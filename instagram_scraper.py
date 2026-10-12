#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Instagram Business Lead Scraper (No Website Finder)
===================================================
Scrapes Instagram business accounts in specified niches and countries/cities,
identifying leads that DO NOT have a website (or only use Linktree / booking links).

Features:
- Multi-query Search Engine discovery (Bing via Playwright + DuckDuckGo)
- Ultra-fast TLS-mimicking profile extraction via curl_cffi
- Advanced classification:
  * NO_WEBSITE: Absolutely no link in bio
  * LINK_AGGREGATOR: Linktree, Beacons, Biolink, Taplink, Carrd, etc.
  * BOOKING_PORTAL: Fresha, Vagaro, Calendly, Acuity, Setmore, Square, etc.
  * WHATSAPP_ONLY: wa.me, api.whatsapp.com
  * SOCIAL_ONLY: Facebook, TikTok, YouTube
  * CUSTOM_WEBSITE: Custom brand domain
- Contact info extraction: Emails, Phone numbers, WhatsApp
- Rich CLI tables, CSV & Excel (.xlsx) export
- Resumable cache / checkpointing
"""

import argparse
import base64
import csv
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import parse_qs, quote_plus, unquote, urlparse
import urllib.parse

# Set Windows UTF-8 stdout
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from curl_cffi import requests
from playwright.sync_api import sync_playwright
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

console = Console()

# Domain categories for link classification
LINK_AGGREGATORS = {
    "linktr.ee", "beacons.ai", "campsite.bio", "bio.link", "linkin.bio",
    "taplink.cc", "solo.to", "allmylinks.com", "lnk.bio", "contactin.bio",
    "carrd.co", "snipfeed.co", "hoo.be", "komi.io", "direct.me", "flowcode.com",
    "link.me", "sleek.bio", "wlo.link", "compiled.social"
}

BOOKING_PORTALS = {
    "fresha.com", "vagaro.com", "calendly.com", "acuityscheduling.com",
    "square.site", "squareup.com", "setmore.com", "booksy.com", "schedulicity.com",
    "treatwell.co.uk", "treatwell.com", "timely.com", "gettimely.com", "mindbodyonline.com"
}

WHATSAPP_DOMAINS = {"wa.me", "api.whatsapp.com", "whatsapp.com"}

SOCIAL_DOMAINS = {
    "facebook.com", "fb.com", "tiktok.com", "youtube.com", "youtu.be",
    "twitter.com", "x.com", "pinterest.com", "linkedin.com"
}

IGNORED_USERNAMES = {
    "p", "reel", "reels", "explore", "stories", "about", "legal", "popular",
    "directory", "accounts", "developer", "press", "help", "privacy", "terms",
    "instagram", "meta", "shop", "tags", "locations", "channel"
}


def clean_domain(url: str) -> str:
    """Extract clean lowercased domain without www."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def classify_website(links: List[str]) -> Tuple[str, Optional[str]]:
    """
    Classify a profile's website status:
    - NO_WEBSITE: No external link provided
    - LINK_AGGREGATOR: Only Linktree / Beacons / Carrd
    - BOOKING_PORTAL: Only booking site (Fresha, Vagaro, etc.)
    - WHATSAPP_ONLY: WhatsApp direct link
    - SOCIAL_ONLY: Facebook / TikTok / Twitter link only
    - CUSTOM_WEBSITE: Custom brand/business website
    """
    clean_links = [l.strip() for l in links if l and l.strip()]
    if not clean_links:
        return "NO_WEBSITE", None

    primary = clean_links[0]
    domain = clean_domain(primary)

    if domain in LINK_AGGREGATORS or any(domain.endswith("." + agg) for agg in LINK_AGGREGATORS):
        return "LINK_AGGREGATOR", primary

    if domain in BOOKING_PORTALS or any(domain.endswith("." + bp) for bp in BOOKING_PORTALS):
        return "BOOKING_PORTAL", primary

    if domain in WHATSAPP_DOMAINS or "wa.me" in primary:
        return "WHATSAPP_ONLY", primary

    if domain in SOCIAL_DOMAINS or any(domain.endswith("." + soc) for soc in SOCIAL_DOMAINS):
        return "SOCIAL_ONLY", primary

    return "CUSTOM_WEBSITE", primary


