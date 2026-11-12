import sydneyRaw from "@/data/sydney_dog_groomers_50_leads.json";
import ukRaw from "@/data/uk_tree_surgeons_100_leads.json";

export type CampaignId = "sydney-dog-groomers" | "uk-tree-surgeons" | "all";
export type WebsiteStatus = "NO_WEBSITE" | "WHATSAPP_ONLY" | "LINK_AGGREGATOR" | "BOOKING_ONLY";

export interface Lead {
  uid: string;
  id: number;
  campaign: "sydney-dog-groomers" | "uk-tree-surgeons";
  campaignLabel: string;
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

interface RawSydneyLead {
  id: number;
  username: string;
  business_name: string;
  suburb: string;
  location: string;
  country: string;
  website_status: string;
  contact_route: string;
  phone: string;
  followers: number;
  posts: number;
  services: string;
  pitch_angle?: string;
  pitch?: string;
  profile_url: string;
  bio: string;
}

interface RawUkLead {
  id: number;
  username: string;
  full_name: string;
  location: string;
  country: string;
  website_status: string;
  contact_route: string;
  phones: string;
  emails: string;
  followers: number;
  following?: number;
  posts: number;
  service_evidence: string;
  primary_link: string;
  profile_url: string;
  bio: string;
}

export const SYDNEY_LEADS: Lead[] = (sydneyRaw as RawSydneyLead[]).map((item) => ({
  uid: `sydney-${item.id}`,
  id: item.id,
  campaign: "sydney-dog-groomers",
  campaignLabel: "Sydney Dog Groomers",
  username: item.username,
  businessName: item.business_name,
  suburb: item.suburb || item.location.split(",")[0].trim(),
  location: item.location,
  country: item.country || "Australia",
  websiteStatus: (item.website_status as WebsiteStatus) || "NO_WEBSITE",
  primaryLink: "",
  contactRoute: item.contact_route,
  phone: item.phone || "",
  email: "",
  followers: Number(item.followers) || 0,
  posts: Number(item.posts) || 0,
  services: item.services,
  pitchAngle: item.pitch_angle || item.pitch || "",
  profileUrl: item.profile_url,
  bio: item.bio,
}));

export const UK_LEADS: Lead[] = (ukRaw as RawUkLead[]).map((item) => ({
  uid: `uk-${item.id}`,
  id: item.id,
  campaign: "uk-tree-surgeons",
  campaignLabel: "UK Tree Surgeons",
  username: item.username,
  businessName: item.full_name,
  suburb: item.location.split(",")[0].trim(),
  location: item.location,
  country: item.country || "United Kingdom",
  websiteStatus: (item.website_status as WebsiteStatus) || "NO_WEBSITE",
  primaryLink: item.primary_link || "",
  contactRoute: item.contact_route,
  phone: item.phones || "",
  email: item.emails || "",
  followers: Number(item.followers) || 0,
  posts: Number(item.posts) || 0,
  services: item.service_evidence,
  pitchAngle: `Currently operating in ${item.location} with ${item.website_status === "WHATSAPP_ONLY" ? "WhatsApp-only booking" : "no independent website"}; a fast local SEO landing page with instant quote request forms will capture Google local search traffic.`,
  profileUrl: item.profile_url,
  bio: item.bio,
}));

export const ALL_LEADS: Lead[] = [...SYDNEY_LEADS, ...UK_LEADS];

export const DATASET_COUNTS = {
  sydneyDogGroomers: SYDNEY_LEADS.length,
  ukTreeSurgeons: UK_LEADS.length,
  total: ALL_LEADS.length,
};

