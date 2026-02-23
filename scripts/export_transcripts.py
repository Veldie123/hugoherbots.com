#!/usr/bin/env python3
"""
Export all transcripts from Supabase to local files for RAG model building.
Creates individual files and a combined corpus.

Usage:
    python scripts/export_transcripts.py
"""

import os
import json
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("Installing supabase...")
    os.system("pip install supabase")
    from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

OUTPUT_DIR = Path("data/transcripts")
CORPUS_FILE = OUTPUT_DIR / "hugo_training_corpus.json"
COMBINED_FILE = OUTPUT_DIR / "hugo_combined_transcripts.txt"


def main():
    print("=" * 60)
    print("Hugo Transcripts Export")
    print("=" * 60)
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist")
        return
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("\nTranscripts ophalen uit Supabase...")
    result = supabase.table("roleplay_uploads") \
        .select("id, file_name, title, transcript_text, techniek_id, fase") \
        .eq("status", "completed") \
        .not_.is_("transcript_text", "null") \
        .order("file_name") \
        .execute()
    
    transcripts = result.data
    print(f"Gevonden: {len(transcripts)} voltooide transcripts")
    
    if not transcripts:
        print("Geen transcripts gevonden om te exporteren.")
        return
    
    corpus = []
    combined_text = []
    
    print("\nExporteren naar lokale bestanden...")
    for i, t in enumerate(transcripts, 1):
        file_name = t["file_name"].rsplit(".", 1)[0]
        txt_file = OUTPUT_DIR / f"{file_name}.txt"
        
        txt_file.write_text(t["transcript_text"], encoding="utf-8")
        
        corpus.append({
            "id": t["id"],
            "source": t["file_name"],
            "title": t.get("title") or file_name,
            "techniek_id": t.get("techniek_id"),
            "fase": t.get("fase"),
            "text": t["transcript_text"],
            "word_count": len(t["transcript_text"].split()),
        })
        
        combined_text.append(f"--- {t['file_name']} ---\n{t['transcript_text']}\n")
        
        if i % 20 == 0:
            print(f"  ... {i}/{len(transcripts)} geëxporteerd")
    
    with open(CORPUS_FILE, "w", encoding="utf-8") as f:
        json.dump(corpus, f, ensure_ascii=False, indent=2)
    
    COMBINED_FILE.write_text("\n".join(combined_text), encoding="utf-8")
    
    total_words = sum(c["word_count"] for c in corpus)
    
    print("\n" + "=" * 60)
    print("KLAAR!")
    print("=" * 60)
    print(f"Individuele bestanden: {OUTPUT_DIR}/*.txt ({len(transcripts)} bestanden)")
    print(f"JSON corpus: {CORPUS_FILE}")
    print(f"Gecombineerd: {COMBINED_FILE}")
    print(f"\nStatistieken:")
    print(f"  - Totaal transcripts: {len(transcripts)}")
    print(f"  - Totaal woorden: {total_words:,}")
    print(f"  - Gemiddeld per transcript: {total_words // len(transcripts):,} woorden")


if __name__ == "__main__":
    main()
