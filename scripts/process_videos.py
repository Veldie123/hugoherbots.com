#!/usr/bin/env python3
"""
Video Processing Pipeline for HugoHerbots.ai

This script processes pending videos from Google Drive:
1. Downloads video from Google Drive
2. Extracts audio using ffmpeg
3. Uploads video to Mux for streaming
4. Transcribes audio using ElevenLabs Scribe
5. Generates embeddings using OpenAI
6. Stores in Supabase for RAG

Usage:
    python scripts/process_videos.py [--job-id JOB_ID]
"""

import argparse
import base64
import glob
import json
import os
import random
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import replicate
import requests
from openai import OpenAI
from supabase import create_client


def cleanup_temp_files():
    """Clean up old temp directories to prevent disk quota issues."""
    temp_patterns = ["/tmp/tmp*", "/tmp/video_*", "/tmp/audio_*"]
    cleaned = 0
    for pattern in temp_patterns:
        for path in glob.glob(pattern):
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
                cleaned += 1
            except Exception:
                pass
    if cleaned > 0:
        print(f"  🧹 {cleaned} temp bestanden opgeruimd")

EMBEDDING_MODEL = "text-embedding-3-small"

# Winter office backgrounds - rotate every hour of cumulative video time
# TEST: Using avond (dark background) exclusively for testing transparency issues
WINTER_BACKGROUNDS = [
    "bg_winter_avond_1080p.jpg",        # 0-60 min (TEST: donkere achtergrond)
    "bg_winter_avond_1080p.jpg",        # 60-120 min
    "bg_winter_avond_1080p.jpg",        # 120-180 min
    "bg_winter_avond_1080p.jpg",        # 180-240 min
]

# Minimum words for a video to be considered content (not just filler)
MIN_CONTENT_WORDS = 50

# Track cumulative video duration for background selection (loaded from DB)
_cumulative_duration_seconds = 0
_duration_loaded = False

supabase = None
openai_client = None
mux_token_id = None
mux_token_secret = None


def load_cumulative_duration():
    """Load cumulative processed duration from Supabase (persisted across runs)."""
    global _cumulative_duration_seconds, _duration_loaded
    
    if _duration_loaded or supabase is None:
        return
    
    try:
        # Try to load duration_seconds if column exists
        result = supabase.table("video_ingest_jobs").select("duration_seconds").eq("status", "completed").execute()
        
        if result.data:
            total = sum(r.get("duration_seconds") or 0 for r in result.data)
            _cumulative_duration_seconds = float(total)
        else:
            _cumulative_duration_seconds = 0
        
        _duration_loaded = True
        hours = _cumulative_duration_seconds / 3600
        print(f"  Cumulatieve duur geladen: {hours:.2f} uur ({len(result.data or [])} video's)")
    except Exception as e:
        # Column might not exist - fall back to counting completed jobs (estimate ~3 min each)
        try:
            result = supabase.table("video_ingest_jobs").select("id").eq("status", "completed").execute()
            completed_count = len(result.data or [])
            _cumulative_duration_seconds = completed_count * 180.0  # ~3 min per video
            hours = _cumulative_duration_seconds / 3600
            print(f"  Duur geschat: {hours:.1f} uur ({completed_count} video's x 3 min)")
        except:
            _cumulative_duration_seconds = 0
        _duration_loaded = True


def get_background_for_duration(video_duration: float) -> Path:
    """
    Select background based on cumulative video duration INCLUDING current video.
    Rotates through 4 backgrounds every hour (3600 seconds).
    
    Pattern: ochtend → middag → zonsondergang → avond → ochtend...
    """
    global _cumulative_duration_seconds
    
    # Load persisted duration if not yet loaded
    load_cumulative_duration()
    
    script_dir = Path(__file__).parent.parent
    assets_dir = script_dir / "assets"
    
    # Include current video's duration in the calculation
    total_with_current = _cumulative_duration_seconds + video_duration
    
    # Calculate which hour we're in (0-3, cycling)
    hour_index = int(total_with_current / 3600) % 4
    
    background_name = WINTER_BACKGROUNDS[hour_index]
    background_path = assets_dir / background_name
    
    if not background_path.exists():
        # Fallback to any available background
        for bg in WINTER_BACKGROUNDS:
            fallback = assets_dir / bg
            if fallback.exists():
                return fallback
        # Last resort fallback
        fallback = assets_dir / "office_background.jpg"
        if fallback.exists():
            return fallback
    
    return background_path


def add_to_cumulative_duration(duration_seconds: float):
    """Add video duration to cumulative counter for background rotation."""
    global _cumulative_duration_seconds
    _cumulative_duration_seconds += duration_seconds
    hours = _cumulative_duration_seconds / 3600
    print(f"  Cumulatieve duur: {hours:.2f} uur")


