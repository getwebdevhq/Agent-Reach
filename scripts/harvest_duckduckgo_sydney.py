import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
import concurrent.futures
import json
import re
import time
import urllib.parse
from pathlib import Path
from bs4 import BeautifulSoup
from curl_cffi import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
}

SUBURBS = [
    "Sydney", "Bondi", "Manly", "Cronulla", "Parramatta", "Newtown",
    "Surry Hills", "Marrickville", "Coogee", "Mosman", "Chatswood",
    "Ryde", "Castle Hill", "Penrith", "Blacktown", "Liverpool",
    "Northern Beaches", "Inner West", "Eastern Suburbs", "North Shore",
    "Sutherland Shire", "Hills District", "Leichhardt", "Paddington",
    "Dee Why", "Miranda", "Hurstville", "Strathfield", "Double Bay"
]

TERMS = [
    "dog grooming", "dog groomer", "mobile dog grooming", "dog salon", "pet grooming"
]

IGNORED = {
    'p', 'reel', 'reels', 'explore', 'stories', 'about', 'popular', 'tags',
    'locations', 'directory', 'legal', 'privacy', 'help', 'accounts',
    'developer', 'meta', 'instagram', 'blog', 'support', 'business'
}

def ddg_search(suburb: str, term: str):
    q = f'site:instagram.com "{term}" "{suburb}" NSW Australia'
    results = []
    try:
        r = requests.post("https://html.duckduckgo.com/html/", data={'q': q}, headers=headers, impersonate="chrome120", timeout=8)
        if r.status_code != 200:
            return results
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.select("a.result__url, a.result__snippet, a.result__a"):
            href = a.get("href", "")
            m_u = re.search(r'uddg=([^&]+)', href)
            target = urllib.parse.unquote(m_u.group(1)) if m_u else href
            
            m = re.search(r'instagram\.com/([a-zA-Z0-9._]{3,30})/?(?:\?|$)', target)
            if not m:
                continue
            username = m.group(1).lower()
            if username in IGNORED:
                continue
            
            # Find parent result block
            parent = a.find_parent("div", class_="result")
            title = ""
            desc = ""
            if parent:
                t_el = parent.select_one("a.result__a")
                s_el = parent.select_one("a.result__snippet")
                if t_el:
                    title = t_el.get_text(strip=True)
                if s_el:
                    desc = s_el.get_text(strip=True)
            
            results.append({
                "username": username,
                "title": title,
                "desc": desc,
                "target": target,
                "suburb": suburb,
                "term": term
            })
    except Exception:
        pass
    return results

def main():
    queries = [(s, t) for s in SUBURBS for t in TERMS[:3]]
    print(f"Total DDG queries: {len(queries)}")
    candidates = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        f_map = {executor.submit(ddg_search, s, t): (s, t) for s, t in queries}
        completed = 0
        for f in concurrent.futures.as_completed(f_map):
            completed += 1
            if completed % 20 == 0:
                print(f"DDG progress: {completed}/{len(queries)} done. Unique handles: {len(candidates)}")
            for r in f.result():
                u = r["username"]
                if u not in candidates:
                    candidates[u] = r
                else:
                    if len(r["desc"]) > len(candidates[u]["desc"]):
                        candidates[u]["desc"] = r["desc"]
                    if len(r["title"]) > len(candidates[u]["title"]):
                        candidates[u]["title"] = r["title"]
    
    out_file = Path("scratch/harvested_ddg_sydney.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(candidates, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(candidates)} DDG candidates to {out_file}")

if __name__ == "__main__":
    main()

