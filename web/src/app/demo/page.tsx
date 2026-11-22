"use client"

import GlassFolderCardsDemo from "@/components/ui/demo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DemoPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute top-4 left-4 z-50">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-medium text-slate-200 backdrop-blur-md transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Agent Leads
        </Link>
      </div>
      <GlassFolderCardsDemo />
    </div>
  );
}