def get_video_duration(video_path: Path) -> float:
    """Get video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(video_path)
            ],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except:
        pass
    return 0.0


def get_mux_asset_id_from_upload(upload_id: str, max_wait: int = 30) -> str | None:
    """Wait for and retrieve asset_id from a Mux upload."""
    if not mux_token_id or not mux_token_secret or not upload_id:
        return None
    
    credentials = base64.b64encode(f"{mux_token_id}:{mux_token_secret}".encode()).decode()
    headers = {"Authorization": f"Basic {credentials}"}
    
    for _ in range(max_wait // 2):
        try:
            response = requests.get(
                f"https://api.mux.com/video/v1/uploads/{upload_id}",
                headers=headers
            )
            if response.status_code == 200:
                data = response.json().get("data", {})
                asset_id = data.get("asset_id")
                if asset_id:
                    return asset_id
        except:
            pass
        time.sleep(2)
    
    return None


def delete_mux_asset(asset_id: str = None, upload_id: str = None) -> bool:
    """
    Delete a Mux asset (used for filtered videos with <50 words).
    
    Can delete by asset_id directly, or wait for asset_id from upload_id.
    """
    if not mux_token_id or not mux_token_secret:
        return False
    
    # If we only have upload_id, wait for asset_id
    if not asset_id and upload_id:
        print(f"  Wachten op Mux asset_id...", end=" ", flush=True)
        asset_id = get_mux_asset_id_from_upload(upload_id)
        if not asset_id:
            print("niet gevonden")
            return False
    
    if not asset_id:
        return False
    
    try:
        credentials = base64.b64encode(f"{mux_token_id}:{mux_token_secret}".encode()).decode()
        headers = {"Authorization": f"Basic {credentials}"}
        
        response = requests.delete(
            f"https://api.mux.com/video/v1/assets/{asset_id}",
            headers=headers
        )
        
        if response.status_code in [200, 204]:
            print(f"✓ Mux asset verwijderd: {asset_id[:12]}...")
            return True
        else:
            print(f"⚠ Mux asset verwijderen mislukt: {response.status_code}")
            return False
    except Exception as e:
        print(f"⚠ Mux verwijderen fout: {str(e)[:50]}")
        return False


def init_clients():
    """Initialize Supabase, OpenAI, and Mux clients."""
    global supabase, openai_client, mux_token_id, mux_token_secret
    
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("Openai_API")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY vereist")
    if not openai_key:
        raise ValueError("OPENAI_API_KEY vereist")
    
    supabase = create_client(supabase_url, supabase_key)
    openai_client = OpenAI(api_key=openai_key)
    
    mux_token_id = os.environ.get("MUX_TOKEN_ID")
    mux_token_secret = os.environ.get("MUX_TOKEN_SECRET")
    
    if mux_token_id and mux_token_secret:
        print("✓ Clients geinitialiseerd (inclusief Mux)")
    else:
        print("✓ Clients geinitialiseerd (Mux niet geconfigureerd - upload wordt overgeslagen)")


def get_google_access_token() -> str:
    """Get Google Drive access token from Replit connector."""
    hostname = os.environ.get("REPLIT_CONNECTORS_HOSTNAME")
    repl_identity = os.environ.get("REPL_IDENTITY")
    web_renewal = os.environ.get("WEB_REPL_RENEWAL")
    
    if repl_identity:
        x_replit_token = f"repl {repl_identity}"
    elif web_renewal:
        x_replit_token = f"depl {web_renewal}"
    else:
        raise ValueError("Replit connector credentials niet beschikbaar")
    
    if not hostname:
        raise ValueError("REPLIT_CONNECTORS_HOSTNAME niet beschikbaar")
    
    response = requests.get(
        f"https://{hostname}/api/v2/connection?include_secrets=true&connector_names=google-drive",
        headers={
            "Accept": "application/json",
            "X_REPLIT_TOKEN": x_replit_token
        }
    )
    
    data = response.json()
    connection = data.get("items", [{}])[0]
    settings = connection.get("settings", {})
    
    access_token = settings.get("access_token") or settings.get("oauth", {}).get("credentials", {}).get("access_token")
    
    if not access_token:
        raise ValueError("Google Drive niet verbonden - controleer connector in Replit")
    
    return access_token


def download_video_from_drive(file_id: str, access_token: str, output_path: Path, max_retries: int = 5) -> bool:
    """Download video file from Google Drive with exponential backoff retry."""
    print(f"  Downloaden van Google Drive...", end=" ", flush=True)
    
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    last_error = None
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, stream=True, timeout=300)
            
            # Check for rate limiting
            if response.status_code == 429:
                retry_after_header = response.headers.get('Retry-After', '60')
                try:
                    retry_after = int(retry_after_header)
                except ValueError:
                    # Could be HTTP-date format, use default
                    retry_after = 60
                print(f"rate limit, wacht {retry_after}s...", end=" ", flush=True)
                time.sleep(retry_after)
                continue
            
            # Check for server errors (503, 500, etc) - retry these
            if response.status_code >= 500:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"server error {response.status_code}, retry in {wait_time:.1f}s...", end=" ", flush=True)
                time.sleep(wait_time)
                continue
            
            # Client errors (400, 403, 404) - don't retry
            if response.status_code != 200:
                print(f"FOUT: {response.status_code}")
                return False
            
            # Download the file
            with open(output_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            size_mb = output_path.stat().st_size / (1024 * 1024)
            print(f"✓ ({size_mb:.1f} MB)")
            return True
            
        except (requests.exceptions.ConnectionError, 
                requests.exceptions.Timeout,
                requests.exceptions.ChunkedEncodingError) as e:
            last_error = str(e)
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            if attempt < max_retries - 1:
                print(f"connectie fout, retry in {wait_time:.1f}s...", end=" ", flush=True)
                time.sleep(wait_time)
            continue
    
    print(f"FOUT na {max_retries} pogingen: {last_error or 'onbekend'}")
    return False


def apply_rvm_matting(input_path: Path, output_path: Path, background_path: Path | None = None) -> bool:
    """
    Apply AI-based foreground segmentation using Robust Video Matting (RVM) via Replicate.
    
    NOTE: Currently disabled - Hugo's greenscreen quality causes artifacts with RVM.
    Falls back to chromakey instead.
    
    Returns False to trigger chromakey fallback.
    """
    print(f"  RVM uitgeschakeld (greenscreen kwaliteit)...", end=" ", flush=True)
    return False  # Always use chromakey fallback for now
    
    # Original RVM code disabled:
    print(f"  AI Foreground Segmentatie (RVM)...", end=" ", flush=True)
    
    # Get video duration and select appropriate background
    duration = get_video_duration(input_path)
    
    if background_path is None:
        background_path = get_background_for_duration(duration)
    
    if not background_path or not background_path.exists():
        print(f"WAARSCHUWING: Achtergrond niet gevonden")
        return False
    
    replicate_token = os.environ.get("REPLICATE_API_TOKEN")
    if not replicate_token:
        print("FOUT: REPLICATE_API_TOKEN niet gevonden")
        return False
    
    try:
        compressed_path = input_path.parent / f"compressed_{input_path.stem}.mp4"
        
        print("comprimeren...", end=" ", flush=True)
        compress_result = subprocess.run(
            [
                "ffmpeg",
                "-i", str(input_path),
                "-vf", "scale=640:-2",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "28",
                "-an",
                "-y",
                str(compressed_path)
            ],
            capture_output=True,
            text=True,
            timeout=600
        )
        
        if compress_result.returncode != 0:
            print(f"FOUT: Compressie mislukt")
            return False
        
        compressed_size = compressed_path.stat().st_size / (1024 * 1024)
        if compressed_size > 45:
            print(f"FOUT: Gecomprimeerde video nog te groot ({compressed_size:.1f}MB)")
            compressed_path.unlink(missing_ok=True)
            return False
        
        timestamp = int(time.time())
        storage_path = f"temp_rvm/{timestamp}_{compressed_path.name}"
        
        print("uploaden...", end=" ", flush=True)
        with open(compressed_path, "rb") as f:
            upload_result = supabase.storage.from_("videos").upload(
                storage_path,
                f,
                {"content-type": "video/mp4"}
            )
        
        compressed_path.unlink(missing_ok=True)
        
        public_url = supabase.storage.from_("videos").get_public_url(storage_path)
        
        print("RVM verwerken...", end=" ", flush=True)
        output = replicate.run(
            "arielreplicate/robust_video_matting:2d2de06a76a837a4ba92b6164bf8bfd3ddb524a1fb64b0d8ae055af17fa22503",
            input={
                "input_video": public_url,
                "output_type": "alpha-mask"
            }
        )
        
        mask_url = output
        if isinstance(output, dict):
            mask_url = output.get("output") or output.get("video") or str(output)
        if hasattr(output, 'read'):
            mask_path = input_path.parent / f"mask_{input_path.stem}.webm"
            print("mask opslaan...", end=" ", flush=True)
            with open(mask_path, "wb") as f:
                f.write(output.read())
        else:
            print("mask downloaden...", end=" ", flush=True)
            mask_path = input_path.parent / f"mask_{input_path.stem}.webm"
            response = requests.get(str(mask_url), stream=True)
            if response.status_code != 200:
                print(f"FOUT: Mask download mislukt ({response.status_code})")
                try:
                    supabase.storage.from_("videos").remove([storage_path])
                except:
                    pass
                return False
            
            with open(mask_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
        
        try:
            supabase.storage.from_("videos").remove([storage_path])
        except:
            pass
        
        print("compositing...", end=" ", flush=True)
        # CRITICAL: Keep Hugo EXACTLY as filmed - only replace background
        # scale2ref scales mask and background to match original video dimensions
        filter_complex = (
            "[0:v]format=rgba[src];"
            "[1:v][src]scale2ref=iw:ih:flags=bilinear,format=gray[mask][srcref];"
            "[srcref][mask]alphamerge[fg];"
            "[2:v][fg]scale2ref=iw:ih:flags=lanczos[bg][fgref];"
            "[bg][fgref]overlay=0:0:shortest=1[out]"
        )
        
        result = subprocess.run(
            [
                "ffmpeg",
                "-i", str(input_path),
                "-i", str(mask_path),
                "-loop", "1",
                "-i", str(background_path),
                "-filter_complex", filter_complex,
                "-map", "[out]",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", "slow",
                "-crf", "10",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                "-y",
                str(output_path)
            ],
            capture_output=True,
            text=True,
            timeout=1800
        )
        
        mask_path.unlink(missing_ok=True)
        
        if result.returncode != 0:
            print(f"FOUT: FFmpeg compositing mislukt - {result.stderr[:200]}")
            return False
        
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"✓ ({size_mb:.1f} MB, AI-kwaliteit)")
        return True
        
    except Exception as e:
        print(f"FOUT: {str(e)[:150]}")
        return False


def apply_chromakey(input_path: Path, output_path: Path, background_path: Path | None = None, video_duration: float = 0) -> bool:
    """
    FALLBACK: Apply chromakey (green screen removal) using ffmpeg.
    Used when RVM is unavailable or fails.
    
    Uses winter office backgrounds that rotate every hour of cumulative video time.
    Professional pipeline with near-lossless quality (CRF=10).
    
    Args:
        input_path: Path to input video
        output_path: Path to output video
        background_path: Optional specific background path
        video_duration: Duration of video in seconds (for background selection)
    """
    print(f"  Chromakey fallback...", end=" ", flush=True)
    
    # Get video duration if not provided
    if video_duration <= 0:
        video_duration = get_video_duration(input_path)
    
    if background_path is None:
        background_path = get_background_for_duration(video_duration)
    
    if not background_path or not background_path.exists():
        print(f"WAARSCHUWING: Achtergrond niet gevonden, overslaan")
        return True
    
    print(f"({background_path.name})...", end=" ", flush=True)
    
    try:
        # Simple chromakey for studio green (skip HDR conversion - most cameras use SDR):
        # - format=yuv444p for chromakey compatibility, then convert back to yuv420p for Mux
        # - similarity 0.29: optimal balance - Hugo not transparent, minimal green edges (TESTED & FINAL)
        # - blend 0.10: smooth edge feathering (TESTED & WORKING)
        # CRITICAL: Use scale2ref to match background to SOURCE video dimensions
        # HIGH QUALITY: CRF 14, profile high, VBV caps for Mux compatibility
        filter_complex = (
            "[0:v]format=yuv444p,chromakey=0x00FF00:0.29:0.10[fg];"
            "[1:v][fg]scale2ref=iw:ih:flags=lanczos[bg][fgref];"
            "[bg][fgref]overlay=0:0:shortest=1,format=yuv420p[out]"
        )
        
        result = subprocess.run(
            [
                "ffmpeg",
                "-i", str(input_path),
                "-loop", "1",
                "-i", str(background_path),
                "-filter_complex", filter_complex,
                "-map", "[out]",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", "slow",
                "-crf", "14",
                "-profile:v", "high",
                "-level:v", "4.2",
                "-pix_fmt", "yuv420p",
                "-maxrate", "18M",
                "-bufsize", "36M",
                "-tune", "film",
                "-movflags", "+faststart",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                "-y",
                str(output_path)
            ],
            capture_output=True,
            text=True,
            timeout=1800
        )
        
        if result.returncode != 0:
            # Fallback: simpler chromakey filter without HDR conversion (for SDR sources)
            print("fallback (SDR)...", end=" ")
            filter_complex_fallback = (
                "[0:v]format=yuv444p,chromakey=0x00FF00:0.29:0.10[fg];"
                "[1:v][fg]scale2ref=iw:ih:flags=lanczos[bg][fgref];"
                "[bg][fgref]overlay=0:0:shortest=1,format=yuv420p[out]"
            )
            result = subprocess.run(
                [
                    "ffmpeg",
                    "-i", str(input_path),
                    "-loop", "1",
                    "-i", str(background_path),
                    "-filter_complex", filter_complex_fallback,
                    "-map", "[out]",
                    "-map", "0:a?",
                    "-c:v", "libx264",
                    "-preset", "slow",
                    "-crf", "14",
                    "-profile:v", "high",
                    "-level:v", "4.2",
                    "-pix_fmt", "yuv420p",
                    "-maxrate", "18M",
                    "-bufsize", "36M",
                    "-tune", "film",
                    "-movflags", "+faststart",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-shortest",
                    "-y",
                    str(output_path)
                ],
                capture_output=True,
                text=True,
                timeout=1800
            )
            if result.returncode != 0:
                error_lines = [l for l in result.stderr.split('\n') if 'error' in l.lower() or 'Error' in l]
                error_msg = '\n'.join(error_lines[-3:]) if error_lines else result.stderr[-300:]
                print(f"FOUT: {error_msg}")
                return False
        
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"✓ ({size_mb:.1f} MB, near-lossless)")
        return True
        
    except subprocess.TimeoutExpired:
        print("FOUT: Timeout (>30 min)")
        return False
    except FileNotFoundError:
        print("FOUT: ffmpeg niet gevonden")
        return False
    except Exception as e:
        print(f"FOUT: {str(e)[:100]}")
        return False


def extract_audio(video_path: Path, audio_path: Path) -> bool:
    """Extract audio from video using ffmpeg."""
    print(f"  Audio extractie met ffmpeg...", end=" ", flush=True)
    
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-i", str(video_path),
                "-vn",
                "-acodec", "aac",
                "-b:a", "128k",
                "-y",
                str(audio_path)
            ],
            capture_output=True,
            text=True,
            timeout=600
        )
        
        if result.returncode != 0:
            print(f"FOUT: {result.stderr[:200]}")
            return False
        
        size_mb = audio_path.stat().st_size / (1024 * 1024)
        print(f"✓ ({size_mb:.1f} MB)")
        return True
        
    except subprocess.TimeoutExpired:
        print("FOUT: Timeout (>10 min)")
        return False
    except FileNotFoundError:
        print("FOUT: ffmpeg niet gevonden")
        return False


def wait_for_mux_playback_id(asset_id: str, max_wait: int = 120) -> str | None:
    """
    Poll Mux API until asset is ready and has playback_id.
    Mux typically takes 30-90 seconds to process a video.
    """
    if not mux_token_id or not mux_token_secret or not asset_id:
        return None
    
    credentials = base64.b64encode(f"{mux_token_id}:{mux_token_secret}".encode()).decode()
    headers = {"Authorization": f"Basic {credentials}"}
    
    for i in range(max_wait // 5):
        try:
            response = requests.get(
                f"https://api.mux.com/video/v1/assets/{asset_id}",
                headers=headers
            )
            if response.status_code == 200:
                data = response.json().get("data", {})
                status = data.get("status")
                playback_ids = data.get("playback_ids", [])
                
                if status == "ready" and playback_ids:
                    return playback_ids[0].get("id")
                elif status == "errored":
                    print("FOUT", end=" ", flush=True)
                    return None
        except:
            pass
        time.sleep(5)
    
    return None


def upload_to_mux(video_path: Path, title: str) -> dict:
    """
    Upload video to Mux using direct upload API.
    Waits for Mux to finish processing and returns playback_id.
    """
    if not mux_token_id or not mux_token_secret:
        print("  Mux upload overgeslagen (niet geconfigureerd)")
        return {"asset_id": None, "playback_id": None}
    
    print(f"  Uploaden naar Mux...", end=" ", flush=True)
    
    try:
        credentials = base64.b64encode(f"{mux_token_id}:{mux_token_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json"
        }
        
        create_upload_response = requests.post(
            "https://api.mux.com/video/v1/uploads",
            headers=headers,
            json={
                "cors_origin": "*",
                "new_asset_settings": {
                    "playback_policy": ["public"],
                    "encoding_tier": "smart",
                    "max_resolution_tier": "1080p"
                }
            }
        )
        
        if create_upload_response.status_code != 201:
            print(f"FOUT: Upload URL aanmaken mislukt ({create_upload_response.status_code})")
            return {"asset_id": None, "playback_id": None}
        
        upload_data = create_upload_response.json()["data"]
        upload_url = upload_data["url"]
        upload_id = upload_data["id"]
        
        file_size = video_path.stat().st_size
        # Timeout: 10 min voor grote bestanden (300MB+ kan lang duren)
        upload_timeout = max(300, int(file_size / 100000))  # min 5 min, ~100KB/s
        with open(video_path, "rb") as f:
            put_response = requests.put(
                upload_url,
                data=f,
                headers={"Content-Type": "video/mp4"},
                timeout=upload_timeout
            )
        
        if put_response.status_code not in [200, 201]:
            print(f"FOUT: Bestand uploaden mislukt ({put_response.status_code})")
            return {"asset_id": None, "playback_id": None}
        
        size_mb = file_size / (1024 * 1024)
        print(f"✓ ({size_mb:.1f} MB)", end=" ", flush=True)
        
        # Wait for asset_id from upload
        time.sleep(3)
        check_response = requests.get(
            f"https://api.mux.com/video/v1/uploads/{upload_id}",
            headers={"Authorization": f"Basic {credentials}"}
        )
        
        asset_id = None
        if check_response.status_code == 200:
            check_data = check_response.json()["data"]
            asset_id = check_data.get("asset_id")
        
        if not asset_id:
            print("(geen asset_id)")
            return {"asset_id": None, "playback_id": None, "upload_id": upload_id}
        
        # Wait for Mux to process and get playback_id
        print("wachten op Mux...", end=" ", flush=True)
        playback_id = wait_for_mux_playback_id(asset_id, max_wait=120)
        
        if playback_id:
            print(f"✓ (klaar)")
        else:
            print("(timeout - playback_id komt later)")
        
        return {
            "asset_id": asset_id,
            "playback_id": playback_id,
            "upload_id": upload_id
        }
        
    except Exception as e:
        print(f"FOUT: {str(e)[:100]}")
        return {"asset_id": None, "playback_id": None}


def transcribe_with_elevenlabs(audio_path: Path) -> str | None:
    """Transcribe audio using ElevenLabs Scribe API."""
    print(f"  Transcriberen met ElevenLabs...", end=" ", flush=True)
    
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("FOUT: ELEVENLABS_API_KEY niet gevonden")
        return None
    
    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {"xi-api-key": api_key}
    
    with open(audio_path, "rb") as f:
        files = {"file": (audio_path.name, f, "audio/m4a")}
        data = {"model_id": "scribe_v1", "language_code": "nl"}
        
        response = requests.post(url, headers=headers, files=files, data=data)
    
    if response.status_code != 200:
        print(f"FOUT: {response.status_code} - {response.text[:200]}")
        return None
    
    result = response.json()
    transcript = result.get("text", "")
    
    word_count = len(transcript.split())
    print(f"✓ ({word_count} woorden)")
    return transcript


def generate_embedding(text: str) -> list[float]:
    """Generate embedding for text using OpenAI."""
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    import math
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot_product / (norm1 * norm2)


def match_best_technique(transcript_embedding: list[float]) -> tuple[str | None, float]:
    """
    Match transcript embedding to best technique using cosine similarity.
    Returns (techniek_nummer, confidence_score) or (None, 0.0) if no match.
    """
    try:
        techniek_docs = supabase.table("rag_documents").select(
            "techniek_id, embedding"
        ).eq("doc_type", "techniek").execute()
        
        if not techniek_docs.data:
            print("  (geen techniek embeddings gevonden)")
            return None, 0.0
        
        best_match = None
        best_score = 0.0
        
        for doc in techniek_docs.data:
            techniek_id = doc.get("techniek_id")
            techniek_embedding = doc.get("embedding")
            
            if not techniek_id or not techniek_embedding:
                continue
            
            score = cosine_similarity(transcript_embedding, techniek_embedding)
            
            if score > best_score:
                best_score = score
                best_match = techniek_id
        
        return best_match, best_score
        
    except Exception as e:
        print(f"  (techniek matching fout: {str(e)[:50]})")
        return None, 0.0


def store_in_rag(job: dict, transcript: str) -> tuple[str | None, str | None, float]:
    """
    Store transcript and embedding in RAG database.
    Also matches transcript to best technique using cosine similarity.
    
    Returns: (rag_document_id, ai_suggested_techniek_id, ai_confidence)
    """
    print(f"  RAG embedding genereren...", end=" ", flush=True)
    
    embedding = generate_embedding(transcript)
    
    source_id = f"video_{job['id']}"
    title = job.get("video_title") or job.get("drive_file_name", "Onbekende video")
    
    record = {
        "doc_type": "video_transcript",
        "source_id": source_id,
        "title": title,
        "content": transcript,
        "techniek_id": job.get("techniek_id"),
        "fase": job.get("fase"),
        "embedding": embedding,
        "word_count": len(transcript.split()),
    }
    
    existing = supabase.table("rag_documents").select("id").eq("source_id", source_id).execute()
    
    if existing.data:
        supabase.table("rag_documents").update(record).eq("id", existing.data[0]["id"]).execute()
        rag_id = existing.data[0]["id"]
        print(f"✓ (bijgewerkt)", end=" ")
    else:
        result = supabase.table("rag_documents").insert(record).execute()
        rag_id = result.data[0]["id"] if result.data else None
        print(f"✓ (nieuw)", end=" ")
    
    ai_techniek_id, ai_confidence = match_best_technique(embedding)
    if ai_techniek_id:
        print(f"→ AI match: {ai_techniek_id} ({ai_confidence:.0%})")
    else:
        print()
    
    return rag_id, ai_techniek_id, ai_confidence


def update_job_status(job_id: str, status: str, error_message: str = None, **extra_fields):
    """
    Update job status in Supabase.
    
    Supports extra fields including:
    - mux_asset_id: Mux asset ID
    - mux_playback_id: Mux playback ID (set by webhook)
    - mux_status: Mux processing status (processing, ready, error)
    - thumbnail_url: Video thumbnail URL
    - duration_seconds: Video duration in seconds
    - transcript: Transcribed text
    - rag_document_id: Reference to RAG document
    
    Handles missing columns gracefully by retrying without unknown fields.
    """
    update_data = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
    
    if error_message:
        update_data["error_message"] = error_message
        try:
            update_data["retry_count"] = supabase.table("video_ingest_jobs").select("retry_count").eq("id", job_id).execute().data[0].get("retry_count", 0) + 1
        except:
            update_data["retry_count"] = 1
    
    if status == "completed":
        update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
        update_data["error_message"] = None
    
    update_data.update(extra_fields)
    
    try:
        supabase.table("video_ingest_jobs").update(update_data).eq("id", job_id).execute()
    except Exception as e:
        error_str = str(e)
        # Handle missing column errors by retrying with only known fields
        if "PGRST204" in error_str or "42703" in error_str or "column" in error_str.lower():
            # Strip potentially missing Mux columns and retry
            known_fields = {"status", "updated_at", "error_message", "retry_count", 
                           "processed_at", "transcript", "rag_document_id", "audio_url",
                           "duration_seconds", "mux_asset_id", "mux_status"}
            safe_data = {k: v for k, v in update_data.items() if k in known_fields}
            try:
                supabase.table("video_ingest_jobs").update(safe_data).eq("id", job_id).execute()
                print(f"  (Database update zonder Mux kolommen - voeg mux_asset_id toe aan tabel)")
            except Exception as e2:
                print(f"  WAARSCHUWING: Database update mislukt: {str(e2)[:100]}")
        else:
            print(f"  WAARSCHUWING: Database update mislukt: {str(e)[:100]}")


def process_single_job(job: dict, access_token: str):
    """Process a single video ingest job."""
    job_id = job["id"]
    file_id = job["drive_file_id"]
    file_name = job.get("drive_file_name", "video")
    video_title = job.get("video_title") or file_name
    
    print(f"\n{'='*60}")
    print(f"Verwerken: {file_name}")
    print(f"Job ID: {job_id}")
    print(f"{'='*60}")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        video_raw_path = tmpdir / f"video_raw_{job_id}.mp4"
        video_processed_path = tmpdir / f"video_processed_{job_id}.mp4"
        audio_path = tmpdir / f"audio_{job_id}.m4a"
        
        update_job_status(job_id, "downloading")
        if not download_video_from_drive(file_id, access_token, video_raw_path):
            update_job_status(job_id, "failed", "Download van Google Drive mislukt")
            return False
        
        # Get video duration for background rotation
        video_duration = get_video_duration(video_raw_path)
        print(f"  Video duur: {video_duration:.1f} seconden")
        
        update_job_status(job_id, "matting")
        
        replicate_available = os.environ.get("REPLICATE_API_TOKEN")
        matting_success = False
        
        if replicate_available:
            matting_success = apply_rvm_matting(video_raw_path, video_processed_path)
        
        if not matting_success:
            print("  RVM niet beschikbaar of mislukt, probeer chromakey fallback...")
            matting_success = apply_chromakey(video_raw_path, video_processed_path, video_duration=video_duration)
        
        if matting_success:
            video_path = video_processed_path
            video_raw_path.unlink()
        else:
            print("  ⛔ Greenscreen verwijdering mislukt - pipeline gestopt (geen verspilling Mux/ElevenLabs)")
            update_job_status(job_id, "chromakey_failed", "Greenscreen verwijdering mislukt, video overgeslagen")
            return False
        
        update_job_status(job_id, "extracting_audio")
        if not extract_audio(video_path, audio_path):
            update_job_status(job_id, "failed", "Audio extractie mislukt")
            return False
        
        update_job_status(job_id, "uploading_mux")
        mux_result = upload_to_mux(video_path, video_title)
        
        if mux_result.get("asset_id"):
            update_job_status(
                job_id, 
                "uploading_mux",
                mux_asset_id=mux_result["asset_id"],
                mux_status="processing"
            )
        
        video_path.unlink()
        
        update_job_status(job_id, "transcribing")
        transcript = transcribe_with_elevenlabs(audio_path)
        if not transcript:
            update_job_status(job_id, "failed", "Transcriptie mislukt")
            return False
        
        audio_path.unlink()
        
        word_count = len(transcript.split())
        
        if word_count < MIN_CONTENT_WORDS:
            print(f"  ⚠ Te weinig woorden ({word_count} < {MIN_CONTENT_WORDS}), video gefilterd")
            
            # Delete Mux asset for filtered videos (no useful content)
            # Use either asset_id or upload_id to find and delete
            if mux_result.get("asset_id") or mux_result.get("upload_id"):
                print(f"  Verwijderen van Mux (geen nuttige content)...")
                delete_mux_asset(
                    asset_id=mux_result.get("asset_id"),
                    upload_id=mux_result.get("upload_id")
                )
            
            update_job_status(job_id, "filtered", transcript=transcript, mux_asset_id=None, mux_status=None)
            print(f"\n⚠ GEFILTERD: {file_name} ({word_count} woorden)")
            return True
        
        update_job_status(job_id, "embedding", transcript=transcript)
        rag_id, ai_techniek_id, ai_confidence = store_in_rag(job, transcript)
        if not rag_id:
            update_job_status(job_id, "failed", "RAG embedding opslaan mislukt")
            return False
        
        final_update = {"rag_document_id": rag_id}
        
        if ai_techniek_id:
            if not job.get("techniek_id"):
                final_update["techniek_id"] = ai_techniek_id
            try:
                supabase.table("video_ingest_jobs").update({
                    "ai_suggested_techniek_id": ai_techniek_id,
                    "ai_confidence": round(ai_confidence, 3)
                }).eq("id", job_id).execute()
            except Exception as e:
                print(f"  (AI suggestie kolommen niet beschikbaar: {str(e)[:50]})")
        if mux_result.get("asset_id"):
            final_update["mux_asset_id"] = mux_result["asset_id"]
            final_update["mux_status"] = "ready" if mux_result.get("playback_id") else "processing"
        if mux_result.get("playback_id"):
            final_update["mux_playback_id"] = mux_result["playback_id"]
        
        # Try to save duration (column might not exist in older schemas)
        try:
            supabase.table("video_ingest_jobs").update({"duration_seconds": int(video_duration)}).eq("id", job_id).execute()
        except:
            pass  # Column doesn't exist, skip duration persistence
        
        update_job_status(job_id, "completed", **final_update)
        
        # Add video duration to cumulative counter for background rotation
        add_to_cumulative_duration(video_duration)
        
        print(f"\n✓ VOLTOOID: {file_name}")
        return True


def get_pending_jobs(limit: int = 5) -> list[dict]:
    """Get pending jobs from Supabase."""
    result = supabase.table("video_ingest_jobs").select("*").eq("status", "pending").order("created_at").limit(limit).execute()
    return result.data or []


def process_all_pending():
    """Process all pending video jobs - continues until all are done."""
    print("\n" + "="*60)
    print("HugoHerbots.ai Video Processing Pipeline")
    print("="*60)
    
    cleanup_temp_files()
    
    try:
        init_clients()
    except ValueError as e:
        print(f"FOUT bij initialisatie: {e}")
        return
    
    print("Google Drive access token ophalen...")
    try:
        access_token = get_google_access_token()
        print("✓ Google Drive verbonden")
    except ValueError as e:
        print(f"FOUT: {e}")
        return
    
    success = 0
    failed = 0
    batch_num = 0
    
    while True:
        batch_num += 1
        jobs = get_pending_jobs(limit=10)
        
        if not jobs:
            if batch_num == 1:
                print("\nGeen nieuwe video's om te verwerken.")
            break
        
        print(f"\n{'='*60}")
        print(f"BATCH {batch_num}: {len(jobs)} video's")
        print(f"{'='*60}")
        
        for job in jobs:
            try:
                if process_single_job(job, access_token):
                    success += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"\nONVERWACHTE FOUT: {e}")
                update_job_status(job["id"], "failed", str(e)[:500])
                failed += 1
            
            cleanup_temp_files()
            time.sleep(1)
        
        try:
            access_token = get_google_access_token()
        except ValueError as e:
            print(f"FOUT bij token refresh: {e}")
            break
    
    print("\n" + "="*60)
    print("SAMENVATTING")
    print("="*60)
    print(f"Succesvol: {success}")
    print(f"Mislukt: {failed}")
    print(f"Totaal verwerkt: {success + failed}")


def process_single_by_id(job_id: str):
    """Process a single job by ID."""
    print("\n" + "="*60)
    print("HugoHerbots.ai Video Processing Pipeline")
    print("="*60)
    
    try:
        init_clients()
    except ValueError as e:
        print(f"FOUT bij initialisatie: {e}")
        return
    
    result = supabase.table("video_ingest_jobs").select("*").eq("id", job_id).execute()
    
    if not result.data:
        print(f"FOUT: Job {job_id} niet gevonden")
        return
    
    job = result.data[0]
    
    print("Google Drive access token ophalen...")
    try:
        access_token = get_google_access_token()
        print("✓ Google Drive verbonden")
    except ValueError as e:
        print(f"FOUT: {e}")
        return
    
    process_single_job(job, access_token)


def main():
    parser = argparse.ArgumentParser(description="Process video ingest jobs")
    parser.add_argument("--job-id", help="Process a specific job by ID")
    args = parser.parse_args()
    
    if args.job_id:
        process_single_by_id(args.job_id)
    else:
        process_all_pending()


if __name__ == "__main__":
    main()
