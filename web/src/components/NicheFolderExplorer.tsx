"use client";

import React, { useState } from "react";
import GlassFolder, { FolderFile } from "@/components/ui/glass-folder-cards";
import { BatchFilter } from "@/lib/leads";
import { Sparkles, ChevronDown, ChevronUp, FolderKanban, CheckCircle2 } from "lucide-react";

interface NicheFolderExplorerProps {
  activeBatch: BatchFilter;
  onSelectBatch: (batch: BatchFilter) => void;
  selectedNiche: string;
  onSelectNiche: (nicheId: string) => void;
  totalLeadsCount: number;
}

export default function NicheFolderExplorer({
  activeBatch,
  onSelectBatch,
  selectedNiche,
  onSelectNiche,
  totalLeadsCount,
}: NicheFolderExplorerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTreeSurgeonFileSelect = (file: FolderFile) => {
    if (file.name.includes("Batch 1")) {
      onSelectBatch("batch-1");
      notify("Filtered view to Batch 1 (100 London & South East leads)");
    } else if (file.name.includes("Batch 2")) {
      onSelectBatch("batch-2");
      notify("Filtered view to Batch 2 (100 Midlands & North leads)");
    } else if (file.name.includes("Batch 3")) {
      onSelectBatch("batch-3");
      notify("Filtered view to Batch 3 (150 Scotland, Wales & England leads)");
    } else if (file.name.includes("All")) {
      onSelectBatch("all");
      notify("Showing all 350 UK Tree Surgeons leads");
    } else {
      notify(`Selected: ${file.name}`);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-xl shadow-xs transition-all overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <FolderKanban className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Niche Folder System
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                Active: Tree Surgeons
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Frosted 3D glass folders for multi-niche campaign discovery & batch organization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notification && (
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-3 py-1 text-xs animate-fade-in shadow-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>{notification}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Browse Folders</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Folder Cards Row */}
      {isExpanded && (
        <div className="p-4 sm:p-6 bg-radial from-slate-50/60 to-slate-100/40">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 justify-items-center items-end py-2">
            {/* 1. Tree Surgeons Folder (Active Niche) */}
            <div className="flex flex-col items-center">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Primary Campaign (350 Verified Leads)
              </div>
              <GlassFolder
                label="Tree Surgeons"
                meta={`${totalLeadsCount} Leads · UK`}
                tone="light"
                art="verdant"
                seed={7}
                action="more"
                labelPlacement="bottom-left"
                files={[
                  { name: "Batch 1 (100 leads)", meta: "London & SE" },
                  { name: "Batch 2 (100 leads)", meta: "Midlands & North" },
                  { name: "Batch 3 (150 leads)", meta: "Scotland & Wales" },
                  { name: "All 350 Leads", meta: "Complete Master" },
                ]}
                onFileSelect={handleTreeSurgeonFileSelect}
                menu={[
                  { label: "Filter: Batch 1 (100)", onSelect: () => onSelectBatch("batch-1") },
                  { label: "Filter: Batch 2 (100)", onSelect: () => onSelectBatch("batch-2") },
                  { label: "Filter: Batch 3 (150)", onSelect: () => onSelectBatch("batch-3") },
                  { label: "Show All 350 Leads", onSelect: () => onSelectBatch("all") },
                ]}
              />
              <span className="mt-3 text-[11px] text-slate-500 text-center font-mono">
                Click folder to open · Select batch sheet to filter
              </span>
            </div>

            {/* 2. Sydney Dog Groomers Folder */}
            <div className="flex flex-col items-center">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Niche 2: Sydney Pet Care (50 Leads)
              </div>
              <GlassFolder
                label="Dog Groomers"
                meta="50 Leads · Sydney"
                tone="light"
                art="ember"
                seed={11}
                action="more"
                labelPlacement="top-left"
                files={[
                  { name: "Sydney Metro (50)", meta: "Eastern Suburbs" },
                  { name: "Mobile Booking Pitch", meta: "Website Angle" },
                  { name: "SMS Cold Outreach", meta: "High Reply Rate" },
                ]}
                onFileSelect={(f) => notify(`Dog Groomers: ${f.name}`)}
                menu={[
                  { label: "Preview Sydney Leads", onSelect: () => notify("Switched to Sydney Dog Groomers") },
                  { label: "Download CSV", onSelect: () => notify("Downloading Sydney leads CSV...") },
                ]}
              />
              <span className="mt-3 text-[11px] text-slate-500 text-center font-mono">
                50 Sydney grooming businesses without websites
              </span>
            </div>

            {/* 3. Add New Niche Folder */}
            <div className="flex flex-col items-center">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <Sparkles className="h-3 w-3 text-indigo-500" />
                Next Niches (Custom Workflow)
              </div>
              <GlassFolder
                label="+ New Niche"
                meta="Add Campaign"
                tone="dark"
                art="aurora"
                seed={23}
                action="add"
                labelPlacement="top-right"
                files={[
                  { name: "London Roofers", meta: "Pipeline queued" },
                  { name: "Commercial Cleaners", meta: "B2B Outreach" },
                  { name: "Car Detailing", meta: "Instagram First" },
                ]}
                onAdd={() => {
                  notify("Created new niche pipeline draft!");
                  return { name: "Dental Clinics", meta: "New Niche · Just now" };
                }}
                onFileSelect={(f) => notify(`Niche: ${f.name}`)}
              />
              <span className="mt-3 text-[11px] text-slate-500 text-center font-mono">
                Click + button to drop a new niche file
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
