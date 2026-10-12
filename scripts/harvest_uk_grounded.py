#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UK-Grounded Tree Surgeons Harvester
===================================
Queries Yahoo Search with strict UK grounding ("UK" / "England") across all 60 cities and 8 search terms.
"""

import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import concurrent.futures
import time
import re
import urllib.parse
from pathlib import Path
from typing import Set, Tuple
from bs4 import BeautifulSoup
from curl_cffi import requests

CITIES = [
    # Top Cities from User Prompt
    "London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol",
    "Glasgow", "Edinburgh", "Newcastle upon Tyne", "Nottingham", "Sheffield", "Leicester",
    "Cardiff", "Belfast", "Brighton and Hove", "Oxford", "Cambridge", "Reading",
    "Southampton", "Portsmouth", "Bournemouth", "Exeter", "Plymouth", "Bath",
    "Cheltenham", "Coventry", "Derby", "York", "Bradford", "Hull", "Sunderland", "Aberdeen",
    "Dundee", "Inverness", "Swansea", "Newport", "Chester", "Preston", "Norwich", "Ipswich",
    "Milton Keynes", "Luton", "Watford", "Guildford", "Canterbury", "Maidstone",
    "Peterborough", "Northampton", "Worcester", "Durham", "Colchester", "Chelmsford",
    "Warrington", "Bolton", "Stockport", "Salford", "Wakefield", "Harrogate", "Doncaster",
    "Eastbourne", "Worthing", "Torquay", "Lisburn", "Derry",
    # English Counties
    "Surrey", "Kent", "Essex", "Sussex", "Hampshire", "Devon", "Cheshire",
    "Lancashire", "Yorkshire", "Hertfordshire", "Berkshire", "Dorset", "Somerset",
    "Wiltshire", "Gloucestershire", "Warwickshire", "Staffordshire", "Shropshire"
]

TERMS = [
    "tree surgeon",
    "arborist",
    "tree surgery",
    "stump grinding",
    "tree removal",
    "crown reduction",
    "hedge cutting",
    "emergency tree work"
]

IGNORED = {
    'explore', 'reels', 'about', 'directory', 'legal', 'p', 'reel', 'stories',
    'terms', 'privacy', 'help', 'press', 'accounts', 'developer', 'tags',
    'locations', 'meta', 'instagram', 'blog', 'support', 'business'
}

def harvest_uk_query(params: Tuple[str, str]) -> Set[str]:
    term, location = params
    q = f'site:instagram.com "{term}" "{location}" UK'
    url = f"https://search.yahoo.com/search?p={urllib.parse.quote_plus(q)}"
    handles = set()
    try:
        r = requests.get(url, impersonate="chrome120", timeout=7)
        if r.status_code != 200:
            return set()
        soup = BeautifulSoup(r.text, "html.parser")
        
        post_urls = []
        for a in soup.select("div.compTitle a, h3 a, a.fz-20"):
            href = a.get("href", "")
            target = ""
            if "RU=" in href:
                target = urllib.parse.unquote(href.split("RU=")[1].split("/RK=")[0])
            elif "instagram.com" in href:
                target = href
                
            if "instagram.com" in target:
                m_prof = re.search(r'instagram\.com/([a-zA-Z0-9._]{3,30})/?(?:\?|$)', target)
                m_post = re.search(r'instagram\.com/(?:p|reel)/([a-zA-Z0-9_-]+)', target)
                if m_post:
                    post_urls.append(target)
                elif m_prof:
                    u = m_prof.group(1).lower()
                    if u not in IGNORED and not any(x in u for x in ["va", "usa", "texas", "florida", "ohio"]):
                        handles.add(u)
                        
        for purl in post_urls[:2]:
            try:
                pr = requests.get(purl, impersonate="chrome120", timeout=4)
                og_desc = re.search(r'<meta property="og:description" content="([^"]+)"', pr.text)
                if og_desc:
                    txt = og_desc.group(1)
                    m_author = re.search(r'-\s*([a-zA-Z0-9._]{3,30})\s+on\b', txt)
                    if m_author:
                        author = m_author.group(1).lower()
                        if author not in IGNORED:
                            handles.add(author)
            except Exception:
                pass
                
        return handles
    except Exception:
        return set()

def main():
    output_file = Path("scratch/harvested_uk_verified.txt")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    existing = set()
    if output_file.exists():
        with open(output_file, "r", encoding="utf-8") as f:
            for line in f:
                l = line.strip().lower()
                if l:
                    existing.add(l)
                    
    print(f"Loaded {len(existing)} existing UK handles.", flush=True)
    all_handles = set(existing)
    
    tasks = []
    for term in TERMS:
        for loc in CITIES:
            tasks.append((term, loc))
            
    print(f"Executing {len(tasks)} UK-grounded queries with 10 concurrent workers...", flush=True)
    start_time = time.time()
    completed = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_task = {executor.submit(harvest_uk_query, t): t for t in tasks}
        
        for future in concurrent.futures.as_completed(future_to_task):
            completed += 1
            term, loc = future_to_task[future]
            try:
                found = future.result()
                new_h = found - all_handles
                if new_h:
                    all_handles.update(new_h)
                    with open(output_file, "a", encoding="utf-8") as f:
                        for h in new_h:
                            f.write(h + "\n")
            except Exception:
                pass
                
            if completed % 25 == 0 or completed == len(tasks):
                elapsed = int(time.time() - start_time)
                print(f"[{completed}/{len(tasks)}] Done in {elapsed}s | Total unique UK handles: {len(all_handles)}", flush=True)

    print(f"\nFinal: Harvested {len(all_handles)} unique UK candidate handles in {int(time.time() - start_time)}s.")

if __name__ == "__main__":
    main()
