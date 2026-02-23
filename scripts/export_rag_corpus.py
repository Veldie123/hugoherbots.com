#!/usr/bin/env python3
"""
Export RAG Corpus to JSON for AI Chat Integration

Exports all RAG documents (video transcripts with embeddings) to a JSON file
that can be imported into another Replit for AI chat functionality.

Usage:
    python3 scripts/export_rag_corpus.py [--with-embeddings] [--output FILE]

Output includes:
    - All video transcripts
    - Metadata (title, source, word count, technique ID)
    - Optionally embeddings (for direct pgvector import)

Environment variables required:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path
from supabase import create_client

OUTPUT_DIR = Path("exports")


def init_supabase():
    """Initialize Supabase client."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    
    return create_client(url, key)


def export_rag_corpus(supabase, with_embeddings=False):
    """
    Export all RAG documents from Supabase.
    
    Returns list of documents with content and optional embeddings.
    """
    print("Fetching RAG documents from Supabase...")
    
    if with_embeddings:
        select_fields = 'id, doc_type, source_id, title, content, embedding, word_count, created_at'
    else:
        select_fields = 'id, doc_type, source_id, title, content, word_count, created_at'
    
    result = supabase.table('rag_documents').select(select_fields).execute()
    
    documents = result.data
    print(f"Found {len(documents)} RAG documents")
    
    return documents


def get_video_metadata(supabase):
    """
    Get video metadata to enrich exports with technique info.
    """
    print("Fetching video metadata...")
    
    result = supabase.table('video_ingest_jobs').select(
        'video_title, drive_file_name, fase, techniek_id, ai_suggested_techniek_id, duration_seconds, rag_document_id'
    ).not_.is_('rag_document_id', 'null').execute()
    
    metadata = {}
    for v in result.data:
        source = v.get('video_title') or v.get('drive_file_name')
        metadata[source] = {
            'fase': v.get('fase'),
            'techniek_id': v.get('techniek_id'),
            'ai_suggested_techniek_id': v.get('ai_suggested_techniek_id'),
            'duration_seconds': v.get('duration_seconds'),
        }
    
    return metadata


def main():
    parser = argparse.ArgumentParser(description='Export RAG corpus for AI chat integration')
    parser.add_argument('--with-embeddings', action='store_true', help='Include embeddings in export')
    parser.add_argument('--output', type=str, help='Output file path')
    args = parser.parse_args()
    
    print("=" * 70)
    print("RAG Corpus Export")
    print("=" * 70)
    
    try:
        supabase = init_supabase()
        print("✓ Supabase connected")
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    
    documents = export_rag_corpus(supabase, with_embeddings=args.with_embeddings)
    
    if not documents:
        print("No RAG documents found!")
        return
    
    video_metadata = get_video_metadata(supabase)
    
    enriched_docs = []
    for doc in documents:
        source_id = doc.get('source_id', '')
        
        entry = {
            'id': doc['id'],
            'doc_type': doc['doc_type'],
            'source_id': source_id,
            'title': doc['title'],
            'content': doc['content'],
            'word_count': doc.get('word_count', len(doc['content'].split())),
            'created_at': doc.get('created_at'),
        }
        
        if source_id in video_metadata:
            entry['metadata'] = video_metadata[source_id]
        
        if args.with_embeddings and 'embedding' in doc:
            entry['embedding'] = doc['embedding']
        
        enriched_docs.append(entry)
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if args.output:
        output_file = Path(args.output)
    else:
        suffix = '_with_embeddings' if args.with_embeddings else ''
        output_file = OUTPUT_DIR / f"rag_corpus{suffix}_{timestamp}.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'export_timestamp': datetime.now().isoformat(),
            'total_documents': len(enriched_docs),
            'total_words': sum(d['word_count'] for d in enriched_docs),
            'includes_embeddings': args.with_embeddings,
            'documents': enriched_docs
        }, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 70)
    print("EXPORT COMPLETE")
    print("=" * 70)
    print(f"Output file: {output_file}")
    print(f"Documents:   {len(enriched_docs)}")
    print(f"Total words: {sum(d['word_count'] for d in enriched_docs):,}")
    print(f"Embeddings:  {'Yes' if args.with_embeddings else 'No'}")
    print(f"\nFile size:   {output_file.stat().st_size / 1024:.1f} KB")
    
    by_type = {}
    for d in enriched_docs:
        t = d['doc_type']
        by_type[t] = by_type.get(t, 0) + 1
    
    print("\nBy type:")
    for t, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  - {t}: {count}")


if __name__ == '__main__':
    main()
