#!/usr/bin/env python3
"""
Batch transcription script for Hugo training audio files using ElevenLabs Scribe.
Processes audio files in parallel (3 concurrent) and saves transcripts as text files.

Usage:
    1. Place audio files in the 'audio/' directory
    2. Set ELEVENLABS_API_KEY environment variable
    3. Run: python scripts/batch_transcribe.py
"""

import os
import asyncio
import json
from pathlib import Path
from datetime import datetime
from elevenlabs.client import ElevenLabs

AUDIO_DIR = Path("audio")
OUT_DIR = Path("transcripts")
OUT_DIR.mkdir(parents=True, exist_ok=True)

client = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))
sem = asyncio.Semaphore(3)

processed_count = 0
failed_count = 0
total_files = 0


def transcribe_sync(path: Path) -> dict:
    """Synchronously transcribe a single audio file."""
    with path.open("rb") as f:
        result = client.speech_to_text.convert(
            file=f,
            model_id="scribe_v1",
            diarize=True,
            tag_audio_events=True,
        )
    return {
        "text": result.text,
        "words": getattr(result, "words", []),
        "language_code": getattr(result, "language_code", None),
    }


async def transcribe_one(path: Path):
    """Transcribe a single file with semaphore limiting."""
    global processed_count, failed_count
    
    async with sem:
        try:
            print(f"[{processed_count + failed_count + 1}/{total_files}] Transcriberen: {path.name}...")
            result = await asyncio.to_thread(transcribe_sync, path)
            
            txt_path = OUT_DIR / f"{path.stem}.txt"
            txt_path.write_text(result["text"], encoding="utf-8")
            
            json_path = OUT_DIR / f"{path.stem}.json"
            json_path.write_text(json.dumps({
                "source_file": path.name,
                "transcribed_at": datetime.now().isoformat(),
                "language_code": result["language_code"],
                "text": result["text"],
            }, ensure_ascii=False, indent=2), encoding="utf-8")
            
            processed_count += 1
            print(f"OK: {path.name} -> {txt_path.name}")
            
        except Exception as e:
            failed_count += 1
            print(f"FOUT: {path.name} - {str(e)}")
            
            error_path = OUT_DIR / f"{path.stem}.error.txt"
            error_path.write_text(f"Error transcribing {path.name}:\n{str(e)}", encoding="utf-8")


async def main():
    global total_files
    
    if not os.environ.get("ELEVENLABS_API_KEY"):
        print("FOUT: ELEVENLABS_API_KEY niet gevonden in environment variables!")
        print("Stel deze in via Replit Secrets of export ELEVENLABS_API_KEY=...")
        return
    
    audio_extensions = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".mp4", ".webm"}
    files = sorted([
        p for p in AUDIO_DIR.iterdir() 
        if p.is_file() and p.suffix.lower() in audio_extensions
    ])
    
    if not files:
        print(f"Geen audio bestanden gevonden in {AUDIO_DIR}/")
        print(f"Ondersteunde formaten: {', '.join(audio_extensions)}")
        return
    
    total_files = len(files)
    print(f"\n{'='*60}")
    print(f"ElevenLabs Batch Transcription - Hugo Training Videos")
    print(f"{'='*60}")
    print(f"Audio bestanden gevonden: {total_files}")
    print(f"Output directory: {OUT_DIR}/")
    print(f"Concurrent verwerking: 3 bestanden tegelijk")
    print(f"{'='*60}\n")
    
    start_time = datetime.now()
    await asyncio.gather(*(transcribe_one(p) for p in files))
    elapsed = datetime.now() - start_time
    
    print(f"\n{'='*60}")
    print(f"KLAAR!")
    print(f"{'='*60}")
    print(f"Verwerkt: {processed_count}/{total_files}")
    print(f"Mislukt: {failed_count}")
    print(f"Tijd: {elapsed}")
    print(f"Transcripts opgeslagen in: {OUT_DIR}/")


if __name__ == "__main__":
    asyncio.run(main())
