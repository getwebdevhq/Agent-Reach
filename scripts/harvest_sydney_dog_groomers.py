#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sydney Dog Grooming Leads Harvester
===================================
Harvesters candidate Instagram profiles for dog groomers in Sydney, NSW, Australia.
Queries Yahoo Search across 40+ Sydney suburbs/regions and 8 service terms.
"""

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
    "Sydney", "Sydney NSW", "Inner West Sydney", "Eastern Suburbs Sydney",
    "Northern Beaches Sydney", "North Shore Sydney", "Sutherland Shire",
    "Western Sydney", "Hills District Sydney", "Bondi", "Manly", "Cronulla",
    "Parramatta", "Newtown", "Surry Hills", "Marrickville", "Coogee", "Mosman",
    "Chatswood", "Ryde", "Castle Hill", "Penrith", "Blacktown", "Liverpool NSW",
    "Leichhardt", "Balmain", "Paddington Sydney", "Randwick", "Dee Why",
    "Mona Vale", "Brookvale", "Miranda NSW", "Hurstville", "Kogarah", "Caringbah",
    "Strathfield", "Burwood NSW", "Campbelltown NSW", "Camden NSW", "Baulkham Hills",
    "Kellyville", "Rouse Hill", "Lane Cove", "Crows Nest Sydney", "Alexandria Sydney",
    "Rose Bay", "Double Bay", "Avalon Sydney", "Balgowlah", "Engadine"
]

TERMS = [
    "dog groomer",
    "dog grooming",
    "mobile dog groomer",
    "mobile dog grooming",
    "dog salon",
    "pet grooming",
    "dog wash",
    "dog stylist"
]

IGNORED = {
    'p', 'reel', 'reels', 'explore', 'stories', 'about', 'popular', 'tags',
    'locations', 'directory', 'legal', 'privacy', 'help', 'accounts',
    'developer', 'meta', 'instagram', 'blog', 'support', 'business'
}

def search_query(suburb: str, term: str, page: int = 1):
    q = f'site:instagram.com "{term}" "{suburb}"'
    url = f"https://search.yahoo.com/search?p={urllib.parse.quote_plus(q)}&b={page}"
    results = []
    try:
        r = requests.get(url, headers=headers, impersonate="chrome120", timeout=8)
        if r.status_code != 200:
            return results
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
    tasks = []
    for s in SUBURBS:
        for t in TERMS[:4]:  # Top terms first
            tasks.append((s, t, 1))
            tasks.append((s, t, 11))
    
    print(f"Total tasks to execute: {len(tasks)}")
    all_candidates = {}
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        future_to_task = {executor.submit(search_query, s, t, p): (s, t, p) for s, t, p in tasks}
        completed = 0
        for future in concurrent.futures.as_completed(future_to_task):
            completed += 1
            if completed % 50 == 0:
                print(f"Progress: {completed}/{len(tasks)} queries done. Unique handles found: {len(all_candidates)}")
            res = future.result()
            for r in res:
                u = r["username"]
                if u not in all_candidates:
                    all_candidates[u] = r
                else:
                    # Append desc if new info
                    if len(r["desc"]) > len(all_candidates[u]["desc"]):
                        all_candidates[u]["desc"] = r["desc"]
                    if len(r["title"]) > len(all_candidates[u]["title"]):
                        all_candidates[u]["title"] = r["title"]
    
    print(f"\nFinal unique candidates: {len(all_candidates)}")
    out_file = Path("scratch/harvested_sydney_dog_groomers.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_candidates, f, indent=2, ensure_ascii=False)
    print(f"Saved candidates to {out_file}")

if __name__ == "__main__":
    main()

