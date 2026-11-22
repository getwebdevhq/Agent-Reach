import { FolderFile } from "@/components/ui/glass-folder-cards";

export interface NicheConfig {
  id: string;
  label: string;
  meta: string;
  tone: "light" | "dark";
  art: "verdant" | "ember" | "aurora" | "glacier" | "dusk";
  seed: number;
  leadCount: number;
  location: string;
  description: string;
  files: FolderFile[];
}

export const NICHES: NicheConfig[] = [
  {
    id: "uk-tree-surgeons",
    label: "Tree Surgeons",
    meta: "350 leads · UK",
    tone: "light",
    art: "verdant",
    seed: 7,
    leadCount: 350,
    location: "United Kingdom",
    description: "Verified UK Tree Surgeons and Arborists operating on Instagram without a website.",
    files: [
      { name: "Batch 1 (100 leads)", meta: "London & SE" },
      { name: "Batch 2 (100 leads)", meta: "Midlands & North" },
      { name: "Batch 3 (150 leads)", meta: "Scotland & Wales" },
      { name: "All 350 Leads", meta: "Complete Master" },
      { name: "Outreach Copy", meta: "High Converting" },
    ],
  },
  {
    id: "sydney-dog-groomers",
    label: "Dog Groomers",
    meta: "50 leads · Sydney",
    tone: "light",
    art: "ember",
    seed: 11,
    leadCount: 50,
    location: "Sydney, Australia",
    description: "Sydney dog groomers and mobile salons operating exclusively via IG DMs and SMS.",
    files: [
      { name: "Sydney Metro (50)", meta: "Eastern Suburbs & Inner West" },
      { name: "Booking System Pitch", meta: "Direct Booking Angle" },
      { name: "Follow-up SMS Scripts", meta: "High Response Rate" },
    ],
  },
  {
    id: "new-niche",
    label: "+ New Niche",
    meta: "Expand Reach",
    tone: "dark",
    art: "aurora",
    seed: 23,
    leadCount: 0,
    location: "Custom Territory",
    description: "Launch new automated Instagram lead discovery across targeted service niches.",
    files: [
      { name: "London Roofers", meta: "Draft Pipeline" },
      { name: "Commercial Cleaners", meta: "B2B Focus" },
      { name: "Aesthetic Clinics", meta: "High Ticket" },
    ],
  },
];
