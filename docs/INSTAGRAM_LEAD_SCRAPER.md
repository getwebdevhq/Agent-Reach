# 📷 Instagram Business Lead Scraper (No Website Finder)

An automated lead generation tool tailored for agencies, web designers, and marketing consultants to find local businesses on Instagram that **do not have a website** (or only rely on Linktree / booking portals).

---

## 🚀 How It Works

1. **Targeted Discovery Engine**:
   - Uses Playwright to execute high-precision search dorks across search engines (e.g., `site:instagram.com "{niche}" "{country/city}"`, `#{location}{niche}`, `"DM to book"`, `"contact"`).
   - Extracts genuine Instagram business handles without triggering Instagram login walls or burn rates.

2. **Ultra-Fast Profile Inspection**:
   - Queries Instagram's public profile data using `curl_cffi` with browser TLS fingerprinting (Chrome 120/133 emulation).
   - Lightning fast (~0.5s per profile) and requires **no Instagram login**.

3. **Intelligent Website Classification**:
   - `NO_WEBSITE`: The business has **zero** links in bio. Highest priority outreach target.
   - `LINK_AGGREGATOR`: Only uses Linktree, Beacons, Bio.link, Taplink, Carrd, etc. (No real company domain).
   - `BOOKING_PORTAL`: Only uses marketplace booking links like Fresha, Vagaro, Square, Calendly, Acuity, Setmore.
   - `WHATSAPP_ONLY`: Takes orders/bookings directly through a `wa.me` WhatsApp link.
   - `SOCIAL_ONLY`: Only links to Facebook, TikTok, or YouTube.
   - `CUSTOM_WEBSITE`: Already has an official custom website domain (filtered out by default).

4. **Contact Extraction**:
   - Automatically parses direct **email addresses** from bio text.
   - Automatically parses **phone numbers** and **WhatsApp contacts** from bio text.

5. **Multi-Format Export**:
   - Automatically exports formatted leads to:
     - `leads/instagram_leads_YYYYMMDD_HHMMSS.xlsx` (Excel)
     - `leads/instagram_leads_YYYYMMDD_HHMMSS.csv` (CSV for CRM / Cold Outreach tools)
     - `leads/instagram_leads_YYYYMMDD_HHMMSS.json` (Structured JSON)

---

## 🛠️ Usage

### Option 1: Provide Niches & Countries in Chat
Simply reply in chat with the niches and countries/cities you want to target (e.g. `niches: dentist, roofing, landscaping`, `countries: UK, Canada, Australia`). I will run the scraper and give you the formatted results and exported files.

### Option 2: Using Text Files
Edit [niches.txt](file:///c:/Users/abhib/Documents/Agent-Reach/niches.txt) and [countries.txt](file:///c:/Users/abhib/Documents/Agent-Reach/countries.txt) in the project directory, then run:

```bash
python instagram_scraper.py
```

### Option 3: Command Line Flags
You can run directly with custom parameters:

```bash
# Scrape specific niches and cities
python instagram_scraper.py --niches "hair salon,bakery,plumbing" --countries "London,Manchester,Toronto" --max-leads 50

# Strict mode: Only profiles with literally 0 links in bio
python instagram_scraper.py --niches "roofing" --countries "United Kingdom" --filter-mode strictly_no_website

# Filter by follower size (e.g. SMBs between 100 and 15,000 followers)
python instagram_scraper.py --niches "chiropractor" --countries "Sydney" --min-followers 100 --max-followers 15000
```

---

## 📊 Exported Fields

| Field | Description | Example |
|---|---|---|
| `username` | Instagram handle | `tayasalon` |
| `full_name` | Business / Owner name | `Toronto Hair Salon 🇰🇷🇨🇦` |
| `niche` | Target niche | `hair salon` |
| `country` | Target location | `Toronto` |
| `website_status` | Classification | `BOOKING_PORTAL` or `NO_WEBSITE` |
| `has_website` | Boolean (`True`/`False`) | `False` |
| `primary_link` | First link in bio (if any) | `https://fresha.com/book-now/...` |
| `followers` | Follower count | `6,135` |
| `following` | Following count | `298` |
| `emails` | Extracted email address | `contact@...` |
| `phones` | Extracted phone number | `416-221-8788` |
| `profile_url` | Direct Instagram link | `https://www.instagram.com/tayasalon/` |
| `bio` | Full Instagram biography | `Toronto No.1 Korean hair salon...` |
