#!/usr/bin/env python3
"""
Batch audio normalisatie voor bestaande video's.

Downloadt verwerkte video's van Mux (chromakey al toegepast), normaliseert audio
(2-pass EBU R128), uploadt opnieuw naar Mux, en updatet de database.

Gebruik:
    python scripts/normalize_existing_videos.py                  # Alle completed video's
    python scripts/normalize_existing_videos.py --dry-run        # Preview zonder wijzigingen
    python scripts/normalize_existing_videos.py --limit 3        # Eerste 3 video's
    python scripts/normalize_existing_videos.py --job-id <uuid>  # Specifieke video
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
from pathlib import Path

# Load .env from project root
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from process_videos import (
    init_clients,
    normalize_video_audio,
    extract_audio,
    upload_to_mux,
    delete_mux_asset,
    update_job_status,
    transcribe_with_elevenlabs,
)


def get_completed_jobs(limit: int = None, job_id: str = None):
    """Fetch completed video ingest jobs from Supabase."""
    from process_videos import supabase

    query = supabase.table("video_ingest_jobs").select(
        "id, drive_file_id, drive_file_name, mux_asset_id, mux_playback_id, status, techniek_id"
    )

    if job_id:
        query = query.eq("id", job_id)
    else:
        query = query.eq("status", "completed").eq("is_hidden", False)

    query = query.order("created_at", desc=False)

    if limit:
        query = query.limit(limit)

    result = query.execute()
    return result.data or []


def download_from_mux(playback_id: str, output_path: Path, timeout: int = 600) -> bool:
    """Download processed video from Mux HLS stream via ffmpeg."""
    url = f"https://stream.mux.com/{playback_id}.m3u8"
    print(f"  Downloaden van Mux stream...", end=" ", flush=True)
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", url, "-c", "copy", "-y", str(output_path)],
            capture_output=True, text=True, timeout=timeout
        )
        if result.returncode != 0:
            print(f"FOUT: {result.stderr[:200]}")
            return False
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"✓ ({size_mb:.1f} MB)")
        return True
    except subprocess.TimeoutExpired:
        print("FOUT: Timeout")
        return False
    except FileNotFoundError:
        print("FOUT: ffmpeg niet gevonden")
        return False


def update_video_mapping(old_playback_id: str, new_playback_id: str):
    """Update config/video_mapping.json with new Mux playback ID."""
    mapping_path = Path(__file__).parent.parent / "config" / "video_mapping.json"
    if not mapping_path.exists():
        print(f"  ⚠ video_mapping.json niet gevonden")
        return False

    with open(mapping_path) as f:
        mapping = json.load(f)

    updated = False
    videos = mapping.get("videos", {})
    for key, video in videos.items():
        if video.get("mux_playback_id") == old_playback_id:
            video["mux_playback_id"] = new_playback_id
            updated = True

    if updated:
        with open(mapping_path, "w") as f:
            json.dump(mapping, f, indent=2, ensure_ascii=False)
        print(f"  ✓ video_mapping.json bijgewerkt")
    else:
        print(f"  ⚠ Playback ID {old_playback_id} niet gevonden in mapping")

    return updated


def process_single_job(job: dict, dry_run: bool = False, retranscribe: bool = False):
    """Download from Mux, normalize audio, re-upload."""
    job_id = job["id"]
    file_name = job["drive_file_name"] or f"video_{job_id}"
    old_asset_id = job.get("mux_asset_id")
    old_playback_id = job.get("mux_playback_id")

    print(f"\n{'='*60}")
    print(f"Video: {file_name}")
    print(f"  Job ID: {job_id}")
    print(f"  Mux: {old_playback_id or '(geen)'}")

    if not old_playback_id:
        print(f"  ✗ Geen Mux playback ID, skip")
        return False

    if dry_run:
        print(f"  [DRY RUN] Zou downloaden van Mux, normaliseren, en opnieuw uploaden")
        return True

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        video_path = tmpdir / f"video_{job_id}.mp4"
        normalized_path = tmpdir / f"video_normalized_{job_id}.mp4"
        audio_path = tmpdir / f"audio_{job_id}.m4a"

        # 1. Download processed video from Mux (chromakey already applied)
        print(f"  Stap 1/4: Downloaden van Mux...")
        if not download_from_mux(old_playback_id, video_path):
            print(f"  ✗ Download mislukt, skip")
            return False

        # 2. Normalize audio
        print(f"  Stap 2/4: Audio normalisatie...")
        if not normalize_video_audio(video_path, normalized_path):
            print(f"  ✗ Normalisatie mislukt, skip")
            return False

        # Use normalized version
        video_path.unlink()
        normalized_path.rename(video_path)

        # 3. Re-upload to Mux
        print(f"  Stap 3/4: Upload naar Mux...")
        mux_result = upload_to_mux(video_path, file_name)
        new_asset_id = mux_result.get("asset_id")
        new_playback_id = mux_result.get("playback_id")

        if not new_asset_id:
            print(f"  ✗ Mux upload mislukt, skip")
            return False

        print(f"  ✓ Nieuw Mux asset: {new_asset_id}, playback: {new_playback_id}")

        # 4. Update database
        print(f"  Stap 4/4: Database bijwerken...")
        update_job_status(
            job_id, "completed",
            mux_asset_id=new_asset_id,
            mux_playback_id=new_playback_id,
        )

        # Update video_mapping.json
        if old_playback_id and new_playback_id:
            update_video_mapping(old_playback_id, new_playback_id)

        # Delete old Mux asset
        if old_asset_id and old_asset_id != new_asset_id:
            print(f"  Oud Mux asset verwijderen: {old_asset_id[:20]}...")
            delete_mux_asset(asset_id=old_asset_id)

        # Optional: re-transcribe for better quality
        if retranscribe:
            print(f"  Bonus: Re-transcriptie met genormaliseerde audio...")
            if extract_audio(video_path, audio_path):
                transcript_data = transcribe_with_elevenlabs(audio_path)
                if transcript_data:
                    update_job_status(job_id, "completed", transcript=transcript_data["text"])
                    print(f"  ✓ Transcript bijgewerkt")

        video_path.unlink(missing_ok=True)
        print(f"  ✓ Klaar!")
        return True


def main():
    parser = argparse.ArgumentParser(description="Batch audio normalisatie voor bestaande video's")
    parser.add_argument("--dry-run", action="store_true", help="Preview zonder wijzigingen")
    parser.add_argument("--limit", type=int, default=None, help="Max aantal video's")
    parser.add_argument("--job-id", type=str, default=None, help="Specifieke job ID")
    parser.add_argument("--retranscribe", action="store_true", help="Ook opnieuw transcriberen")
    args = parser.parse_args()

    print("=" * 60)
    print("Video Audio Normalisatie — Batch Processing")
    print("=" * 60)
    if args.dry_run:
        print("MODE: DRY RUN (geen wijzigingen)")
    print()

    # Initialize clients (Mux credentials needed for upload)
    init_clients()

    # Get jobs
    jobs = get_completed_jobs(limit=args.limit, job_id=args.job_id)
    print(f"\nGevonden: {len(jobs)} video's om te verwerken")

    if not jobs:
        print("Geen video's gevonden.")
        return

    success = 0
    failed = 0
    for i, job in enumerate(jobs, 1):
        print(f"\n[{i}/{len(jobs)}]", end="")
        try:
            if process_single_job(job, dry_run=args.dry_run, retranscribe=args.retranscribe):
                success += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ✗ Onverwachte fout: {e}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"Resultaat: {success} geslaagd, {failed} mislukt van {len(jobs)} totaal")
    print("=" * 60)


if __name__ == "__main__":
    main()
