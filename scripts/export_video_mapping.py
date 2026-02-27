#!/usr/bin/env python3
"""
Export Video Mapping from Supabase

Generates video-mapping.json based on real videos in video_ingest_jobs table.
Maps videos to EPIC techniques from technieken_index.json (SSOT).

Usage:
    python scripts/export_video_mapping.py
"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    os.system("pip install supabase")
    from supabase import create_client

TECHNIEKEN_FILE = Path("src/data/technieken_index.json")
OUTPUT_FILE = Path("src/data/video-mapping.json")


def init_supabase():
    """Initialize Supabase client."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    
    return create_client(url, key)


def load_technieken():
    """Load EPIC techniques from SSOT."""
    with open(TECHNIEKEN_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("technieken", {})


def get_fase_number(techniek_nummer):
    """Extract fase number from technique number."""
    if not techniek_nummer:
        return None
    first_char = techniek_nummer.split('.')[0]
    if first_char.isdigit():
        return int(first_char)
    return 0


def get_fase_naam(fase_num):
    """Get fase name from number."""
    fase_map = {
        0: "Pre-contactfase",
        1: "Openingsfase",
        2: "Ontdekkingsfase",
        3: "Aanbevelingsfase",
        4: "Beslissingsfase"
    }
    return fase_map.get(fase_num, "Onbekend")


def main():
    print("=" * 70)
    print("Video Mapping Export from Supabase")
    print("=" * 70)
    
    try:
        supabase = init_supabase()
        print("✓ Supabase connected")
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    
    technieken = load_technieken()
    print(f"✓ Loaded {len(technieken)} techniques from SSOT")
    
    print("\nFetching videos from video_ingest_jobs...")
    result = supabase.table("video_ingest_jobs").select(
        "id, video_title, drive_file_name, fase, techniek_id, ai_suggested_techniek_id, "
        "duration_seconds, status, transcript, mux_asset_id, mux_playback_id, ai_confidence, is_hidden, ai_attractive_title"
    ).is_("deleted_at", "null").order("drive_file_name").execute()
    
    videos = result.data
    print(f"Found {len(videos)} videos in database")
    
    video_mapping = {
        "_meta": {
            "description": "Mapping van video bestanden naar technieken en metadata",
            "updated": datetime.now().strftime("%Y-%m-%d"),
            "source": "Supabase video_ingest_jobs",
            "total_videos": len(videos)
        },
        "videos": {},
        "techniek_videos": {},
        "fase_videos": {
            "0": [],
            "1": [],
            "2": [],
            "3": [],
            "4": []
        },
        "status_summary": {
            "total": len(videos),
            "with_techniek": 0,
            "with_ai_suggested": 0,
            "with_mux": 0,
            "with_transcript": 0
        }
    }
    
    for v in videos:
        file_name = v.get("drive_file_name") or v.get("video_title") or f"video_{v['id']}"
        techniek_id = v.get("techniek_id")
        ai_techniek = v.get("ai_suggested_techniek_id")
        
        effective_techniek = techniek_id or ai_techniek
        fase_num = get_fase_number(effective_techniek)
        
        techniek_info = technieken.get(effective_techniek, {}) if effective_techniek else {}
        
        video_entry = {
            "id": v["id"],
            "title": v.get("ai_attractive_title") or v.get("video_title") or file_name.replace(".mp4", "").replace(".m4a", "").replace("_", " "),
            "file_name": file_name,
            "fase": fase_num,
            "fase_naam": get_fase_naam(fase_num),
            "techniek": effective_techniek,
            "techniek_naam": techniek_info.get("naam", ""),
            "techniek_source": "manual" if techniek_id else ("ai" if ai_techniek else "none"),
            "duration_seconds": v.get("duration_seconds"),
            "status": v.get("status"),
            "has_transcript": bool(v.get("transcript")),
            "ai_confidence": v.get("ai_confidence"),
            "is_hidden": v.get("is_hidden", False),
            "has_mux": bool(v.get("mux_asset_id")),
            "mux_playback_id": v.get("mux_playback_id")
        }
        
        video_mapping["videos"][file_name] = video_entry
        
        if effective_techniek:
            if effective_techniek not in video_mapping["techniek_videos"]:
                video_mapping["techniek_videos"][effective_techniek] = []
            video_mapping["techniek_videos"][effective_techniek].append(file_name)
            video_mapping["status_summary"]["with_techniek" if techniek_id else "with_ai_suggested"] += 1
        
        if fase_num is not None:
            video_mapping["fase_videos"][str(fase_num)].append(file_name)
        
        if v.get("mux_asset_id"):
            video_mapping["status_summary"]["with_mux"] += 1
        if v.get("transcript_status") == "completed":
            video_mapping["status_summary"]["with_transcript"] += 1
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(video_mapping, f, ensure_ascii=False, indent=2)
    
    config_path = Path("config/video_mapping.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(video_mapping, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 70)
    print("EXPORT COMPLETE")
    print("=" * 70)
    print(f"Output file: {OUTPUT_FILE}")
    print(f"Config file: {config_path}")
    print(f"\nSummary:")
    print(f"  Total videos:        {video_mapping['status_summary']['total']}")
    print(f"  With manual techniek: {video_mapping['status_summary']['with_techniek']}")
    print(f"  With AI suggested:   {video_mapping['status_summary']['with_ai_suggested']}")
    print(f"  With Mux:            {video_mapping['status_summary']['with_mux']}")
    print(f"  With transcript:     {video_mapping['status_summary']['with_transcript']}")
    
    print("\nVideos per fase:")
    for fase, vids in video_mapping["fase_videos"].items():
        print(f"  Fase {fase}: {len(vids)} videos")
    
    print(f"\nTechnieken met videos: {len(video_mapping['techniek_videos'])}")


if __name__ == "__main__":
    main()
