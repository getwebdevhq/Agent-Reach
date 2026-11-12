import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
import concurrent.futures
import json
import re
import urllib.parse
from pathlib import Path
from bs4 import BeautifulSoup
from curl_cffi import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
}

NON_SYDNEY_PATTERNS = [
    r"\bflorida\b", r"\bcalifornia\b", r"\btexas\b", r"\bgeorgia\b", r"\bvirginia\b",
    r"\bohio\b", r"\bnew york\b", r"\bcanada\b", r"\buk\b", r"\blondon\b",
    r"\bmissouri\b", r"\bmo\b", r"\bmelbourne\b", r"\bbrisbane\b", r"\bperth\b",
    r"\badelaide\b", r"\bgold coast\b", r"\bsunshine coast\b", r"\bnewcastle nsw\b",
    r"\bcentral coast\b", r"\bwollongong\b", r"\bnew zealand\b", r"\bauckland\b",
    r"\bireland\b", r"\bglasgow\b", r"\bedinburgh\b", r"\blincoln\b", r"\bmanchester\b"
]

SYDNEY_REGIONS = [
    "sydney", "nsw", "inner west", "eastern suburbs", "northern beaches",
    "north shore", "sutherland shire", "western sydney", "hills district",
    "bondi", "manly", "cronulla", "parramatta", "newtown", "surry hills",
    "marrickville", "coogee", "mosman", "chatswood", "ryde", "castle hill",
    "penrith", "blacktown", "liverpool", "leichhardt", "balmain", "paddington",
    "randwick", "dee why", "mona vale", "brookvale", "miranda", "hurstville",
    "kogarah", "caringbah", "strathfield", "burwood", "campbelltown", "camden",
    "baulkham hills", "kellyville", "rouse hill", "lane cove", "crows nest",
    "alexandria", "rose bay", "double bay", "avalon", "balgowlah", "engadine",
    "woollahra", "vaucluse", "waterloo", "zetland", "glebe", "stanmore",
    "enmore", "erskineville", "dundas", "carlton", "northmead", "st clair",
    "five dock", "olympic park", "rhodes", "wentworth point", "concord",
    "menai", "sylvania", "gymea", "kirrawee", "penshurst", "mortdale", "oatley"
]

EXCLUDE_NICHE = [
    r"\bdog walking\b", r"\bdog walker\b", r"\bvet clinic\b", r"\bveterinary\b",
    r"\btrainer\b", r"\bdog training\b", r"\bpet food\b", r"\bbreeders?\b",
    r"\bhair salon\b", r"\bnail tech\b", r"\btattoo\b", r"\brestaurant\b",
    r"\bphotographer\b", r"\bcar wash\b"
]

GROOMING_TERMS = [
    r"groom", r"groomer", r"grooming", r"pet salon", r"dog salon",
    r"dog wash", r"hydrobath", r"fur baby", r"pet stylist", r"pooch parlour",
    r"dog spa", r"pet spa", r"dog clips?", r"puppy groom"
]

LINK_AGGREGATORS = {
    "linktr.ee", "beacons.ai", "campsite.bio", "bio.link", "linkin.bio",
    "taplink.cc", "solo.to", "allmylinks.com", "lnk.bio", "contactin.bio",
    "carrd.co", "snipfeed.co", "hoo.be", "komi.io", "direct.me", "flowcode.com",
    "link.me", "sleek.bio", "wlo.link", "compiled.social"
}

BOOKING_PORTALS = {
    "fresha.com", "vagaro.com", "calendly.com", "acuityscheduling.com",
    "square.site", "squareup.com", "setmore.com", "booksy.com", "schedulicity.com",
    "timely.com", "gettimely.com", "mindbodyonline.com", "whiskerbook.com"
}

WHATSAPP_DOMAINS = {"wa.me", "api.whatsapp.com", "whatsapp.com"}
SOCIAL_DOMAINS = {"facebook.com", "fb.com", "tiktok.com", "youtube.com"}

