"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Globe,
  LayoutGrid,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { CampaignId, Lead } from "@/lib/leads";

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
  sydneyLeads: Lead[];
  ukLeads: Lead[];
}

type ViewMode = "table" | "cards" | "json";
type ContactFilter = "all" | "phone" | "email" | "dm";
type SortOption = "id-asc" | "followers-desc" | "followers-asc" | "posts-desc" | "name-asc";
type CrmStatus = "New" | "Contacted" | "Replied" | "Booked";

const CRM_STORAGE_KEY = "agent_reach_crm_status_v1";

const CRM_BADGE_STYLES: Record<CrmStatus, string> = {
  New: "bg-slate-100 text-slate-700 border-slate-200",
  Contacted: "bg-amber-50 text-amber-700 border-amber-200",
  Replied: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Booked: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

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
  if (lead.campaign === "sydney-dog-groomers") {
    return `Hi ${lead.businessName} team! 👋 Came across your gorgeous grooms on Instagram (@${lead.username}).\n\nI noticed you don't have a standalone website set up yet and are handling bookings via ${lead.phone ? `phone/SMS (${lead.phone})` : "Instagram DMs"}. Most Sydney groomers tell me they lose hours every week answering booking messages while their hands are full.\n\nI mocked up a clean 1-page website concept for ${lead.businessName} with local ${lead.suburb} Google SEO, breed price estimator, and direct booking intake.\n\nWould you like me to send over a quick 60-second preview?`;
  }
  return `Hi ${lead.businessName} team! 👋 Saw your recent arboriculture work on Instagram (@${lead.username}).\n\nI noticed you don't currently have an independent website and rely on ${lead.phone ? `direct calls (${lead.phone})` : "Instagram DMs"} for quotes. Homeowners in ${lead.location} searching Google for tree surgery often book the first local firm with a fast quote site.\n\nI put together a quick local-SEO website concept for ${lead.businessName} with an instant photo-quote request form.\n\nOpen to taking a quick look?`;
}

