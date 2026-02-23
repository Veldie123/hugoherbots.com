#!/usr/bin/env python3
"""
One-time fix: Update existing Mux assets with their playback_ids.
For videos that were processed before the playback_id polling was added.
"""

import os
import base64
import requests
from supabase import create_client

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
mux_token_id = os.environ.get("MUX_TOKEN_ID")
mux_token_secret = os.environ.get("MUX_TOKEN_SECRET")

if not all([supabase_url, supabase_key, mux_token_id, mux_token_secret]):
    print("Missing environment variables")
    exit(1)

supabase = create_client(supabase_url, supabase_key)
credentials = base64.b64encode(f"{mux_token_id}:{mux_token_secret}".encode()).decode()
headers = {"Authorization": f"Basic {credentials}"}

# Get all jobs with mux_asset_id but no mux_playback_id
result = supabase.table("video_ingest_jobs").select("id, drive_file_name, mux_asset_id, mux_playback_id").not_.is_("mux_asset_id", "null").execute()

jobs = result.data or []
print(f"Gevonden: {len(jobs)} jobs met mux_asset_id")

updated = 0
for job in jobs:
    file_name = job.get("drive_file_name", "unknown")
    if job.get("mux_playback_id"):
        print(f"  {file_name}: al heeft playback_id")
        continue
    
    asset_id = job.get("mux_asset_id")
    if not asset_id:
        continue
    
    # Fetch asset from Mux API
    try:
        response = requests.get(f"https://api.mux.com/video/v1/assets/{asset_id}", headers=headers)
        if response.status_code == 200:
            data = response.json().get("data", {})
            status = data.get("status")
            playback_ids = data.get("playback_ids", [])
            
            if status == "ready" and playback_ids:
                playback_id = playback_ids[0].get("id")
                
                # Update in database
                supabase.table("video_ingest_jobs").update({
                    "mux_playback_id": playback_id,
                    "mux_status": "ready"
                }).eq("id", job["id"]).execute()
                
                print(f"  ✓ {file_name}: playback_id = {playback_id}")
                updated += 1
            elif status == "errored":
                print(f"  ✗ {file_name}: Mux error")
            else:
                print(f"  ⏳ {file_name}: status = {status}")
        else:
            print(f"  ✗ {file_name}: API error {response.status_code}")
    except Exception as e:
        print(f"  ✗ {file_name}: {e}")

print(f"\n✓ {updated} video's bijgewerkt met playback_id")
