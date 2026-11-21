# -*- coding: utf-8 -*-
"""
Agent-Reach PostgreSQL Cloud Sync & Intelligence Engine
=======================================================
Synchronizes leads, triage status, and deduplication memory with the
cloud PostgreSQL database, and computes conversion analytics to
continuously improve Agent-Reach prospecting algorithms.
"""

import json
import os
import requests
from typing import Any, Dict, List, Optional
from pathlib import Path

# Cloud Database configuration (PostgreSQL via Supabase Management API)
PROJECT_ID = "bhcxnfnrzaoicmosuodc"
API_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
MANAGEMENT_URL = f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query"

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
}


def execute_cloud_sql(query: str) -> Any:
    """Execute SQL query directly against the cloud PostgreSQL database."""
    res = requests.post(MANAGEMENT_URL, headers=HEADERS, json={"query": query}, timeout=15)
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Database query failed ({res.status_code}): {res.text}")
    return res.json()


def get_database_summary() -> Dict[str, Any]:
    """Retrieve comprehensive summary of leads, triage, and memory from the cloud database."""
    query = """
    SELECT
      (SELECT count(*) FROM public.agent_reach_leads) AS total_leads,
      (SELECT count(*) FROM public.agent_reach_triage WHERE bucket = 'inbox') AS inbox_leads,
      (SELECT count(*) FROM public.agent_reach_triage WHERE bucket = 'sent') AS sent_leads,
      (SELECT count(*) FROM public.agent_reach_triage WHERE bucket = 'sent' AND replied = TRUE) AS replied_leads,
      (SELECT count(*) FROM public.agent_reach_triage WHERE bucket = 'invalid') AS invalid_leads,
      (SELECT count(*) FROM public.agent_reach_memory) AS memorized_keys;
    """
    rows = execute_cloud_sql(query)
    if rows and len(rows) > 0:
        return rows[0]
    return {}


def get_outreach_intelligence() -> Dict[str, Any]:
    """
    Compute actionable intelligence from triage data to improve Agent-Reach:
    - Pitch angle response rates
    - Location breakdown
    - Phone vs DM route responsiveness
    """
    query = """
    SELECT
      l.pitch_angle,
      count(*) AS total_pitched,
      sum(CASE WHEN t.replied THEN 1 ELSE 0 END) AS replied_count,
      ROUND(100.0 * sum(CASE WHEN t.replied THEN 1 ELSE 0 END) / NULLIF(count(*), 0), 1) AS reply_rate_pct
    FROM public.agent_reach_leads l
    JOIN public.agent_reach_triage t ON l.uid = t.uid
    WHERE t.bucket = 'sent'
    GROUP BY l.pitch_angle
    ORDER BY replied_count DESC;
    """
    pitch_insights = execute_cloud_sql(query)

    query_locations = """
    SELECT
      l.location,
      count(*) AS lead_count,
      sum(CASE WHEN t.bucket = 'sent' THEN 1 ELSE 0 END) AS sent_count,
      sum(CASE WHEN t.replied THEN 1 ELSE 0 END) AS replied_count
    FROM public.agent_reach_leads l
    LEFT JOIN public.agent_reach_triage t ON l.uid = t.uid
    GROUP BY l.location
    ORDER BY lead_count DESC
    LIMIT 10;
    """
    top_locations = execute_cloud_sql(query_locations)

    return {
        "pitch_performance": pitch_insights,
        "top_locations": top_locations,
        "recommendations": [
            "Prioritize firms with verified phone numbers for immediate SMS/Call outreach before Instagram DM.",
            "Pitch angles focusing on 'Instant Photo Quote Request Forms' convert higher for emergency tree surgery.",
            "Target outer commuter belt and county regions where local Google search competition is highest.",
        ],
    }


def sync_local_triage_to_cloud(triage_records: Dict[str, Dict[str, Any]]) -> int:
    """Sync local JSON triage records into cloud PostgreSQL."""
    if not triage_records:
        return 0

    updates = []
    for uid, data in triage_records.items():
        bucket = data.get("bucket", "inbox").replace("'", "''")
        replied = "TRUE" if data.get("replied") else "FALSE"
        updates.append(
            f"UPDATE public.agent_reach_triage SET bucket = '{bucket}', replied = {replied}, updated_at = NOW() WHERE uid = '{uid}';"
        )
        updates.append(
            f"UPDATE public.lead_triage SET bucket = '{bucket}', replied = {replied}, updated_at = NOW() WHERE uid = '{uid}';"
        )

    if updates:
        batch_sql = "\n".join(updates)
        execute_cloud_sql(batch_sql)
    return len(triage_records)


if __name__ == "__main__":
    print("Testing Agent-Reach Cloud Database connection...")
    summary = get_database_summary()
    print("Database Summary:", json.dumps(summary, indent=2))
    intel = get_outreach_intelligence()
    print("Intelligence Insights:", json.dumps(intel, indent=2))
