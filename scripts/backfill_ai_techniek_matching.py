#!/usr/bin/env python3
"""
Backfill AI Technique Matching for Existing Completed Videos

This script matches existing video transcripts to EPIC sales techniques
WITHOUT re-running the entire video processing pipeline.

It uses the existing embeddings from rag_documents (doc_type='hugo_training')
and matches them against the 49 technique embeddings using cosine similarity.

Usage:
    python3 scripts/backfill_ai_techniek_matching.py [--dry-run] [--limit N]
"""

import os
import sys
import json
import argparse
import numpy as np
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CONFIDENCE_THRESHOLD = 0.30


def cosine_similarity(vec_a, vec_b):
    """Calculate cosine similarity between two vectors."""
    vec_a = np.array(vec_a)
    vec_b = np.array(vec_b)
    
    if vec_a.shape != vec_b.shape:
        return 0.0
    
    dot = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return dot / (norm_a * norm_b)


def get_technique_embeddings():
    """Fetch all technique embeddings from rag_documents."""
    print("Fetching technique embeddings...")
    result = supabase.table('rag_documents').select(
        'id, source_id, embedding'
    ).eq('doc_type', 'techniek').execute()
    
    techniques = []
    for row in result.data:
        if row.get('embedding'):
            embedding = row['embedding']
            if isinstance(embedding, str):
                embedding = json.loads(embedding)
            techniques.append({
                'techniek_id': row['source_id'],
                'embedding': embedding
            })
    
    print(f"Found {len(techniques)} technique embeddings")
    return techniques


def get_hugo_training_embeddings():
    """Fetch all hugo_training embeddings from rag_documents.
    
    Returns dict mapping source_id (e.g. 'MVI_0606.m4a') to embedding.
    """
    print("Fetching hugo_training embeddings...")
    result = supabase.table('rag_documents').select(
        'id, source_id, embedding'
    ).eq('doc_type', 'hugo_training').execute()
    
    embeddings = {}
    for row in result.data:
        if row.get('embedding') and row.get('source_id'):
            embedding = row['embedding']
            if isinstance(embedding, str):
                embedding = json.loads(embedding)
            embeddings[row['source_id']] = {
                'rag_id': row['id'],
                'embedding': embedding
            }
    
    print(f"Found {len(embeddings)} hugo_training embeddings")
    return embeddings


def match_technique(video_embedding, technique_embeddings):
    """Find the best matching technique for a video embedding."""
    best_match = None
    best_score = 0.0
    
    for tech in technique_embeddings:
        score = cosine_similarity(video_embedding, tech['embedding'])
        if score > best_score:
            best_score = score
            best_match = tech['techniek_id']
    
    if best_score >= CONFIDENCE_THRESHOLD:
        return best_match, best_score
    return None, best_score


def get_completed_videos_without_ai_suggestion(limit=None):
    """Get completed videos that don't have AI suggestion yet."""
    print("Fetching completed videos without AI suggestion...")
    
    query = supabase.table('video_ingest_jobs').select(
        'id, video_title, drive_file_name, rag_document_id, ai_suggested_techniek_id'
    ).eq('status', 'completed').is_('ai_suggested_techniek_id', 'null')
    
    if limit:
        query = query.limit(limit)
    
    result = query.execute()
    print(f"Found {len(result.data)} videos to process")
    return result.data


def update_video_ai_suggestion(video_id, techniek_id, confidence, rag_document_id=None):
    """Update video with AI suggestion."""
    update_data = {
        'ai_suggested_techniek_id': techniek_id,
        'ai_confidence': confidence
    }
    if rag_document_id:
        update_data['rag_document_id'] = rag_document_id
    
    supabase.table('video_ingest_jobs').update(update_data).eq('id', video_id).execute()


def main():
    parser = argparse.ArgumentParser(description='Backfill AI technique matching')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--limit', type=int, help='Limit number of videos to process')
    args = parser.parse_args()
    
    print("=" * 60)
    print("AI Technique Matching Backfill v2")
    print("=" * 60)
    
    if args.dry_run:
        print(">>> DRY RUN MODE - No changes will be made <<<\n")
    
    technique_embeddings = get_technique_embeddings()
    if not technique_embeddings:
        print("ERROR: No technique embeddings found. Run generate_techniek_embeddings.py first.")
        sys.exit(1)
    
    hugo_embeddings = get_hugo_training_embeddings()
    if not hugo_embeddings:
        print("ERROR: No hugo_training embeddings found.")
        sys.exit(1)
    
    videos = get_completed_videos_without_ai_suggestion(limit=args.limit)
    if not videos:
        print("\nNo videos found that need AI suggestion. All done!")
        return
    
    matched = 0
    no_match = 0
    no_embedding = 0
    
    for i, video in enumerate(videos, 1):
        title = video.get('video_title') or video.get('drive_file_name') or 'Unknown'
        print(f"\n[{i}/{len(videos)}] Processing: {title[:50]}...")
        
        audio_key = f"{title}.m4a"
        video_key = f"{title}.MP4"
        
        embedding_data = hugo_embeddings.get(audio_key) or hugo_embeddings.get(video_key) or hugo_embeddings.get(title)
        
        if not embedding_data:
            base_name = title.replace('.MP4', '').replace('.m4a', '')
            for key in hugo_embeddings:
                if base_name in key:
                    embedding_data = hugo_embeddings[key]
                    break
        
        if not embedding_data:
            print(f"  ⚠️  No embedding found for '{title}' - skipping")
            no_embedding += 1
            continue
        
        techniek_id, confidence = match_technique(embedding_data['embedding'], technique_embeddings)
        
        if techniek_id:
            print(f"  ✅ Match: {techniek_id} ({confidence:.1%} confidence)")
            matched += 1
            
            if not args.dry_run:
                update_video_ai_suggestion(
                    video['id'], 
                    techniek_id, 
                    confidence,
                    embedding_data['rag_id'] if not video.get('rag_document_id') else None
                )
        else:
            print(f"  ❌ No match (best score: {confidence:.1%} < {CONFIDENCE_THRESHOLD:.0%} threshold)")
            no_match += 1
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total processed: {len(videos)}")
    print(f"Matched:         {matched}")
    print(f"No match:        {no_match}")
    print(f"No embedding:    {no_embedding}")
    
    if args.dry_run:
        print("\n>>> DRY RUN - No changes were made <<<")
        print("Run without --dry-run to apply changes")


if __name__ == '__main__':
    main()
