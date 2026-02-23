#!/usr/bin/env python3
"""
Generate OpenAI embeddings for all techniques and store in Supabase.
These embeddings are used to auto-match video transcripts to techniques.

Usage:
    python scripts/generate_techniek_embeddings.py
"""

import json
import os
import time
from pathlib import Path

from openai import OpenAI
from supabase import create_client

TECHNIEKEN_PATH = Path("src/data/technieken_index.json")
EMBEDDING_MODEL = "text-embedding-3-small"

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
    
    print("✓ Clients geïnitialiseerd")


def load_techniques():
    """Load techniques from JSON file."""
    if not TECHNIEKEN_PATH.exists():
        raise FileNotFoundError(f"Technieken niet gevonden: {TECHNIEKEN_PATH}")
    
    with open(TECHNIEKEN_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    techniques = data.get("technieken", {})
    non_fase_techniques = [t for t in techniques.values() if not t.get("is_fase")]
    
    return non_fase_techniques


def create_technique_text(technique: dict) -> str:
    """Create combined text for embedding from technique fields."""
    parts = []
    
    if technique.get("naam"):
        parts.append(f"Techniek: {technique['naam']}")
    
    if technique.get("doel"):
        parts.append(f"Doel: {technique['doel']}")
    
    if technique.get("wat"):
        parts.append(f"Wat: {technique['wat']}")
    
    if technique.get("waarom"):
        parts.append(f"Waarom: {technique['waarom']}")
    
    if technique.get("wanneer"):
        parts.append(f"Wanneer: {technique['wanneer']}")
    
    if technique.get("hoe"):
        parts.append(f"Hoe: {technique['hoe']}")
    
    if technique.get("tags"):
        parts.append(f"Tags: {', '.join(technique['tags'])}")
    
    return "\n".join(parts)


def generate_embedding(text: str) -> list[float]:
    """Generate embedding for text using OpenAI."""
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding


def store_techniek_embedding(technique: dict, embedding: list[float], text: str):
    """Store or update technique embedding in rag_documents table with doc_type='techniek'."""
    nummer = technique.get("nummer")
    naam = technique.get("naam")
    fase = technique.get("fase")
    
    source_id = f"techniek_{nummer}"
    
    record = {
        "doc_type": "techniek",
        "source_id": source_id,
        "title": f"{nummer} - {naam}",
        "content": text,
        "techniek_id": nummer,
        "fase": fase,
        "embedding": embedding,
        "word_count": len(text.split()),
    }
    
    existing = supabase.table("rag_documents").select("id").eq("source_id", source_id).execute()
    
    if existing.data:
        supabase.table("rag_documents").update(record).eq("id", existing.data[0]["id"]).execute()
        return "updated"
    else:
        supabase.table("rag_documents").insert(record).execute()
        return "inserted"


def main():
    """Main function."""
    print("=" * 60)
    print("Techniek Embeddings Generator")
    print("=" * 60)
    
    try:
        init_clients()
    except ValueError as e:
        print(f"FOUT: {e}")
        return
    
    print(f"\nTechnieken laden: {TECHNIEKEN_PATH}")
    techniques = load_techniques()
    print(f"Gevonden: {len(techniques)} technieken (excl. fases)")
    
    print("\n" + "-" * 60)
    processed = 0
    errors = 0
    
    for i, technique in enumerate(techniques):
        nummer = technique.get("nummer", "?")
        naam = technique.get("naam", "Onbekend")[:40]
        
        try:
            print(f"[{i+1}/{len(techniques)}] {nummer} - {naam}...", end=" ", flush=True)
            
            text = create_technique_text(technique)
            embedding = generate_embedding(text)
            action = store_techniek_embedding(technique, embedding, text)
            
            print(f"({action})")
            processed += 1
            
            if (i + 1) % 10 == 0:
                time.sleep(0.3)
                
        except Exception as e:
            errors += 1
            print(f"FOUT: {e}")
    
    print("\n" + "=" * 60)
    print(f"Klaar! Verwerkt: {processed}, Fouten: {errors}")
    print("=" * 60)


if __name__ == "__main__":
    main()