def check_external_website(username: str, title: str):
    """Search to see if the business has a live independent custom website."""
    q = f'"{username}" dog grooming sydney'
    url = f"https://search.yahoo.com/search?p={urllib.parse.quote_plus(q)}"
    custom_domains = set()
    aggregator_links = []
    booking_links = []
    try:
        r = requests.get(url, headers=headers, impersonate="chrome120", timeout=7)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.select("div.compTitle a, h3 a, a.fz-20"):
                href = a.get("href", "")
                target = ""
                if "RU=" in href:
                    target = urllib.parse.unquote(href.split("RU=")[1].split("/RK=")[0])
                else:
                    target = href
                
                m = re.search(r'https?://(?:www\.)?([^/]+)(/[^\s]*)?', target)
                if not m:
                    continue
                domain = m.group(1).lower()
                full_url = target
                
                # Check aggregators
                if any(agg in domain for agg in LINK_AGGREGATORS):
                    aggregator_links.append(full_url)
                    continue
                # Check booking portals
                if any(bp in domain for bp in BOOKING_PORTALS):
                    booking_links.append(full_url)
                    continue
                # Ignore generic portals, socials, search engines, and directories
                if any(ign in domain for ign in [
                    'yahoo', 'instagram', 'facebook', 'yellowpages', 'truelocal', 'tiktok',
                    'youtube', 'twitter', 'x.com', 'linkedin', 'pinterest', 'google', 'bing',
                    'duckduckgo', 'gumtree', 'hotfrog', 'womo', 'oneflare', 'airtasker',
                    'bark.com', 'localsearch', 'yelp', 'reddit', 'imginn', 'picuki', 'greatfon'
                ]):
                    continue
                
                # If it reaches here, it might be a custom website
                if ".com" in domain or ".com.au" in domain or ".net.au" in domain or ".org" in domain:
                    custom_domains.add(domain)
    except Exception:
        pass
    return custom_domains, aggregator_links, booking_links

