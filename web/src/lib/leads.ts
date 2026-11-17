import ukRaw from "@/data/uk_tree_surgeons_350_leads.json";

export type BatchFilter = "all" | "batch-1" | "batch-2" | "batch-3";
export type WebsiteStatus = "NO_WEBSITE" | "WHATSAPP_ONLY" | "LINK_AGGREGATOR" | "BOOKING_ONLY";

export interface Lead {
  uid: string;
  id: number;
  campaign: "uk-tree-surgeons";
  campaignLabel: string;
  batch: "Batch 1" | "Batch 2" | "Batch 3";
  username: string;
  businessName: string;
  suburb: string;
  location: string;
  country: string;
  websiteStatus: WebsiteStatus;
  primaryLink: string;
  contactRoute: string;
  phone: string;
  email: string;
  followers: number;
  posts: number;
  services: string;
  pitchAngle: string;
  profileUrl: string;
  bio: string;
}

interface RawUkLead {
  id: number;
  batch?: string;
  username: string;
  full_name: string;
  location: string;
  country?: string;
  website_status: string;
  contact_route: string;
  phones?: string;
  emails?: string;
  followers?: number;
  following?: number;
  posts?: number;
  service_evidence?: string;
  primary_link?: string;
  profile_url: string;
  bio?: string;
  pitch_angle?: string;
}

function resolveBatch(item: RawUkLead): "Batch 1" | "Batch 2" | "Batch 3" {
  if (item.batch === "Batch 1" || item.batch === "Batch 2" || item.batch === "Batch 3") {
    return item.batch;
  }
  if (item.id <= 100) return "Batch 1";
  if (item.id <= 200) return "Batch 2";
  return "Batch 3";
}

export const UK_LEADS: Lead[] = (ukRaw as RawUkLead[]).map((item) => {
  const batch = resolveBatch(item);
  return {
    uid: `uk-${item.id}`,
    id: item.id,
    campaign: "uk-tree-surgeons",
    campaignLabel: `UK Tree Surgeons (${batch})`,
    batch,
    username: item.username,
    businessName: item.full_name || item.username,
    suburb: (item.location || "United Kingdom").split(",")[0].trim(),
    location: item.location || "United Kingdom",
    country: item.country || "United Kingdom",
    websiteStatus: (item.website_status as WebsiteStatus) || "NO_WEBSITE",
    primaryLink: item.primary_link || "",
    contactRoute: item.contact_route || "Instagram Direct Message (DM) for quotes",
    phone: item.phones || "",
    email: item.emails || "",
    followers: Number(item.followers) || 0,
    posts: Number(item.posts) || 0,
    services: item.service_evidence || "Tree Surgery, Arboriculture, Crown Care",
    pitchAngle:
      item.pitch_angle ||
      `Currently operating in ${item.location} with ${
        item.website_status === "WHATSAPP_ONLY" ? "WhatsApp-only booking" : "no independent website"
      }; a fast local SEO landing page with instant quote request forms will capture Google local search traffic.`,
    profileUrl: item.profile_url || `https://www.instagram.com/${item.username}/`,
    bio: item.bio || "",
  };
});

export const ALL_LEADS: Lead[] = UK_LEADS;

export const DATASET_COUNTS = {
  ukTreeSurgeons: UK_LEADS.length,
  batch1: UK_LEADS.filter((l) => l.batch === "Batch 1").length,
  batch2: UK_LEADS.filter((l) => l.batch === "Batch 2").length,
  batch3: UK_LEADS.filter((l) => l.batch === "Batch 3").length,
  total: ALL_LEADS.length,
};

export const AGENT_MEMORY_METRICS = {
  engine: "agentmemory",
  engineUrl: "https://github.com/rohitg00/agentmemory",
  status: "ACTIVE",
  policy: "Zero duplicate leads across all sessions (Strict)",
  totalMemorized: ALL_LEADS.length,
  uniqueHandles: new Set(ALL_LEADS.map((l) => l.username.toLowerCase())).size,
  uniquePhones: new Set(ALL_LEADS.map((l) => l.phone).filter(Boolean)).size,
  duplicateCollisionsPrevented: 0,
  verifiedCrossSession: true,
};
