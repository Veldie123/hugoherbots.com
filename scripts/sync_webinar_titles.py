#!/usr/bin/env python3
"""
Sync Webinar Titles from Video Library

Genereert commerciële webinar-titels gebaseerd op de samenvattingen van de 56
gepubliceerde video's. Slaat de video→webinar mapping op in Supabase zodat
toekomstige wijzigingen aan video-volgorde of -inhoud automatisch de webinar-
titels updaten.

Gebruik:
    python3 scripts/sync_webinar_titles.py [--dry-run] [--force]

Flags:
    --dry-run   Alleen preview tonen, niets updaten
    --force     Update ook al heeft de webinar al een gegenereerde titel

Omgevingsvariabelen:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
    (of AI_INTEGRATIONS_OPENAI_API_KEY)
"""

import os
import sys
import json
import argparse
from openai import OpenAI
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_KEY = os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
OPENAI_BASE = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")

def get_clients():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt")
        sys.exit(1)
    if not OPENAI_KEY:
        print("❌ OPENAI_API_KEY ontbreekt")
        sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    kwargs = {"api_key": OPENAI_KEY}
    if OPENAI_BASE:
        kwargs["base_url"] = OPENAI_BASE
    ai = OpenAI(**kwargs)
    return sb, ai


def fetch_published_videos(sb):
    """Haal de 56 gepubliceerde video's op in playback_order volgorde."""
    resp = (sb.from_("video_ingest_jobs")
            .select("id, ai_attractive_title, ai_summary, techniek_id, fase, playback_order")
            .eq("status", "completed")
            .eq("is_hidden", False)
            .not_.is_("mux_playback_id", "null")
            .order("playback_order", desc=False)
            .execute())
    if resp.data is None:
        print("❌ Kon video's niet ophalen:", resp)
        sys.exit(1)
    print(f"✓ {len(resp.data)} gepubliceerde video's geladen")
    return resp.data


def fetch_webinar_sessions(sb):
    """Haal alle live_sessions op in volgorde."""
    resp = (sb.from_("live_sessions")
            .select("id, title, description, phase_id, scheduled_date, video_cluster_ids")
            .order("scheduled_date", desc=False)
            .execute())
    if resp.data is None:
        print("❌ Kon webinars niet ophalen:", resp)
        sys.exit(1)
    print(f"✓ {len(resp.data)} webinar-sessies geladen")
    return resp.data


def ensure_cluster_column(sb):
    """Controleer of video_cluster_ids kolom bestaat; geef instructie als niet."""
    try:
        sb.from_("live_sessions").select("video_cluster_ids").limit(1).execute()
    except Exception:
        print("\n⚠️  Supabase kolom 'video_cluster_ids' ontbreekt in live_sessions.")
        print("Voer dit uit in de Supabase SQL Editor:")
        print("  ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS video_cluster_ids TEXT[] DEFAULT '{}';")
        print("  ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS title_generated BOOLEAN DEFAULT false;")
        sys.exit(1)


def build_prompt(videos, sessions):
    """Bouw de OpenAI prompt op met alle video- en webinar-data."""

    video_list = []
    for v in videos:
        video_list.append({
            "id": v["id"],
            "order": v["playback_order"],
            "fase": v["fase"],
            "title": v["ai_attractive_title"] or "",
            "summary": (v["ai_summary"] or "")[:150]
        })

    session_list = []
    for s in sessions:
        session_list.append({
            "id": s["id"],
            "current_title": s["title"],
            "phase_id": s["phase_id"]
        })

    style_examples = [
        "De EPIC Sales Engine in de praktijk",
        "Van informatieverkoper naar waarde-architect",
        "Wie is jouw klant echt?",
        "De pre-contactfase: cruciaal voor sales succes",
        "Herkennen van sociale gedragsstijlen in verkoopgesprekken",
        "Hoe je de motivatie van de prospect achterhaalt",
        "Bezwaren analyseren en isoleren",
        "Proefafsluiting en vragen effectief sturen"
    ]

    prompt = f"""Je bent een expert in verkooptraining die commerciële, pakkende titels schrijft voor live webinars.

GEPUBLICEERDE VIDEO'S (56 stuks, in volgorde van de video-bibliotheek):
{json.dumps(video_list, ensure_ascii=False, indent=2)}

WEBINAR SESSIES (42 stuks, in chronologische volgorde):
{json.dumps(session_list, ensure_ascii=False, indent=2)}

STIJLGIDS — deze titels zijn het voorbeeld:
{chr(10).join(f'- {t}' for t in style_examples)}

OPDRACHT:
Voor elke webinar-sessie:
1. Identificeer 3-6 video-IDs uit de bovenstaande lijst die het BEST passen bij het onderwerp van die webinar (gebruik current_title + phase_id als hint, en kies qua volgorde passende video's)
2. Genereer een commerciële Nederlandse webinar-titel op basis van de samenvattingen van die video's

REGELS voor de nieuwe titel:
- Maximaal 65 tekens
- Geen "Live Coaching:" prefix
- Resultaatgericht of inzichtgevend ("Hoe je...", "Van X naar Y", "De kunst van...", "Wie is...", "Waarom...")
- Spreek de verkoper direct aan
- Mag overlappende thema's samenvatten (een webinar dekt meerdere gerelateerde onderwerpen)

ANTWOORD als JSON array (geen markdown):
[
  {{
    "session_id": "...",
    "video_ids": ["id1", "id2", "id3"],
    "new_title": "..."
  }},
  ...
]

Geef voor ALLE {len(sessions)} sessies een resultaat terug."""

    return prompt


