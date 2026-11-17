# -*- coding: utf-8 -*-
"""
AgentMemory Lead Deduplication & Cross-Session Memory Engine
============================================================
Integrates with Rohit Ghumare's agentmemory (https://github.com/rohitg00/agentmemory)
to ensure no business lead is ever harvested, qualified, contacted, or stored more than once.

Key Features:
- Persistent cross-session lead memory powered by agentmemory standalone KV store
- Multi-attribute deduplication:
    * Normalized Instagram handle (case-insensitive, '@' and URL agnostic)
    * International and local phone number normalizer (Australian & UK prefix mapping)
    * Business / Brand name normalization
- Dual-persistence architecture:
    * Primary: agentmemory standalone JSON ($STANDALONE_PERSIST_PATH or memory_bank)
    * Secondary: Repository git-tracked registry (leads/lead_memory_registry.json)
    * MCP interoperability: Formats memories so memory_recall and memory_smart_search surface them
- Scraper hooks: Filter candidate handles before profile fetches to save bandwidth and prevent re-harvesting
"""

import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


# Default agentmemory persist paths
DEFAULT_STANDALONE_PATHS = [
    os.environ.get("STANDALONE_PERSIST_PATH"),
    os.environ.get("AGENTMEMORY_PATH"),
    "c:/Users/abhib/Documents/instagrapi/memory_bank/data/agentmemory_standalone.json",
    str(Path.home() / ".agentmemory" / "standalone.json"),
]

REPO_REGISTRY_PATH = Path(__file__).resolve().parent.parent / "leads" / "lead_memory_registry.json"


def normalize_handle(handle: Optional[str]) -> str:
    """Normalize an Instagram username or profile URL into a clean canonical handle."""
    if not handle:
        return ""
    h = str(handle).strip().lower()
    # Strip URL prefixes
    h = re.sub(r"^https?://(www\.)?instagram\.com/", "", h)
    # Strip trailing slashes, queries, or fragments
    h = h.split("?")[0].split("#")[0].strip("/")
    # Strip leading '@'
    h = h.lstrip("@").strip()
    return h