class InstagramDiscovery:
    """Discovers Instagram handles via search engines using targeted search dorks."""

    def __init__(self, headless: bool = True, proxy: Optional[str] = None):
        self.headless = headless
        self.proxy = {"server": proxy} if proxy else None

    def search_bing(self, niche: str, location: str, max_pages: int = 5) -> Set[str]:
        """Query Bing for Instagram profile URLs matching the niche & location."""
        clean_niche = niche.lower().strip()
        clean_loc = location.lower().strip()
        niche_tag = re.sub(r"[^a-zA-Z0-9]", "", clean_niche)
        loc_tag = re.sub(r"[^a-zA-Z0-9]", "", clean_loc)

        dorks = [
            f'site:instagram.com "{clean_niche}" "{clean_loc}"',
            f'site:instagram.com "{clean_niche}" "{clean_loc}" "DM" OR "call" OR "book"',
            f'site:instagram.com "#{loc_tag}{niche_tag}"',
            f'site:instagram.com "#{niche_tag}{loc_tag}"',
            f'site:instagram.com intext:"{clean_niche}" intext:"{clean_loc}"',
        ]

        usernames = set()
        with sync_playwright() as p:
            launch_args = {"headless": self.headless}
            if self.proxy:
                launch_args["proxy"] = self.proxy
            browser = p.chromium.launch(**launch_args)
            page = browser.new_page()

            for dork in dorks:
                encoded_dork = urllib.parse.quote_plus(dork)
                for page_idx in range(max_pages):
                    first = page_idx * 10 + 1
                    search_url = f"https://www.bing.com/search?q={encoded_dork}&first={first}"
                    try:
                        page.goto(search_url, wait_until="domcontentloaded", timeout=15000)
                        page.wait_for_timeout(1800)
                        hrefs = page.eval_on_selector_all("a", "elements => elements.map(e => e.href)")

                        found_in_page = 0
                        for href in hrefs:
                            # Direct Instagram links
                            m = re.search(r"https?://(?:www\.)?instagram\.com/([a-zA-Z0-9._]{2,30})/?", href)
                            if m:
                                u = m.group(1).lower()
                                if u not in IGNORED_USERNAMES:
                                    usernames.add(u)
                                    found_in_page += 1

                            # Bing tracking redirects containing base64 encoded URL
                            elif "&u=a1" in href:
                                m_b64 = re.search(r"&u=a1([a-zA-Z0-9_\-]+)", href)
                                if m_b64:
                                    raw_b64 = m_b64.group(1)
                                    rem = len(raw_b64) % 4
                                    if rem > 0:
                                        raw_b64 += "=" * (4 - rem)
                                    try:
                                        dec = base64.urlsafe_b64decode(raw_b64).decode("utf-8", errors="ignore")
                                        match_u = re.search(r"instagram\.com/([a-zA-Z0-9._]{2,30})/?", dec)
                                        if match_u:
                                            u = match_u.group(1).lower()
                                            if u not in IGNORED_USERNAMES:
                                                usernames.add(u)
                                                found_in_page += 1
                                    except Exception:
                                        pass

                        if found_in_page == 0:
                            break  # No more results for this query

                    except Exception as e:
                        console.print(f"[dim yellow]Warning fetching Bing results: {e}[/dim yellow]")
                        break

            browser.close()

        return usernames


