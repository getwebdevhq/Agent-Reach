#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UK Tree Surgeons - 100 Verified Leads Pipeline (Strict Filtering & Full UK Scope)
==================================================================================
Identifies and verifies 100 independent UK tree surgeons who:
1. Have an active Instagram business profile
2. Have NO independent custom website (only no website, link-in-bio, whatsapp, or social profile)
3. Have credible arboricultural service evidence (felling, pruning, crown reduction, stump grinding, hedge cutting, emergency work)
4. Are independently owned (not national chains, retail shops, or directories)
5. Have a public business contact route (UK phone, email, WhatsApp, or active DM quote)
6. Are based in the United Kingdom (England prioritized)
"""

import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import concurrent.futures
import csv
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

from curl_cffi import requests
from bs4 import BeautifulSoup
import pandas as pd
from rich.console import Console

console = Console()

OUTPUT_DIR = Path("leads")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

LINK_AGGREGATORS = {
    "linktr.ee", "beacons.ai", "campsite.bio", "bio.link", "linkin.bio",
    "taplink.cc", "solo.to", "allmylinks.com", "lnk.bio", "contactin.bio",
    "carrd.co", "snipfeed.co", "hoo.be", "komi.io", "direct.me", "flowcode.com",
    "link.me", "sleek.bio", "wlo.link", "compiled.social"
}

BOOKING_PORTALS = {
    "fresha.com", "vagaro.com", "calendly.com", "acuityscheduling.com",
    "square.site", "squareup.com", "setmore.com", "booksy.com", "schedulicity.com"
}

WHATSAPP_DOMAINS = {"wa.me", "api.whatsapp.com", "whatsapp.com"}
SOCIAL_DOMAINS = {"facebook.com", "fb.com", "tiktok.com", "youtube.com", "youtu.be", "twitter.com", "x.com"}

CORE_ARBORICULTURE_KEYWORDS = [
    "tree surgeon", "tree surgery", "arborist", "arborists", "arboriculture",
    "tree care", "tree services", "tree works", "tree work", "felling",
    "stump grinding", "crown reduction", "crown thinning", "hedge cutting",
    "hedge trimming", "emergency tree", "treeworker", "climber"
]

DISALLOWED_CATEGORIES = [
    "hair", "salon", "drain", "plumbing", "dental", "dentist", "oral surgeon",
    "teeth", "beauty", "aesthetic", "fitness", "gym", "timber sales", "furniture",
    "council", "streetscene", "photographer", "wedding", "restaurant", "cafe",
    "hotel", "apparel", "gear", "association", "directory", "portal", "christmas tree",
    "christmastree", "farm", "nursery"
]

NON_UK_PATTERNS = [
    r"\bva\b", r"\bky\b", r"\bfl\b", r"\bca\b", r"\btx\b", r"\bnc\b", r"\bsc\b",
    r"\btn\b", r"\bga\b", r"\boh\b", r"\bpa\b", r"\bny\b", r"\bnj\b", r"\bwa\b",
    r"\bflorida\b", r"\bvirginia\b", r"\btexas\b", r"\bcalifornia\b", r"\bgeorgia\b",
    r"\bohio\b", r"\bkentucky\b", r"\baustralia\b", r"\bcanada\b", r"\bireland\b"
]

UK_LOCATION_NAMES = [
    "london", "manchester", "birmingham", "leeds", "liverpool", "bristol",
    "nottingham", "sheffield", "leicester", "newcastle", "brighton",
    "oxford", "cambridge", "reading", "southampton", "portsmouth", "bournemouth",
    "exeter", "plymouth", "bath", "cheltenham", "coventry", "derby", "york",
    "bradford", "hull", "sunderland", "norwich", "ipswich", "milton keynes",
    "luton", "watford", "guildford", "canterbury", "maidstone", "peterborough",
    "northampton", "worcester", "durham", "colchester", "chelmsford",
    "warrington", "bolton", "stockport", "salford", "wakefield", "harrogate",
    "doncaster", "eastbourne", "worthing", "torquay", "chester", "preston",
    "surrey", "kent", "essex", "sussex", "hampshire", "devon", "cornwall",
    "dorset", "somerset", "wiltshire", "gloucestershire", "berkshire",
    "oxfordshire", "buckinghamshire", "hertfordshire", "suffolk", "norfolk",
    "cambridgeshire", "northamptonshire", "warwickshire", "worcestershire",
    "staffordshire", "shropshire", "cheshire", "lancashire", "yorkshire",
    "derbyshire", "nottinghamshire", "lincolnshire", "cumbria", "northumberland",
    "cotswolds", "glasgow", "edinburgh", "aberdeen", "dundee", "inverness",
    "cardiff", "swansea", "newport", "belfast", "lisburn", "derry"
]

p1 = re.compile(
    r'([0-9.,KMBkmb]+)\s+Followers,\s+([0-9.,KMBkmb]+)\s+Following,\s+([0-9.,KMBkmb]+)\s+Posts\s*-\s*(.*?)\s*\(@([a-zA-Z0-9._]+)\)\s+on Instagram:\s*"(.*?)"',
    re.DOTALL
)
p2 = re.compile(
    r'([0-9.,KMBkmb]+)\s+Followers,\s+([0-9.,KMBkmb]+)\s+Following,\s+([0-9.,KMBkmb]+)\s+Posts\s*-\s*@([a-zA-Z0-9._]+)\s+on Instagram:\s*"(.*?)"',
    re.DOTALL
)
p3 = re.compile(
    r'([0-9.,KMBkmb]+)\s+Followers,\s+([0-9.,KMBkmb]+)\s+Following,\s+([0-9.,KMBkmb]+)\s+Posts\s*-\s*(?:See Instagram photos and videos from\s+)?(.*?)\s*\(@([a-zA-Z0-9._]+)\)',
    re.DOTALL
)

def parse_num(s: str) -> int:
    s = s.replace(",", "").strip().lower()
    if s.endswith("k"):
        return int(float(s[:-1]) * 1000)
    elif s.endswith("m"):
        return int(float(s[:-1]) * 1000000)
    try:
        return int(s)
    except Exception:
        return 0

def clean_domain(url: str) -> str:
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower() or parsed.path.lower().split("/")[0]
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""

def classify_website_from_text(text: str) -> Tuple[str, str]:
    urls = re.findall(
        r'(?:https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.(?:co\.uk|org\.uk|com|net|org|biz|info|io)(?:/[^\s]*)?)',
        text.lower()
    )
    clean_urls = []
    for u in urls:
        if "@" in u:
            continue
        clean_urls.append(u)

    if not clean_urls:
        return "NO_WEBSITE", ""

    primary = clean_urls[0]
    domain = clean_domain(primary)

    if any(agg in domain for agg in LINK_AGGREGATORS):
        return "LINK_AGGREGATOR", primary
    if any(wa in domain for wa in WHATSAPP_DOMAINS) or "wa.me" in primary:
        return "WHATSAPP_ONLY", primary
    if any(soc in domain for soc in SOCIAL_DOMAINS):
        return "SOCIAL_ONLY", primary
    if any(bp in domain for bp in BOOKING_PORTALS):
        return "BOOKING_PORTAL", primary

    return "CUSTOM_WEBSITE", primary

def lookup_profile_snippet(username: str) -> Optional[Dict]:
    url = f"https://search.yahoo.com/search?p=site%3Ainstagram.com%2F{username}%2F"
    for attempt in range(2):
        try:
            r = requests.get(url, impersonate="chrome120", timeout=7)
            if r.status_code != 200:
                return None
            soup = BeautifulSoup(r.text, "html.parser")

            full_snippet_text = ""
            matched_data = None

            for ct in soup.find_all(class_=re.compile("compText|fz-14|desc")):
                txt = ct.get_text()
                full_snippet_text += " " + txt
                if "Followers" not in txt or matched_data:
                    continue

                m = p1.search(txt)
                if m:
                    matched_data = {
                        "username": m.group(5).lower(),
                        "full_name": m.group(4).strip(),
                        "followers": parse_num(m.group(1)),
                        "following": parse_num(m.group(2)),
                        "posts": parse_num(m.group(3)),
                        "bio": m.group(6).strip(),
                    }
                    continue

                m = p2.search(txt)
                if m:
                    matched_data = {
                        "username": m.group(4).lower(),
                        "full_name": m.group(4).strip(),
                        "followers": parse_num(m.group(1)),
                        "following": parse_num(m.group(2)),
                        "posts": parse_num(m.group(3)),
                        "bio": m.group(5).strip(),
                    }
                    continue

                m = p3.search(txt)
                if m:
                    matched_data = {
                        "username": m.group(5).lower(),
                        "full_name": m.group(4).strip(),
                        "followers": parse_num(m.group(1)),
                        "following": parse_num(m.group(2)),
                        "posts": parse_num(m.group(3)),
                        "bio": "",
                    }

            if matched_data:
                matched_data["full_text"] = full_snippet_text
                return matched_data

        except Exception:
            time.sleep(0.3)
    return None

def extract_city_or_county(text: str) -> str:
    lower = text.lower()
    for loc in UK_LOCATION_NAMES:
        if loc in lower:
            return loc.title()
    return "England (UK-wide)"

def extract_service_evidence(text: str) -> str:
    lower = text.lower()
    evidence = []
    if "nptc" in lower:
        evidence.append("NPTC Certified")
    if "insur" in lower:
        evidence.append("Fully Insured")
    if "fell" in lower or "removal" in lower:
        evidence.append("Felling & Removals")
    if "prun" in lower:
        evidence.append("Pruning")
    if "crown" in lower or "reduction" in lower:
        evidence.append("Crown Reduction")
    if "stump" in lower:
        evidence.append("Stump Grinding")
    if "hedge" in lower:
        evidence.append("Hedge Trimming")
    if "emergency" in lower or "24/7" in lower or "storm" in lower:
        evidence.append("24/7 Emergency Work")
    if "domestic" in lower or "commercial" in lower:
        evidence.append("Domestic & Commercial")
    if "free quote" in lower or "quote" in lower:
        evidence.append("Free Quotes")
    if not evidence:
        evidence.append("Active Arboricultural Portfolio")
    return ", ".join(evidence)

def extract_contact(text: str) -> Tuple[List[str], List[str]]:
    emails = list(set(re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)))
    raw_phones = re.findall(
        r"(?:(?:\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}|(?:\+44\s?1\d{3}|01\d{3})\s?\d{5,7}|(?:\+44\s?2\d{2}|02\d{2})\s?\d{7,8}|0800\s?\d{3}\s?\d{3,4})",
        text
    )
    phones = list(set(p.strip() for p in raw_phones))
    return phones, emails

def is_strictly_uk(combined_text: str, phones: List[str]) -> bool:
    for pat in NON_UK_PATTERNS:
        if re.search(pat, combined_text):
            return False

    if phones:
        return True

    uk_markers = [
        "uk", "gb", "england", "scotland", "wales", "london", "manchester",
        "birmingham", "leeds", "bristol", "liverpool", "sheffield", "newcastle",
        "nottingham", "surrey", "kent", "essex", "sussex", "hampshire", "devon",
        "cheshire", "yorkshire", "lancashire", "somerset", "dorset", "norfolk",
        "suffolk", "cornwall", "berkshire", "gloucestershire", "leicestershire",
        "oxfordshire", "derbyshire", "warwickshire", "hertfordshire", "wiltshire"
    ]
    return any(m in combined_text for m in uk_markers)

def qualify_lead(raw: Dict) -> Tuple[bool, str, Dict]:
    username = raw["username"]
    full_name = raw["full_name"]
    bio = raw["bio"]
    full_text = raw.get("full_text", f"{username} {full_name} {bio}")
    combined = f"{username} {full_name} {bio} {full_text}".lower()

    # 1. Follower count (25 to 50k)
    followers = raw["followers"]
    if followers < 25:
        return False, "Followers too low (<25)", {}
    if followers > 50000:
        return False, "Likely national brand or directory (>50k)", {}

    # 2. Activity / posts
    posts = raw["posts"]
    if posts < 3:
        return False, "Insufficient posts (<3)", {}

    # 3. Disallowed business categories
    if any(d in combined for d in DISALLOWED_CATEGORIES):
        return False, "Disallowed category", {}

    # 4. Must be a genuine arboriculture business
    has_core = any(c in combined for c in CORE_ARBORICULTURE_KEYWORDS)
    if not has_core:
        return False, "No core arboriculture keywords", {}

    # 5. STRICT NO CUSTOM WEBSITE CHECK
    web_status, primary_link = classify_website_from_text(bio)
    if web_status == "CUSTOM_WEBSITE":
        return False, f"Has custom website ({primary_link})", {}

    m_cust = re.search(
        r'(?:www\.[a-zA-Z0-9-]+\.(?:co\.uk|com)|https?://(?:www\.)?[a-zA-Z0-9-]+\.(?:co\.uk|com))',
        full_text.lower()
    )
    if m_cust:
        found_url = m_cust.group(0)
        dom = clean_domain(found_url)
        if (
            dom not in LINK_AGGREGATORS
            and dom not in SOCIAL_DOMAINS
            and dom not in WHATSAPP_DOMAINS
            and not any(dom.endswith("." + agg) for agg in LINK_AGGREGATORS)
        ):
            return False, f"Has custom website in snippet ({found_url})", {}

    # 6. Extract Contacts & Confirm UK
    phones, emails = extract_contact(combined)
    if not is_strictly_uk(combined, phones):
        return False, "Not confirmed in UK", {}

    contact_route = ""
    if phones:
        contact_route = f"Phone: {phones[0]}"
    elif emails:
        contact_route = f"Email: {emails[0]}"
    elif web_status == "WHATSAPP_ONLY":
        contact_route = f"WhatsApp ({primary_link})"
    elif any(k in combined for k in ["dm", "quote", "call", "message", "contact"]):
        contact_route = "Instagram DM for free quote"
    else:
        return False, "No public contact route", {}

    loc = extract_city_or_county(combined)
    evidence = extract_service_evidence(combined)

    lead_data = {
        "username": username,
        "full_name": full_name or username,
        "location": loc,
        "country": "United Kingdom",
        "website_status": web_status,
        "primary_link": primary_link,
        "contact_route": contact_route,
        "phones": ", ".join(phones),
        "emails": ", ".join(emails),
        "followers": followers,
        "following": raw["following"],
        "posts": posts,
        "service_evidence": evidence,
        "profile_url": f"https://www.instagram.com/{username}/",
        "bio": bio
    }

    return True, "Qualified", lead_data

def load_candidate_pool() -> List[str]:
    candidates = []
    
    # 1. UK verified file
    f1 = Path("scratch/harvested_uk_verified.txt")
    if f1.exists():
        with open(f1, "r", encoding="utf-8") as f:
            for l in f:
                h = l.strip().lower()
                if h and len(h) >= 3:
                    candidates.append(h)

    # 2. Tree surgeons file
    f2 = Path("scratch/harvested_tree_surgeons.txt")
    if f2.exists():
        with open(f2, "r", encoding="utf-8") as f:
            for l in f:
                h = l.strip().lower()
                if h and len(h) >= 3:
                    candidates.append(h)

    # 3. Brave harvested
    f3 = Path("scratch/brave_harvested_handles.txt")
    if f3.exists():
        with open(f3, "r", encoding="utf-8") as f:
            for l in f:
                h = l.strip().lower()
                if h and len(h) >= 3:
                    candidates.append(h)

    # 4. Verified Seeds
    seeds = [
        "ashwood_tree_surgeons", "agmtreesurgery", "branchingouttrees", "ashwood_tree_surgery",
        "edinburghtree", "hurstflynntreecare", "icstreeservicesltd", "dphtreesurgery",
        "longacretrees", "lg_trees", "rapidtreecare_", "putneytreesurgeons",
        "treesurgeonsinsouthlondon", "wharfe_tree_services", "tendringtrees",
        "all_aspect_trees_ltd", "cstreegardenservices", "arborist_surrey",
        "shropshirestumpgrinding", "cheshiretreecare", "jh_arb", "viking_tree_careuk",
        "the.tree.guy", "treesandgardensliverpool", "eddystreeandgardenservices",
        "ltdurbantreecare", "hallstreeservices", "michaelbirrellgardenandtrees",
        "mkm_bromsgrove", "lumberjacksltd", "capitaltreesltd", "hinwood06",
        "releaf_tree_services_", "hobsontreeservicesltd", "s6treespecialistsltd",
        "essextreebrothers", "family_tree_services", "robertfinigantreeservices",
        "jjltrees", "jh_tree_services_hampshire_", "countrywide_tree_specialists",
        "specialised.tree.service", "lukethetreeguy", "avenue.trees", "tree_doctor_kent",
        "joericetree", "broadleaftreecare", "tomandsonstreeandgardening0", "apex_tree_surgeons",
        "woodlandtreesurgeons", "bramleytreesurgery", "countrysidetreecare", "crown_tree_surgeons",
        "climb_high_tree_care", "pinnacletreesurgeons", "forest_tree_surgery",
        "greenwoodtreesurgeons", "sycamoretreecare", "evergreentreesurgery", "willowtreecareuk",
        "beechtreesurgery", "cedartreecare", "birchtreesurgeons", "mapletreesurgery",
        "ash_tree_surgeons", "treemendoustrees", "propertreework", "uk_tree_specialists"
    ]
    candidates.extend(seeds)

    seen = set()
    unique = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique.append(c)

    return unique

def main():
    existing_valid_leads = []
    seen_usernames = set()
    
    # Load previously verified leads and clean any false positives
    existing_file = OUTPUT_DIR / "uk_tree_surgeons_100_leads.json"
    if existing_file.exists():
        with open(existing_file, "r", encoding="utf-8") as f:
            prev = json.load(f)
            banned_users = {
                "hairvolutionbyabbey", "drainsurgeonaberdeen", "surviveddaily",
                "uppercanadatimberco", "liverpoolstreetscene", "callkarl_"
            }
            for p in prev:
                u = p["username"].lower()
                if u not in banned_users and u not in seen_usernames:
                    seen_usernames.add(u)
                    existing_valid_leads.append(p)

    console.print(f"[bold cyan]Loaded {len(existing_valid_leads)} pre-verified qualified UK leads.[/bold cyan]")

    candidates = load_candidate_pool()
    unprocessed = [c for c in candidates if c not in seen_usernames]
    console.print(f"[bold cyan]Scanning remaining {len(unprocessed)} UK candidates for qualification...[/bold cyan]")

    qualified_leads: List[Dict] = list(existing_valid_leads)
    checked = 0
    start_time = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        f_map = {ex.submit(lookup_profile_snippet, u): u for u in unprocessed}

        for f in concurrent.futures.as_completed(f_map):
            u = f_map[f]
            checked += 1
            try:
                raw_data = f.result()
                if raw_data and raw_data["username"] not in seen_usernames:
                    is_qual, reason, lead = qualify_lead(raw_data)
                    if is_qual:
                        seen_usernames.add(lead["username"])
                        qualified_leads.append(lead)
                        contact = lead["contact_route"]
                        console.print(
                            f"[bold green]✔ [{len(qualified_leads):03d}/100][/bold green] "
                            f"@{lead['username']:<25} | {lead['website_status']:<15} | "
                            f"{lead['location']:<14} | {contact[:24]}"
                        )

                        if len(qualified_leads) >= 100:
                            console.print("\n[bold green]🎯 Reached 100 Qualified Leads! Exporting results...[/bold green]")
                            ex.shutdown(wait=False, cancel_futures=True)
                            break
            except Exception:
                pass

            if checked % 50 == 0:
                elapsed = int(time.time() - start_time)
                console.print(
                    f"[dim]Progress: Checked {checked}/{len(unprocessed)} candidates ({len(qualified_leads)} qualified) in {elapsed}s...[/dim]"
                )

    console.print(f"\n[bold green]🏆 Total Qualified UK Tree Surgeon Leads: {len(qualified_leads)}[/bold green]")
    export_leads(qualified_leads)

def export_leads(leads: List[Dict]):
    if not leads:
        console.print("[red]No leads to export.[/red]")
        return

    excel_file = OUTPUT_DIR / "uk_tree_surgeons_100_leads.xlsx"
    csv_file = OUTPUT_DIR / "uk_tree_surgeons_100_leads.csv"
    json_file = OUTPUT_DIR / "uk_tree_surgeons_100_leads.json"

    cols = [
        "username", "full_name", "location", "country", "website_status",
        "contact_route", "phones", "emails", "followers", "following", "posts",
        "service_evidence", "primary_link", "profile_url", "bio"
    ]

    df = pd.DataFrame(leads)
    df_export = df[[c for c in cols if c in df.columns]]
    df_export.to_excel(excel_file, index=False)
    df_export.to_csv(csv_file, index=False, encoding="utf-8-sig")

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)

    console.print(f"\n[bold cyan]📁 Saved Excel Report:[/bold cyan] {excel_file}")
    console.print(f"[bold cyan]📁 Saved CSV File:    [/bold cyan] {csv_file}")
    console.print(f"[bold cyan]📁 Saved JSON File:   [/bold cyan] {json_file}")

if __name__ == "__main__":
    main()