def normalize_phone(phone: Optional[str]) -> str:
    """Extract digits and normalize phone numbers for cross-session matching."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", str(phone))
    if not digits:
        return ""

    # Australia: 04XXXXXXXX (10 digits) <-> 614XXXXXXXX (11 digits)
    if digits.startswith("04") and len(digits) == 10:
        return "61" + digits[1:]
    if digits.startswith("614") and len(digits) == 11:
        return digits
    if digits.startswith("6104") and len(digits) == 12:
        return "614" + digits[4:]

    # UK: 07XXXXXXXXX (11 digits) <-> 447XXXXXXXXX (12 digits)
    if digits.startswith("07") and len(digits) == 11:
        return "44" + digits[1:]
    if digits.startswith("447") and len(digits) == 12:
        return digits

    return digits


def normalize_name(name: Optional[str]) -> str:
    """Normalize business name for fuzzy matching."""
    if not name:
        return ""
    # Lowercase, remove special characters, collapse whitespace
    clean = re.sub(r"[^\w\s]", "", str(name).lower())
    return " ".join(clean.split())


class LeadMemoryEngine:
    """Persistent Lead Deduplication & Cross-Session Memory Engine using agentmemory."""

    def __init__(self, persist_path: Optional[str] = None, repo_registry_path: Optional[Path] = None):
        self.persist_path = self._resolve_persist_path(persist_path)
        self.repo_registry_path = repo_registry_path or REPO_REGISTRY_PATH

        # In-memory indexes for fast O(1) deduplication checks
        self.handles_index: Dict[str, Dict[str, Any]] = {}
        self.phones_index: Dict[str, str] = {}  # phone -> handle
        self.names_index: Dict[str, str] = {}   # name -> handle

        # Load existing data
        self.load()

    def _resolve_persist_path(self, override: Optional[str]) -> Optional[str]:
        if override and Path(override).parent.exists():
            return override
        for p in DEFAULT_STANDALONE_PATHS:
            if p and Path(p).exists():
                return p
        # If none exist, choose first valid default path and ensure dir
        target = "c:/Users/abhib/Documents/instagrapi/memory_bank/data/agentmemory_standalone.json"
        try:
            Path(target).parent.mkdir(parents=True, exist_ok=True)
            return target
        except Exception:
            fallback = str(Path.home() / ".agentmemory" / "standalone.json")
            Path(fallback).parent.mkdir(parents=True, exist_ok=True)
            return fallback

    def load(self):
        """Load known leads from agentmemory and repo registry."""
        self.handles_index.clear()
        self.phones_index.clear()
        self.names_index.clear()

        # 1. Load from agentmemory standalone JSON
        if self.persist_path and Path(self.persist_path).exists():
            try:
                with open(self.persist_path, "r", encoding="utf-8") as f:
                    store = json.load(f)

                # Check agentreach:leads scope
                leads_scope = store.get("agentreach:leads", {})
                for handle, lead in leads_scope.items():
                    clean_h = normalize_handle(handle)
                    if clean_h:
                        lead["username"] = clean_h
                        lead["handle"] = clean_h
                        self.handles_index[clean_h] = lead
                        # Index phone
                        raw_p = lead.get("phone") or lead.get("phones")
                        phone = raw_p[0] if isinstance(raw_p, list) and raw_p else (raw_p.split(",")[0].strip() if isinstance(raw_p, str) and raw_p.strip() else None)
                        if phone:
                            clean_p = normalize_phone(phone)
                            if clean_p:
                                self.phones_index[clean_p] = clean_h
                        # Index name
                        name = lead.get("business_name") or lead.get("full_name")
                        if name:
                            clean_n = normalize_name(name)
                            if clean_n and len(clean_n) > 3:
                                self.names_index[clean_n] = clean_h

                # Also inspect mem:memories for any lead entities saved by other sessions
                memories = store.get("mem:memories", {})
                for mem_id, mem in memories.items():
                    concepts = mem.get("concepts", [])
                    if isinstance(concepts, list):
                        for c in concepts:
                            if c.startswith("handle:"):
                                h = normalize_handle(c.split("handle:", 1)[1])
                                if h and h not in self.handles_index:
                                    mem_str = str(mem).lower()
                                    niche = "Sydney Dog Groomers" if ("groom" in mem_str or "dog" in mem_str) else ("UK Tree Surgeons" if "tree" in mem_str else "General")
                                    country = "Australia" if ("sydney" in mem_str or "australia" in mem_str) else ("United Kingdom" if "uk" in mem_str else "Unknown")
                                    self.handles_index[h] = {
                                        "username": h,
                                        "handle": h,
                                        "niche": niche,
                                        "country": country,
                                        "memory_id": mem_id,
                                        "source": "mem:memories",
                                        "title": mem.get("title", ""),
                                        "created_at": mem.get("createdAt", ""),
                                    }
                            elif c.startswith("phone:"):
                                p = normalize_phone(c.split("phone:", 1)[1])
                                if p:
                                    h_tag = [x for x in concepts if x.startswith("handle:")]
                                    if h_tag:
                                        self.phones_index[p] = normalize_handle(h_tag[0].split(":", 1)[1])
            except Exception as e:
                sys.stderr.write(f"[LeadMemoryEngine] Warning loading agentmemory: {e}\n")

        # 2. Merge with git-tracked repository registry if present
        if self.repo_registry_path and self.repo_registry_path.exists():
            try:
                with open(self.repo_registry_path, "r", encoding="utf-8") as f:
                    reg = json.load(f)
                for item in reg.get("leads", []):
                    clean_h = normalize_handle(item.get("username") or item.get("handle"))
                    if clean_h:
                        item["username"] = clean_h
                        item["handle"] = clean_h
                        # Update if missing or if only placeholder from mem:memories
                        if clean_h not in self.handles_index or self.handles_index[clean_h].get("source") == "mem:memories":
                            self.handles_index[clean_h] = item
                        raw_p = item.get("phone") or item.get("phones")
                        phone = raw_p[0] if isinstance(raw_p, list) and raw_p else (raw_p.split(",")[0].strip() if isinstance(raw_p, str) and raw_p.strip() else None)
                        if phone:
                            clean_p = normalize_phone(phone)
                            if clean_p:
                                self.phones_index[clean_p] = clean_h
                        name = item.get("business_name") or item.get("full_name")
                        if name:
                            clean_n = normalize_name(name)
                            if clean_n and len(clean_n) > 3:
                                self.names_index[clean_n] = clean_h
            except Exception as e:
                sys.stderr.write(f"[LeadMemoryEngine] Warning loading repo registry: {e}\n")

    def is_lead_known(
        self,
        identifier: str,
        phone: Optional[str] = None,
        business_name: Optional[str] = None
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Check if a lead has ever been discovered, qualified, or contacted before.
        Returns:
            (is_known: bool, reason: str, existing_lead_data: Optional[Dict])
        """
        # 1. Check Instagram Handle
        clean_h = normalize_handle(identifier)
        if clean_h and clean_h in self.handles_index:
            existing = self.handles_index[clean_h]
            campaign = existing.get("campaign", existing.get("niche", "unspecified"))
            return True, f"Instagram handle '@{clean_h}' already memorized in agentmemory (campaign: {campaign})", existing

        # 2. Check Phone Number
        if phone:
            clean_p = normalize_phone(phone)
            if clean_p and clean_p in self.phones_index:
                matched_handle = self.phones_index[clean_p]
                existing = self.handles_index.get(matched_handle, {})
                return True, f"Phone number matches memorized lead '@{matched_handle}' in agentmemory", existing

        # 3. Check Exact Business Name
        if business_name:
            clean_n = normalize_name(business_name)
            if clean_n and len(clean_n) > 5 and clean_n in self.names_index:
                matched_handle = self.names_index[clean_n]
                existing = self.handles_index.get(matched_handle, {})
                return True, f"Business name '{business_name}' matches memorized lead '@{matched_handle}' in agentmemory", existing

        return False, "Fresh lead (unseen in all sessions)", None

    def record_lead(
        self,
        lead: Dict[str, Any],
        source: str = "scraper",
        campaign: Optional[str] = None
    ) -> bool:
        """
        Record a verified lead into agentmemory and repo registry.
        Guarantees idempotency: returns False if already memorized.
        """
        username = lead.get("username") or lead.get("handle") or lead.get("id")
        clean_h = normalize_handle(username)
        if not clean_h:
            return False

        # If already known, check if it's already fully recorded
        is_known, reason, existing = self.is_lead_known(clean_h)
        if is_known:
            if existing and existing.get("verified") and (existing.get("phone") or existing.get("phones")):
                return False
            # If existing was only a lightweight placeholder from mem:memories, proceed to enrich it

        # Extract normalized attributes
        phone = lead.get("phone")
        if not phone:
            raw_phones = lead.get("phones")
            if isinstance(raw_phones, list) and raw_phones:
                phone = raw_phones[0]
            elif isinstance(raw_phones, str) and raw_phones.strip():
                phone = raw_phones.split(",")[0].strip()
        clean_p = normalize_phone(phone)

        business_name = lead.get("business_name") or lead.get("full_name") or clean_h
        clean_n = normalize_name(business_name)

        niche = lead.get("niche") or "UK Tree Surgeons"
        location = lead.get("location") or lead.get("suburb") or ""
        country = lead.get("country") or "United Kingdom"
        website_status = lead.get("website_status") or "NO_WEBSITE"
        profile_url = lead.get("profile_url") or f"https://www.instagram.com/{clean_h}/"

        now_iso = datetime.now(timezone.utc).isoformat()
        lead_hash = hashlib.sha256(clean_h.encode("utf-8")).hexdigest()[:12]
        memory_id = f"mem_lead_{lead_hash}"

        # Standard agentmemory memory structure
        concepts = [
            "lead",
            "agentreach",
            "verified-lead",
            f"handle:{clean_h}",
            f"niche:{niche.lower().replace(' ', '-')}",
            f"country:{country.lower()}",
            f"website_status:{website_status}",
        ]
        if clean_p:
            concepts.append(f"phone:{clean_p}")

        content = (
            f"Verified Lead: @{clean_h}\n"
            f"Business Name: {business_name}\n"
            f"Niche: {niche}\n"
            f"Location: {location}, {country}\n"
            f"Website Status: {website_status}\n"
            f"Phone: {phone or 'N/A'}\n"
            f"Profile URL: {profile_url}\n"
            f"Pitch: {lead.get('pitch', lead.get('pitch_angle', 'N/A'))}\n"
            f"Campaign: {campaign or source}"
        )

        lead_entry = {
            "id": memory_id,
            "username": clean_h,
            "business_name": business_name,
            "niche": niche,
            "location": location,
            "country": country,
            "phone": phone or "",
            "normalized_phone": clean_p,
            "website_status": website_status,
            "profile_url": profile_url,
            "followers": lead.get("followers", 0),
            "campaign": campaign or source,
            "source": source,
            "first_seen_at": now_iso,
            "verified": True,
        }

        # Update in-memory indexes
        self.handles_index[clean_h] = lead_entry
        if clean_p:
            self.phones_index[clean_p] = clean_h
        if clean_n and len(clean_n) > 3:
            self.names_index[clean_n] = clean_h

        # Persist to agentmemory standalone store
        self._persist_to_agentmemory(
            memory_id=memory_id,
            clean_h=clean_h,
            title=f"Verified Lead: @{clean_h} - {business_name} ({niche})",
            content=content,
            concepts=concepts,
            lead_entry=lead_entry,
            now_iso=now_iso,
        )

        # Persist to repo registry
        self._persist_to_repo_registry(lead_entry)
        return True

    def batch_record_leads(
        self,
        leads: List[Dict[str, Any]],
        source: str = "batch",
        campaign: Optional[str] = None
    ) -> int:
        """Batch record multiple leads into agentmemory with atomic file writes."""
        added_count = 0
        for lead in leads:
            if self.record_lead(lead, source=source, campaign=campaign):
                added_count += 1
        return added_count

    def filter_unseen_handles(self, handles: List[str]) -> List[str]:
        """Filter a candidate list of handles, returning ONLY unseen handles."""
        unseen = []
        for h in handles:
            clean = normalize_handle(h)
            if not clean:
                continue
            is_known, _, _ = self.is_lead_known(clean)
            if not is_known:
                unseen.append(clean)
        return unseen

    def filter_unseen_leads(self, leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter a list of lead dictionaries, discarding any known in agentmemory."""
        fresh = []
        for l in leads:
            h = l.get("username") or l.get("handle")
            p = l.get("phone") or (l.get("phones", [None])[0] if isinstance(l.get("phones"), list) else None)
            n = l.get("business_name") or l.get("full_name")
            is_known, _, _ = self.is_lead_known(h, phone=p, business_name=n)
            if not is_known:
                fresh.append(l)
        return fresh

    def _persist_to_agentmemory(
        self,
        memory_id: str,
        clean_h: str,
        title: str,
        content: str,
        concepts: List[str],
        lead_entry: Dict[str, Any],
        now_iso: str,
    ):
        """Atomically persist to agentmemory standalone store."""
        if not self.persist_path:
            return

        try:
            store: Dict[str, Any] = {}
            p = Path(self.persist_path)
            if p.exists():
                with open(p, "r", encoding="utf-8") as f:
                    store = json.load(f)

            if "mem:memories" not in store:
                store["mem:memories"] = {}
            if "agentreach:leads" not in store:
                store["agentreach:leads"] = {}

            # Add to mem:memories (surfaces in memory_recall & memory_smart_search)
            store["mem:memories"][memory_id] = {
                "id": memory_id,
                "type": "fact",
                "title": title[:80],
                "content": content,
                "concepts": concepts,
                "files": ["leads/uk_tree_surgeons_350_leads.json"],
                "createdAt": now_iso,
                "updatedAt": now_iso,
                "strength": 9,
                "version": 1,
                "isLatest": True,
                "sessionIds": [],
                "project": "agent-reach",
            }

            # Add to fast index scope
            store["agentreach:leads"][clean_h] = lead_entry

            # Atomic write
            tmp_path = p.with_suffix(".tmp")
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(store, f, indent=2, ensure_ascii=False)
            tmp_path.replace(p)
        except Exception as e:
            sys.stderr.write(f"[LeadMemoryEngine] Error writing to agentmemory: {e}\n")

    def _persist_to_repo_registry(self, lead_entry: Dict[str, Any]):
        """Persist lead to local repository registry."""
        try:
            reg: Dict[str, Any] = {
                "version": "1.0.0",
                "engine": "agentmemory",
                "repository": "getwebdevhq/agent-reach-leads",
                "last_synced_at": datetime.now(timezone.utc).isoformat(),
                "leads": [],
            }
            if self.repo_registry_path.exists():
                with open(self.repo_registry_path, "r", encoding="utf-8") as f:
                    reg = json.load(f)

            # Avoid duplicates in list
            existing_handles = {normalize_handle(x.get("username") or x.get("handle")) for x in reg.get("leads", [])}
            if lead_entry["username"] not in existing_handles:
                reg["leads"].append(lead_entry)
                reg["total_leads"] = len(reg["leads"])
                reg["last_synced_at"] = datetime.now(timezone.utc).isoformat()

                self.repo_registry_path.parent.mkdir(parents=True, exist_ok=True)
                tmp_path = self.repo_registry_path.with_suffix(".tmp")
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(reg, f, indent=2, ensure_ascii=False)
                tmp_path.replace(self.repo_registry_path)
        except Exception as e:
            sys.stderr.write(f"[LeadMemoryEngine] Error writing repo registry: {e}\n")

    def get_stats(self) -> Dict[str, Any]:
        """Return memory statistics for dashboard and telemetry."""
        niches: Dict[str, int] = {}
        countries: Dict[str, int] = {}
        for lead in self.handles_index.values():
            n = lead.get("niche", "Unknown")
            c = lead.get("country", "Unknown")
            niches[n] = niches.get(n, 0) + 1
            countries[c] = countries.get(c, 0) + 1

        return {
            "total_memorized_leads": len(self.handles_index),
            "unique_phone_numbers": len(self.phones_index),
            "unique_business_names": len(self.names_index),
            "breakdown_by_niche": niches,
            "breakdown_by_country": countries,
            "persist_store": str(self.persist_path),
            "repo_registry": str(self.repo_registry_path),
            "deduplication_policy": "Zero duplicate leads across all sessions (Strict)",
        }

    def purge_pet_and_dog_leads(self) -> Dict[str, int]:
        """Remove all doggy daycare, pet boarding, and dog grooming leads from memory & registry."""
        pet_keywords = (
            "dog groom", "doggy daycare", "pet boarding", "sydney dog",
            "doggy", "pooch", "puppy", "groomer", "grooming", "daycare", "boarding", "australia"
        )

        def is_pet_lead(obj: Any) -> bool:
            txt = json.dumps(obj, ensure_ascii=False).lower()
            if "tree" in txt or "arbor" in txt or "stump" in txt:
                return False
            return any(kw in txt for kw in pet_keywords)

        removed_store = 0
        removed_mems = 0
        removed_reg = 0

        # 1. Purge from agentmemory standalone store
        if self.persist_path and Path(self.persist_path).exists():
            try:
                p = Path(self.persist_path)
                with open(p, "r", encoding="utf-8") as f:
                    store = json.load(f)

                if "agentreach:leads" in store:
                    new_leads = {}
                    for k, v in store["agentreach:leads"].items():
                        if is_pet_lead(v):
                            removed_store += 1
                        else:
                            new_leads[k] = v
                    store["agentreach:leads"] = new_leads

                if "mem:memories" in store:
                    new_mems = {}
                    for k, v in store["mem:memories"].items():
                        if (k.startswith("mem_lead_") or v.get("project") == "agent-reach") and is_pet_lead(v):
                            removed_mems += 1
                        else:
                            new_mems[k] = v
                    store["mem:memories"] = new_mems

                tmp_path = p.with_suffix(".tmp")
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(store, f, indent=2, ensure_ascii=False)
                tmp_path.replace(p)
            except Exception as e:
                sys.stderr.write(f"[LeadMemoryEngine] Warning purging persist store: {e}\n")

        # 2. Purge from repository registry
        if self.repo_registry_path and self.repo_registry_path.exists():
            try:
                with open(self.repo_registry_path, "r", encoding="utf-8") as f:
                    reg = json.load(f)
                orig = reg.get("leads", [])
                kept = [l for l in orig if not is_pet_lead(l)]
                removed_reg = len(orig) - len(kept)
                reg["leads"] = kept
                reg["total_leads"] = len(kept)
                reg["last_synced_at"] = datetime.now(timezone.utc).isoformat()

                tmp_path = self.repo_registry_path.with_suffix(".tmp")
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(reg, f, indent=2, ensure_ascii=False)
                tmp_path.replace(self.repo_registry_path)
            except Exception as e:
                sys.stderr.write(f"[LeadMemoryEngine] Warning purging repo registry: {e}\n")

        self.load()
        return {
            "removed_from_agentmemory_leads": removed_store,
            "removed_from_agentmemory_memories": removed_mems,
            "removed_from_repo_registry": removed_reg,
            "remaining_memorized_leads": len(self.handles_index),
        }

    def sync_all_existing_leads(self) -> Dict[str, Any]:
        """Scan all UK tree surgeon leads in leads/ directory and sync into agentmemory."""
        leads_dir = Path(__file__).resolve().parent.parent / "leads"
        candidate_files = [
            leads_dir / "uk_tree_surgeons_350_leads.json",
            leads_dir / "uk_tree_surgeons_200_leads.json",
            leads_dir / "uk_tree_surgeons_100_leads.json",
            leads_dir / "uk_tree_surgeons_100_more_leads.json",
            leads_dir / "uk_tree_surgeons_150_more_leads.json",
        ]

        synced_uk = 0
        for uk_file in candidate_files:
            if uk_file.exists():
                with open(uk_file, "r", encoding="utf-8") as f:
                    uk_leads = json.load(f)
                for l in uk_leads:
                    l["niche"] = "UK Tree Surgeons"
                    l["country"] = "United Kingdom"
                    if self.record_lead(l, source=uk_file.stem, campaign="UK Tree Surgeons"):
                        synced_uk += 1

        return {
            "synced_uk": synced_uk,
            "total_synced": synced_uk,
            "current_total": len(self.handles_index),
        }


# Global singleton instance
lead_memory = LeadMemoryEngine()


def check_lead(handle: str, phone: Optional[str] = None) -> Tuple[bool, str]:
    """Convenience helper: check if handle or phone is known."""
    known, reason, _ = lead_memory.is_lead_known(handle, phone=phone)
    return known, reason


def record_new_lead(lead_dict: Dict[str, Any], campaign: Optional[str] = None) -> bool:
    """Convenience helper: record new lead."""
    return lead_memory.record_lead(lead_dict, campaign=campaign)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="AgentMemory Lead Deduplication Engine")
    parser.add_argument("--sync", action="store_true", help="Sync all existing leads from leads/ into agentmemory")
    parser.add_argument("--stats", action="store_true", help="Display memory statistics")
    parser.add_argument("--check", type=str, help="Check if an Instagram handle or profile is known")
    parser.add_argument("--phone", type=str, help="Optional phone to check alongside --check")
    args = parser.parse_args()

    engine = LeadMemoryEngine()

    if args.sync:
        print("[AgentMemory] Synchronizing existing verified leads into persistent store...")
        res = engine.sync_all_existing_leads()
        print(f"[AgentMemory] Synchronization complete: {res}")

    if args.check:
        known, reason, data = engine.is_lead_known(args.check, phone=args.phone)
        print(f"\nTarget: {args.check}")
        print(f"Known:  {'REJECTED - DUPLICATE' if known else 'ALLOWED - FRESH'}")
        print(f"Reason: {reason}")
        if data:
            print(f"Data:   @{data.get('username')} ({data.get('business_name')}) - {data.get('niche')}")

    if args.stats or (not args.sync and not args.check):
        print("\n=== AgentMemory Lead Deduplication Engine Stats ===")
        stats = engine.get_stats()
        for k, v in stats.items():
            print(f"  {k}: {v}")

