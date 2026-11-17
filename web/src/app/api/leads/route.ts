import { NextResponse } from "next/server";
import { ALL_LEADS, DATASET_COUNTS, AGENT_MEMORY_METRICS } from "@/lib/leads";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    meta: {
      campaign: "uk-tree-surgeons",
      count: ALL_LEADS.length,
      totals: DATASET_COUNTS,
      deduplication: AGENT_MEMORY_METRICS,
      generatedAt: new Date().toISOString(),
    },
    leads: ALL_LEADS,
  });
}
