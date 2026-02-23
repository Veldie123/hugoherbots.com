#!/usr/bin/env python3
"""
Sync Storage bucket files to roleplay_uploads database.
Creates database records for files that exist in Storage but not in the database.

Usage:
    python scripts/sync_storage_to_db.py
"""

import os
from datetime import datetime

try:
    from supabase import create_client, Client
except ImportError:
    print("Installing supabase...")
    os.system("pip install supabase")
    from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

BUCKET_NAME = "roleplay-uploads"
ADMIN_USER_ID = None  # Will be fetched from first admin user

supabase: Client = None


def init_client():
    global supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Connected to Supabase: {SUPABASE_URL[:40]}...")


def get_admin_user_id() -> str:
    """Get the first admin user ID (hugoherbots.com email)."""
    result = supabase.rpc("get_admin_user_id").execute()
    if result.data:
        return result.data
    
    # Fallback: try to get from auth.users via a workaround
    # This requires service role key
    print("Let op: Kan geen admin user ID ophalen. Gebruik een service role key.")
    print("Of geef handmatig een user_id op.")
    return None


def list_storage_files(folder: str = "") -> list:
    """List all files in the Storage bucket with pagination."""
    all_files = []
    offset = 0
    limit = 100
    
    try:
        while True:
            result = supabase.storage.from_(BUCKET_NAME).list(
                folder,
                {"limit": limit, "offset": offset}
            )
            
            if not result:
                break
                
            for item in result:
                if item.get("id"):  # It's a file
                    path = f"{folder}/{item['name']}" if folder else item["name"]
                    all_files.append({
                        "name": item["name"],
                        "path": path,
                        "size": item.get("metadata", {}).get("size", 0),
                        "mimetype": item.get("metadata", {}).get("mimetype", "audio/mpeg"),
                    })
                else:  # It's a folder
                    subfolder = f"{folder}/{item['name']}" if folder else item["name"]
                    all_files.extend(list_storage_files(subfolder))
            
            if len(result) < limit:
                break
            
            offset += limit
            print(f"  ... {len(all_files)} bestanden gevonden, meer ophalen...")
        
        return all_files
    except Exception as e:
        print(f"Error listing files: {e}")
        return all_files


def get_existing_paths() -> set:
    """Get all storage paths already in the database."""
    result = supabase.table("roleplay_uploads").select("storage_path").execute()
    return {r["storage_path"] for r in result.data}


def create_upload_record(file: dict, user_id: str) -> bool:
    """Create a database record for a file."""
    try:
        storage_path = f"roleplay-uploads/{file['path']}"
        
        data = {
            "user_id": user_id,
            "file_name": file["name"],
            "file_size": file["size"] or 1000000,
            "file_type": file["mimetype"] or "audio/mpeg",
            "storage_path": storage_path,
            "title": file["name"].replace("_", " ").rsplit(".", 1)[0],
            "description": "Hugo training video",
            "status": "pending",
        }
        
        supabase.table("roleplay_uploads").insert(data).execute()
        return True
    except Exception as e:
        print(f"  Error creating record for {file['name']}: {e}")
        return False


def main():
    print(f"\n{'='*60}")
    print("Storage to Database Sync")
    print(f"{'='*60}")
    
    init_client()
    
    # Get admin user ID - ask user for it
    print("\nVoer de admin user_id in (te vinden in Supabase → Auth → Users):")
    print("(Dit is de UUID van het @hugoherbots.com account)")
    user_id = input("User ID: ").strip()
    
    if not user_id:
        print("Geen user_id opgegeven. Stoppen.")
        return
    
    print(f"\nGebruiker: {user_id}")
    
    # List files in Storage
    print("\nBestanden ophalen uit Storage bucket...")
    files = list_storage_files()
    
    if not files:
        print("Geen bestanden gevonden in de bucket.")
        return
    
    print(f"Gevonden: {len(files)} bestanden")
    
    # Get existing records
    print("Bestaande database records ophalen...")
    existing = get_existing_paths()
    print(f"Bestaande records: {len(existing)}")
    
    # Find new files
    new_files = [f for f in files if f"roleplay-uploads/{f['path']}" not in existing]
    print(f"Nieuwe bestanden: {len(new_files)}")
    
    if not new_files:
        print("\nAlle bestanden hebben al een database record.")
        return
    
    # Create records
    print(f"\n{'='*60}")
    print("Database records aanmaken...")
    print(f"{'='*60}\n")
    
    created = 0
    failed = 0
    
    for i, file in enumerate(new_files, 1):
        print(f"[{i}/{len(new_files)}] {file['name']}...", end=" ")
        if create_upload_record(file, user_id):
            print("OK")
            created += 1
        else:
            print("FOUT")
            failed += 1
    
    print(f"\n{'='*60}")
    print("KLAAR!")
    print(f"{'='*60}")
    print(f"Aangemaakt: {created}")
    print(f"Mislukt: {failed}")
    print(f"\nJe kunt nu 'python scripts/process_uploads.py' uitvoeren")
    print("om alle uploads te transcriberen met ElevenLabs.")


if __name__ == "__main__":
    main()