def generate_titles(ai, videos, sessions):
    """Roep OpenAI aan om titels te genereren en video-clusters te mappen."""
    print("\n🤖 OpenAI aanroepen voor titel-generatie...")

    prompt = build_prompt(videos, sessions)

    response = ai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4000,
        temperature=0.7
    )

    content = response.choices[0].message.content.strip()

    # Strip eventuele markdown code blocks
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        results = json.loads(content)
        print(f"✓ {len(results)} titels gegenereerd")
        return results
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse fout: {e}")
        print("Raw response:", content[:500])
        sys.exit(1)


def show_preview(sessions_by_id, results):
    """Toon een preview-tabel van oud → nieuw."""
    print("\n" + "="*80)
    print("PREVIEW — Nieuwe webinar-titels")
    print("="*80)
    print(f"{'#':<3} {'HUIDIG':<45} {'NIEUW':<45}")
    print("-"*93)

    for i, r in enumerate(results, 1):
        old = sessions_by_id.get(r["session_id"], {}).get("title", "?")[:44]
        new = r.get("new_title", "?")[:44]
        videos = r.get("video_ids", [])
        print(f"{i:<3} {old:<45} {new:<45}")
        print(f"    ↳ {len(videos)} video's gekoppeld: {', '.join(str(v)[:8] for v in videos[:4])}...")

    print("="*80)


def update_supabase(sb, sessions_by_id, results, force=False):
    """Update titels en video_cluster_ids in Supabase."""
    updated = 0
    skipped = 0
    failed = 0

    for r in results:
        sid = r.get("session_id")
        new_title = r.get("new_title", "").strip()
        video_ids = r.get("video_ids", [])

        if not sid or not new_title:
            failed += 1
            continue

        session = sessions_by_id.get(sid)
        if not session:
            print(f"  ⚠️  Sessie {sid} niet gevonden, overslaan")
            failed += 1
            continue

        # Skip als al gegenereerd en force niet actief
        if session.get("title_generated") and not force:
            skipped += 1
            continue

        try:
            sb.from_("live_sessions").update({
                "title": new_title,
                "video_cluster_ids": video_ids,
                "title_generated": True
            }).eq("id", sid).execute()
            print(f"  ✓ {new_title[:60]}")
            updated += 1
        except Exception as e:
            # Kolom video_cluster_ids of title_generated kan ontbreken — update dan enkel titel
            try:
                sb.from_("live_sessions").update({
                    "title": new_title
                }).eq("id", sid).execute()
                print(f"  ✓ {new_title[:60]} (zonder cluster-mapping)")
                updated += 1
            except Exception as e2:
                print(f"  ❌ Fout bij {sid}: {e2}")
                failed += 1

    print(f"\n✅ Klaar: {updated} bijgewerkt, {skipped} overgeslagen, {failed} mislukt")
    return updated


def main():
    parser = argparse.ArgumentParser(description="Sync webinar titels van video-bibliotheek")
    parser.add_argument("--dry-run", action="store_true", help="Alleen preview, geen updates")
    parser.add_argument("--force", action="store_true", help="Update ook al gegenereerde titels")
    args = parser.parse_args()

    print("🎬 HugoHerbots — Webinar Titel Sync")
    print("="*40)

    sb, ai = get_clients()
    ensure_cluster_column(sb)

    videos = fetch_published_videos(sb)
    sessions = fetch_webinar_sessions(sb)

    sessions_by_id = {s["id"]: s for s in sessions}

    results = generate_titles(ai, videos, sessions)
    show_preview(sessions_by_id, results)

    if args.dry_run:
        print("\n⏸  Dry-run modus — geen updates uitgevoerd")
        return

    print(f"\nDit zal {len(results)} webinar-titels bijwerken in Supabase.")
    confirm = input("Druk Enter om door te gaan, of Ctrl+C om te annuleren: ")

    update_supabase(sb, sessions_by_id, results, force=args.force)

    print("\n🔄 Webinar-pagina toont nu de nieuwe titels na refresh.")


if __name__ == "__main__":
    main()
