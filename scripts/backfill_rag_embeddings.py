#!/usr/bin/env python3
"""
Backfill RAG Embeddings for Videos with Transcripts

This script generates OpenAI embeddings for videos that have transcripts but no RAG document yet.
It queries video_ingest_jobs for completed videos, generates embeddings using the OpenAI
text-embedding-3-small model, and stores them in the rag_documents table.

Usage:
    python3 scripts/backfill_rag_embeddings.py [--dry-run] [--limit N]

Environment variables required:
    - OPENAI_API_KEY
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
import argparse
from openai import OpenAI
from supabase import create_client

EMBEDDING_MODEL = "text-embedding-3-small"

supabase = None
openai_client = None


def init_clients():
    """Initialize Supabase and OpenAI clients."""
    global supabase, openai_client
    
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    if not openai_key:
        raise ValueError("OPENAI_API_KEY must be set")
    
    supabase = create_client(supabase_url, supabase_key)
    openai_client = OpenAI(api_key=openai_key)
    
    print("✓ Clients initialized")


def get_videos_needing_embeddings(limit=None):
    """
    Query video_ingest_jobs for completed videos with transcript but no rag_document_id.
    
    Returns:
        list: Video records with id, video_title, transcript, drive_file_name
    """
    print("Fetching completed videos with transcripts but no RAG document...")
    
    query = supabase.table('video_ingest_jobs').select(
        'id, video_title, transcript, drive_file_name, status'
    ).eq('status', 'completed').is_('rag_document_id', 'null').neq('transcript', '')
    
    if limit:
        query = query.limit(limit)
    
    result = query.execute()
    
    videos = []
    for row in result.data:
        if row.get('transcript') and row.get('transcript').strip():
            videos.append(row)
    
    print(f"Found {len(videos)} videos to process")
    return videos


def generate_embedding(text):
    """
    Generate embedding for text using OpenAI.
    
    Args:
        text: Text to embed
        
    Returns:
        list: Embedding vector
    """
    try:
        response = openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding
    except Exception as e:
        raise RuntimeError(f"Failed to generate embedding: {str(e)}")


def insert_rag_document(video_id, source_id, content, embedding):
    """
    Insert RAG document into rag_documents table and return the new ID.
    
    Args:
        video_id: video_ingest_jobs ID (for reference only)
        source_id: video_title (e.g., "MVI_0737")
        content: transcript text
        embedding: OpenAI embedding vector
        
    Returns:
        UUID: ID of the newly created rag_document
    """
    record = {
        "doc_type": "hugo_training",
        "source_id": source_id,
        "title": f"Video: {source_id}",
        "content": content,
        "embedding": embedding,
        "word_count": len(content.split()),
    }
    
    result = supabase.table("rag_documents").insert(record).execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]['id']
    else:
        raise RuntimeError(f"Failed to insert RAG document for {source_id}")


def update_video_rag_id(video_id, rag_document_id):
    """
    Update video_ingest_jobs with the new rag_document_id.
    
    Args:
        video_id: video_ingest_jobs ID
        rag_document_id: new rag_documents ID
    """
    supabase.table('video_ingest_jobs').update({
        'rag_document_id': rag_document_id
    }).eq('id', video_id).execute()


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Backfill RAG embeddings for video transcripts')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--limit', type=int, help='Limit number of videos to process')
    args = parser.parse_args()
    
    print("=" * 70)
    print("RAG Embeddings Backfill")
    print("=" * 70)
    
    if args.dry_run:
        print(">>> DRY RUN MODE - No changes will be made <<<\n")
    
    try:
        init_clients()
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    
    videos = get_videos_needing_embeddings(limit=args.limit)
    
    if not videos:
        print("\nNo videos found needing embeddings. All done!")
        return
    
    print(f"\nProcessing {len(videos)} videos...\n")
    print("-" * 70)
    
    processed = 0
    errors = 0
    
    for i, video in enumerate(videos, 1):
        video_id = video['id']
        source_id = video.get('video_title') or video.get('drive_file_name') or 'Unknown'
        transcript = video.get('transcript', '').strip()
        
        print(f"\n[{i}/{len(videos)}] {source_id[:50]}...", end=" ", flush=True)
        
        if not transcript:
            print("⚠️  SKIP (no transcript)")
            continue
        
        try:
            print("generating embedding...", end=" ", flush=True)
            embedding = generate_embedding(transcript)
            
            if args.dry_run:
                print(f"✓ (dry-run, would insert)")
                processed += 1
            else:
                print("inserting RAG doc...", end=" ", flush=True)
                rag_doc_id = insert_rag_document(video_id, source_id, transcript, embedding)
                
                print("updating video...", end=" ", flush=True)
                update_video_rag_id(video_id, rag_doc_id)
                
                print("✓")
                processed += 1
            
            time.sleep(0.1)
            
        except Exception as e:
            print(f"✗ ERROR: {str(e)[:60]}")
            errors += 1
            continue
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total processed: {len(videos)}")
    print(f"Success:         {processed}")
    print(f"Errors:          {errors}")
    
    if args.dry_run:
        print("\n>>> DRY RUN - No changes were made <<<")
        print("Run without --dry-run to apply changes")
    
    if errors > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
