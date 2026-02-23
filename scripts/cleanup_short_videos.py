#!/usr/bin/env python3
"""
Cleanup script to delete all videos shorter than 30 seconds.
This removes:
1. Records from video_ingest_jobs table
2. Associated Mux assets
3. Associated RAG documents

Usage:
    python scripts/cleanup_short_videos.py --dry-run    # Preview what would be deleted
    python scripts/cleanup_short_videos.py              # Actually delete
"""
import os
import sys
import argparse
import requests

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
MUX_TOKEN_ID = os.environ.get('MUX_TOKEN_ID')
MUX_TOKEN_SECRET = os.environ.get('MUX_TOKEN_SECRET')

MINIMUM_DURATION_SECONDS = 30


def get_short_videos():
    """Get all videos shorter than 30 seconds"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/video_ingest_jobs"
        f"?duration_seconds=lt.{MINIMUM_DURATION_SECONDS}"
        f"&duration_seconds=gt.0"
        f"&status=neq.deleted"
        f"&select=id,drive_file_name,duration_seconds,mux_asset_id,mux_playback_id,status",
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        },
        timeout=30
    )
    
    if resp.status_code != 200:
        print(f"ERROR: Failed to fetch videos: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    return resp.json()


def delete_mux_asset(asset_id):
    """Delete a Mux asset"""
    if not MUX_TOKEN_ID or not MUX_TOKEN_SECRET:
        print(f"  [SKIP] No Mux credentials, cannot delete asset {asset_id}")
        return False
    
    try:
        resp = requests.delete(
            f"https://api.mux.com/video/v1/assets/{asset_id}",
            auth=(MUX_TOKEN_ID, MUX_TOKEN_SECRET),
            timeout=30
        )
        if resp.status_code in [200, 204]:
            return True
        elif resp.status_code == 404:
            print(f"  [INFO] Mux asset {asset_id} already deleted")
            return True
        else:
            print(f"  [ERROR] Failed to delete Mux asset: {resp.status_code}")
            return False
    except Exception as e:
        print(f"  [ERROR] Mux delete failed: {e}")
        return False


def delete_rag_document(job_id):
    """Delete RAG document associated with this video"""
    try:
        resp = requests.delete(
            f"{SUPABASE_URL}/rest/v1/rag_documents?video_job_id=eq.{job_id}",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Prefer': 'return=minimal'
            },
            timeout=10
        )
        return resp.status_code in [200, 204]
    except Exception as e:
        print(f"  [ERROR] RAG delete failed: {e}")
        return False


def mark_video_deleted(job_id):
    """Mark video as deleted in database"""
    try:
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/video_ingest_jobs?id=eq.{job_id}",
            json={
                'status': 'deleted',
                'mux_asset_id': None,
                'mux_playback_id': None
            },
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            timeout=10
        )
        return resp.status_code in [200, 204]
    except Exception as e:
        print(f"  [ERROR] DB update failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Cleanup short videos (< 30 seconds)')
    parser.add_argument('--dry-run', action='store_true', help='Preview only, do not delete')
    args = parser.parse_args()
    
    print(f"{'='*60}")
    print(f"VIDEO CLEANUP: Removing videos < {MINIMUM_DURATION_SECONDS} seconds")
    print(f"Mode: {'DRY RUN (preview only)' if args.dry_run else 'LIVE DELETE'}")
    print(f"{'='*60}")
    print()
    
    videos = get_short_videos()
    
    if not videos:
        print("No short videos found. Nothing to clean up!")
        return
    
    print(f"Found {len(videos)} videos shorter than {MINIMUM_DURATION_SECONDS} seconds:")
    print()
    
    total_deleted = 0
    total_mux_deleted = 0
    total_rag_deleted = 0
    
    for video in videos:
        job_id = video['id']
        name = video.get('drive_file_name', 'Unknown')
        duration = video.get('duration_seconds', 0)
        mux_id = video.get('mux_asset_id')
        status = video.get('status')
        
        print(f"[{job_id}] {name} - {duration}s (status: {status})")
        
        if args.dry_run:
            if mux_id:
                print(f"  Would delete Mux asset: {mux_id}")
            print(f"  Would delete RAG document")
            print(f"  Would mark as deleted")
            total_deleted += 1
            if mux_id:
                total_mux_deleted += 1
            total_rag_deleted += 1
        else:
            # Delete Mux asset if exists
            if mux_id:
                if delete_mux_asset(mux_id):
                    print(f"  [OK] Deleted Mux asset")
                    total_mux_deleted += 1
            
            # Delete RAG document
            if delete_rag_document(job_id):
                print(f"  [OK] Deleted RAG document")
                total_rag_deleted += 1
            
            # Mark as deleted in database
            if mark_video_deleted(job_id):
                print(f"  [OK] Marked as deleted")
                total_deleted += 1
            else:
                print(f"  [FAIL] Could not mark as deleted")
        
        print()
    
    print(f"{'='*60}")
    print(f"SUMMARY:")
    print(f"  Videos processed: {len(videos)}")
    print(f"  Videos {'would be ' if args.dry_run else ''}deleted: {total_deleted}")
    print(f"  Mux assets {'would be ' if args.dry_run else ''}deleted: {total_mux_deleted}")
    print(f"  RAG documents {'would be ' if args.dry_run else ''}deleted: {total_rag_deleted}")
    print(f"{'='*60}")
    
    if args.dry_run:
        print()
        print("This was a DRY RUN. To actually delete, run without --dry-run flag.")


if __name__ == '__main__':
    main()
