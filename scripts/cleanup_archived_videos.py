#!/usr/bin/env python3
"""
Cleanup Archived Videos for HugoHerbots.ai

This script removes Mux assets and RAG documents for archived videos,
while preserving transcripts for tone-of-voice training.

Usage:
    python scripts/cleanup_archived_videos.py --dry-run    # Preview what will be deleted
    python scripts/cleanup_archived_videos.py              # Execute the cleanup
    python scripts/cleanup_archived_videos.py --folder-id FOLDER_ID  # Clean specific folder
"""

import argparse
import os
import sys

import mux_python
from mux_python.rest import ApiException
from supabase import create_client

ARCHIEF_FOLDER_ID = "1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq"


def init_clients():
    """Initialize Supabase and Mux clients."""
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    mux_token_id = os.environ.get("MUX_TOKEN_ID")
    mux_token_secret = os.environ.get("MUX_TOKEN_SECRET")
    
    if not supabase_url or not supabase_key:
        print("❌ SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY vereist")
        sys.exit(1)
    
    if not mux_token_id or not mux_token_secret:
        print("❌ MUX_TOKEN_ID en MUX_TOKEN_SECRET vereist")
        sys.exit(1)
    
    supabase = create_client(supabase_url, supabase_key)
    
    mux_config = mux_python.Configuration()
    mux_config.username = mux_token_id
    mux_config.password = mux_token_secret
    mux_client = mux_python.ApiClient(mux_config)
    mux_assets_api = mux_python.AssetsApi(mux_client)
    
    print("✓ Clients geïnitialiseerd")
    return supabase, mux_assets_api


def get_archived_videos(supabase, folder_id=None):
    """Get all archived videos that need cleanup."""
    query = supabase.table("video_ingest_jobs").select(
        "id, drive_file_name, mux_asset_id, mux_playback_id, rag_document_id, transcript"
    )
    
    if folder_id:
        query = query.eq("drive_folder_id", folder_id)
    else:
        try:
            query = query.eq("is_archived", True)
        except:
            query = query.eq("drive_folder_id", ARCHIEF_FOLDER_ID)
    
    result = query.execute()
    return result.data or []


def delete_mux_asset(mux_api, asset_id: str, dry_run: bool) -> bool:
    """Delete a Mux asset."""
    if dry_run:
        print(f"    [DRY-RUN] Zou Mux asset verwijderen: {asset_id}")
        return True
    
    try:
        mux_api.delete_asset(asset_id)
        print(f"    ✓ Mux asset verwijderd: {asset_id}")
        return True
    except ApiException as e:
        if e.status == 404:
            print(f"    ⚠ Mux asset niet gevonden (al verwijderd?): {asset_id}")
            return True
        print(f"    ❌ Mux asset verwijderen mislukt: {e}")
        return False


def delete_rag_document(supabase, rag_id: str, dry_run: bool) -> bool:
    """Delete a RAG document."""
    if dry_run:
        print(f"    [DRY-RUN] Zou RAG document verwijderen: {rag_id}")
        return True
    
    try:
        supabase.table("rag_documents").delete().eq("id", rag_id).execute()
        print(f"    ✓ RAG document verwijderd: {rag_id}")
        return True
    except Exception as e:
        print(f"    ❌ RAG document verwijderen mislukt: {e}")
        return False


def clear_mux_fields(supabase, job_id: str, dry_run: bool) -> bool:
    """Clear mux_asset_id and mux_playback_id from the job."""
    if dry_run:
        print(f"    [DRY-RUN] Zou Mux velden clearen voor job: {job_id}")
        return True
    
    try:
        supabase.table("video_ingest_jobs").update({
            "mux_asset_id": None,
            "mux_playback_id": None,
            "rag_document_id": None
        }).eq("id", job_id).execute()
        print(f"    ✓ Mux/RAG velden gecleared voor job: {job_id}")
        return True
    except Exception as e:
        print(f"    ❌ Velden clearen mislukt: {e}")
        return False


def cleanup_archived_videos(dry_run: bool = True, folder_id: str = None):
    """Main cleanup function."""
    print("=" * 60)
    print("ARCHIEF VIDEO CLEANUP")
    print("=" * 60)
    
    if dry_run:
        print("\n⚠️  DRY-RUN MODUS - Geen wijzigingen worden gemaakt\n")
    else:
        print("\n🔴 LIVE MODUS - Wijzigingen worden uitgevoerd!\n")
    
    supabase, mux_api = init_clients()
    
    folder_id = folder_id or ARCHIEF_FOLDER_ID
    print(f"📁 Folder ID: {folder_id}")
    
    videos = get_archived_videos(supabase, folder_id)
    print(f"\n📋 Gevonden: {len(videos)} gearchiveerde video's\n")
    
    if not videos:
        print("Geen gearchiveerde video's om te cleanen.")
        return
    
    stats = {
        "total": len(videos),
        "mux_deleted": 0,
        "rag_deleted": 0,
        "fields_cleared": 0,
        "has_transcript": 0,
        "errors": 0
    }
    
    for i, video in enumerate(videos, 1):
        job_id = video["id"]
        file_name = video.get("drive_file_name", "onbekend")
        mux_asset_id = video.get("mux_asset_id")
        rag_document_id = video.get("rag_document_id")
        has_transcript = bool(video.get("transcript"))
        
        print(f"\n[{i}/{len(videos)}] {file_name}")
        print(f"  Job ID: {job_id}")
        
        if has_transcript:
            stats["has_transcript"] += 1
            print(f"  📝 Transcript behouden voor tone-of-voice training")
        
        success = True
        
        if mux_asset_id:
            if delete_mux_asset(mux_api, mux_asset_id, dry_run):
                stats["mux_deleted"] += 1
            else:
                success = False
        else:
            print("  ℹ️  Geen Mux asset om te verwijderen")
        
        if rag_document_id:
            if delete_rag_document(supabase, rag_document_id, dry_run):
                stats["rag_deleted"] += 1
            else:
                success = False
        else:
            print("  ℹ️  Geen RAG document om te verwijderen")
        
        if mux_asset_id or rag_document_id:
            if clear_mux_fields(supabase, job_id, dry_run):
                stats["fields_cleared"] += 1
            else:
                success = False
        
        if not success:
            stats["errors"] += 1
    
    print("\n" + "=" * 60)
    print("SAMENVATTING")
    print("=" * 60)
    print(f"Totaal gearchiveerde video's: {stats['total']}")
    print(f"Mux assets verwijderd:        {stats['mux_deleted']}")
    print(f"RAG documenten verwijderd:    {stats['rag_deleted']}")
    print(f"Database velden gecleared:    {stats['fields_cleared']}")
    print(f"Transcripts behouden:         {stats['has_transcript']}")
    print(f"Fouten:                       {stats['errors']}")
    
    if dry_run:
        print("\n⚠️  Dit was een DRY-RUN. Voer zonder --dry-run uit om wijzigingen door te voeren.")
    else:
        print("\n✅ Cleanup voltooid!")


def main():
    parser = argparse.ArgumentParser(description="Cleanup archived videos")
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Preview what will be deleted without making changes"
    )
    parser.add_argument(
        "--folder-id",
        type=str,
        default=ARCHIEF_FOLDER_ID,
        help=f"Google Drive folder ID to clean (default: {ARCHIEF_FOLDER_ID})"
    )
    args = parser.parse_args()
    
    cleanup_archived_videos(dry_run=args.dry_run, folder_id=args.folder_id)


if __name__ == "__main__":
    main()
