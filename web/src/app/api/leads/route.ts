import { NextResponse } from "next/server";
import { ALL_LEADS, DATASET_COUNTS } from "@/lib/leads";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    meta: {
      campaign: "all",
      count: ALL_LEADS.length,
      totals: DATASET_COUNTS,
      generatedAt: new Date().toISOString(),
    },
    leads: ALL_LEADS,
  });
}
