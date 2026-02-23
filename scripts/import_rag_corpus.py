#!/usr/bin/env python3
"""
Import RAG corpus from CSV and generate embeddings using OpenAI.
Stores the data in the rag_documents table with pgvector embeddings.
"""

import os
import csv
import time
import psycopg2
from openai import OpenAI

DATABASE_URL = os.environ.get("DATABASE_URL")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
BATCH_SIZE = 20

def get_embedding(text: str) -> list[float]:
    """Generate embedding for a single text using OpenAI."""
    text = text.replace("\n", " ").strip()
    if not text:
        return [0.0] * EMBEDDING_DIMENSIONS
    
    response = client.embeddings.create(
        input=text,
        model=EMBEDDING_MODEL
    )
    return response.data[0].embedding

def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts."""
    cleaned = [t.replace("\n", " ").strip() if t else "" for t in texts]
    non_empty = [(i, t) for i, t in enumerate(cleaned) if t]
    
    if not non_empty:
        return [[0.0] * EMBEDDING_DIMENSIONS] * len(texts)
    
    response = client.embeddings.create(
        input=[t for _, t in non_empty],
        model=EMBEDDING_MODEL
    )
    
    result = [[0.0] * EMBEDDING_DIMENSIONS] * len(texts)
    for idx, (original_idx, _) in enumerate(non_empty):
        result[original_idx] = response.data[idx].embedding
    
    return result

def main():
    csv_path = "attached_assets/rag_corpus_export_(1)_1769049659932.csv"
    
    print(f"Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("DELETE FROM rag_documents")
    conn.commit()
    print("Cleared existing rag_documents")
    
    print(f"Reading CSV from {csv_path}...")
    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    
    print(f"Found {len(rows)} rows to process")
    
    total_processed = 0
    total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for batch_num in range(total_batches):
        start_idx = batch_num * BATCH_SIZE
        end_idx = min(start_idx + BATCH_SIZE, len(rows))
        batch = rows[start_idx:end_idx]
        
        texts_to_embed = []
        for row in batch:
            text = f"{row.get('title', '')} {row.get('content', '')}".strip()
            texts_to_embed.append(text)
        
        print(f"Generating embeddings for batch {batch_num + 1}/{total_batches} ({len(batch)} items)...")
        
        try:
            embeddings = get_embeddings_batch(texts_to_embed)
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            time.sleep(5)
            embeddings = get_embeddings_batch(texts_to_embed)
        
        for i, row in enumerate(batch):
            embedding = embeddings[i]
            content = row.get('content', '')
            word_count = len(content.split()) if content else 0
            
            techniek_id = row.get('techniek_id', '')
            fase = techniek_id.split('.')[0] if techniek_id and '.' in techniek_id else techniek_id
            
            cur.execute("""
                INSERT INTO rag_documents 
                (id, doc_type, source_id, title, content, techniek_id, fase, categorie, embedding, word_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                row.get('id'),
                row.get('doc_type', 'unknown'),
                row.get('source_id', ''),
                row.get('title', ''),
                content,
                techniek_id,
                fase,
                '',
                embedding,
                word_count
            ))
        
        conn.commit()
        total_processed += len(batch)
        print(f"  Inserted {total_processed}/{len(rows)} documents")
        
        time.sleep(0.5)
    
    cur.execute("SELECT COUNT(*) FROM rag_documents")
    final_count = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM rag_documents WHERE embedding IS NOT NULL")
    with_embeddings = cur.fetchone()[0]
    
    print(f"\n=== Import Complete ===")
    print(f"Total documents: {final_count}")
    print(f"With embeddings: {with_embeddings}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
