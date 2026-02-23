#!/usr/bin/env python3
"""
Build RAG corpus by linking transcripts to EPIC techniques.
Uses technieken_catalog.json as single source of truth.

Usage:
    python scripts/build_rag_corpus.py
"""

import os
import json
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    os.system("pip install supabase")
    from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

TECHNIEKEN_FILE = Path("src/data/technieken_catalog.json")
OUTPUT_DIR = Path("data/rag")
CORPUS_FILE = OUTPUT_DIR / "epic_rag_corpus.json"
EMBEDDINGS_READY_FILE = OUTPUT_DIR / "documents_for_embedding.jsonl"


def load_technieken():
    """Load EPIC techniques from single source of truth."""
    with open(TECHNIEKEN_FILE, "r", encoding="utf-8") as f:
        techniques = json.load(f)
    
    technique_map = {}
    for t in techniques:
        nummer = t.get("nummer")
        if nummer:
            technique_map[nummer] = {
                "nummer": nummer,
                "naam": t.get("naam"),
                "fase": t.get("fase"),
                "parent": t.get("parent"),
                "wat": t.get("wat"),
                "waarom": t.get("waarom"),
                "wanneer": t.get("wanneer"),
                "hoe": t.get("hoe"),
                "voorbeeld": t.get("voorbeeld"),
                "ai_eval_points": t.get("ai_eval_points"),
            }
    
    return technique_map


def fetch_transcripts():
    """Fetch all completed transcripts from Supabase."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    result = supabase.table("roleplay_uploads") \
        .select("id, file_name, title, transcript_text, techniek_id, fase") \
        .eq("status", "completed") \
        .not_.is_("transcript_text", "null") \
        .order("file_name") \
        .execute()
    return result.data


def build_rag_documents(transcripts, techniques):
    """
    Build RAG-ready documents combining transcripts with technique metadata.
    Creates multiple document types for different retrieval needs.
    """
    documents = []
    
    for t in transcripts:
        transcript_text = t["transcript_text"]
        techniek_id = t.get("techniek_id")
        
        doc = {
            "id": t["id"],
            "type": "hugo_training",
            "source": t["file_name"],
            "title": t.get("title") or t["file_name"],
            "content": transcript_text,
            "word_count": len(transcript_text.split()),
            "techniek": None,
        }
        
        if techniek_id and techniek_id in techniques:
            tech = techniques[techniek_id]
            doc["techniek"] = {
                "nummer": tech["nummer"],
                "naam": tech["naam"],
                "fase": tech["fase"],
                "parent": tech.get("parent"),
            }
        
        documents.append(doc)
    
    for nummer, tech in techniques.items():
        if not tech.get("wat"):
            continue
        
        technique_text = f"""EPIC Techniek {tech['nummer']}: {tech['naam']}

Fase: {tech['fase']}
{f"Parent: {tech['parent']}" if tech.get('parent') else ""}

WAT: {tech.get('wat', '')}

WAAROM: {tech.get('waarom', '')}

WANNEER: {tech.get('wanneer', '')}

HOE: {tech.get('hoe', '')}

VOORBEELD: {json.dumps(tech.get('voorbeeld', []), ensure_ascii=False) if tech.get('voorbeeld') else ''}
"""
        
        documents.append({
            "id": f"techniek_{nummer}",
            "type": "epic_techniek",
            "source": "technieken_catalog.json",
            "title": f"{tech['nummer']} - {tech['naam']}",
            "content": technique_text.strip(),
            "word_count": len(technique_text.split()),
            "techniek": {
                "nummer": tech["nummer"],
                "naam": tech["naam"],
                "fase": tech["fase"],
                "parent": tech.get("parent"),
            },
        })
    
    return documents


def export_for_embeddings(documents):
    """Export documents in JSONL format ready for embedding generation."""
    with open(EMBEDDINGS_READY_FILE, "w", encoding="utf-8") as f:
        for doc in documents:
            line = json.dumps({
                "id": doc["id"],
                "type": doc["type"],
                "title": doc["title"],
                "content": doc["content"],
                "metadata": {
                    "source": doc["source"],
                    "word_count": doc["word_count"],
                    "techniek": doc.get("techniek"),
                }
            }, ensure_ascii=False)
            f.write(line + "\n")


def main():
    print("=" * 60)
    print("EPIC RAG Corpus Builder")
    print("=" * 60)
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Supabase credentials required")
        return
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("\n1. Laden technieken uit technieken_catalog.json...")
    techniques = load_technieken()
    print(f"   Gevonden: {len(techniques)} technieken")
    
    techniques_with_details = sum(1 for t in techniques.values() if t.get("wat"))
    print(f"   Met wat/waarom/hoe: {techniques_with_details} technieken")
    
    print("\n2. Ophalen transcripts uit Supabase...")
    transcripts = fetch_transcripts()
    print(f"   Gevonden: {len(transcripts)} voltooide transcripts")
    
    print("\n3. Bouwen RAG documents...")
    documents = build_rag_documents(transcripts, techniques)
    
    hugo_docs = [d for d in documents if d["type"] == "hugo_training"]
    tech_docs = [d for d in documents if d["type"] == "epic_techniek"]
    
    print(f"   Hugo training docs: {len(hugo_docs)}")
    print(f"   EPIC techniek docs: {len(tech_docs)}")
    print(f"   Totaal: {len(documents)}")
    
    print("\n4. Exporteren...")
    
    with open(CORPUS_FILE, "w", encoding="utf-8") as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)
    print(f"   JSON corpus: {CORPUS_FILE}")
    
    export_for_embeddings(documents)
    print(f"   Embeddings JSONL: {EMBEDDINGS_READY_FILE}")
    
    total_words = sum(d["word_count"] for d in documents)
    
    print("\n" + "=" * 60)
    print("KLAAR!")
    print("=" * 60)
    print(f"Totaal documents: {len(documents)}")
    print(f"Totaal woorden: {total_words:,}")
    print(f"\nBestanden:")
    print(f"  - {CORPUS_FILE}")
    print(f"  - {EMBEDDINGS_READY_FILE}")
    print(f"\nVolgende stap: embeddings genereren en opslaan in pgvector")


if __name__ == "__main__":
    main()
