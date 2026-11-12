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

QUERIES = [
    # Mobile groomers
    'site:instagram.com "mobile dog wash" "Sydney"',
    'site:instagram.com "mobile dog groomer" "Sydney"',
    'site:instagram.com "mobile dog grooming" "Sydney"',
    'site:instagram.com "mobile pet grooming" "Sydney"',
    'site:instagram.com "mobile grooming" "Sydney" "04"',
    'site:instagram.com "dog wash" "Sydney" "04"',
    'site:instagram.com "dog groomer" "Sydney" "04"',
    'site:instagram.com "dog grooming" "Sydney" "04"',
    'site:instagram.com "dog groomer" "Inner West" "04"',
    'site:instagram.com "dog groomer" "Northern Beaches" "04"',
    'site:instagram.com "dog groomer" "Eastern Suburbs" "04"',
    'site:instagram.com "dog groomer" "North Shore" "04"',
    'site:instagram.com "dog groomer" "Sutherland Shire" "04"',
    'site:instagram.com "dog groomer" "Hills District" "04"',
    'site:instagram.com "dog groomer" "Western Sydney" "04"',
    'site:instagram.com "dog salon" "Sydney" "04"',
    'site:instagram.com "pet stylist" "Sydney"',
    'site:instagram.com "dog styling" "Sydney"',
    'site:instagram.com "dog grooming" "DM to book" "Sydney"',
    'site:instagram.com "dog groomer" "DM to book" "Sydney"',
    'site:instagram.com "dog groomer" "text only" "Sydney"',
    'site:instagram.com "dog grooming" "link in bio" "Sydney"',
    'site:instagram.com "dog groomer" "link in bio" "Sydney"',
    'site:instagram.com "dog groomer" "linktr.ee" "Sydney"',
    'site:instagram.com "dog grooming" "linktr.ee" "Sydney"',
    'site:instagram.com "dog grooming" "Bondi"',
    'site:instagram.com "dog grooming" "Manly"',
    'site:instagram.com "dog grooming" "Cronulla"',
    'site:instagram.com "dog grooming" "Parramatta"',
    'site:instagram.com "dog grooming" "Penrith"',
    'site:instagram.com "dog grooming" "Campbelltown"',
    'site:instagram.com "dog grooming" "Castle Hill"',
    'site:instagram.com "dog grooming" "Ryde"',
    'site:instagram.com "dog grooming" "Chatswood"',
    'site:instagram.com "dog grooming" "Mosman"',
    'site:instagram.com "dog grooming" "Marrickville"',
    'site:instagram.com "dog grooming" "Surry Hills"',
    'site:instagram.com "dog grooming" "Newtown"',
    'site:instagram.com "dog grooming" "Balmain"',
    'site:instagram.com "dog grooming" "Leichhardt"',
    'site:instagram.com "dog grooming" "Caringbah"',
    'site:instagram.com "dog grooming" "Miranda"',
    'site:instagram.com "dog grooming" "Dee Why"',
    'site:instagram.com "dog grooming" "Mona Vale"',
    'site:instagram.com "dog grooming" "Brookvale"',
    'site:instagram.com "dog grooming" "Hurstville"',
    'site:instagram.com "dog grooming" "Strathfield"',
    'site:instagram.com "dog grooming" "Blacktown"',
    'site:instagram.com "dog grooming" "Liverpool NSW"',
]

IGNORED = {
    'p', 'reel', 'reels', 'explore', 'stories', 'about', 'popular', 'tags',
    'locations', 'directory', 'legal', 'privacy', 'help', 'accounts',
    'developer', 'meta', 'instagram', 'blog', 'support', 'business'
}

def fetch_q(q, page):
    url = f"https://search.yahoo.com/search?p={urllib.parse.quote_plus(q)}&b={page}"
    res = []
    try:
        r = requests.get(url, headers=headers, impersonate="chrome120", timeout=8)
        if r.status_code != 200:
            return res
        soup = BeautifulSoup(r.text, "html.parser")
        for div in soup.find_all("div", class_=lambda c: c and "algo" in c.lower()):
            title_el = div.find("h3")
            link_el = div.find("a")
            text_el = div.find("div", class_="compText")
            if not title_el or not link_el:
                continue
            href = link_el.get("href", "")
            target = ""
            if "RU=" in href:
                target = urllib.parse.unquote(href.split("RU=")[1].split("/RK=")[0])
            elif "instagram.com" in href:
                target = href
            
            m = re.search(r'instagram\.com/([a-zA-Z0-9._]{3,30})/?(?:\?|$)', target)
            if not m:
                continue
            username = m.group(1).lower()
            if username in IGNORED:
                continue
            
            title = title_el.get_text(strip=True)
            desc = text_el.get_text(strip=True) if text_el else ""
            res.append({
                "username": username,
                "title": title,
                "desc": desc,
                "target": target,
                "query": q
            })
    except Exception:
        pass
    return res

def main():
    tasks = []
    for q in QUERIES:
        for page in [1, 11, 21]:
            tasks.append((q, page))
            
    print(f"Total queries to run: {len(tasks)}")
    new_candidates = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        f_map = {executor.submit(fetch_q, q, p): (q, p) for q, p in tasks}
        completed = 0
        for f in concurrent.futures.as_completed(f_map):
            completed += 1
            if completed % 25 == 0:
                print(f"Progress: {completed}/{len(tasks)} done. Unique handles: {len(new_candidates)}")
            for item in f.result():
                u = item["username"]
                if u not in new_candidates:
                    new_candidates[u] = item
                else:
                    if len(item["desc"]) > len(new_candidates[u]["desc"]):
                        new_candidates[u]["desc"] = item["desc"]
                    if len(item["title"]) > len(new_candidates[u]["title"]):
                        new_candidates[u]["title"] = item["title"]

    print(f"Done! New harvested unique handles: {len(new_candidates)}")
    with open("scratch/harvested_round2_sydney.json", "w", encoding="utf-8") as f:
        json.dump(new_candidates, f, indent=2, ensure_ascii=False)
    print("Saved to scratch/harvested_round2_sydney.json")

if __name__ == "__main__":
    main()

