#!/usr/bin/env python3
"""
Script om bestaande zaterdagsessies naar maandag te verplaatsen.
Sessies op zondag worden ook naar maandag verplaatst.

Gebruik:
  python scripts/move-saturday-sessions.py --dry-run  # Bekijk wijzigingen
  python scripts/move-saturday-sessions.py            # Voer wijzigingen uit
"""

import os
import sys
from datetime import datetime, timedelta
from supabase import create_client

# Load environment
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def main():
    dry_run = "--dry-run" in sys.argv
    
    if dry_run:
        print("🔍 DRY RUN - geen wijzigingen worden doorgevoerd\n")
    
    # Haal alle sessies op
    result = supabase.table("live_sessions").select("id, title, scheduled_date, status").execute()
    sessions = result.data or []
    
    print(f"📋 {len(sessions)} sessies gevonden\n")
    
    weekend_sessions = []
    
    for session in sessions:
        scheduled_date = session.get("scheduled_date")
        if not scheduled_date:
            continue
            
        dt = datetime.fromisoformat(scheduled_date.replace("Z", "+00:00"))
        day_of_week = dt.weekday()  # 0=maandag, 5=zaterdag, 6=zondag
        
        if day_of_week == 5:  # Zaterdag
            new_dt = dt + timedelta(days=2)  # Naar maandag
            weekend_sessions.append({
                "session": session,
                "old_date": dt,
                "new_date": new_dt,
                "reason": "zaterdag → maandag"
            })
        elif day_of_week == 6:  # Zondag
            new_dt = dt + timedelta(days=1)  # Naar maandag
            weekend_sessions.append({
                "session": session,
                "old_date": dt,
                "new_date": new_dt,
                "reason": "zondag → maandag"
            })
    
    if not weekend_sessions:
        print("✅ Geen sessies op weekend gevonden. Alles is al ma-vr gepland.")
        return
    
    print(f"⚠️  {len(weekend_sessions)} sessies op weekend gevonden:\n")
    
    for item in weekend_sessions:
        session = item["session"]
        old_str = item["old_date"].strftime("%A %d-%m-%Y %H:%M")
        new_str = item["new_date"].strftime("%A %d-%m-%Y %H:%M")
        print(f"  📅 {session['title'][:40]}")
        print(f"     {item['reason']}: {old_str} → {new_str}")
        print()
    
    if dry_run:
        print("🔍 Voer zonder --dry-run uit om wijzigingen door te voeren")
        return
    
    # Voer updates uit
    print("🔄 Wijzigingen doorvoeren...\n")
    
    for item in weekend_sessions:
        session = item["session"]
        new_date_iso = item["new_date"].isoformat()
        
        try:
            supabase.table("live_sessions").update({
                "scheduled_date": new_date_iso
            }).eq("id", session["id"]).execute()
            print(f"  ✅ {session['title'][:40]} verplaatst")
        except Exception as e:
            print(f"  ❌ Fout bij {session['title'][:40]}: {e}")
    
    print(f"\n✅ {len(weekend_sessions)} sessies verplaatst naar maandag")

if __name__ == "__main__":
    main()
