/**
 * Agent-Reach Persistent Cloud Database Client
 * Powered by PostgreSQL on Supabase / Neon
 */

export const DB_CONFIG = {
  url: "https://bhcxnfnrzaoicmosuodc.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY3huZm5yemFvaWNtb3N1b2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTI3NTcsImV4cCI6MjA5MjYyODc1N30.mrGX-2i46Ae-lLkSDzaYJ2gJa5117PFqsFVIvHZYJvc",
  tables: {
    leads: "agent_reach_leads",
    triage: "agent_reach_triage",
    leadTriage: "lead_triage",
    memory: "agent_reach_memory",
    analytics: "agent_reach_outreach_analytics",
  },
};

export interface RemoteTriageRow {
  uid: string;
  id: number;
  username: string;
  bucket: "inbox" | "sent" | "invalid";
  replied: boolean;
  updated_at?: string;
  sent_at?: string;
  replied_at?: string;
}

/**
 * Fetch all triage statuses from PostgreSQL
 */
export async function fetchRemoteTriage(): Promise<Record<string, { bucket: "inbox" | "sent" | "invalid"; replied: boolean; updatedAt: string }>> {
  try {
    const res = await fetch(
      `${DB_CONFIG.url}/rest/v1/${DB_CONFIG.tables.triage}?select=uid,id,username,bucket,replied,updated_at`,
      {
        headers: {
          apikey: DB_CONFIG.anonKey,
          Authorization: `Bearer ${DB_CONFIG.anonKey}`,
        },
      }
    );

    if (!res.ok) return {};

    const rows: RemoteTriageRow[] = await res.json();
    const map: Record<string, { bucket: "inbox" | "sent" | "invalid"; replied: boolean; updatedAt: string }> = {};

    for (const r of rows) {
      map[r.uid] = {
        bucket: r.bucket || "inbox",
        replied: Boolean(r.replied),
        updatedAt: r.updated_at || "",
      };
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Persist a lead triage action to PostgreSQL
 */
export async function persistRemoteTriage(
  uid: string,
  record: { bucket: "inbox" | "sent" | "invalid"; replied: boolean }
): Promise<boolean> {
  try {
    const body = {
      uid,
      bucket: record.bucket,
      replied: record.replied,
      updated_at: new Date().toISOString(),
      sent_at: record.bucket === "sent" ? new Date().toISOString() : null,
      replied_at: record.replied ? new Date().toISOString() : null,
    };

    // Upsert to agent_reach_triage
    await fetch(`${DB_CONFIG.url}/rest/v1/${DB_CONFIG.tables.triage}?on_conflict=uid`, {
      method: "POST",
      headers: {
        apikey: DB_CONFIG.anonKey,
        Authorization: `Bearer ${DB_CONFIG.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    });

    // Also update lead_triage
    await fetch(`${DB_CONFIG.url}/rest/v1/${DB_CONFIG.tables.leadTriage}?uid=eq.${uid}`, {
      method: "PATCH",
      headers: {
        apikey: DB_CONFIG.anonKey,
        Authorization: `Bearer ${DB_CONFIG.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucket: record.bucket,
        replied: record.replied,
        updated_at: new Date().toISOString(),
      }),
    });

    return true;
  } catch {
    return false;
  }
}
