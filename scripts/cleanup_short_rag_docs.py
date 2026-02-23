#!/usr/bin/env python3
"""
Cleanup Short RAG Documents

Removes RAG documents with very short content (less than 50 words).
These are typically test clips or fragments that add noise to the RAG system.

Usage:
    python3 scripts/cleanup_short_rag_docs.py [--dry-run] [--min-words N]
"""

import os
import sys
import argparse
from supabase import create_client

MINIMUM_WORD_COUNT = 50

supabase = None


def init_supabase():
    global supabase
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    
    supabase = create_client(url, key)
    print("✓ Supabase connected")


def get_short_rag_documents(min_words):
    """Find RAG documents with fewer than min_words words."""
    print(f"Finding RAG documents with fewer than {min_words} words...")
    
    result = supabase.table('rag_documents').select(
        'id, source_id, title, word_count, content'
    ).lt('word_count', min_words).execute()
    
    docs = result.data
    print(f"Found {len(docs)} short documents")
    return docs


def delete_rag_document(doc_id):
    """Delete a RAG document by ID."""
    result = supabase.table('rag_documents').delete().eq('id', doc_id).execute()
    
    if hasattr(result, 'error') and result.error:
        raise RuntimeError(f"Delete failed: {result.error}")


def unlink_video_rag_id(source_id):
    """Remove rag_document_id from video_ingest_jobs matching this source."""
    supabase.table('video_ingest_jobs').update({
        'rag_document_id': None
    }).or_(f"video_title.eq.{source_id},drive_file_name.eq.{source_id}").execute()


def main():
    parser = argparse.ArgumentParser(description='Cleanup short RAG documents')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted')
    parser.add_argument('--min-words', type=int, default=MINIMUM_WORD_COUNT, help=f'Minimum word count (default: {MINIMUM_WORD_COUNT})')
    args = parser.parse_args()
    
    print("=" * 70)
    print("RAG Cleanup - Remove Short Documents")
    print("=" * 70)
    
    if args.dry_run:
        print(">>> DRY RUN MODE <<<\n")
    
    try:
        init_supabase()
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    
    docs = get_short_rag_documents(args.min_words)
    
    if not docs:
        print("\nNo short documents found!")
        return
    
    print(f"\nDocuments to remove ({len(docs)}):\n")
    print("-" * 70)
    
    for doc in docs[:20]:
        content_preview = (doc.get('content') or '')[:60].replace('\n', ' ')
        print(f"  {doc['source_id']}: {doc['word_count']} words - \"{content_preview}...\"")
    
    if len(docs) > 20:
        print(f"  ... and {len(docs) - 20} more")
    
    print("-" * 70)
    
    if args.dry_run:
        print(f"\n>>> Would delete {len(docs)} documents <<<")
        print("Run without --dry-run to apply")
        return
    
    deleted = 0
    errors = 0
    
    for doc in docs:
        try:
            delete_rag_document(doc['id'])
            deleted += 1
        except Exception as e:
            print(f"Error deleting {doc['source_id']}: {e}")
            errors += 1
    
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)
    print(f"Deleted: {deleted}")
    print(f"Errors:  {errors}")


if __name__ == '__main__':
    main()
