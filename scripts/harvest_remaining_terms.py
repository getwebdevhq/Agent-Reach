#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Harvest Remaining Search Terms across UK Cities
================================================
Harvests candidate Instagram handles for:
- tree surgery
- stump grinding
- tree removal
- crown reduction
- hedge cutting
- emergency tree work
across all 70+ UK cities and counties.
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
    "Surrey", "Kent", "Essex", "Sussex", "Hampshire", "Devon", "Cheshire",
    "Lancashire", "Yorkshire", "Hertfordshire", "Berkshire", "Dorset", "Somerset",
    "Wiltshire", "Gloucestershire", "Warwickshire", "Staffordshire", "Shropshire"
]

REMAINING_TERMS = [
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

def harvest_query(params: Tuple[str, str]) -> Set[str]:
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
                    
    print(f"Starting with {len(existing)} existing handles.", flush=True)
    all_handles = set(existing)
    
    tasks = []
    for term in REMAINING_TERMS:
        for loc in CITIES:
            tasks.append((term, loc))
            
    print(f"Executing {len(tasks)} queries with 12 concurrent workers...", flush=True)
    start_time = time.time()
    completed = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        future_to_task = {executor.submit(harvest_query, t): t for t in tasks}
        
        for future in concurrent.futures.as_completed(future_to_task):
            completed += 1
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
                print(f"[{completed}/{len(tasks)}] in {elapsed}s | Total unique handles: {len(all_handles)}", flush=True)

    print(f"\nFinal: Collected {len(all_handles)} total handles in {int(time.time() - start_time)}s.")

if __name__ == "__main__":
    main()
