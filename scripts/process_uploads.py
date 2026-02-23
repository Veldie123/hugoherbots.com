#!/usr/bin/env python3
"""
Background worker to process roleplay uploads from Supabase Storage.
Fetches pending uploads, transcribes with ElevenLabs, and updates status.

Usage:
    python scripts/process_uploads.py

This script is designed to run continuously or as a cron job.
"""

import os
import asyncio
import json
import tempfile
from datetime import datetime
from pathlib import Path

try:
    from elevenlabs.client import ElevenLabs
    from supabase import create_client, Client
except ImportError:
    print("Installing required packages...")
    os.system("pip install elevenlabs supabase")
    from elevenlabs.client import ElevenLabs
    from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")

BUCKET_NAME = "roleplay-uploads"
CONCURRENT_LIMIT = 3

supabase: Client = None
elevenlabs: ElevenLabs = None
sem = asyncio.Semaphore(CONCURRENT_LIMIT)

processed_count = 0
failed_count = 0


def init_clients():
    """Initialize Supabase and ElevenLabs clients."""
    global supabase, elevenlabs
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY/SUPABASE_ANON_KEY must be set")
    if not ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY must be set")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    elevenlabs = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    print(f"Clients initialized. Supabase: {SUPABASE_URL[:30]}...")


def get_pending_uploads(limit: int = 10) -> list:
    """Fetch pending uploads from database."""
    result = supabase.table("roleplay_uploads") \
        .select("*") \
        .in_("status", ["pending", "failed"]) \
        .lt("retry_count", 3) \
        .order("created_at") \
        .limit(limit) \
        .execute()
    return result.data


def update_upload_status(upload_id: str, status: str, **kwargs):
    """Update upload status and any additional fields."""
    data = {"status": status, **kwargs}
    if status == "completed":
        data["processed_at"] = datetime.now().isoformat()
    supabase.table("roleplay_uploads").update(data).eq("id", upload_id).execute()


def download_file(storage_path: str) -> bytes:
    """Download file from Supabase Storage."""
    response = supabase.storage.from_(BUCKET_NAME).download(storage_path.replace(f"{BUCKET_NAME}/", ""))
    return response


def transcribe_audio(audio_bytes: bytes, file_name: str) -> dict:
    """Transcribe audio using ElevenLabs Scribe with Dutch language."""
    with tempfile.NamedTemporaryFile(suffix=Path(file_name).suffix, delete=False) as f:
        f.write(audio_bytes)
        temp_path = f.name
    
    try:
        with open(temp_path, "rb") as f:
            result = elevenlabs.speech_to_text.convert(
                file=f,
                model_id="scribe_v1",
                language_code="nld",
                diarize=True,
                tag_audio_events=True,
            )
        return {
            "text": result.text,
            "language_code": "nld",
        }
    finally:
        os.unlink(temp_path)


def analyze_transcript(transcript: str, techniek_id: str = None) -> dict:
    """
    Placeholder for AI analysis of the transcript.
    TODO: Implement actual AI analysis using the Hugo RAG model.
    """
    word_count = len(transcript.split())
    
    if word_count > 500:
        score = 85
        quality = "excellent"
        strengths = ["Uitgebreid gesprek", "Goede lengte"]
        improvements = ["Kan altijd beter"]
    elif word_count > 200:
        score = 75
        quality = "good"
        strengths = ["Goede basis"]
        improvements = ["Meer doorvragen", "Langere interactie"]
    else:
        score = 60
        quality = "needs-improvement"
        strengths = ["Poging gedaan"]
        improvements = ["Langere gesprekken voeren", "Meer oefenen"]
    
    return {
        "score": score,
        "quality": quality,
        "feedback": {
            "strengths": strengths,
            "improvements": improvements,
        }
    }


async def process_one(upload: dict):
    """Process a single upload."""
    global processed_count, failed_count
    upload_id = upload["id"]
    file_name = upload["file_name"]
    storage_path = upload["storage_path"]
    
    async with sem:
        try:
            print(f"[Processing] {file_name}...")
            update_upload_status(upload_id, "processing")
            
            print(f"  Downloading from Storage...")
            audio_bytes = await asyncio.to_thread(download_file, storage_path)
            
            print(f"  Transcribing with ElevenLabs...")
            update_upload_status(upload_id, "transcribing")
            transcript_result = await asyncio.to_thread(transcribe_audio, audio_bytes, file_name)
            
            print(f"  Analyzing transcript...")
            update_upload_status(upload_id, "analyzing")
            analysis = await asyncio.to_thread(
                analyze_transcript, 
                transcript_result["text"], 
                upload.get("techniek_id")
            )
            
            update_upload_status(
                upload_id,
                "completed",
                transcript_text=transcript_result["text"],
                language_code=transcript_result["language_code"],
                ai_score=analysis["score"],
                ai_quality=analysis["quality"],
                ai_feedback=json.dumps(analysis["feedback"]),
            )
            
            processed_count += 1
            print(f"  OK: {file_name} (Score: {analysis['score']}%)")
            
        except Exception as e:
            failed_count += 1
            error_msg = str(e)
            print(f"  FOUT: {file_name} - {error_msg}")
            
            supabase.table("roleplay_uploads").update({
                "status": "failed",
                "error_message": error_msg,
                "retry_count": upload.get("retry_count", 0) + 1,
            }).eq("id", upload_id).execute()


async def main():
    """Main processing loop."""
    global processed_count, failed_count
    
    print(f"\n{'='*60}")
    print(f"Roleplay Upload Processor")
    print(f"{'='*60}")
    
    try:
        init_clients()
    except ValueError as e:
        print(f"FOUT: {e}")
        return
    
    pending = get_pending_uploads(limit=50)
    
    if not pending:
        print("Geen pending uploads gevonden.")
        return
    
    print(f"Gevonden: {len(pending)} uploads om te verwerken")
    print(f"Concurrent verwerking: {CONCURRENT_LIMIT} tegelijk")
    print(f"{'='*60}\n")
    
    start_time = datetime.now()
    await asyncio.gather(*(process_one(upload) for upload in pending))
    elapsed = datetime.now() - start_time
    
    print(f"\n{'='*60}")
    print(f"KLAAR!")
    print(f"{'='*60}")
    print(f"Verwerkt: {processed_count}")
    print(f"Mislukt: {failed_count}")
    print(f"Tijd: {elapsed}")


if __name__ == "__main__":
    asyncio.run(main())
