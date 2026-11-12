# Agent-Reach Leads Intelligence & Outreach Platform

[![Deploy to Cloudflare Workers](https://github.com/getwebdevhq/agent-reach-leads/actions/workflows/deploy-cloudflare.yml/badge.svg)](https://github.com/getwebdevhq/agent-reach-leads/actions/workflows/deploy-cloudflare.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare)](https://workers.cloudflare.com/)

A full-stack lead intelligence and cold outreach platform targeting verified Instagram businesses that **do not have a website** (operating exclusively via Instagram DMs, SMS/phone, or link-in-bio aggregators).

Includes **150 verified leads**, a high-performance **Next.js 16 + Tailwind CSS** interface, structured API endpoints, and zero-cold-start deployment on **Cloudflare Workers**.

---

## 📊 Qualified Lead Datasets

| Dataset | Verified Leads | Website Status | Reachability | Formats Available |
|:---|:---:|:---|:---:|:---|
| **Sydney Dog Groomers (Australia)** | **50** | 100% `NO_WEBSITE` | 24 with direct mobile/landline, 26 via DM | CSV, JSON, Excel |
| **UK Tree Surgeons (United Kingdom)** | **100** | `NO_WEBSITE` & `WHATSAPP_ONLY` | 50+ with direct UK phone, 50 via DM | CSV, JSON, Excel |
| **Total Qualified Leads** | **150** | **100% Without Custom Website** | High Intent Local Prospects | [`leads/`](./leads) |

Every lead includes:
- Instagram `@handle` and direct profile URL
- Business name and specific suburb/region (e.g. Bondi, Newtown, Parramatta, Sutherland Shire, Mosman, Manchester, London)
- Verified phone number (Australian `04xx xxx xxx` or UK `07xxx xxxxxx` / landlines)
- Follower count and activity metrics
- Verified services offered
- **Tailored Sales Pitch Angle** specific to their business, location, and bottleneck
- Ready-to-send personalized cold DM/SMS outreach script

---

## 🚀 Key Features

1. **Interactive Lead Dashboard (`web/`)**:
   - **Campaign Switcher**: Toggle between Sydney Dog Groomers, UK Tree Surgeons, or all 150 leads.
   - **Real-Time KPI Strip**: Instant tracking of matching leads, phone/SMS reachability percentage, DM-only prospects, average followers, and geographic coverage.
   - **Search & Multi-Filtering**: Search by username, business name, suburb, phone, or service; filter by contact route, website status, and location; sort by ID, followers, posts, or name.
   - **3 Output Views**:
     - **Table View**: Compact overview with 1-click phone copying and CRM status dropdown.
     - **Prospect Cards**: Visual cards with service tags and highlighted pitch angles.
     - **Structured JSON View**: Live formatted JSON payload with schema reference and 1-click JSON/CSV download.
   - **Slide-Over Detail & Outreach Drawer**:
     - Full bio and verified service breakdown.
     - 1-click copy of pre-composed personalized cold outreach messages.
     - Local CRM stage tracking (`New`, `Contacted`, `Replied`, `Booked`) saved persistently.

2. **Edge API on Cloudflare Workers (`worker.js`)**:
   - `GET /api/leads?campaign=sydney-dog-groomers`: Returns Sydney dog groomers JSON.
   - `GET /api/leads?campaign=uk-tree-surgeons`: Returns UK tree surgeons JSON.
   - `GET /api/leads?campaign=all`: Returns combined 150 leads.
   - `GET /api/leads?campaign=...&format=csv`: Streams downloadable CSV file with CORS enabled.

3. **Cloudflare Workers Deployment (`wrangler.toml`)**:
   - Zero-cold-start global distribution.
   - Next.js static asset binding (`[assets]`) with SPA client routing fallback.
   - Automated GitHub Actions deployment on `git push main`.

---

## 🛠️ Project Structure

```
agent-reach-leads/
├── .github/
│   └── workflows/
│       └── deploy-cloudflare.yml   # Automated Cloudflare Workers CI/CD
├── leads/
│   ├── sydney_dog_groomers_50_leads.csv
│   ├── sydney_dog_groomers_50_leads.json
│   ├── sydney_dog_groomers_50_leads.xlsx
│   ├── uk_tree_surgeons_100_leads.csv
│   ├── uk_tree_surgeons_100_leads.json
│   └── uk_tree_surgeons_100_leads.xlsx
├── scripts/
│   ├── compile_final_50_sydney_leads.py
│   ├── qualify_sydney_leads.py
│   └── harvest_sydney_dog_groomers.py
├── web/                             # Next.js 16 + Tailwind CSS App
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   └── LeadDashboard.tsx    # Interactive dashboard UI
│   │   ├── data/                    # Bundled lead datasets
│   │   └── lib/
│   │       └── leads.ts             # Normalized TypeScript schema
│   ├── package.json
│   └── next.config.ts
├── worker.js                        # Cloudflare Workers entrypoint & edge API
├── wrangler.toml                    # Cloudflare Workers configuration
└── package.json                     # Root scripts for build & deployment
```

---

## 💻 Local Development

### 1. Run the Next.js UI Locally
```bash
cd web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### 2. Build for Production (Static Export)
```bash
cd web
npm run build
```
Generates the optimized static distribution in `web/out/`.

### 3. Test with Cloudflare Wrangler Locally
```bash
# In the root directory:
npm run deploy:dry
# Or launch the Cloudflare Workers local runtime:
npx wrangler dev
```

---

## ☁️ Cloudflare Workers Deployment

### Automated Deployment via GitHub Actions
Pushing to the `main` branch automatically triggers `.github/workflows/deploy-cloudflare.yml`.

To enable automatic deployments, configure the following **Repository Secrets** in GitHub (`Settings -> Secrets and variables -> Actions`):
1. `CLOUDFLARE_API_TOKEN`: Cloudflare API token with `Workers:Edit` and `Account:Read` permissions.
2. `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID (found on the Workers dashboard).

### Manual Deployment from CLI
```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Build and deploy
npm run deploy
```

---

## 📄 License
MIT License. Created by [getwebdevhq](https://github.com/getwebdevhq).