export default function LeadDashboard({ sydneyLeads, ukLeads }: LeadDashboardProps) {
  const [campaign, setCampaign] = useState<CampaignId>("sydney-dog-groomers");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("id-asc");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const crmRaw = useSyncExternalStore(
    (onStoreChange) => {
      const handler = () => onStoreChange();
      window.addEventListener("storage", handler);
      window.addEventListener("crm-storage-update", handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener("crm-storage-update", handler);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(CRM_STORAGE_KEY) || "{}";
      } catch {
        return "{}";
      }
    },
    () => "{}"
  );

  const crmMap = useMemo<Record<string, CrmStatus>>(() => {
    try {
      return JSON.parse(crmRaw) as Record<string, CrmStatus>;
    } catch {
      return {};
    }
  }, [crmRaw]);

  const updateCrmStatus = (uid: string, status: CrmStatus) => {
    const next = { ...crmMap, [uid]: status };
    try {
      window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("crm-storage-update"));
    } catch {
      // Ignore storage errors
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

  const activeBaseLeads = useMemo(() => {
    if (campaign === "sydney-dog-groomers") return sydneyLeads;
    if (campaign === "uk-tree-surgeons") return ukLeads;
    return [...sydneyLeads, ...ukLeads];
  }, [campaign, sydneyLeads, ukLeads]);

  // Reset location & status filters when switching campaign
  const handleCampaignChange = (nextCampaign: CampaignId) => {
    setCampaign(nextCampaign);
    setLocationFilter("all");
    setStatusFilter("all");
    setSelectedLead(null);
  };

  const uniqueLocations = useMemo(() => {
    const locs = Array.from(new Set(activeBaseLeads.map((l) => l.location)));
    return locs.sort((a, b) => a.localeCompare(b));
  }, [activeBaseLeads]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = activeBaseLeads.filter((lead) => {
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

      if (contactFilter === "phone" && !lead.phone) return false;
      if (contactFilter === "email" && !lead.email) return false;
      if (contactFilter === "dm" && (lead.phone || lead.email)) return false;

      if (statusFilter !== "all" && lead.websiteStatus !== statusFilter) return false;
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
          if (a.campaign !== b.campaign) {
            return a.campaign === "sydney-dog-groomers" ? -1 : 1;
          }
          return a.id - b.id;
      }
    });

    return sorted;
  }, [activeBaseLeads, searchQuery, contactFilter, statusFilter, locationFilter, sortBy]);

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
        campaign,
        total_in_dataset: activeBaseLeads.length,
        filtered_count: filteredLeads.length,
        all_campaigns_total: sydneyLeads.length + ukLeads.length,
        breakdown: {
          sydney_dog_groomers: sydneyLeads.length,
          uk_tree_surgeons: ukLeads.length,
        },
        filters: {
          searchQuery: searchQuery || null,
          contactFilter,
          statusFilter,
          locationFilter,
          sortBy,
        },
      },
      leads: filteredLeads.map((l) => ({
        uid: l.uid,
        id: l.id,
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
        crm_status: crmMap[l.uid] || "New",
      })),
    };
  }, [
    campaign,
    activeBaseLeads.length,
    filteredLeads,
    sydneyLeads.length,
    ukLeads.length,
    searchQuery,
    contactFilter,
    statusFilter,
    locationFilter,
    sortBy,
    crmMap,
  ]);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(structuredPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign}_structured_leads.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const headers = [
      "ID",
      "Campaign",
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
      "CRM Status",
    ];
    const escapeCell = (val: unknown) => {
      const s = String(val ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = [
      headers.join(","),
      ...filteredLeads.map((l) =>
        [
          l.id,
          l.campaignLabel,
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
          crmMap[l.uid] || "New",
        ]
          .map(escapeCell)
          .join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign}_filtered_leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                    Agent-Reach Lead Intelligence
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {sydneyLeads.length + ukLeads.length} Total Verified Leads
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Verified Instagram businesses without independent custom websites • Ready for outreach
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/leads?campaign=${campaign}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Code2 className="h-3.5 w-3.5 text-indigo-600" />
                Live JSON API
              </a>
              <button
                onClick={downloadJson}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                Export JSON
              </button>
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV ({filteredLeads.length})
              </button>
            </div>
          </div>

          {/* Campaign Switcher */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Campaign Dataset:
            </span>
            <button
              onClick={() => handleCampaignChange("sydney-dog-groomers")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                campaign === "sydney-dog-groomers"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>🐾 Sydney Dog Groomers</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] ${
                  campaign === "sydney-dog-groomers"
                    ? "bg-white/20 text-white"
                    : "bg-white text-slate-700"
                }`}
              >
                {sydneyLeads.length}
              </span>
            </button>

            <button
              onClick={() => handleCampaignChange("uk-tree-surgeons")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                campaign === "uk-tree-surgeons"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>🌳 UK Tree Surgeons</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] ${
                  campaign === "uk-tree-surgeons"
                    ? "bg-white/20 text-white"
                    : "bg-white text-slate-700"
                }`}
              >
                {ukLeads.length}
              </span>
            </button>

            <button
              onClick={() => handleCampaignChange("all")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                campaign === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>🌐 All Qualified Leads</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] ${
                  campaign === "all"
                    ? "bg-white/20 text-white"
                    : "bg-white text-slate-700"
                }`}
              >
                {sydneyLeads.length + ukLeads.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Matching Leads
              </span>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{metrics.total}</span>
              <span className="text-xs text-slate-500">
                of {activeBaseLeads.length} in dataset
              </span>
            </div>
            <div className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1 px-2 py-0.5 rounded-full">
              <Globe className="h-3 w-3" />
              100% Without Custom Website
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Direct Phone / SMS
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Phone className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{metrics.withPhone}</span>
              <span className="text-xs text-slate-500">
                ({metrics.total > 0 ? Math.round((metrics.withPhone / metrics.total) * 100) : 0}%
                call-ready)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Verified mobile or landline numbers in bio
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Instagram DM Route
              </span>
              <div className="h-8 w-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{metrics.dmOnly}</span>
              <span className="text-xs text-slate-500">
                ({metrics.total > 0 ? Math.round((metrics.dmOnly / metrics.total) * 100) : 0}% DM /
                link)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Ideal for DM pitch with preview mockup
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Avg Followers & Coverage
              </span>
              <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {metrics.avgFollowers.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">avg followers</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Across <span className="font-semibold text-slate-700">{metrics.distinctMarkets}</span>{" "}
              suburbs / regions
            </p>
          </div>
        </section>

        {/* Controls & Filters */}
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
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Contact Routes</option>
              <option value="phone">Has Direct Phone / SMS</option>
              <option value="email">Has Email Address</option>
              <option value="dm">Instagram DM Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Website Statuses</option>
              <option value="NO_WEBSITE">No Website</option>
              <option value="WHATSAPP_ONLY">WhatsApp Only</option>
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 max-w-[230px]"
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
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 ml-auto"
            >
              <option value="id-asc">Sort: Default Order (#)</option>
              <option value="followers-desc">Sort: Followers (High → Low)</option>
              <option value="followers-asc">Sort: Followers (Low → High)</option>
              <option value="posts-desc">Sort: Most Active (Posts)</option>
              <option value="name-asc">Sort: Business Name (A–Z)</option>
            </select>
          </div>
        </section>

        {/* Main Output Views */}
        {filteredLeads.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No leads match your current filters.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Try clearing your search query or resetting location/contact filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setContactFilter("all");
                setStatusFilter("all");
                setLocationFilter("all");
              }}
              className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : viewMode === "table" ? (
          <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Business &amp; IG Handle</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Contact Route</th>
                    <th className="py-3 px-4 text-right">Audience</th>
                    <th className="py-3 px-4">CRM</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLeads.map((lead) => {
                    const statusBadge =
                      WEBSITE_STATUS_BADGE[lead.websiteStatus] ||
                      WEBSITE_STATUS_BADGE.NO_WEBSITE;
                    const crmStatus = crmMap[lead.uid] || "New";
                    return (
                      <tr
                        key={lead.uid}
                        onClick={() => setSelectedLead(lead)}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
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
                              {campaign === "all" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                  {lead.country === "Australia" ? "🇦🇺 Sydney" : "🇬🇧 UK"}
                                </span>
                              )}
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
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.classes}`}
                          >
                            {statusBadge.label}
                          </span>
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
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={crmStatus}
                            onChange={(e) =>
                              updateCrmStatus(lead.uid, e.target.value as CrmStatus)
                            }
                            className={`text-[11px] font-semibold px-2 py-1 rounded-md border cursor-pointer focus:outline-none ${CRM_BADGE_STYLES[crmStatus]}`}
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Replied">Replied</option>
                            <option value="Booked">Booked</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLead(lead);
                            }}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                          >
                            Pitch &amp; Bio
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
              const crmStatus = crmMap[lead.uid] || "New";
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

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate">
                      {lead.phone ? `📞 ${lead.phone}` : `💬 ${lead.contactRoute}`}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${CRM_BADGE_STYLES[crmStatus]}`}
                      >
                        {crmStatus}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(buildOutreachMessage(lead), `card-pitch-${lead.uid}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                      >
                        {copiedKey === `card-pitch-${lead.uid}` ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy Pitch
                          </>
                        )}
                      </button>
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
                    Structured Schema &amp; Live JSON Output
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Strongly-typed payload reflecting your active campaign ({filteredLeads.length}{" "}
                    records) • Also accessible via{" "}
                    <code className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      GET /api/leads?campaign={campaign}
                    </code>
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

              {/* Schema Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-4">
                {[
                  { field: "uid", type: "string" },
                  { field: "username", type: "string" },
                  { field: "business_name", type: "string" },
                  { field: "location", type: "string" },
                  { field: "website_status", type: "enum" },
                  { field: "phone / contact_route", type: "string" },
                  { field: "followers / posts", type: "number" },
                  { field: "services", type: "string" },
                  { field: "pitch_angle", type: "string" },
                  { field: "profile_url", type: "uri" },
                  { field: "crm_status", type: "enum" },
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
              {/* Quick Stats */}
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
                  <div className="text-[11px] font-medium text-slate-500">CRM Stage</div>
                  <select
                    value={crmMap[selectedLead.uid] || "New"}
                    onChange={(e) =>
                      updateCrmStatus(selectedLead.uid, e.target.value as CrmStatus)
                    }
                    className="mt-0.5 text-xs font-semibold text-indigo-700 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Replied">Replied</option>
                    <option value="Booked">Booked</option>
                  </select>
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
                Open Instagram Profile
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
    </div>
  );
}

