#!/usr/bin/env python3
"""
Backfill Transcripts for Videos with Mux but without RAG

This script finds completed videos that have Mux playback IDs but no RAG/transcript,
downloads the audio from Mux, transcribes with ElevenLabs, generates embeddings,
and stores them in the RAG system.

Usage:
    python3 scripts/backfill_mux_transcripts.py [--dry-run] [--limit N]

Environment variables required:
    - OPENAI_API_KEY
    - ELEVENLABS_API_KEY
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
import argparse
import tempfile
import subprocess
from pathlib import Path
from openai import OpenAI
from supabase import create_client
import requests

EMBEDDING_MODEL = "text-embedding-3-small"

supabase = None
openai_client = None
elevenlabs_key = None


def init_clients():
    """Initialize all clients."""
    global supabase, openai_client, elevenlabs_key
    
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    if not openai_key:
        raise ValueError("OPENAI_API_KEY must be set")
    if not elevenlabs_key:
        raise ValueError("ELEVENLABS_API_KEY must be set")
    
    supabase = create_client(supabase_url, supabase_key)
    openai_client = OpenAI(api_key=openai_key)
    
    print("✓ Clients initialized")


MINIMUM_DURATION_SECONDS = 30

def get_videos_needing_transcripts(limit=None):
    """
    Query video_ingest_jobs for videos with Mux but no RAG.
    Filters out videos shorter than 30 seconds.
    """
    print("Fetching videos with Mux but without RAG...")
    
    query = supabase.table('video_ingest_jobs').select(
        'id, video_title, mux_playback_id, drive_file_name, status, transcript, duration_seconds'
    ).not_.is_('mux_playback_id', 'null').is_('rag_document_id', 'null')
    
    if limit:
        query = query.limit(limit)
    
    result = query.execute()
    
    videos = []
    skipped_short = 0
    for v in result.data:
        if not v.get('mux_playback_id'):
            continue
        duration = v.get('duration_seconds') or 0
        if duration > 0 and duration < MINIMUM_DURATION_SECONDS:
            skipped_short += 1
            continue
        videos.append(v)
    
    print(f"Found {len(videos)} videos with Mux but no RAG")
    if skipped_short > 0:
        print(f"Skipped {skipped_short} videos shorter than {MINIMUM_DURATION_SECONDS}s")
    return videos


def download_mux_audio(playback_id, output_path):
    """
    Download audio from Mux stream using ffmpeg.
    No duration limit - extracts full audio.
    """
    mux_url = f"https://stream.mux.com/{playback_id}.m3u8"
    
    cmd = [
        'ffmpeg', '-y', '-i', mux_url,
        '-vn', '-acodec', 'libmp3lame', '-q:a', '4',
        output_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[:200]}")
    
    if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
        raise RuntimeError("Audio file too small or missing")
    
    return output_path


def transcribe_audio(audio_path):
    """
    Transcribe audio using ElevenLabs Scribe.
    """
    with open(audio_path, 'rb') as f:
        resp = requests.post(
            'https://api.elevenlabs.io/v1/speech-to-text',
            headers={'xi-api-key': elevenlabs_key},
            files={'file': ('audio.mp3', f, 'audio/mpeg')},
            data={'model_id': 'scribe_v1', 'language_code': 'nld'}
        )
    
    if resp.status_code == 200:
        text = resp.json().get('text', '')
        return text
    else:
        raise RuntimeError(f"ElevenLabs error: {resp.status_code} - {resp.text[:200]}")


def generate_embedding(text):
    """Generate embedding using OpenAI."""
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding


def insert_rag_document(source_id, content, embedding):
    """Insert RAG document and return ID. Uses video_transcript type to match Cloud Run worker."""
    record = {
        "doc_type": "video_transcript",
        "source_id": source_id,
        "title": f"Video: {source_id}",
        "content": content,
        "embedding": embedding,
        "word_count": len(content.split()),
    }
    
    result = supabase.table("rag_documents").insert(record).execute()
    
    if hasattr(result, 'error') and result.error:
        raise RuntimeError(f"Supabase insert error: {result.error}")
    
    if result.data and len(result.data) > 0:
        return result.data[0]['id']
    else:
        raise RuntimeError(f"Failed to insert RAG document for {source_id}")


def update_video_record(video_id, rag_document_id, transcript):
    """Update video_ingest_jobs with transcript and RAG ID."""
    result = supabase.table('video_ingest_jobs').update({
        'rag_document_id': rag_document_id,
        'transcript': transcript
    }).eq('id', video_id).execute()
    
    if hasattr(result, 'error') and result.error:
        raise RuntimeError(f"Supabase update error: {result.error}")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Backfill transcripts for Mux videos without RAG')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done')
    parser.add_argument('--limit', type=int, help='Limit number of videos')
    args = parser.parse_args()
    
    print("=" * 70)
    print("Mux Transcript Backfill")
    print("=" * 70)
    
    if args.dry_run:
        print(">>> DRY RUN MODE <<<\n")
    
    try:
        init_clients()
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    
    videos = get_videos_needing_transcripts(limit=args.limit)
    
    if not videos:
        print("\nNo videos found needing transcripts!")
        return
    
    print(f"\nProcessing {len(videos)} videos...\n")
    
    processed = 0
    errors = 0
    
    with tempfile.TemporaryDirectory() as tmpdir:
        for i, video in enumerate(videos, 1):
            video_id = video['id']
            source_id = video.get('video_title') or video.get('drive_file_name') or 'Unknown'
            playback_id = video['mux_playback_id']
            existing_transcript = (video.get('transcript') or '').strip()
            
            print(f"\n[{i}/{len(videos)}] {source_id[:40]}...", end=" ", flush=True)
            
            if args.dry_run:
                print("✓ (would process)")
                processed += 1
                continue
            
            try:
                if existing_transcript and len(existing_transcript) > 100:
                    transcript = existing_transcript
                    print("using existing transcript...", end=" ", flush=True)
                else:
                    audio_path = os.path.join(tmpdir, f"{video_id}.mp3")
                    print("downloading audio...", end=" ", flush=True)
                    download_mux_audio(playback_id, audio_path)
                    
                    print("transcribing...", end=" ", flush=True)
                    transcript = transcribe_audio(audio_path)
                    
                    os.remove(audio_path)
                
                if not transcript or len(transcript) < 50:
                    print("⚠️  SKIP (transcript too short)")
                    continue
                
                print("embedding...", end=" ", flush=True)
                embedding = generate_embedding(transcript)
                
                print("inserting RAG...", end=" ", flush=True)
                rag_doc_id = insert_rag_document(source_id, transcript, embedding)
                
                print("updating video...", end=" ", flush=True)
                update_video_record(video_id, rag_doc_id, transcript)
                
                print("✓")
                processed += 1
                
                time.sleep(0.5)
                
            except Exception as e:
                print(f"✗ ERROR: {str(e)[:60]}")
                errors += 1
                continue
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total:           {len(videos)}")
    print(f"Success:         {processed}")
    print(f"Errors:          {errors}")
    
    if args.dry_run:
        print("\n>>> DRY RUN - No changes made <<<")


if __name__ == '__main__':
    main()