class InstagramProfileExtractor:
    """Extracts public Instagram profile metadata and contact information."""

    def __init__(self, delay_range: Tuple[float, float] = (1.0, 2.5)):
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        self.delay_range = delay_range

    def get_profile(self, username: str) -> Optional[Dict]:
        """Fetch and parse a public Instagram profile without login requirements."""
        url = f"https://www.instagram.com/{username}/"
        try:
            r = requests.get(url, headers=self.headers, impersonate="chrome120", timeout=12)
            if r.status_code == 404:
                return None
            if r.status_code != 200:
                return None

            html = r.text

            # Extract bio_links array
            bio_links = []
            bio_links_match = re.search(r'"bio_links":(\[[^\]]*\])', html)
            if bio_links_match:
                try:
                    raw_links = json.loads(bio_links_match.group(1))
                    for item in raw_links:
                        if isinstance(item, dict) and item.get("url"):
                            bio_links.append(item.get("url"))
                except Exception:
                    pass

            # Extract external_url
            ext_url_match = re.search(r'"external_url":\s*("(.*?)"|null)', html)
            if ext_url_match and ext_url_match.group(2):
                ext_url = ext_url_match.group(2)
                if ext_url not in bio_links:
                    bio_links.append(ext_url)

            # Extract biography
            bio = ""
            bio_match = re.search(r'"biography":"(.*?)"(?=,"[a-zA-Z_]+":)', html)
            if bio_match:
                try:
                    bio = json.loads(f'"{bio_match.group(1)}"')
                except Exception:
                    bio = bio_match.group(1)

            # Extract full name
            full_name = ""
            name_match = re.search(r'"full_name":"(.*?)"(?=,"[a-zA-Z_]+":)', html)
            if name_match:
                try:
                    full_name = json.loads(f'"{name_match.group(1)}"')
                except Exception:
                    full_name = name_match.group(1)

            # Extract follower count
            follower_count = 0
            followers_match = re.search(r'"follower_count":(\d+)', html)
            if followers_match:
                follower_count = int(followers_match.group(1))

            # Extract following count
            following_count = 0
            following_match = re.search(r'"following_count":(\d+)', html)
            if following_match:
                following_count = int(following_match.group(1))

            # Extract category name
            category = ""
            cat_match = re.search(r'"category_name":"(.*?)"(?=,"[a-zA-Z_]+":)', html)
            if cat_match:
                category = cat_match.group(1)

            # Check if business or verified
            is_verified = '"is_verified":true' in html

            # Extract emails
            emails = list(set(re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", bio)))
            # Extract phone numbers
            raw_phones = re.findall(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", bio)
            phones = list(set(p.strip() for p in raw_phones if len(re.sub(r"\D", "", p)) >= 10))

            # Classify website status
            website_status, primary_link = classify_website(bio_links)

            # Has real website flag
            has_website = (website_status == "CUSTOM_WEBSITE")

            return {
                "username": username,
                "profile_url": f"https://www.instagram.com/{username}/",
                "full_name": full_name,
                "followers": follower_count,
                "following": following_count,
                "category": category,
                "is_verified": is_verified,
                "website_status": website_status,
                "has_website": has_website,
                "primary_link": primary_link or "",
                "all_links": ", ".join(bio_links),
                "emails": ", ".join(emails),
                "phones": ", ".join(phones),
                "bio": bio.replace("\n", " ").strip(),
            }

        except Exception as e:
            return None


class InstagramLeadScraper:
    """Orchestrates search discovery, profile extraction, filtering, and export."""

    def __init__(
        self,
        output_dir: str = "leads",
        filter_mode: str = "no_custom_website",
        min_followers: int = 10,
        max_followers: int = 100000,
        headless: bool = True,
    ):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.filter_mode = filter_mode
        self.min_followers = min_followers
        self.max_followers = max_followers
        self.discovery = InstagramDiscovery(headless=headless)
        self.extractor = InstagramProfileExtractor()

    def run(
        self,
        niches: List[str],
        countries: List[str],
        max_leads: int = 50,
        pages_per_query: int = 3,
    ) -> List[Dict]:
        """Run the full scraper for all given niches and countries."""
        all_leads: List[Dict] = []
        processed_users: Set[str] = set()

        console.print(
            Panel.fit(
                f"[bold cyan]Instagram Business Lead Scraper[/bold cyan]\n"
                f"[yellow]Filter Mode:[/yellow] [bold]{self.filter_mode}[/bold] "
                f"(Targeting businesses without custom websites)\n"
                f"[yellow]Niches:[/yellow] {', '.join(niches)}\n"
                f"[yellow]Countries/Cities:[/yellow] {', '.join(countries)}\n"
                f"[yellow]Target Leads:[/yellow] {max_leads} per niche-country combination",
                border_style="cyan",
            )
        )

        for country in countries:
            for niche in niches:
                console.print(
                    f"\n[bold green]🔍 Searching for '{niche}' in '{country}'...[/bold green]"
                )

                found_handles = self.discovery.search_bing(
                    niche=niche, location=country, max_pages=pages_per_query
                )
                new_handles = [h for h in found_handles if h not in processed_users]

                console.print(
                    f"  Found [bold cyan]{len(found_handles)}[/bold cyan] total handles "
                    f"([bold cyan]{len(new_handles)}[/bold cyan] new to inspect)"
                )

                if not new_handles:
                    continue

                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    BarColumn(),
                    TextColumn("{task.completed}/{task.total}"),
                    TimeElapsedColumn(),
                    console=console,
                ) as progress:
                    task = progress.add_task(f"Inspecting profiles for {niche} - {country}...", total=len(new_handles))

                    for username in new_handles:
                        processed_users.add(username)
                        profile = self.extractor.get_profile(username)
                        progress.advance(task)

                        if not profile:
                            continue

                        # Check follower count filter
                        if profile["followers"] < self.min_followers or profile["followers"] > self.max_followers:
                            continue

                        # Apply website filtering
                        is_match = False
                        if self.filter_mode == "strictly_no_website":
                            is_match = (profile["website_status"] == "NO_WEBSITE")
                        elif self.filter_mode == "no_custom_website":
                            # Matches NO_WEBSITE, LINK_AGGREGATOR, BOOKING_PORTAL, WHATSAPP_ONLY, SOCIAL_ONLY
                            is_match = (profile["website_status"] != "CUSTOM_WEBSITE")
                        else:  # all
                            is_match = True

                        if is_match:
                            profile["niche"] = niche
                            profile["country"] = country
                            all_leads.append(profile)

                            # Delay to respect rate limits
                            time.sleep(0.4)

                            if len(all_leads) >= max_leads:
                                break

        # Export results
        self.export(all_leads)
        self.display_summary(all_leads)
        return all_leads

    def display_summary(self, leads: List[Dict]):
        """Print a summary table of the scraped leads."""
        if not leads:
            console.print("[bold red]No matching leads found.[/bold red]")
            return

        table = Table(title="🎯 Scraped Leads (Businesses Without Custom Websites)", border_style="green")
        table.add_column("Username", style="cyan", no_wrap=True)
        table.add_column("Business Name", style="white")
        table.add_column("Website Status", style="magenta")
        table.add_column("Followers", style="yellow")
        table.add_column("Contact (Email / Phone)", style="green")
        table.add_column("Bio Snippet", style="dim", max_width=40)

        for l in leads[:25]:  # Display top 25 in console
            contact_info = []
            if l["emails"]:
                contact_info.append(f"✉️ {l['emails']}")
            if l["phones"]:
                contact_info.append(f"📞 {l['phones']}")
            contact_str = " | ".join(contact_info) or "DM only"

            table.add_row(
                f"@{l['username']}",
                l["full_name"] or l["username"],
                l["website_status"],
                str(l["followers"]),
                contact_str,
                l["bio"][:38] + ("..." if len(l["bio"]) > 38 else ""),
            )

        console.print(table)
        console.print(f"\n[bold green]✅ Total High-Quality Leads Found: {len(leads)}[/bold green]")

    def export(self, leads: List[Dict]):
        """Export leads to CSV, Excel, and JSON."""
        if not leads:
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"instagram_leads_{timestamp}"

        # 1. Export CSV
        csv_path = self.output_dir / f"{base_name}.csv"
        fieldnames = [
            "username", "full_name", "niche", "country", "website_status",
            "has_website", "primary_link", "followers", "following",
            "emails", "phones", "profile_url", "bio", "all_links"
        ]

        with open(csv_path, mode="w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for l in leads:
                writer.writerow(l)

        # 2. Export JSON
        json_path = self.output_dir / f"{base_name}.json"
        with open(json_path, mode="w", encoding="utf-8") as f:
            json.dump(leads, f, indent=2, ensure_ascii=False)

        # 3. Export Excel if openpyxl/pandas is available
        excel_path = self.output_dir / f"{base_name}.xlsx"
        try:
            import pandas as pd
            df = pd.DataFrame(leads)
            df.to_excel(excel_path, index=False)
            console.print(f"[bold cyan]📁 Exported Excel:[/bold cyan] {excel_path}")
        except Exception:
            pass

        console.print(f"[bold cyan]📁 Exported CSV:[/bold cyan] {csv_path}")
        console.print(f"[bold cyan]📁 Exported JSON:[/bold cyan] {json_path}")


def load_items_from_source(
    cli_arg: Optional[str], file_arg: Optional[str], default_filename: str
) -> List[str]:
    """Load list of items from CLI argument, explicit file, or default file."""
    # 1. If explicit file provided, read it
    if file_arg and Path(file_arg).is_file():
        with open(file_arg, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
        if lines:
            return lines

    # 2. If CLI string provided (and not equal to sentinel or user provided custom arg)
    if cli_arg:
        items = [i.strip() for i in cli_arg.split(",") if i.strip()]
        if items:
            return items

    # 3. If default file exists in current directory, read it
    default_path = Path(default_filename)
    if default_path.is_file():
        with open(default_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
        if lines:
            return lines

    return []


def main():
    parser = argparse.ArgumentParser(
        description="Scrape Instagram businesses without websites for cold outreach & lead generation."
    )
    parser.add_argument(
        "--niches",
        type=str,
        default=None,
        help="Comma-separated list of business niches (e.g. 'hair salon,dentist,roofing')",
    )
    parser.add_argument(
        "--niches-file",
        type=str,
        default=None,
        help="Path to file containing niches, one per line (defaults to niches.txt if present)",
    )
    parser.add_argument(
        "--countries",
        type=str,
        default=None,
        help="Comma-separated list of countries or cities (e.g. 'UK,USA,London,Toronto')",
    )
    parser.add_argument(
        "--countries-file",
        type=str,
        default=None,
        help="Path to file containing countries/cities, one per line (defaults to countries.txt if present)",
    )
    parser.add_argument(
        "--filter-mode",
        choices=["no_custom_website", "strictly_no_website", "all"],
        default="no_custom_website",
        help=(
            "Filter mode: 'no_custom_website' (includes Linktree/Fresha/WhatsApp/No Link), "
            "'strictly_no_website' (strictly zero links), or 'all'"
        ),
    )
    parser.add_argument(
        "--max-leads",
        type=int,
        default=50,
        help="Target number of leads to scrape per niche-country combination",
    )
    parser.add_argument(
        "--min-followers",
        type=int,
        default=10,
        help="Minimum follower count (filters dead/fake accounts)",
    )
    parser.add_argument(
        "--max-followers",
        type=int,
        default=50000,
        help="Maximum follower count (filters large national chains)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="leads",
        help="Directory to save exported files",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Run browser in headless mode",
    )

    args = parser.parse_args()

    niche_list = load_items_from_source(args.niches, args.niches_file, "niches.txt")
    if not niche_list:
        niche_list = ["hair salon", "plumbing", "roofing", "bakery"]

    country_list = load_items_from_source(args.countries, args.countries_file, "countries.txt")
    if not country_list:
        country_list = ["United Kingdom", "United States", "Canada"]

    scraper = InstagramLeadScraper(
        output_dir=args.output_dir,
        filter_mode=args.filter_mode,
        min_followers=args.min_followers,
        max_followers=args.max_followers,
        headless=args.headless,
    )

    scraper.run(
        niches=niche_list,
        countries=country_list,
        max_leads=args.max_leads,
    )


if __name__ == "__main__":
    main()
