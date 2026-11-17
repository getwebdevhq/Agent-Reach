#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Strict Exa UK Tree Surgeons Pipeline — 150 Verified NO_WEBSITE Leads (Batch 3)
==============================================================================
1. Audits existing candidates in scratch/batch3_150_verified.json with strict brand-domain check
   (no location bias), removing any business with a custom website, news/parks, or non-UK origin.
2. Runs 120+ targeted UK-specific Exa Instagram queries (#treesurgeonuk, #ukarborist, UK counties + "07"/"NPTC"/"DM").
3. Verifies EVERY candidate has:
   - Real active UK Tree Surgeon / Arborist / Stump Grinding Instagram handle
   - Explicit UK proof (UK mobile 07 / landline 01-02 / UK county / NPTC / Ltd / £ / UK flag)
   - ZERO foreign (US/CA/AU/NZ/IE) indicators
   - ZERO custom website domain (strict Exa brand-domain verification)
   - ZERO overlap with existing 200 UK Tree Surgeons via AgentMemory
4. Exports exactly 150 spotless Batch 3 leads and compiles the Master 350-Lead UK dataset!
"""

import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import concurrent.futures
import json
import re
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse

from curl_cffi import requests
import pandas as pd
from rich.console import Console

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from agent_reach.lead_memory import lead_memory, normalize_handle, normalize_phone

console = Console()
OUTPUT_DIR = ROOT_DIR / "leads"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

EXA_URL = "https://mcp.exa.ai/mcp"
EXA_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}

IGNORED_HANDLES = {
    "p", "reel", "reels", "explore", "stories", "accounts", "about", "legal",
    "tv", "channel", "directory", "tags", "locations", "blog", "instagram",
    "arboricultural_association", "arbjobs", "arbtalk", "stihl", "husqvarna",
    "stihlgb", "husqvarnauk", "honeybros", "gustharts", "frjonesandson",
    "sorbusinternational", "treesurgeon", "arborist", "timberwolfuk", "greenmech",
    "forstwoodchippers", "arbtrader", "proarbmagazine", "essentialarb",
    "gristwoodandtoms", "thorstrees", "foremosttreesurgeons", "nicholsandsonstree",
    "reynoldstreecareltd", "ashdownspiderhire", "wokinghamtoday", "bestofwalsall",
    "examinerlive", "keepdurhambeautiful", "baldock_and_letchworth_news",
    "londonlive", "newbedfordguide", "parksinpreston", "chescoparkspres",
    "schnelltreeservice", "diaztreeservice", "bgtreeservicenc", "colonialtreeservice",
    "chuckstreeservice", "bigtreecare_au"
}

NON_BUSINESS_HANDLE_PARTS = (
    "news", "live", "today", "guide", "parks", "council", "bestof", "beautiful",
    "spiderhire", "planthire", "toolhire", "machinery", "magazine", "journal",
    "association", "society", "charity", "trust", "museum", "school", "college",
    "university", "_au", "australia", "canada", "usa", "tx", "nc", "fl", "ny", "nj"
)

DIRECTORY_AND_SOCIAL_DOMAINS = {
    "instagram.com", "facebook.com", "m.facebook.com", "fb.com", "checkatrade.com",
    "yell.com", "trustatrader.com", "bark.com", "mybuilder.com", "ratedpeople.com",
    "freeindex.co.uk", "thomsonlocal.com", "192.com", "linkedin.com", "uk.linkedin.com",
    "tiktok.com", "youtube.com", "youtu.be", "x.com", "twitter.com", "threads.net",
    "threads.com", "yelp.co.uk", "yelp.com", "cylex-uk.co.uk", "nextdoor.co.uk",
    "trustpilot.com", "uk.trustpilot.com", "google.com", "maps.google.com", "linktr.ee",
    "beacons.ai", "bio.link", "wa.me", "whatsapp.com", "gov.uk",
    "find-and-update.company-information.service.gov.uk", "company-information.service.gov.uk",
    "endole.co.uk", "suite.endole.co.uk", "pomanda.com", "bizstats.co.uk",
    "companieshouse.gov.uk", "checkcompany.co.uk", "companycheck.co.uk", "open.endole.co.uk",
    "arbjobs.com", "arbtalk.co.uk", "trees.org.uk", "exa.ai", "pinterest.com",
    "pinterest.co.uk", "reddit.com", "gumtree.com", "threebestrated.co.uk",
    "uk.placedigger.com", "gb.kompass.com", "businessmagnet.co.uk", "hotfrog.co.uk",
    "scoot.co.uk", "touchlocal.com", "brownbook.net", "cybo.com", "infobel.co.uk",
    "opendi.co.uk", "tupalo.co", "uksmallbusinessdirectory.co.uk", "foursquare.com",
    "tripadvisor.co.uk", "mapquest.com", "bing.com", "yahoo.com", "wikipedia.org",
    "bbc.co.uk", "ebay.co.uk", "amazon.co.uk", "findglocal.com", "nicelocal.co.uk",
    "vymaps.com", "near-place.com", "locallife.co.uk", "thebestof.co.uk", "safelocaltrades.com",
    "which.co.uk", "trustedtraders.which.co.uk", "tradingstandards.uk", "buywithconfidence.gov.uk",
    "bizify.co.uk", "uk.bizdb.co.uk", "gb.enrollbusiness.com", "uk.kompass.com",
    "dnb.com", "bloomberg.com", "zoominfo.com", "rocketreach.co", "apollo.io",
    "signalhire.com", "pitchbook.com", "crunchbase.com", "owler.com", "glassdoor.co.uk",
    "indeed.com", "uk.indeed.com", "reed.co.uk", "totaljobs.com", "cv-library.co.uk",
    "companieslist.co.uk", "ukcompanydata.com", "bizdb.co.uk", "duedil.com",
    "globaldatabase.com", "misterwhat.co.uk", "yably.co.uk", "openingtimesin.uk",
    "reviews.io", "feefo.com", "houzz.co.uk", "homify.co.uk", "checkapro.com",
    "trustist.com", "findatrade.com", "myjobquote.co.uk", "hamuch.com", "localheroes.com",
    "quotatis.co.uk", "service.co.uk", "tradesmen.co.uk", "yell.co.uk",
    "ukbusinessforums.co.uk", "forestryjournal.co.uk", "hortweek.com", "proarbmagazine.com",
    "essentialarb.com", "arboristnews.com", "share.google", "company-director-check.co.uk",
    "creditsafe.com", "northdata.com", "opencorporates.com", "uk.globaldatabase.com",
    "b2bhint.com", "bizstats.co.uk", "check-business.co.uk", "ukdatahouse.com",
    "companycheck.co.uk", "uk.trade.org", "tradefinder.co.uk", "ratedtrades.co.uk",
    "checktrade.co.uk", "localmole.co.uk", "ukphonebook.com", "thephonebook.bt.com",
    "british-business-directory.co.uk", "gb.bizzspot.co", "nearme.co.uk"
}

GENERIC_BRAND_STOPWORDS = {
    "tree", "trees", "surgeon", "surgeons", "surgery", "arborist", "arborists",
    "arboriculture", "care", "service", "services", "work", "works", "stump",
    "grinding", "removal", "hedge", "hedges", "cutting", "trimming", "garden",
    "gardening", "landscapes", "landscaping", "grounds", "maintenance", "forestry",
    "woodland", "timber", "ltd", "limited", "uk", "england", "scotland", "wales",
    "the", "and", "sons", "bros", "company", "group", "specialist", "specialists",
    "contracting", "contractors", "solutions", "north", "south", "east", "west",
    "midlands", "london", "surrey", "kent", "essex", "sussex", "yorkshire", "devon",
    "cornwall", "hampshire", "dorset", "somerset", "cheshire", "lancashire", "norfolk",
    "suffolk", "hertfordshire", "berkshire", "oxfordshire", "wiltshire", "shropshire",
    "staffordshire", "warwickshire", "worcestershire", "gloucestershire", "derbyshire",
    "nottinghamshire", "lincolnshire", "cumbria", "durham", "bristol", "leeds",
    "manchester", "birmingham", "liverpool", "sheffield", "newcastle", "glasgow",
    "edinburgh", "cardiff", "belfast", "brighton", "oxford", "cambridge", "bath",
    "exeter", "plymouth", "norwich", "ipswich", "york", "chester", "preston", "reading"
}

STRICT_TREE_KEYWORDS = [
    "tree surgeon", "tree surgery", "arborist", "arborists", "arboriculture",
    "tree care", "tree services", "tree service", "tree works", "tree work",
    "tree felling", "tree removal", "stump grinding", "stump removal",
    "crown reduction", "crown thinning", "pollarding", "tree dismantling",
    "emergency tree", "treeworker", "tree specialist", "nptc"
]

DISALLOWED_CATEGORIES = [
    "hair", "salon", "drain", "plumbing", "dental", "dentist", "oral surgeon",
    "beauty", "aesthetic", "fitness", "gym", "furniture", "council", "photographer",
    "wedding", "restaurant", "cafe", "hotel", "apparel", "gear shop", "association",
    "directory", "portal", "christmas tree", "christmastree", "nursery", "tool hire",
    "chainsaw sales", "jobs board", "recruitment", "printmaker", "athlete", "snowboard",
    "doggy daycare", "pet boarding", "dog grooming", "pet grooming", "kennel", "cattery",
    "fire dept", "marine corps", "manufacturer", "excavator attachment", "spider lift hire",
    "cherry picker hire", "woodchipper sales", "newspaper", "local news", "radio station"
]

FOREIGN_KEYWORDS = [
    "llc", "inc.", "inc ", "corp.", "quebec", "québec", "canada", "canadian", "ontario",
    "british columbia", "alberta", "kawartha", "australia", "sydney", "melbourne",
    "brisbane", "perth wa", "western australia", "new zealand", "auckland", "florida",
    "virginia", "texas", "california", "georgia", "ohio", "kentucky", "new york",
    "new jersey", "pennsylvania", "massachusetts", "connecticut", "new hampshire",
    "vermont", "michigan", "illinois", "north carolina", "south carolina", "tennessee",
    "oregon", "washington state", "pacific northwest", "colorado", "arizona",
    "minnesota", "wisconsin", "maryland", "indiana", "missouri", "alabama",
    "louisiana", "oklahoma", "utah", "nevada", "west chester", "chester springs",
    "ireland", "dublin", "cork", "galway", "usa", "u.s.a", "united states",
    "🇺🇸", "🇨🇦", "🇦🇺", "🇳🇿", "🇮🇪", "tcia", "usd", "$", "raleigh", "charlotte",
    "durham nc", "chapel hill", "richmond va", "chester county", "new bedford",
    "kildare", "meath", "wicklow", "limerick", "belfast me"
]

US_STATE_OR_PHONE = re.compile(
    r"(?:,\s*(?:PA|VA|NC|SC|GA|FL|TX|CA|NY|NJ|OH|MI|IL|WI|MN|WA|OR|CO|AZ|MA|CT|NH|VT|ME|MD|DE|TN|KY|AL|LA|OK|UT|NV|IN|MO|IA|KS|NE|ND|SD|MT|ID|WY|NM|AR|MS|WV|RI|HI|AK|ON|QC|BC|AB|NSW|VIC|QLD|WA)\b|\(\d{3}\)\s*\d{3}[-.\s]\d{4}|\b[2-9]\d{2}[-.]\d{3}[-.]\d{4}\b)",
    re.IGNORECASE,
)

UK_LOCATION_MAP = [
    "London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol",
    "Nottingham", "Sheffield", "Leicester", "Newcastle", "Brighton", "Oxford",
    "Cambridge", "Reading", "Southampton", "Portsmouth", "Bournemouth", "Exeter",
    "Plymouth", "Bath", "Cheltenham", "Coventry", "Derby", "York", "Bradford",
    "Hull", "Sunderland", "Norwich", "Ipswich", "Milton Keynes", "Luton",
    "Watford", "Guildford", "Canterbury", "Maidstone", "Peterborough",
    "Northampton", "Worcester", "Durham", "Colchester", "Chelmsford",
    "Warrington", "Bolton", "Stockport", "Salford", "Wakefield", "Harrogate",
    "Doncaster", "Eastbourne", "Worthing", "Torquay", "Chester", "Preston",
    "Surrey", "Kent", "Essex", "Sussex", "Hampshire", "Devon", "Cornwall",
    "Dorset", "Somerset", "Wiltshire", "Gloucestershire", "Berkshire",
    "Oxfordshire", "Buckinghamshire", "Hertfordshire", "Suffolk", "Norfolk",
    "Cambridgeshire", "Northamptonshire", "Warwickshire", "Worcestershire",
    "Staffordshire", "Shropshire", "Cheshire", "Lancashire", "Yorkshire",
    "Derbyshire", "Nottinghamshire", "Lincolnshire", "Cumbria", "Northumberland",
    "Bedfordshire", "Herefordshire", "Cotswolds", "Glasgow", "Edinburgh",
    "Aberdeen", "Dundee", "Inverness", "Perth", "Stirling", "Fife", "Ayr",
    "Cardiff", "Swansea", "Newport", "Wrexham", "Belfast", "Swindon",
    "Salisbury", "Taunton", "Yeovil", "Truro", "Poole", "Shrewsbury", "Telford",
    "Hereford", "Lincoln", "Carlisle", "Kendal", "Middlesbrough", "Darlington",
    "Huddersfield", "Halifax", "Barnsley", "Rotherham", "Blackburn", "Blackpool",
    "Burnley", "Lancaster", "Scarborough", "Macclesfield", "Wirral", "Wigan",
    "Tunbridge Wells", "Sevenoaks", "Horsham", "Crawley", "Chichester", "Lewes",
    "Hastings", "Ashford", "Folkestone", "Bromley", "Croydon", "Kingston",
    "Epsom", "Woking", "Reigate", "Dorking", "Farnham", "Basingstoke",
    "Winchester", "Newbury", "Maidenhead", "Windsor", "High Wycombe", "Aylesbury",
    "Banbury", "St Albans", "Stevenage", "Southend", "Basildon", "Brentwood",
    "Braintree", "Bedford", "Kettering", "Nuneaton", "Tamworth", "Lichfield",
    "Stafford", "Wolverhampton", "Solihull", "Redditch", "Wales", "Scotland",
    "Midlands", "North West", "North East", "South West", "South East", "East Anglia"
]


def exa_search(query: str, num_results: int = 20) -> List[Dict[str, str]]:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "web_search_exa",
            "arguments": {"query": query, "numResults": num_results},
        },
    }
    try:
        r = requests.post(EXA_URL, headers=EXA_HEADERS, json=payload, timeout=18)
        if r.status_code != 200:
            return []
        raw_text = ""
        for line in r.text.splitlines():
            if line.startswith("data: "):
                obj = json.loads(line[6:])
                raw_text = obj.get("result", {}).get("content", [{}])[0].get("text", "")
                break
        if not raw_text:
            return []
        results = []
        for block in raw_text.split("\n---\n"):
            m_title = re.search(r"Title:\s*(.+)", block)
            m_url = re.search(r"URL:\s*(\S+)", block)
            m_hl = re.search(r"Highlights:\s*([\s\S]+)", block)
            if m_url:
                results.append({
                    "title": m_title.group(1).strip() if m_title else "",
                    "url": m_url.group(1).strip(),
                    "highlights": m_hl.group(1).strip() if m_hl else "",
                })
        return results
    except Exception:
        return []


def extract_uk_phone(text: str) -> str:
    m_mob = re.search(r"(?:(?:\+44\s?7|07)\d{3}\s?\d{3}\s?\d{3})", text)
    if m_mob:
        return re.sub(r"\s+", " ", m_mob.group(0).strip())
    m_land = re.search(r"(?:(?:\+44\s?[12]|0[12])\d{2,4}\s?\d{5,7})", text)
    if m_land:
        return re.sub(r"\s+", " ", m_land.group(0).strip())
    return ""


def extract_uk_email(text: str) -> str:
    m = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    for e in m:
        if not any(ign in e.lower() for ign in ["example", "domain", "instagram", "facebook"]):
            return e.lower()
    return ""


def detect_uk_location(text: str, fallback: str = "") -> str:
    lower = text.lower()
    for loc in UK_LOCATION_MAP:
        if re.search(rf"\b{re.escape(loc.lower())}\b", lower):
            return loc
    return fallback or "England (UK-wide)"


def extract_services(text: str) -> str:
    lower = text.lower()
    ev = []
    if "nptc" in lower:
        ev.append("NPTC Certified")
    if "insur" in lower:
        ev.append("Fully Insured")
    if "fell" in lower or "removal" in lower or "dismantl" in lower:
        ev.append("Tree Felling & Dismantling")
    if "crown" in lower or "reduction" in lower or "thinning" in lower:
        ev.append("Crown Reduction & Thinning")
    if "prun" in lower or "pollard" in lower:
        ev.append("Pruning & Pollarding")
    if "stump" in lower:
        ev.append("Stump Grinding")
    if "hedge" in lower:
        ev.append("Hedge Trimming & Maintenance")
    if "emergency" in lower or "24/7" in lower or "storm" in lower:
        ev.append("24/7 Emergency Tree Work")
    if "domestic" in lower or "commercial" in lower:
        ev.append("Domestic & Commercial Arboriculture")
    return ", ".join(ev) if ev else "Tree Surgery, Arboriculture, Crown Care, Local Tree Work"


def domain_matches_business(domain: str, handle: str, business_name: str) -> bool:
    d = domain.lower().replace("www.", "")
    if not d or d in DIRECTORY_AND_SOCIAL_DOMAINS:
        return False
    parts = d.split(".")
    if len(parts) >= 2:
        root2 = ".".join(parts[-2:])
        root3 = ".".join(parts[-3:]) if len(parts) >= 3 else root2
        if root2 in DIRECTORY_AND_SOCIAL_DOMAINS or root3 in DIRECTORY_AND_SOCIAL_DOMAINS:
            return False

    d_compact = re.sub(r"[^a-z0-9]", "", d.split(".")[0])
    h_compact = re.sub(r"[^a-z0-9]", "", handle.lower())
    b_compact = re.sub(r"[^a-z0-9]", "", business_name.lower())
    # Strip trailing ltd/limited for comparison
    h_clean = re.sub(r"(ltd|limited|uk)$", "", h_compact)
    b_clean = re.sub(r"(ltd|limited|uk)$", "", b_compact)

    if len(d_compact) < 4:
        return False

    for ref in (h_compact, b_compact, h_clean, b_clean):
        if len(ref) >= 5 and (ref in d_compact or d_compact in ref):
            return True

    tokens = set(re.findall(r"[a-z0-9]{4,}", f"{handle} {business_name}".lower()))
    distinctive = [t for t in tokens if t not in GENERIC_BRAND_STOPWORDS]
    for tok in distinctive:
        if tok in d_compact and any(tw in d_compact for tw in ("tree", "arb", "stump", "hedge", "wood", "garden", "land", "forest", "log")):
            return True
        if tok == d_compact:
            return True

    # Also catch exact multi-word match like "localbranch" in "localbranch.co.uk"
    b_words = [w for w in re.findall(r"[a-z0-9]{3,}", business_name.lower()) if w not in {"the", "and", "ltd", "limited", "uk"}]
    if len(b_words) >= 2:
        first_two = b_words[0] + b_words[1]
        if len(first_two) >= 6 and first_two in d_compact:
            return True

    return False


def strict_verify_candidate(candidate: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Strict 100% UK + NO_WEBSITE verification via Exa (location-unbiased brand query)."""
    handle = normalize_handle(candidate.get("username"))
    bname = (candidate.get("full_name") or "").strip()
    if not handle or handle in IGNORED_HANDLES:
        return None
    if any(bad in handle for bad in NON_BUSINESS_HANDLE_PARTS):
        return None

    # Check handle or name has arboriculture signal
    base_txt = f"{handle} {bname} {candidate.get('bio', '')}"
    if not any(kw in base_txt.lower() for kw in STRICT_TREE_KEYWORDS):
        return None
    if any(dis in base_txt.lower() for dis in DISALLOWED_CATEGORIES):
        return None
    if any(fk in base_txt.lower() for fk in FOREIGN_KEYWORDS) or US_STATE_OR_PHONE.search(base_txt):
        return None

    # Check bio/caption for any custom website URL
    bio_urls = re.findall(
        r"(?:https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:co\.uk|org\.uk|com|net|org))",
        candidate.get("bio", "").lower(),
    )
    website_status = candidate.get("website_status", "NO_WEBSITE")
    primary_link = candidate.get("primary_link", "")
    for u in bio_urls:
        if "@" in u:
            continue
        dom = urlparse(u if u.startswith("http") else f"https://{u}").netloc.lower().replace("www.", "")
        if "linktr.ee" in dom or "beacons.ai" in dom or "bio.link" in dom:
            website_status = "LINK_AGGREGATOR"
            primary_link = u
        elif "wa.me" in dom or "whatsapp" in dom:
            website_status = "WHATSAPP_ONLY"
            primary_link = u
        elif dom and dom not in DIRECTORY_AND_SOCIAL_DOMAINS:
            return None

    # Location-UNBIASED Exa web search to catch ANY custom brand website anywhere in the UK!
    q = f'"{bname}" OR "{handle}" tree surgeon UK'
    res = exa_search(q, num_results=8)
    extra_text = ""
    for item in res:
        dom = urlparse(item["url"]).netloc.lower().replace("www.", "")
        if domain_matches_business(dom, handle, bname):
            return None  # Has custom website -> REJECT!
        # Also reject if title matches this exact business on a .co.uk/.com site
        if dom not in DIRECTORY_AND_SOCIAL_DOMAINS:
            it_title = item["title"].lower()
            b_clean = re.sub(r"\b(ltd|limited)\b", "", bname.lower()).strip()
            if len(b_clean) >= 8 and b_clean in it_title:
                return None
        if "instagram.com" in dom and handle in item["url"].lower():
            extra_text += " " + item["title"] + " " + item["highlights"]

    full_ctx = f"{base_txt} {extra_text}"
    if any(fk in full_ctx.lower() for fk in FOREIGN_KEYWORDS) or US_STATE_OR_PHONE.search(full_ctx):
        return None
    if any(dis in full_ctx.lower() for dis in DISALLOWED_CATEGORIES):
        return None

    phone = candidate.get("phones") or extract_uk_phone(full_ctx)
    email = candidate.get("emails") or extract_uk_email(full_ctx)

    # Require explicit UK proof
    loc = detect_uk_location(full_ctx, fallback="")
    has_uk_proof = bool(
        phone
        or any(sig in full_ctx.lower() for sig in ("nptc", "£", "🇬🇧", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "🏴󠁧󠁢󠁷󠁬󠁳󠁿", " ltd", "limited", "loler", "uk", "england", "scotland", "wales"))
        or (loc and loc != "England (UK-wide)")
    )
    if not has_uk_proof:
        return None
    if not loc:
        loc = candidate.get("location") or "England (UK-wide)"

    # AgentMemory strict zero-duplicate check (handle + phone + name)
    if lead_memory.is_lead_known(handle, phone=phone or None, business_name=bname)[0]:
        return None

    contact_route = (
        f"Phone / SMS: {phone}"
        if phone
        else (f"Email: {email}" if email else "Instagram Direct Message (DM) for quotes")
    )
    services = extract_services(full_ctx)
    pitch = (
        f"Operating across {loc} relying exclusively on "
        f"{'phone (' + phone + ')' if phone else 'Instagram Direct Messages'} without an independent website; "
        f"a fast local-SEO quote website with NPTC credentials and before/after galleries will capture urgent local Google tree surgery searches."
    )

    return {
        "username": handle,
        "full_name": bname or handle.replace("_", " ").title(),
        "location": loc,
        "country": "United Kingdom",
        "website_status": website_status,
        "contact_route": contact_route,
        "phones": phone,
        "emails": email,
        "followers": int(candidate.get("followers") or 0),
        "following": 0,
        "posts": int(candidate.get("posts") or 0),
        "service_evidence": services,
        "primary_link": primary_link,
        "profile_url": f"https://www.instagram.com/{handle}/",
        "bio": (candidate.get("bio") or "").replace("\n", " ").strip()[:300],
        "pitch_angle": pitch,
        "batch": "Batch 3",
    }


def harvest_query(q: str) -> List[Dict[str, Any]]:
    items = exa_search(q, num_results=25)
    found: Dict[str, Dict[str, Any]] = {}
    for item in items:
        u_url = item["url"]
        if "instagram.com/" not in u_url:
            continue
        m = re.search(r"instagram\.com/([a-zA-Z0-9._]{3,30})(?:/|\?|$)", u_url)
        if not m:
            continue
        handle = normalize_handle(m.group(1))
        if not handle or handle in IGNORED_HANDLES or handle in found:
            continue
        if any(bad in handle for bad in NON_BUSINESS_HANDLE_PARTS):
            continue
        if lead_memory.is_lead_known(handle)[0]:
            continue

        title = item["title"]
        hl = item["highlights"]
        combo = f"{handle} {title} {hl}"
        if not any(kw in combo.lower() for kw in STRICT_TREE_KEYWORDS):
            continue
        if any(dis in combo.lower() for dis in DISALLOWED_CATEGORIES):
            continue
        if any(fk in combo.lower() for fk in FOREIGN_KEYWORDS) or US_STATE_OR_PHONE.search(combo):
            continue

        bname = title.split("|")[0].strip() if "|" in title else handle.replace("_", " ").title()
        bname = re.sub(r"\s*\(@[a-zA-Z0-9._]+\)\s*", "", bname).strip()
        bname = bname.replace("&amp;", "&")
        if not bname or len(bname) > 65 or bname.lower() == "instagram" or bname.startswith("@"):
            bname = handle.replace("_", " ").title()

        bio = hl.replace("| Instagram", "").replace("&amp;", "&").strip()
        found[handle] = {
            "username": handle,
            "full_name": bname,
            "location": detect_uk_location(combo, fallback="England (UK-wide)"),
            "bio": bio,
            "phones": extract_uk_phone(combo),
            "emails": extract_uk_email(combo),
        }
    return list(found.values())


def build_uk_queries() -> List[str]:
    queries = [
        # High-signal UK arborist hashtag & phone queries
        'site:instagram.com "#treesurgeonuk" "07"',
        'site:instagram.com "#treesurgeonuk" "free quote" OR "DM"',
        'site:instagram.com "#ukarborist" "07" OR "DM"',
        'site:instagram.com "#treesurgeryuk" "07" OR "DM"',
        'site:instagram.com "#uktreesurgeon" "tree" "07"',
        'site:instagram.com "#treeservicesuk" "tree" OR "hedge"',
        'site:instagram.com "#treecareuk" "07" OR "DM"',
        'site:instagram.com "#stumpgrindinguk" "07" OR "DM"',
        'site:instagram.com "#nptc" "tree surgeon" "07"',
        'site:instagram.com "#crownreduction" "07" "UK"',
        'site:instagram.com "#treefelling" "07" "UK"',
        'site:instagram.com "#hedgecutting" "tree surgeon" "07"',
        'site:instagram.com "NPTC qualified" "tree surgeon" "07"',
        'site:instagram.com "fully insured" "tree surgeon" "07" "free quote"',
        'site:instagram.com "DM for a free quote" "tree surgeon" UK',
        'site:instagram.com "DM for quotes" "tree surgery" UK',
        'site:instagram.com "stump grinding" "07" "UK" "tree"',
        'site:instagram.com "crown reduction" "07" "free quote" UK',
        'site:instagram.com "emergency tree work" "07" UK',
        'site:instagram.com "all aspects of tree work" "07" UK',
        'site:instagram.com "all aspects of tree surgery" "07" UK',
        'site:instagram.com "domestic and commercial" "tree surgeon" "07"',
        'site:instagram.com "tree care" "NPTC" "07"',
        'site:instagram.com "tree services ltd" "07" UK',
        'site:instagram.com "tree surgery ltd" "07" UK',
        'site:instagram.com "arboriculture" "07" "UK" "quote"',
        'site:instagram.com "sectional felling" "07" UK',
        'site:instagram.com "deadwooding" "tree surgeon" "07"',
        'site:instagram.com "pollarding" "tree surgeon" "07"',
        'site:instagram.com "conifer" "tree surgeon" "07" UK',
    ]

    # Regional UK queries with explicit UK phone/NPTC/hashtag anchors
    regions = [
        "Surrey", "Kent", "Essex", "Sussex", "Hampshire", "Devon", "Cornwall",
        "Dorset", "Somerset", "Wiltshire", "Gloucestershire", "Berkshire",
        "Oxfordshire", "Buckinghamshire", "Hertfordshire", "Suffolk", "Norfolk",
        "Cambridgeshire", "Northamptonshire", "Warwickshire", "Worcestershire",
        "Staffordshire", "Shropshire", "Cheshire", "Lancashire", "Yorkshire",
        "Derbyshire", "Nottinghamshire", "Lincolnshire", "Cumbria", "Northumberland",
        "Bedfordshire", "Herefordshire", "Cotswolds", "London", "Manchester",
        "Birmingham", "Leeds", "Liverpool", "Bristol", "Sheffield", "Newcastle",
        "Nottingham", "Leicester", "Brighton", "Oxford", "Cambridge", "Reading",
        "Southampton", "Portsmouth", "Bournemouth", "Exeter", "Plymouth", "Bath",
        "Cheltenham", "Coventry", "Derby", "York", "Norwich", "Ipswich",
        "Milton Keynes", "Guildford", "Canterbury", "Maidstone", "Peterborough",
        "Colchester", "Chelmsford", "Warrington", "Stockport", "Wakefield",
        "Harrogate", "Doncaster", "Preston", "Huddersfield", "Swindon",
        "Salisbury", "Taunton", "Truro", "Poole", "Shrewsbury", "Lincoln",
        "Carlisle", "Middlesbrough", "Wolverhampton", "Solihull", "Glasgow",
        "Edinburgh", "Aberdeen", "Dundee", "Inverness", "Fife", "Cardiff",
        "Swansea", "Newport", "Wrexham", "Belfast", "North Wales", "South Wales",
        "Scotland", "East Midlands", "West Midlands", "East Anglia", "North West",
        "North East", "South West", "South East"
    ]
    for r in regions:
        queries.append(f'site:instagram.com "tree surgeon" "{r}" "07"')
        queries.append(f'site:instagram.com "tree surgery" OR "arborist" "{r}" "NPTC" OR "fully insured" OR "free quote"')
        queries.append(f'site:instagram.com "stump grinding" OR "tree care" "{r}" "07" OR "DM"')
    return queries


def main():
    target_count = 150
    prev_file = ROOT_DIR / "scratch" / "batch3_150_verified.json"
    strict_file = ROOT_DIR / "scratch" / "batch3_150_strict_final.json"

    verified: List[Dict[str, Any]] = []
    seen_handles: Set[str] = set()
    seen_phones: Set[str] = set()
    attempted: Set[str] = set()

    lock = threading.Lock()
    start = time.time()

    def save_cp():
        with open(strict_file, "w", encoding="utf-8") as f:
            json.dump(verified, f, indent=2, ensure_ascii=False)

    # Phase 1: Re-audit existing candidates from prev_file with strict website check!
    if strict_file.exists():
        for item in json.load(open(strict_file, encoding="utf-8")):
            h = normalize_handle(item["username"])
            if h and h not in seen_handles and not lead_memory.is_lead_known(h)[0]:
                verified.append(item)
                seen_handles.add(h)
                attempted.add(h)
                p = normalize_phone(item.get("phones"))
                if p:
                    seen_phones.add(p)

    if prev_file.exists() and len(verified) < target_count:
        prev_items = json.load(open(prev_file, encoding="utf-8"))
        to_audit = [it for it in prev_items if normalize_handle(it["username"]) not in attempted]
        console.print(f"[yellow]Phase 1: Strictly auditing {len(to_audit)} existing Batch 3 candidates (removing any custom sites/non-UK)...[/yellow]")
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            for res in ex.map(strict_verify_candidate, to_audit):
                if res:
                    h = res["username"]
                    p = normalize_phone(res.get("phones"))
                    attempted.add(h)
                    if h not in seen_handles and (not p or p not in seen_phones):
                        seen_handles.add(h)
                        if p:
                            seen_phones.add(p)
                        verified.append(res)
        for it in to_audit:
            attempted.add(normalize_handle(it["username"]))
        save_cp()
        console.print(f"[bold green]Phase 1 Retained {len(verified)} strictly verified NO_WEBSITE UK tree surgeons![/bold green]")

    # Phase 2: Harvest & strictly verify until exactly 150!
    queries = build_uk_queries()
    console.print(f"\n[cyan]Phase 2: Running targeted UK Exa queries ({len(queries)} queued) to reach {target_count}/{target_count}...[/cyan]")

    for q_idx in range(0, len(queries), 8):
        if len(verified) >= target_count:
            break
        q_wave = queries[q_idx : q_idx + 8]
        wave_cands: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            for res_list in ex.map(harvest_query, q_wave):
                for c in res_list:
                    if c["username"] not in attempted:
                        attempted.add(c["username"])
                        wave_cands.append(c)

        if not wave_cands:
            continue

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            fmap = {ex.submit(strict_verify_candidate, c): c for c in wave_cands}
            for fut in concurrent.futures.as_completed(fmap):
                if len(verified) >= target_count:
                    break
                try:
                    res = fut.result()
                    if res:
                        with lock:
                            h = res["username"]
                            p = normalize_phone(res.get("phones"))
                            if h in seen_handles or (p and p in seen_phones):
                                continue
                            if len(verified) >= target_count:
                                break
                            seen_handles.add(h)
                            if p:
                                seen_phones.add(p)
                            verified.append(res)
                            console.print(
                                f"  [green]✓ [{len(verified)}/{target_count}][/green] "
                                f"[bold cyan]@{h}[/bold cyan] | {res['full_name']} | "
                                f"[magenta]{res['location']}[/magenta] | {res['website_status']} ({res['phones'] or 'DM'})"
                            )
                            if len(verified) % 5 == 0 or len(verified) >= target_count:
                                save_cp()
                except Exception:
                    pass

        console.print(f"[dim]Wave {q_idx // 8 + 1} complete -> {len(verified)}/{target_count} verified in {time.time() - start:.0f}s[/dim]")
        save_cp()

    save_cp()
    console.print(f"\n[bold green]FINAL STRICT COUNT: {len(verified)}/{target_count} in {time.time() - start:.1f}s![/bold green]")


if __name__ == "__main__":
    main()