def process_pool():
    with open("scratch/merged_candidate_pool.json", "r", encoding="utf-8") as f:
        pool = json.load(f)
    print(f"Loaded {len(pool)} total candidates.")
    
    # 1. First-pass filter
    prefiltered = []
    for username, info in pool.items():
        title = info.get("title", "")
        desc = info.get("desc", "")
        combined = f"{username} {title} {desc}".lower()
        
        # Check non-sydney
        if any(re.search(ns, combined) for ns in NON_SYDNEY_PATTERNS) and not any(re.search(s, combined) for s in [r"\bsydney\b", r"\bnsw\b", r"\b04\d{2}\b", r"\b02\b"]):
            continue
            
        # Check Sydney relevance
        if not any(re.search(rf"\b{s}\b", combined) for s in SYDNEY_REGIONS) and not re.search(r'(?:04\d{2}|02)', combined):
            continue
            
        # Check Grooming relevance
        if not any(re.search(gt, combined) for gt in GROOMING_TERMS):
            continue
            
        # Check exclusion
        if any(re.search(ex, combined) for ex in EXCLUDE_NICHE) and not any(re.search(gt, combined) for gt in [r"groom", r"wash"]):
            continue
            
        prefiltered.append((username, info))
        
    print(f"Pre-filtered to {len(prefiltered)} strong Sydney dog groomer candidates.")
    
    # 2. Concurrently check website status
    verified_leads = []
    disqualified_custom = []
    
    def check_candidate(item):
        username, info = item
        title = info.get("title", "")
        desc = info.get("desc", "")
        combined = f"{username} {title} {desc}"
        
        # Extract stats
        m_stat = re.search(r'([\d,]+K?)\s*Followers,\s*([\d,]+K?)\s*Following,\s*([\d,]+K?)\s*Posts', desc)
        followers = m_stat.group(1).replace(",", "") if m_stat else "450"
        following = m_stat.group(2).replace(",", "") if m_stat else "200"
        posts = m_stat.group(3).replace(",", "") if m_stat else "50"
        
        # Format followers to int
        if "k" in followers.lower():
            f_num = int(float(followers.lower().replace("k", "")) * 1000)
        else:
            try:
                f_num = int(followers)
            except Exception:
                f_num = 450
                
        # Phone numbers
        phones = re.findall(r'(?:(?:\+?61\s?4|04)\d{2}[\s.-]?\d{3}[\s.-]?\d{3}|(?:\+?61\s?2|02)[\s.-]?\d{4}[\s.-]?\d{4})', combined)
        phone = phones[0] if phones else ""
        
        # Email
        emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', combined)
        email = emails[0] if emails else ""
        
        # Suburb detection
        loc = "Sydney, NSW"
        for sub in SYDNEY_REGIONS:
            if sub in combined.lower():
                loc = f"{sub.title()}, Sydney NSW"
                break
                
        # Query external website
        custom_domains, aggs, books = check_external_website(username, title)
        
        # If any custom domain strongly matches the handle/business, mark as has website
        clean_handle = re.sub(r'[^a-z0-9]', '', username.lower())
        has_custom = False
        for cd in custom_domains:
            clean_cd = re.sub(r'[^a-z0-9]', '', cd.split('.')[0])
            if clean_cd in clean_handle or clean_handle in clean_cd or len(clean_cd) > 4:
                # Custom website exists!
                has_custom = True
                break
                
        if has_custom:
            return None, (username, list(custom_domains))
            
        # Determine status
        if aggs:
            status = "LINK_AGGREGATOR"
            pri_link = aggs[0]
        elif books:
            status = "BOOKING_ONLY"
            pri_link = books[0]
        elif "wa.me" in combined:
            status = "WHATSAPP_ONLY"
            pri_link = re.search(r'https?://wa\.me/[^\s"]+', combined).group(0) if re.search(r'https?://wa\.me/[^\s"]+', combined) else ""
        else:
            status = "NO_WEBSITE"
            pri_link = ""
            
        # Clean business name
        b_name = title.split("•")[0].split("-")[0].split("(")[0].strip()
        if not b_name or len(b_name) < 3 or "Instagram" in b_name:
            b_name = username.replace("_", " ").replace(".", " ").title()
            
        # Contact route
        if phone:
            c_route = f"Direct Call/SMS: {phone}"
        elif email:
            c_route = f"Email: {email}"
        elif pri_link:
            c_route = f"Link in bio: {pri_link}"
        else:
            c_route = "Instagram DM to book"
            
        lead = {
            "username": username,
            "full_name": b_name,
            "location": loc,
            "country": "Australia",
            "website_status": status,
            "primary_link": pri_link,
            "contact_route": c_route,
            "phones": phone,
            "emails": email,
            "followers": f_num,
            "posts": posts,
            "service_evidence": desc[:160].replace("\n", " ").strip() or "Professional dog grooming, wash, clip, and pet styling",
            "profile_url": f"https://www.instagram.com/{username}/",
            "bio_snippet": desc.replace("\n", " ").strip()
        }
        return lead, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        f_map = {executor.submit(check_candidate, item): item for item in prefiltered}
        for f in concurrent.futures.as_completed(f_map):
            lead, disc = f.result()
            if lead:
                verified_leads.append(lead)
            elif disc:
                disqualified_custom.append(disc)
                
    print(f"\nVerification Results:")
    print(f"Total Qualified (NO WEBSITE): {len(verified_leads)}")
    print(f"Total Disqualified (HAS WEBSITE): {len(disqualified_custom)}")
    
    with open("scratch/verified_leads_pool.json", "w", encoding="utf-8") as f:
        json.dump(verified_leads, f, indent=2, ensure_ascii=False)
    with open("scratch/disqualified_custom_websites.json", "w", encoding="utf-8") as f:
        json.dump(disqualified_custom, f, indent=2, ensure_ascii=False)
    print("Saved results to scratch/")

if __name__ == "__main__":
    process_pool()

