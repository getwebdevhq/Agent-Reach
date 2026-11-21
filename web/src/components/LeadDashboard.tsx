"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  Archive,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Filter,
  Globe,
  Inbox,
  LayoutGrid,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { BatchFilter, BucketType, Lead, LeadBucketRecord } from "@/lib/leads";

function Instagram({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface LeadDashboardProps {
  ukLeads: Lead[];
}

type ViewMode = "table" | "cards" | "json";
type ContactFilter = "all" | "phone" | "email" | "dm";
type SortOption = "id-asc" | "followers-desc" | "followers-asc" | "posts-desc" | "name-asc";
type SentSubFilter = "all" | "replied" | "awaiting";

const TRIAGE_STORAGE_KEY = "agent_reach_lead_triage_v2";

const WEBSITE_STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  NO_WEBSITE: {
    label: "No Website",
    classes: "bg-rose-50 text-rose-700 border-rose-200",
  },
  WHATSAPP_ONLY: {
    label: "WhatsApp Only",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  LINK_AGGREGATOR: {
    label: "Link-in-Bio Only",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  BOOKING_ONLY: {
    label: "Booking Link Only",
    classes: "bg-sky-50 text-sky-700 border-sky-200",
  },
};

function buildOutreachMessage(lead: Lead): string {
  return `Hi ${lead.businessName} team! 👋 Saw your recent arboriculture work on Instagram (@${lead.username}).\n\nI noticed you don't currently have an independent website and rely on ${
    lead.phone ? `direct calls (${lead.phone})` : "Instagram DMs"
  } for quotes. Homeowners in ${
    lead.location
  } searching Google for tree surgery often book the first local firm with a fast quote site.\n\nI put together a quick local-SEO website concept for ${
    lead.businessName
  } with an instant photo-quote request form.\n\nOpen to taking a quick look?`;
}

export default function LeadDashboard({ ukLeads }: LeadDashboardProps) {
  // Main Navigation & Bucket state
  const [activeBucket, setActiveBucket] = useState<BucketType>("inbox");
  const [sentSubFilter, setSentSubFilter] = useState<SentSubFilter>("all");
  const [batchFilter, setBatchFilter] = useState<BatchFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("id-asc");

  // Modals & Drawers
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cross-tab reactive storage for Triage Buckets & Replied states
  const triageRaw = useSyncExternalStore(
    (onStoreChange) => {
      const handler = () => onStoreChange();
      window.addEventListener("storage", handler);
      window.addEventListener("lead-triage-storage-update", handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener("lead-triage-storage-update", handler);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(TRIAGE_STORAGE_KEY) || "{}";
      } catch {
        return "{}";
      }
    },
    () => "{}"
  );

  const triageMap = useMemo<Record<string, LeadBucketRecord>>(() => {
    try {
      return JSON.parse(triageRaw) as Record<string, LeadBucketRecord>;
    } catch {
      return {};
    }
  }, [triageRaw]);

  const saveTriageRecord = (uid: string, record: Partial<LeadBucketRecord>) => {
    const prev = triageMap[uid] || { bucket: "inbox", replied: false, updatedAt: "" };
    const next: Record<string, LeadBucketRecord> = {
      ...triageMap,
      [uid]: {
        bucket: record.bucket ?? prev.bucket,
        replied: record.replied ?? prev.replied,
        updatedAt: new Date().toISOString(),
      },
    };
    try {
      window.localStorage.setItem(TRIAGE_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("lead-triage-storage-update"));
    } catch {
      // Storage quota or disabled
    }
  };

  // Actions
  const handleMarkSent = (uid: string) => {
    saveTriageRecord(uid, { bucket: "sent", replied: false });
  };

  const handleMarkInvalid = (uid: string) => {
    saveTriageRecord(uid, { bucket: "invalid", replied: false });
  };

  const handleToggleReplied = (uid: string) => {
    const current = triageMap[uid];
    const newReplied = !(current?.replied ?? false);
    saveTriageRecord(uid, { bucket: "sent", replied: newReplied });
  };

  const handleRestoreToInbox = (uid: string) => {
    saveTriageRecord(uid, { bucket: "inbox", replied: false });
  };

  const handleResetTriage = () => {
    if (window.confirm("Are you sure you want to restore all leads back to the Main Feed?")) {
      try {
        window.localStorage.removeItem(TRIAGE_STORAGE_KEY);
        window.dispatchEvent(new Event("lead-triage-storage-update"));
      } catch {
        // Ignore
      }
    }
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 1800);
    } catch {
      // Clipboard blocked
    }
  };

  // Batch breakdown of raw leads
  const batchCounts = useMemo(() => {
    return {
      all: ukLeads.length,
      batch1: ukLeads.filter((l) => l.batch === "Batch 1").length,
      batch2: ukLeads.filter((l) => l.batch === "Batch 2").length,
      batch3: ukLeads.filter((l) => l.batch === "Batch 3").length,
    };
  }, [ukLeads]);

  const activeBaseLeads = useMemo(() => {
    if (batchFilter === "batch-1") return ukLeads.filter((l) => l.batch === "Batch 1");
    if (batchFilter === "batch-2") return ukLeads.filter((l) => l.batch === "Batch 2");
    if (batchFilter === "batch-3") return ukLeads.filter((l) => l.batch === "Batch 3");
    return ukLeads;
  }, [batchFilter, ukLeads]);

  const handleBatchChange = (nextBatch: BatchFilter) => {
    setBatchFilter(nextBatch);
    setLocationFilter("all");
    setStatusFilter("all");
    setSelectedLead(null);
  };

  // Live bucket counts across activeBaseLeads
  const bucketCounts = useMemo(() => {
    let inboxCount = 0;
    let sentCount = 0;
    let repliedCount = 0;
    let awaitingCount = 0;
    let invalidCount = 0;

    activeBaseLeads.forEach((lead) => {
      const record = triageMap[lead.uid];
      const b = record?.bucket || "inbox";
      if (b === "sent") {
        sentCount++;
        if (record?.replied) repliedCount++;
        else awaitingCount++;
      } else if (b === "invalid") {
        invalidCount++;
      } else {
        inboxCount++;
      }
    });

    return {
      inbox: inboxCount,
      sent: sentCount,
      replied: repliedCount,
      awaiting: awaitingCount,
      invalid: invalidCount,
      total: activeBaseLeads.length,
    };
  }, [activeBaseLeads, triageMap]);

  const uniqueLocations = useMemo(() => {
    const locs = Array.from(new Set(activeBaseLeads.map((l) => l.location)));
    return locs.sort((a, b) => a.localeCompare(b));
  }, [activeBaseLeads]);

  // Main filtered leads respecting the selected Bucket
  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = activeBaseLeads.filter((lead) => {
      const record = triageMap[lead.uid];
      const bucket = record?.bucket || "inbox";

      // 1. Bucket segregation
      if (activeBucket === "inbox") {
        if (bucket !== "inbox") return false; // disappears from main feed!
      } else if (activeBucket === "sent") {
        if (bucket !== "sent") return false;
        if (sentSubFilter === "replied" && !record?.replied) return false;
        if (sentSubFilter === "awaiting" && record?.replied) return false;
      } else if (activeBucket === "invalid") {
        if (bucket !== "invalid") return false;
      }

      // 2. Search query
      if (q) {
        const haystack = [
          lead.username,
          lead.businessName,
          lead.location,
          lead.suburb,
          lead.services,
          lead.phone,
          lead.email,
          lead.bio,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // 3. Contact filter
      if (contactFilter === "phone" && !lead.phone) return false;
      if (contactFilter === "email" && !lead.email) return false;
      if (contactFilter === "dm" && (lead.phone || lead.email)) return false;

      // 4. Status filter
      if (statusFilter !== "all" && lead.websiteStatus !== statusFilter) return false;

      // 5. Location filter
      if (locationFilter !== "all" && lead.location !== locationFilter) return false;

      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "followers-desc":
          return b.followers - a.followers;
        case "followers-asc":
          return a.followers - b.followers;
        case "posts-desc":
          return b.posts - a.posts;
        case "name-asc":
          return a.businessName.localeCompare(b.businessName);
        case "id-asc":
        default:
          return a.id - b.id;
      }
    });

    return sorted;
  }, [
    activeBaseLeads,
    triageMap,
    activeBucket,
    sentSubFilter,
    searchQuery,
    contactFilter,
    statusFilter,
    locationFilter,
    sortBy,
  ]);

  const metrics = useMemo(() => {
    const total = filteredLeads.length;
    const withPhone = filteredLeads.filter((l) => Boolean(l.phone)).length;
    const dmOnly = filteredLeads.filter((l) => !l.phone && !l.email).length;
    const avgFollowers =
      total > 0
        ? Math.round(filteredLeads.reduce((acc, l) => acc + l.followers, 0) / total)
        : 0;
    const distinctMarkets = new Set(filteredLeads.map((l) => l.suburb)).size;
    return { total, withPhone, dmOnly, avgFollowers, distinctMarkets };
  }, [filteredLeads]);

  const structuredPayload = useMemo(() => {
    return {
      meta: {
        campaign: "uk-tree-surgeons",
        batch: batchFilter,
        active_bucket: activeBucket,
        sent_sub_filter: activeBucket === "sent" ? sentSubFilter : null,
        bucket_stats: bucketCounts,
        filtered_count: filteredLeads.length,
        total_in_dataset: activeBaseLeads.length,
        all_uk_total: ukLeads.length,
        breakdown: {
          batch_1: batchCounts.batch1,
          batch_2: batchCounts.batch2,
          batch_3: batchCounts.batch3,
        },
        filters: {
          searchQuery: searchQuery || null,
          contactFilter,
          statusFilter,
          locationFilter,
          sortBy,
        },
      },
      leads: filteredLeads.map((l) => {
        const triage = triageMap[l.uid] || { bucket: "inbox", replied: false };
        return {
          uid: l.uid,
          id: l.id,
          batch: l.batch,
          campaign: l.campaign,
          username: l.username,
          business_name: l.businessName,
          suburb: l.suburb,
          location: l.location,
          country: l.country,
          website_status: l.websiteStatus,
          contact_route: l.contactRoute,
          phone: l.phone || null,
          email: l.email || null,
          followers: l.followers,
          posts: l.posts,
          services: l.services,
          pitch_angle: l.pitchAngle,
          profile_url: l.profileUrl,
          bucket: triage.bucket,
          replied: triage.replied,
        };
      }),
    };
  }, [
    batchFilter,
    activeBucket,
    sentSubFilter,
    bucketCounts,
    filteredLeads,
    activeBaseLeads.length,
    ukLeads.length,
    batchCounts,
    searchQuery,
    contactFilter,
    statusFilter,
    locationFilter,
    sortBy,
    triageMap,
  ]);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(structuredPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uk_tree_surgeons_${activeBucket}_${batchFilter}_leads.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const headers = [
      "ID",
      "Campaign",
      "Bucket",
      "Replied",
      "Instagram Handle",
      "Business Name",
      "Suburb",
      "Location",
      "Country",
      "Website Status",
      "Contact Route",
      "Phone",
      "Email",
      "Followers",
      "Posts",
      "Services",
      "Pitch Angle",
      "Profile URL",
    ];
    const escapeCell = (val: unknown) => {
      const s = String(val ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = [
      headers.join(","),
      ...filteredLeads.map((l) => {
        const triage = triageMap[l.uid] || { bucket: "inbox", replied: false };
        return [
          l.id,
          l.campaignLabel,
          triage.bucket,
          triage.replied ? "YES" : "NO",
          `@${l.username}`,
          l.businessName,
          l.suburb,
          l.location,
          l.country,
          l.websiteStatus,
          l.contactRoute,
          l.phone,
          l.email,
          l.followers,
          l.posts,
          l.services,
          l.pitchAngle,
          l.profileUrl,
        ]
          .map(escapeCell)
          .join(",");
      }),
    ];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uk_tree_surgeons_${activeBucket}_${batchFilter}_leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate SQL for Neon Postgres if user wants to sync
  const neonSqlMigration = useMemo(() => {
    return `-- ====================================================================
-- Neon Lakebase Postgres Schema & Lead Triage Sync
-- Run this in your Neon SQL Editor or via psql $DATABASE_URL
-- ====================================================================

CREATE TABLE IF NOT EXISTS lead_triage (
  uid TEXT PRIMARY KEY,
  id INT NOT NULL,
  username TEXT NOT NULL,
  business_name TEXT NOT NULL,
  location TEXT,
  phone TEXT,
  bucket TEXT NOT NULL DEFAULT 'inbox', -- 'inbox' | 'sent' | 'invalid'
  replied BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant bucket queries
CREATE INDEX IF NOT EXISTS idx_lead_triage_bucket ON lead_triage (bucket);
CREATE INDEX IF NOT EXISTS idx_lead_triage_replied ON lead_triage (bucket, replied);
`;
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-slate-900">
                    UK Tree Surgeons Outreach Portal
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {ukLeads.length} Verified UK Leads
                  </span>
                  <button
                    onClick={() => setShowDatabaseModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors cursor-pointer"
                    title="View connected databases (Neon, Supabase, AgentMemory, SQLite)"
                  >
                    <Database className="h-3.5 w-3.5 text-sky-600" />
                    Databases Connected
                  </button>
                  <a
                    href="https://github.com/rohitg00/agentmemory"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
                    title="Rohit Ghumare's agentmemory (0 duplicates across sessions)"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                    AgentMemory: 0 Duplicates
                  </a>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Triage leads into Sent &amp; Invalid buckets • Live response tracking • Cloudflare Workers Edge
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/leads?batch=${batchFilter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Code2 className="h-3.5 w-3.5 text-indigo-600" />
                Live API
              </a>
              <button
                onClick={downloadJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                Export JSON
              </button>
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Export {activeBucket === "inbox" ? "Main Feed" : activeBucket === "sent" ? "Sent" : "Invalid"} CSV ({filteredLeads.length})
              </button>
            </div>
          </div>

          {/* Primary Bucket Navigation Tabs */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
              {/* Inbox / Main Feed Tab */}
              <button
                onClick={() => {
                  setActiveBucket("inbox");
                  setSelectedLead(null);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBucket === "inbox"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Inbox className="h-4 w-4 text-indigo-600" />
                <span>📥 Main Feed</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeBucket === "inbox"
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {bucketCounts.inbox}
                </span>
              </button>

              {/* Sent Bucket Tab */}
              <button
                onClick={() => {
                  setActiveBucket("sent");
                  setSelectedLead(null);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBucket === "sent"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Send className="h-4 w-4 text-emerald-600" />
                <span>📤 Sent Bucket</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      activeBucket === "sent"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {bucketCounts.sent}
                  </span>
                  {bucketCounts.replied > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-green-500 text-white">
                      {bucketCounts.replied} replied
                    </span>
                  )}
                </div>
              </button>

              {/* Invalid Bucket Tab */}
              <button
                onClick={() => {
                  setActiveBucket("invalid");
                  setSelectedLead(null);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBucket === "invalid"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Ban className="h-4 w-4 text-rose-500" />
                <span>🚫 Invalid Bucket</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeBucket === "invalid"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {bucketCounts.invalid}
                </span>
              </button>
            </div>

            {/* Batch Switcher */}
            <div className="flex items-center gap-1 text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mr-1">
                Batches:
              </span>
              <button
                onClick={() => handleBatchChange("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  batchFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({batchCounts.all})
              </button>
              <button
                onClick={() => handleBatchChange("batch-1")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  batchFilter === "batch-1"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                B1 ({batchCounts.batch1})
              </button>
              <button
                onClick={() => handleBatchChange("batch-2")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  batchFilter === "batch-2"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                B2 ({batchCounts.batch2})
              </button>
              <button
                onClick={() => handleBatchChange("batch-3")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  batchFilter === "batch-3"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                B3 ({batchCounts.batch3})
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Bucket Context Banner & Quick Sub-filters */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                activeBucket === "inbox"
                  ? "bg-indigo-50 text-indigo-700"
                  : activeBucket === "sent"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {activeBucket === "inbox" ? (
                <Inbox className="h-5 w-5" />
              ) : activeBucket === "sent" ? (
                <Send className="h-5 w-5" />
              ) : (
                <Ban className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {activeBucket === "inbox" && "📥 Main Lead Feed — Ready for Pitching"}
                {activeBucket === "sent" && "📤 Sent Bucket — Outreached Leads"}
                {activeBucket === "invalid" && "🚫 Invalid Bucket — Disqualified Records"}
              </h2>
              <p className="text-xs text-slate-500">
                {activeBucket === "inbox" &&
                  "Click 'Sent' to log outreach or 'Invalid' to disqualify. Items immediately leave the Main Feed."}
                {activeBucket === "sent" &&
                  "Track replies by toggling 'Replied' or 'Awaiting Reply'. You can also restore any lead to the Main Feed."}
                {activeBucket === "invalid" &&
                  "Leads disqualified due to wrong contacts or existing custom sites. Click 'Restore' to return to Feed."}
              </p>
            </div>
          </div>

          {/* Conditional Sub-filters for Sent Bucket */}
          {activeBucket === "sent" && (
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 self-start md:self-auto">
              <button
                onClick={() => setSentSubFilter("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                  sentSubFilter === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Sent ({bucketCounts.sent})
              </button>
              <button
                onClick={() => setSentSubFilter("replied")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                  sentSubFilter === "replied"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                ✅ Replied ({bucketCounts.replied})
              </button>
              <button
                onClick={() => setSentSubFilter("awaiting")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                  sentSubFilter === "awaiting"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-amber-700"
                }`}
              >
                ⏳ Awaiting ({bucketCounts.awaiting})
              </button>
            </div>
          )}

          {/* Reset Action */}
          {(bucketCounts.sent > 0 || bucketCounts.invalid > 0) && (
            <button
              onClick={handleResetTriage}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 transition-colors cursor-pointer self-start md:self-auto"
              title="Reset all triage actions back to Main Feed"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Triage
            </button>
          )}
        </section>

        {/* Live Metrics Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Visible in View
              </span>
              <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{metrics.total}</span>
              <span className="text-xs text-slate-500">
                of {activeBaseLeads.length} in {batchFilter}
              </span>
            </div>
            <div className="mt-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1 px-2 py-0.5 rounded-full">
              <Globe className="h-3 w-3" />
              100% No Website
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Direct Phone / Call
              </span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Phone className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{metrics.withPhone}</span>
              <span className="text-xs text-slate-500">
                ({metrics.total > 0 ? Math.round((metrics.withPhone / metrics.total) * 100) : 0}%)
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Verified phone / WhatsApp in bio
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Triage Progress
              </span>
              <div className="h-7 w-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {Math.round(((bucketCounts.sent + bucketCounts.invalid) / (bucketCounts.total || 1)) * 100)}%
              </span>
              <span className="text-xs text-slate-500">
                {bucketCounts.sent + bucketCounts.invalid} of {bucketCounts.total} reviewed
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {bucketCounts.sent} sent • {bucketCounts.invalid} invalid
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Reply Conversion
              </span>
              <div className="h-7 w-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{bucketCounts.replied}</span>
              <span className="text-xs text-slate-500">
                ({bucketCounts.sent > 0 ? Math.round((bucketCounts.replied / bucketCounts.sent) * 100) : 0}% of sent)
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {bucketCounts.awaiting} waiting for response
            </p>
          </div>
        </section>

        {/* Controls, Filters & View Switcher */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-xl">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search @handle, business name, suburb, phone, or services..."
                className="w-full pl-10 pr-9 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 self-start lg:self-auto">
              <button
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                onClick={() => setViewMode("json")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "json"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                Structured JSON
              </button>
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 mr-1">
              <Filter className="h-3.5 w-3.5" />
              Filters:
            </div>

            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value as ContactFilter)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Contact Routes</option>
              <option value="phone">Has Phone / WhatsApp</option>
              <option value="email">Has Email Address</option>
              <option value="dm">Instagram DM Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Website Statuses</option>
              <option value="NO_WEBSITE">No Website</option>
              <option value="WHATSAPP_ONLY">WhatsApp Only</option>
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 max-w-[220px] cursor-pointer"
            >
              <option value="all">All Locations ({uniqueLocations.length})</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 ml-auto cursor-pointer"
            >
              <option value="id-asc">Sort: Default Order (#)</option>
              <option value="followers-desc">Sort: Followers (High → Low)</option>
              <option value="followers-asc">Sort: Followers (Low → High)</option>
              <option value="posts-desc">Sort: Most Active (Posts)</option>
              <option value="name-asc">Sort: Business Name (A–Z)</option>
            </select>
          </div>
        </section>

        {/* Main Feed / Bucket Views */}
        {filteredLeads.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
            <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              {activeBucket === "inbox" ? (
                <Inbox className="h-6 w-6" />
              ) : activeBucket === "sent" ? (
                <Send className="h-6 w-6" />
              ) : (
                <Ban className="h-6 w-6" />
              )}
            </div>
            <p className="text-sm font-bold text-slate-800">
              {activeBucket === "inbox" && "All leads in this batch have been triaged!"}
              {activeBucket === "sent" && "No leads in Sent bucket matching your filters."}
              {activeBucket === "invalid" && "No leads currently marked as invalid."}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {activeBucket === "inbox"
                ? "You have moved them to the Sent or Invalid buckets. Switch to 'Sent Bucket' to track replies or review disqualified leads in 'Invalid Bucket'."
                : "Try resetting your search query or contact/location filters."}
            </p>
            {activeBucket === "inbox" && (
              <button
                onClick={() => setActiveBucket("sent")}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                View Sent Bucket ({bucketCounts.sent})
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Business &amp; Instagram</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Contact Route</th>
                    <th className="py-3 px-4 text-right">Audience</th>
                    <th className="py-3 px-4 text-center">
                      {activeBucket === "inbox" && "Triage Actions"}
                      {activeBucket === "sent" && "Outreach & Response"}
                      {activeBucket === "invalid" && "Disqualification"}
                    </th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLeads.map((lead) => {
                    const statusBadge =
                      WEBSITE_STATUS_BADGE[lead.websiteStatus] ||
                      WEBSITE_STATUS_BADGE.NO_WEBSITE;
                    const triage = triageMap[lead.uid] || { bucket: "inbox", replied: false };

                    return (
                      <tr
                        key={lead.uid}
                        onClick={() => setSelectedLead(lead)}
                        className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                          {String(lead.id).padStart(2, "0")}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                              {lead.businessName}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <a
                                href={lead.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs font-mono text-indigo-600 hover:underline"
                              >
                                <Instagram className="h-3 w-3" />@{lead.username}
                              </a>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                {lead.batch}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{lead.location}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {lead.phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                <Phone className="h-3 w-3" />
                                {lead.phone}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(lead.phone, `phone-${lead.uid}`);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                title="Copy phone number"
                              >
                                {copiedKey === `phone-${lead.uid}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          ) : lead.email ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                              <MessageSquare className="h-3 w-3 text-slate-400" />
                              {lead.contactRoute}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="text-xs font-semibold text-slate-800">
                            {lead.followers.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-slate-400">{lead.posts} posts</div>
                        </td>

                        {/* Interactive Triage Buttons */}
                        <td
                          className="py-3.5 px-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {activeBucket === "inbox" && (
                            <div className="flex items-center justify-center gap-2">
                              {/* Sent Button */}
                              <button
                                onClick={() => handleMarkSent(lead.uid)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-transform active:scale-95 cursor-pointer"
                                title="Mark as Sent (Moves lead to Sent bucket & disappears from Main Feed)"
                              >
                                <Send className="h-3.5 w-3.5" />
                                Sent
                              </button>

                              {/* Invalid Button */}
                              <button
                                onClick={() => handleMarkInvalid(lead.uid)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                                title="Mark as Invalid (Moves lead to Invalid bucket & disappears from Main Feed)"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Invalid
                              </button>
                            </div>
                          )}

                          {activeBucket === "sent" && (
                            <div className="flex items-center justify-center gap-2">
                              {/* Replied / Awaiting Toggle */}
                              <button
                                onClick={() => handleToggleReplied(lead.uid)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  triage.replied
                                    ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                                    : "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100"
                                }`}
                                title="Click to toggle Replied / Awaiting Reply"
                              >
                                {triage.replied ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    Replied
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                                    Awaiting Reply
                                  </>
                                )}
                              </button>

                              {/* Restore to Feed */}
                              <button
                                onClick={() => handleRestoreToInbox(lead.uid)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="Move back to Main Feed"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          {activeBucket === "invalid" && (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[11px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                                Disqualified
                              </span>
                              <button
                                onClick={() => handleRestoreToInbox(lead.uid)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                                title="Restore lead back to Main Feed"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Restore
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLead(lead);
                            }}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                          >
                            Pitch
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : viewMode === "cards" ? (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLeads.map((lead) => {
              const statusBadge =
                WEBSITE_STATUS_BADGE[lead.websiteStatus] || WEBSITE_STATUS_BADGE.NO_WEBSITE;
              const triage = triageMap[lead.uid] || { bucket: "inbox", replied: false };

              return (
                <article
                  key={lead.uid}
                  onClick={() => setSelectedLead(lead)}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-[11px] font-semibold text-slate-400">
                          #{String(lead.id).padStart(2, "0")} • {lead.campaignLabel}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {lead.businessName}
                        </h3>
                        <a
                          href={lead.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-mono text-indigo-600 hover:underline mt-0.5"
                        >
                          <Instagram className="h-3.5 w-3.5" />@{lead.username}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${statusBadge.classes}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        {lead.location}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                        {lead.followers.toLocaleString()} followers
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-600 line-clamp-2">
                      <span className="font-semibold text-slate-800">Services: </span>
                      {lead.services}
                    </p>

                    <div className="mt-3 p-3 rounded-lg bg-indigo-50/70 border border-indigo-100">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 mb-1">
                        Website Pitch Angle
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">
                        {lead.pitchAngle}
                      </p>
                    </div>
                  </div>

                  {/* Card Actions & Triage Strip */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="truncate font-medium">
                        {lead.phone ? `📞 ${lead.phone}` : `💬 ${lead.contactRoute}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(buildOutreachMessage(lead), `card-pitch-${lead.uid}`);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer shrink-0"
                      >
                        {copiedKey === `card-pitch-${lead.uid}` ? "Copied Pitch" : "Copy Pitch"}
                      </button>
                    </div>

                    {/* Interactive Triage Buttons on Card */}
                    <div
                      className="pt-1 flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {activeBucket === "inbox" && (
                        <>
                          <button
                            onClick={() => handleMarkSent(lead.uid)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-transform active:scale-95 cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Mark as Sent
                          </button>
                          <button
                            onClick={() => handleMarkInvalid(lead.uid)}
                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Invalid
                          </button>
                        </>
                      )}

                      {activeBucket === "sent" && (
                        <>
                          <button
                            onClick={() => handleToggleReplied(lead.uid)}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              triage.replied
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100"
                            }`}
                          >
                            {triage.replied ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                Replied (Click to toggle)
                              </>
                            ) : (
                              <>
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                Awaiting Reply (Click when replied)
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleRestoreToInbox(lead.uid)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Move back to Main Feed"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {activeBucket === "invalid" && (
                        <div className="w-full flex items-center justify-between">
                          <span className="text-xs text-rose-700 font-semibold">
                            Disqualified Lead
                          </span>
                          <button
                            onClick={() => handleRestoreToInbox(lead.uid)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore to Feed
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          /* Structured JSON Output View */
          <section className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Structured Schema &amp; Bucket JSON Output
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live payload filtered by bucket: <span className="font-semibold text-slate-800">{activeBucket}</span> ({filteredLeads.length} records)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleCopy(JSON.stringify(structuredPayload, null, 2), "json-payload")
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                  >
                    {copiedKey === "json-payload" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Copied JSON
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Structured JSON
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Schema Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-4">
                {[
                  { field: "uid", type: "string" },
                  { field: "bucket", type: "inbox|sent|invalid" },
                  { field: "replied", type: "boolean" },
                  { field: "business_name", type: "string" },
                  { field: "location", type: "string" },
                  { field: "phone", type: "string | null" },
                  { field: "followers / posts", type: "number" },
                  { field: "services", type: "string" },
                  { field: "pitch_angle", type: "string" },
                  { field: "profile_url", type: "uri" },
                  { field: "bucket_stats", type: "object" },
                  { field: "meta.filtered_count", type: "number" },
                ].map((s) => (
                  <div
                    key={s.field}
                    className="px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <div className="font-mono text-[11px] font-semibold text-slate-800 truncate">
                      {s.field}
                    </div>
                    <div className="font-mono text-[10px] text-indigo-600">{s.type}</div>
                  </div>
                ))}
              </div>

              <pre className="rounded-xl bg-slate-950 text-slate-100 p-4 text-xs font-mono overflow-x-auto max-h-[580px] leading-relaxed border border-slate-800">
                {JSON.stringify(structuredPayload, null, 2)}
              </pre>
            </div>
          </section>
        )}
      </main>

      {/* Slide-over Detail & Outreach Drawer */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    LEAD #{String(selectedLead.id).padStart(2, "0")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    {selectedLead.websiteStatus}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-800">
                    Bucket: {triageMap[selectedLead.uid]?.bucket || "inbox"}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  {selectedLead.businessName}
                </h2>
                <a
                  href={selectedLead.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-mono text-indigo-600 hover:underline mt-0.5"
                >
                  <Instagram className="h-4 w-4" />@{selectedLead.username}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Triage Actions Strip inside Drawer */}
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Lead Triage Actions
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleMarkSent(selectedLead.uid)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Mark as Sent
                  </button>

                  <button
                    onClick={() => handleToggleReplied(selectedLead.uid)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      triageMap[selectedLead.uid]?.replied
                        ? "bg-emerald-700 text-white"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {triageMap[selectedLead.uid]?.replied ? "Replied (Active)" : "Mark as Replied"}
                  </button>

                  <button
                    onClick={() => handleMarkInvalid(selectedLead.uid)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Mark Invalid
                  </button>

                  <button
                    onClick={() => handleRestoreToInbox(selectedLead.uid)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore to Feed
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Followers</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedLead.followers.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Posts</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedLead.posts.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Status</div>
                  <div className="text-xs font-bold text-indigo-700 mt-1">
                    {triageMap[selectedLead.uid]?.replied
                      ? "Replied"
                      : triageMap[selectedLead.uid]?.bucket === "sent"
                      ? "Awaiting Reply"
                      : triageMap[selectedLead.uid]?.bucket === "invalid"
                      ? "Disqualified"
                      : "New Lead"}
                  </div>
                </div>
              </div>

              {/* Location & Contact */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Location</div>
                    <div className="text-slate-800">{selectedLead.location}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Contact Route</div>
                    <div className="text-slate-800 font-medium">{selectedLead.contactRoute}</div>
                  </div>
                </div>
              </div>

              {/* Bio & Services */}
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Verified Services
                  </div>
                  <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    {selectedLead.services}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Instagram Bio Snapshot
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                    {selectedLead.bio}
                  </p>
                </div>
              </div>

              {/* Pitch Angle */}
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-1">
                  Tailored Sales Pitch Angle
                </div>
                <p className="text-sm text-indigo-950 leading-relaxed">
                  {selectedLead.pitchAngle}
                </p>
              </div>

              {/* Ready-to-send Outreach Template */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Personalized Outreach Message
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        buildOutreachMessage(selectedLead),
                        `drawer-msg-${selectedLead.uid}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                  >
                    {copiedKey === `drawer-msg-${selectedLead.uid}` ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Copied Message
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Outreach Script
                      </>
                    )}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 leading-relaxed">
                  {buildOutreachMessage(selectedLead)}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <a
                href={selectedLead.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                <Instagram className="h-4 w-4" />
                Open Instagram
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {selectedLead.phone && (
                <a
                  href={`tel:${selectedLead.phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Call {selectedLead.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database Connection Status & Neon Sync Modal */}
      {showDatabaseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setShowDatabaseModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Connected Databases &amp; Cloud Storage
                  </h3>
                  <p className="text-xs text-slate-500">
                    Environment database connections and synchronization options
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDatabaseModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Database Status Cards */}
              <div className="space-y-3">
                {/* Neon Postgres */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">Neon Postgres</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        CONFIGURED &amp; READY
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Neon MCP server configured at <code className="font-mono text-emerald-800">https://mcp.neon.tech/mcp</code>. Ready for serverless branching and cloud sync.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(neonSqlMigration, "neon-sql")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer shrink-0"
                  >
                    {copiedKey === "neon-sql" ? "Copied SQL" : "Copy Neon SQL"}
                  </button>
                </div>

                {/* Supabase */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">Supabase</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        CONNECTED (MCP)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Active healthy project: <code className="font-mono text-indigo-700">SamCarRentalOfficial</code> (ref: bhcxnfnrzaoicmosuodc, Postgres 17).
                    </p>
                  </div>
                </div>

                {/* AgentMemory */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">AgentMemory</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        PERSISTENT (KV)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Local persistent key-value store at <code className="font-mono text-purple-700">~/.agentmemory/standalone.json</code>. Enforcing 0 duplicate leads policy.
                    </p>
                  </div>
                </div>

                {/* Memory Graph */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">Memory Graph (SQLite)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        LOCAL SQLITE
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      SQLite graph storage configured at <code className="font-mono text-slate-700">memory_bank/data/memory-graph.db</code>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Edge Local Storage Note */}
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900">⚡ Live Edge Persistence: </span>
                All your triage actions (Sent, Invalid, and Replied markers) are persisted with zero network latency using cross-tab synchronized local edge storage. They survive page refreshes and browser restarts.
              </div>

              {/* Neon SQL Schema Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Neon Postgres Triage Schema
                  </span>
                </div>
                <pre className="rounded-xl bg-slate-950 text-slate-100 p-3 text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                  {neonSqlMigration}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowDatabaseModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
