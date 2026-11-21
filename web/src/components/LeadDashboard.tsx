"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
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
  SlidersHorizontal,
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
  // Navigation & Bucket State
  const [activeBucket, setActiveBucket] = useState<BucketType>("inbox");
  const [sentSubFilter, setSentSubFilter] = useState<SentSubFilter>("all");
  const [batchFilter, setBatchFilter] = useState<BatchFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("id-asc");

  // Modals & Sheets
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
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
    if (window.confirm("Restore all triaged leads back to the Main Feed?")) {
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

  // Live bucket counts across current batch
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

  // Main filtered leads respecting the active bucket
  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = activeBaseLeads.filter((lead) => {
      const record = triageMap[lead.uid];
      const bucket = record?.bucket || "inbox";

      // 1. Bucket segregation
      if (activeBucket === "inbox") {
        if (bucket !== "inbox") return false; // disappears from Main Feed!
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

  const neonSqlMigration = useMemo(() => {
    return `-- Neon Lakebase Postgres Lead Triage Schema
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

CREATE INDEX IF NOT EXISTS idx_lead_triage_bucket ON lead_triage (bucket);
CREATE INDEX IF NOT EXISTS idx_lead_triage_replied ON lead_triage (bucket, replied);
`;
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Top Header - Mobile Native & Desktop Translucent Glass */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl safe-top transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Brand Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                    Agent-Reach
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {ukLeads.length} UK Leads
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                  Verified UK Tree Surgeons • No Website Outreach CRM
                </p>
              </div>
            </div>

            {/* Quick Actions & Header Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowDatabaseModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 active:scale-[0.97] transition-all cursor-pointer"
                title="View database connections (Neon, Supabase, AgentMemory)"
              >
                <Database className="h-3.5 w-3.5 text-sky-600" />
                <span className="hidden sm:inline">Databases</span>
              </button>

              <button
                onClick={() => setShowMobileFilters(true)}
                className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 active:scale-[0.97] transition-all cursor-pointer"
                aria-label="Open search & filters"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filter</span>
              </button>

              <button
                onClick={downloadCsv}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.97] shadow-xs transition-all cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV ({filteredLeads.length})</span>
              </button>
            </div>
          </div>

          {/* Desktop & Tablet Segmented Control Tabs */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 hidden sm:flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
              <button
                onClick={() => {
                  setActiveBucket("inbox");
                  setSelectedLead(null);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                  activeBucket === "inbox"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Inbox className="h-3.5 w-3.5 text-indigo-600" />
                <span>📥 Main Feed</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 tabular-nums">
                  {bucketCounts.inbox}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveBucket("sent");
                  setSelectedLead(null);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                  activeBucket === "sent"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Send className="h-3.5 w-3.5 text-emerald-600" />
                <span>📤 Sent Bucket</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 tabular-nums">
                  {bucketCounts.sent}
                </span>
                {bucketCounts.replied > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-600 text-white tabular-nums">
                    {bucketCounts.replied} replied
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveBucket("invalid");
                  setSelectedLead(null);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                  activeBucket === "invalid"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Ban className="h-3.5 w-3.5 text-rose-500" />
                <span>🚫 Invalid Bucket</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 tabular-nums">
                  {bucketCounts.invalid}
                </span>
              </button>
            </div>

            {/* Batch Switcher */}
            <div className="flex items-center gap-1 text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mr-1">
                Batch:
              </span>
              <button
                onClick={() => handleBatchChange("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer active:scale-[0.97] transition-all tabular-nums ${
                  batchFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({batchCounts.all})
              </button>
              <button
                onClick={() => handleBatchChange("batch-1")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer active:scale-[0.97] transition-all tabular-nums ${
                  batchFilter === "batch-1"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                B1 ({batchCounts.batch1})
              </button>
              <button
                onClick={() => handleBatchChange("batch-2")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer active:scale-[0.97] transition-all tabular-nums ${
                  batchFilter === "batch-2"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                B2 ({batchCounts.batch2})
              </button>
              <button
                onClick={() => handleBatchChange("batch-3")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer active:scale-[0.97] transition-all tabular-nums ${
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

      {/* Main Container - Extra bottom padding for Mobile Native Dock */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 pb-28 sm:pb-12">
        {/* Bucket Status Header Banner */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {activeBucket === "inbox" && "Main Feed"}
                  {activeBucket === "sent" && "Sent Bucket"}
                  {activeBucket === "invalid" && "Invalid Disqualified Leads"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 tabular-nums">
                  {filteredLeads.length} visible
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {activeBucket === "inbox" &&
                  "Press 'Sent' to log outreach or 'Invalid' to disqualify. Items immediately leave this feed."}
                {activeBucket === "sent" &&
                  "Tap 'Awaiting Reply' to mark as 'Replied'. Restore any lead anytime."}
                {activeBucket === "invalid" &&
                  "Disqualified leads. Tap 'Restore' anytime to put them back in the Main Feed."}
              </p>
            </div>
          </div>

          {/* Sent Bucket Sub-Filter Pills */}
          {activeBucket === "sent" && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 self-start sm:self-auto overflow-x-auto max-w-full">
              <button
                onClick={() => setSentSubFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-[0.97] transition-all whitespace-nowrap tabular-nums ${
                  sentSubFilter === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({bucketCounts.sent})
              </button>
              <button
                onClick={() => setSentSubFilter("replied")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-[0.97] transition-all whitespace-nowrap tabular-nums ${
                  sentSubFilter === "replied"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                ✅ Replied ({bucketCounts.replied})
              </button>
              <button
                onClick={() => setSentSubFilter("awaiting")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-[0.97] transition-all whitespace-nowrap tabular-nums ${
                  sentSubFilter === "awaiting"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-amber-700"
                }`}
              >
                ⏳ Awaiting ({bucketCounts.awaiting})
              </button>
            </div>
          )}

          {/* Reset Triage */}
          {(bucketCounts.sent > 0 || bucketCounts.invalid > 0) && (
            <button
              onClick={handleResetTriage}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600 active:scale-[0.97] transition-colors cursor-pointer self-start sm:self-auto"
              title="Reset triage actions back to feed"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Feed
            </button>
          )}
        </section>

        {/* Live Metrics Grid - Mobile Friendly 2x2 & 4x1 */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Matching Leads
              </span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {metrics.total}
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums">
                of {activeBaseLeads.length}
              </span>
            </div>
            <div className="mt-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md">
              <Globe className="h-3 w-3" />
              No Website
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Phone Direct
              </span>
              <Phone className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {metrics.withPhone}
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums">
                ({metrics.total > 0 ? Math.round((metrics.withPhone / metrics.total) * 100) : 0}%)
              </span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 truncate">
              Verified call/WhatsApp ready
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Triage Done
              </span>
              <TrendingUp className="h-4 w-4 text-violet-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {Math.round(
                  ((bucketCounts.sent + bucketCounts.invalid) / (bucketCounts.total || 1)) * 100
                )}
                %
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {bucketCounts.sent + bucketCounts.invalid}/{bucketCounts.total}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 truncate">
              {bucketCounts.sent} sent • {bucketCounts.invalid} invalid
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Replies
              </span>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {bucketCounts.replied}
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums">
                ({bucketCounts.sent > 0 ? Math.round((bucketCounts.replied / bucketCounts.sent) * 100) : 0}%)
              </span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 truncate">
              {bucketCounts.awaiting} waiting for reply
            </p>
          </div>
        </section>

        {/* Desktop Controls & Search Bar */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input (16px font size to prevent iOS zoom) */}
            <div className="relative flex-1 max-w-xl">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search @handle, company, suburb, phone, services..."
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full pl-10 pr-9 py-2 text-[16px] sm:text-sm rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 active:scale-95 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* View Switcher (Desktop) */}
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100">
              <button
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer ${
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer ${
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer ${
                  viewMode === "json"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                JSON
              </button>
            </div>
          </div>

          {/* Desktop Filter Selects */}
          <div className="hidden sm:flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 mr-1">
              <Filter className="h-3.5 w-3.5" />
              Filter:
            </span>

            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value as ContactFilter)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Contact Routes</option>
              <option value="phone">Has Direct Phone</option>
              <option value="email">Has Email</option>
              <option value="dm">Instagram DM Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Web Statuses</option>
              <option value="NO_WEBSITE">No Website</option>
              <option value="WHATSAPP_ONLY">WhatsApp Only</option>
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 max-w-[200px] cursor-pointer"
            >
              <option value="all">All Regions ({uniqueLocations.length})</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 ml-auto cursor-pointer"
            >
              <option value="id-asc">Sort: Default (#)</option>
              <option value="followers-desc">Followers (High → Low)</option>
              <option value="followers-asc">Followers (Low → High)</option>
              <option value="posts-desc">Activity (Posts)</option>
              <option value="name-asc">Business Name (A–Z)</option>
            </select>
          </div>
        </section>

        {/* Content Views: Empty / Table / Cards / JSON */}
        {filteredLeads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
            <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              {activeBucket === "inbox" ? (
                <Inbox className="h-6 w-6 text-indigo-600" />
              ) : activeBucket === "sent" ? (
                <Send className="h-6 w-6 text-emerald-600" />
              ) : (
                <Ban className="h-6 w-6 text-rose-500" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {activeBucket === "inbox" && "All leads in this batch have been triaged!"}
              {activeBucket === "sent" && "No leads found in Sent bucket."}
              {activeBucket === "invalid" && "No leads marked invalid."}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeBucket === "inbox"
                ? "Every lead is safely saved in either Sent or Invalid. Switch tabs below to track outreach and replies."
                : "Try clearing your search query or adjusting your filters."}
            </p>
            {activeBucket === "inbox" && (
              <button
                onClick={() => setActiveBucket("sent")}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.97] transition-all cursor-pointer shadow-xs"
              >
                Go to Sent Bucket ({bucketCounts.sent})
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          /* Desktop Table View */
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
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
                    <th className="py-3 px-4 text-right">Inspect</th>
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
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400 tabular-nums">
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
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
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
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md tabular-nums">
                                <Phone className="h-3 w-3" />
                                {lead.phone}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(lead.phone, `phone-${lead.uid}`);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 active:scale-90 rounded cursor-pointer"
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
                          <div className="text-xs font-bold text-slate-900 tabular-nums">
                            {lead.followers.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-slate-400 tabular-nums">{lead.posts} posts</div>
                        </td>

                        {/* Interactive Triage Buttons */}
                        <td
                          className="py-3.5 px-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {activeBucket === "inbox" && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleMarkSent(lead.uid)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.97] shadow-2xs transition-all cursor-pointer"
                                title="Mark Sent (leaves Main Feed)"
                              >
                                <Send className="h-3 w-3" />
                                Sent
                              </button>
                              <button
                                onClick={() => handleMarkInvalid(lead.uid)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-[0.97] transition-all cursor-pointer"
                                title="Mark Invalid (leaves Main Feed)"
                              >
                                <Ban className="h-3 w-3" />
                                Invalid
                              </button>
                            </div>
                          )}

                          {activeBucket === "sent" && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleToggleReplied(lead.uid)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-[0.97] transition-all cursor-pointer ${
                                  triage.replied
                                    ? "bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700"
                                    : "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100"
                                }`}
                                title="Click to toggle Replied status"
                              >
                                {triage.replied ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Replied
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                                    Awaiting Reply
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => handleRestoreToInbox(lead.uid)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md active:scale-95 transition-all cursor-pointer"
                                title="Move back to Main Feed"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          {activeBucket === "invalid" && (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-semibold">
                                Disqualified
                              </span>
                              <button
                                onClick={() => handleRestoreToInbox(lead.uid)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all cursor-pointer"
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
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:scale-95 transition-all cursor-pointer"
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
          /* Mobile Native Responsive Card Stream */
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredLeads.map((lead) => {
              const statusBadge =
                WEBSITE_STATUS_BADGE[lead.websiteStatus] || WEBSITE_STATUS_BADGE.NO_WEBSITE;
              const triage = triageMap[lead.uid] || { bucket: "inbox", replied: false };

              return (
                <article
                  key={lead.uid}
                  onClick={() => setSelectedLead(lead)}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 active:scale-[0.99] transition-all flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-[11px] font-semibold text-slate-400 tabular-nums">
                          #{String(lead.id).padStart(2, "0")} • {lead.batch}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight mt-0.5 truncate">
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

                    {/* Metadata Badges */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        {lead.location}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-slate-700 tabular-nums">
                        {lead.followers.toLocaleString()} followers
                      </span>
                    </div>

                    {/* Services snippet */}
                    <p className="mt-2.5 text-xs text-slate-600 line-clamp-2">
                      <span className="font-semibold text-slate-800">Services: </span>
                      {lead.services}
                    </p>

                    {/* Pitch Angle Box */}
                    <div className="mt-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100/90">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1">
                        Outreach Pitch Angle
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                        {lead.pitchAngle}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Triage Controls (Optimized for Mobile Thumbs) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="truncate font-semibold tabular-nums">
                        {lead.phone ? `📞 ${lead.phone}` : `💬 ${lead.contactRoute}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(buildOutreachMessage(lead), `card-pitch-${lead.uid}`);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold active:scale-95 cursor-pointer shrink-0"
                      >
                        {copiedKey === `card-pitch-${lead.uid}` ? "Copied!" : "Copy Pitch"}
                      </button>
                    </div>

                    {/* Main Triage Touch Targets (Min 44px height for mobile ergonomics) */}
                    <div
                      className="pt-1 flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {activeBucket === "inbox" && (
                        <>
                          <button
                            onClick={() => handleMarkSent(lead.uid)}
                            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.97] shadow-xs transition-all cursor-pointer"
                          >
                            <Send className="h-4 w-4" />
                            Mark Sent
                          </button>
                          <button
                            onClick={() => handleMarkInvalid(lead.uid)}
                            className="min-h-[44px] inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-[0.97] transition-all cursor-pointer"
                          >
                            <Ban className="h-4 w-4" />
                            Invalid
                          </button>
                        </>
                      )}

                      {activeBucket === "sent" && (
                        <>
                          <button
                            onClick={() => handleToggleReplied(lead.uid)}
                            className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-[0.97] transition-all cursor-pointer ${
                              triage.replied
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                                : "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100"
                            }`}
                          >
                            {triage.replied ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Replied (Click to toggle)
                              </>
                            ) : (
                              <>
                                <Clock className="h-4 w-4 text-amber-600" />
                                Awaiting Reply (Tap when replied)
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleRestoreToInbox(lead.uid)}
                            className="min-h-[44px] px-3 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 rounded-xl cursor-pointer"
                            title="Move back to Main Feed"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {activeBucket === "invalid" && (
                        <div className="w-full flex items-center justify-between">
                          <span className="text-xs text-rose-700 font-bold">
                            Disqualified Record
                          </span>
                          <button
                            onClick={() => handleRestoreToInbox(lead.uid)}
                            className="min-h-[44px] inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-[0.97] transition-all cursor-pointer"
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
          /* JSON View */
          <section className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Structured Bucket Output
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live JSON for active bucket ({activeBucket}) • {filteredLeads.length} records
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleCopy(JSON.stringify(structuredPayload, null, 2), "json-payload")
                  }
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white active:scale-95 cursor-pointer"
                >
                  {copiedKey === "json-payload" ? "Copied!" : "Copy JSON"}
                </button>
              </div>
              <pre className="rounded-xl bg-slate-950 text-slate-100 p-4 text-xs font-mono overflow-x-auto max-h-[500px] border border-slate-800">
                {JSON.stringify(structuredPayload, null, 2)}
              </pre>
            </div>
          </section>
        )}
      </main>

      {/* MOBILE NATIVE BOTTOM FLOATING DOCK (Emil Kowalski mobile-native standard) */}
      <nav className="sm:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto pointer-events-auto safe-bottom-dock">
        <div className="bg-white/92 backdrop-blur-2xl border border-slate-200/90 shadow-xl rounded-2xl p-1.5 flex items-center justify-around">
          {/* Main Feed Tab */}
          <button
            onClick={() => {
              setActiveBucket("inbox");
              setSelectedLead(null);
            }}
            className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer ${
              activeBucket === "inbox"
                ? "bg-slate-900 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <div className="relative">
              <Inbox className="h-4.5 w-4.5" />
              <span
                className={`absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full text-[9px] font-extrabold tabular-nums ${
                  activeBucket === "inbox"
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {bucketCounts.inbox}
              </span>
            </div>
            <span className="text-[10px]">Feed</span>
          </button>

          {/* Sent Bucket Tab */}
          <button
            onClick={() => {
              setActiveBucket("sent");
              setSelectedLead(null);
            }}
            className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer ${
              activeBucket === "sent"
                ? "bg-slate-900 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <div className="relative">
              <Send className="h-4.5 w-4.5" />
              <span
                className={`absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full text-[9px] font-extrabold tabular-nums ${
                  activeBucket === "sent"
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {bucketCounts.sent}
              </span>
            </div>
            <span className="text-[10px]">Sent</span>
          </button>

          {/* Invalid Bucket Tab */}
          <button
            onClick={() => {
              setActiveBucket("invalid");
              setSelectedLead(null);
            }}
            className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer ${
              activeBucket === "invalid"
                ? "bg-slate-900 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <div className="relative">
              <Ban className="h-4.5 w-4.5" />
              <span
                className={`absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full text-[9px] font-extrabold tabular-nums ${
                  activeBucket === "invalid"
                    ? "bg-rose-500 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {bucketCounts.invalid}
              </span>
            </div>
            <span className="text-[10px]">Invalid</span>
          </button>

          {/* Filter Modal Trigger */}
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-slate-600 active:scale-95 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="h-4.5 w-4.5" />
            <span className="text-[10px]">Filter</span>
          </button>
        </div>
      </nav>

      {/* DETAIL MODAL: Desktop Slide-over Drawer & Mobile Bottom Sheet (Vaul style) */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end md:flex-row md:justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="w-full md:max-w-xl bg-white max-h-[90dvh] md:max-h-full md:h-full rounded-t-3xl md:rounded-t-none shadow-2xl border-t md:border-t-0 md:border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ overscrollBehavior: "contain" }}
          >
            {/* Mobile Sheet Drag Handle */}
            <div className="md:hidden pt-2 pb-1 flex justify-center shrink-0">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>

            {/* Drawer Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums">
                    #{String(selectedLead.id).padStart(2, "0")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {selectedLead.websiteStatus}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                    Bucket: {triageMap[selectedLead.uid]?.bucket || "inbox"}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-1">
                  {selectedLead.businessName}
                </h2>
                <a
                  href={selectedLead.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-indigo-600 hover:underline mt-0.5"
                >
                  <Instagram className="h-3.5 w-3.5" />@{selectedLead.username}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 active:scale-95 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Triage Action Strip in Drawer */}
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200/90 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Outreach Action
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleMarkSent(selectedLead.uid)}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.97] transition-all cursor-pointer shadow-xs"
                  >
                    <Send className="h-4 w-4" />
                    Mark Sent
                  </button>
                  <button
                    onClick={() => handleToggleReplied(selectedLead.uid)}
                    className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-[0.97] transition-all cursor-pointer ${
                      triageMap[selectedLead.uid]?.replied
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {triageMap[selectedLead.uid]?.replied ? "Replied (Active)" : "Mark Replied"}
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Followers</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                    {selectedLead.followers.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Posts</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                    {selectedLead.posts.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Status</div>
                  <div className="text-xs font-bold text-indigo-700 mt-1 truncate">
                    {triageMap[selectedLead.uid]?.replied
                      ? "Replied"
                      : triageMap[selectedLead.uid]?.bucket === "sent"
                      ? "Awaiting"
                      : triageMap[selectedLead.uid]?.bucket === "invalid"
                      ? "Invalid"
                      : "New Lead"}
                  </div>
                </div>
              </div>

              {/* Location & Contact Info */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="font-semibold">{selectedLead.location}</span>
                </div>
                {selectedLead.phone && (
                  <div className="flex items-center gap-2 text-slate-800">
                    <Phone className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold tabular-nums">{selectedLead.phone}</span>
                  </div>
                )}
              </div>

              {/* Verified Services */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Services
                </span>
                <p className="mt-1 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
                  {selectedLead.services}
                </p>
              </div>

              {/* Pitch Angle */}
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                  Sales Pitch Angle
                </span>
                <p className="mt-1 text-xs text-indigo-950 leading-relaxed">
                  {selectedLead.pitchAngle}
                </p>
              </div>

              {/* Ready-to-Send Outreach Message */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Outreach Script
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        buildOutreachMessage(selectedLead),
                        `drawer-msg-${selectedLead.uid}`
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white active:scale-95 cursor-pointer"
                  >
                    {copiedKey === `drawer-msg-${selectedLead.uid}` ? "Copied!" : "Copy Script"}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 leading-relaxed">
                  {buildOutreachMessage(selectedLead)}
                </pre>
              </div>
            </div>

            {/* Fixed Drawer Footer (Safe Area Padded) */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2.5 safe-bottom">
              <a
                href={selectedLead.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.97] transition-all cursor-pointer"
              >
                <Instagram className="h-4 w-4" />
                Open Instagram
                <ExternalLink className="h-3 w-3" />
              </a>
              {selectedLead.phone && (
                <a
                  href={`tel:${selectedLead.phone.replace(/\s+/g, "")}`}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:scale-[0.97] transition-all cursor-pointer"
                >
                  <Phone className="h-4 w-4" />
                  Call
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE FILTERS BOTTOM SHEET */}
      {showMobileFilters && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-xs"
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl shadow-2xl p-5 space-y-4 max-h-[85dvh] overflow-y-auto safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-12 rounded-full bg-slate-300 mx-auto -mt-2 mb-2" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Filter &amp; Sort Leads
              </h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Batch Filter */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700">Batch Target:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(["all", "batch-1", "batch-2", "batch-3"] as BatchFilter[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => handleBatchChange(b)}
                    className={`py-2 rounded-xl text-xs font-bold capitalize active:scale-95 ${
                      batchFilter === b
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {b === "all" ? "All" : b.replace("batch-", "B")}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact Route */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700">Contact Route:</span>
              <select
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value as ContactFilter)}
                className="w-full px-3 py-2 text-[16px] rounded-xl border border-slate-200 bg-slate-50"
              >
                <option value="all">All Contact Routes</option>
                <option value="phone">Has Direct Phone</option>
                <option value="email">Has Email</option>
                <option value="dm">Instagram DM Only</option>
              </select>
            </div>

            {/* Region / Location */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700">Region ({uniqueLocations.length}):</span>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-3 py-2 text-[16px] rounded-xl border border-slate-200 bg-slate-50"
              >
                <option value="all">All Regions ({uniqueLocations.length})</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 text-[16px] rounded-xl border border-slate-200 bg-slate-50"
              >
                <option value="id-asc">Default Order (#)</option>
                <option value="followers-desc">Followers (High → Low)</option>
                <option value="followers-asc">Followers (Low → High)</option>
                <option value="posts-desc">Posts (Most Active)</option>
                <option value="name-asc">Business Name (A–Z)</option>
              </select>
            </div>

            <button
              onClick={() => setShowMobileFilters(false)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs active:scale-[0.97]"
            >
              Apply Filters ({filteredLeads.length} matching)
            </button>
          </div>
        </div>
      )}

      {/* DATABASE & CLOUD SYNC MODAL */}
      {showDatabaseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setShowDatabaseModal(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Database className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Connected Databases
                  </h3>
                  <p className="text-xs text-slate-500">Environment status &amp; sync</p>
                </div>
              </div>
              <button
                onClick={() => setShowDatabaseModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 active:scale-95 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5">
              {/* Neon Card */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">Neon Postgres</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      READY (MCP)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Serverless Postgres endpoint: <code className="font-mono text-emerald-800">https://mcp.neon.tech/mcp</code>.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(neonSqlMigration, "neon-sql")}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 text-white active:scale-95 cursor-pointer shrink-0"
                >
                  {copiedKey === "neon-sql" ? "Copied!" : "Copy SQL"}
                </button>
              </div>

              {/* Supabase Card */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">Supabase</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Active healthy project: <code className="font-mono text-indigo-700">SamCarRentalOfficial</code> (Postgres 17).
                  </p>
                </div>
              </div>

              {/* AgentMemory Card */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">AgentMemory</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                      PERSISTENT KV
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Enforcing zero-duplicate leads policy at <code className="font-mono text-purple-700">~/.agentmemory/standalone.json</code>.
                  </p>
                </div>
              </div>

              {/* Edge Local Storage Note */}
              <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900">⚡ Live Edge Persistence: </span>
                All triage actions (Sent, Invalid, and Replied markers) are persisted with zero network latency using cross-tab synchronized local storage. They survive page refreshes and browser restarts.
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowDatabaseModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white active:scale-95 cursor-pointer"
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
