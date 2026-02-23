#!/usr/bin/env python3
"""
Generate OpenAI embeddings for RAG documents and store in Supabase pgvector.

Usage:
    python scripts/generate_embeddings.py
"""

import json
import os
import time
from pathlib import Path

from openai import OpenAI
from supabase import create_client

CORPUS_PATH = Path("data/rag/epic_rag_corpus.json")
EMBEDDING_MODEL = "text-embedding-3-small"
BATCH_SIZE = 50

supabase = None
openai_client = None


def init_clients():
    """Initialize Supabase and OpenAI clients."""
    global supabase, openai_client
    
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("Openai_API")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY vereist")
    if not openai_key:
        raise ValueError("OPENAI_API_KEY vereist")
    
    supabase = create_client(supabase_url, supabase_key)
    openai_client = OpenAI(api_key=openai_key)
    
    print("Clients geinitialiseerd")


def load_corpus():
    """Load the RAG corpus from JSON file."""
    if not CORPUS_PATH.exists():
        raise FileNotFoundError(f"Corpus niet gevonden: {CORPUS_PATH}")
    
    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    return data


def generate_embedding(text: str) -> list[float]:
    """Generate embedding for a single text using OpenAI."""
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding


def process_documents(documents: list[dict]):
    """Process all documents: generate embeddings and upsert to Supabase."""
    total = len(documents)
    processed = 0
    errors = 0
    
    for i, doc in enumerate(documents):
        try:
            print(f"[{i+1}/{total}] {doc['title'][:50]}...", end=" ", flush=True)
            
            embedding = generate_embedding(doc["content"])
            
            source_id = doc.get("source") or doc.get("id")
            
            record = {
                "doc_type": doc["type"],
                "source_id": source_id,
                "title": doc["title"],
                "content": doc["content"],
                "techniek_id": doc.get("techniek"),
                "fase": doc.get("fase"),
                "categorie": doc.get("categorie"),
                "embedding": embedding,
                "word_count": doc.get("word_count"),
            }
            
            existing = supabase.table("rag_documents").select("id").eq("source_id", source_id).execute()
            
            if existing.data:
                supabase.table("rag_documents").update(record).eq("id", existing.data[0]["id"]).execute()
                print("(updated)", flush=True)
            else:
                supabase.table("rag_documents").insert(record).execute()
                print("(inserted)", flush=True)
            
            processed += 1
            
            if (i + 1) % 10 == 0:
                time.sleep(0.5)
                
        except Exception as e:
            errors += 1
            print(f"FOUT: {e}", flush=True)
    
    return processed, errors


def main():
    """Main function."""
    print("=" * 60)
    print("RAG Embeddings Generator")
    print("=" * 60)
    
    try:
        init_clients()
    except ValueError as e:
        print(f"FOUT: {e}")
        return
    
    print(f"\nCorpus laden: {CORPUS_PATH}")
    documents = load_corpus()
    print(f"Gevonden: {len(documents)} documents")
    
    print(f"\nEmbeddings genereren met {EMBEDDING_MODEL}...")
    print("-" * 60)
    
    processed, errors = process_documents(documents)
    
    print("-" * 60)
    print(f"\nKLAAR!")
    print(f"Verwerkt: {processed}")
    print(f"Fouten: {errors}")
    
    result = supabase.table("rag_documents").select("id").execute()
    print(f"Totaal in database: {len(result.data)} documents")


if __name__ == "__main__":
    main()
