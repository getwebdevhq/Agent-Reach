"""
Generate safe SQL insertion batches for Agent-Reach UK Tree Surgeons leads,
triage state, and memory deduplication registry.
"""

import json
from pathlib import Path

LEADS_FILE = Path("leads/uk_tree_surgeons_350_leads.json")
OUTPUT_SQL_FILE = Path("leads/database_seed.sql")

def sql_quote(val):
    if val is None:
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"

def main():
    with open(LEADS_FILE, "r", encoding="utf-8") as f:
        leads = json.load(f)

    print(f"Total leads to process: {len(leads)}")

    sql_batches = []
    
    # 1. Lead inserts
    for i in range(0, len(leads), 50):
        chunk = leads[i : i + 50]
        values = []
        for lead in chunk:
            uid = f"uk-{lead['id']}"
            bid = lead["id"]
            batch = lead.get("batch") or ("Batch 1" if bid <= 100 else "Batch 2" if bid <= 200 else "Batch 3")
            username = lead["username"]
            business_name = lead.get("full_name") or username
            location = lead.get("location") or "United Kingdom"
            suburb = location.split(",")[0].strip()
            website_status = lead.get("website_status") or "NO_WEBSITE"
            contact_route = lead.get("contact_route") or "Instagram DM"
            phone = lead.get("phones") or lead.get("phone")
            email = lead.get("emails") or lead.get("email")
            followers = int(lead.get("followers") or 0)
            posts = int(lead.get("posts") or 0)
            services = lead.get("service_evidence") or lead.get("services") or "Tree Surgery"
            pitch_angle = lead.get("pitch_angle") or "Local SEO website with photo quote form"
            profile_url = lead.get("profile_url") or f"https://www.instagram.com/{username}/"
            bio = lead.get("bio") or ""

            val = (
                f"({sql_quote(uid)}, {bid}, {sql_quote(batch)}, 'uk-tree-surgeons', "
                f"{sql_quote(username)}, {sql_quote(business_name)}, {sql_quote(suburb)}, "
                f"{sql_quote(location)}, 'United Kingdom', {sql_quote(website_status)}, "
                f"{sql_quote(contact_route)}, {sql_quote(phone)}, {sql_quote(email)}, "
                f"{followers}, {posts}, {sql_quote(services)}, {sql_quote(pitch_angle)}, "
                f"{sql_quote(profile_url)}, {sql_quote(bio)})"
            )
            values.append(val)

        sql = (
            "INSERT INTO public.agent_reach_leads "
            "(uid, id, batch, campaign, username, business_name, suburb, location, country, "
            "website_status, contact_route, phone, email, followers, posts, services, "
            "pitch_angle, profile_url, bio)\nVALUES\n"
            + ",\n".join(values)
            + "\nON CONFLICT (uid) DO UPDATE SET "
            "phone = EXCLUDED.phone, "
            "email = EXCLUDED.email, "
            "pitch_angle = EXCLUDED.pitch_angle;"
        )
        sql_batches.append(sql)

    # 2. Triage & Lead Triage default initialization
    for i in range(0, len(leads), 50):
        chunk = leads[i : i + 50]
        triage_vals = []
        lead_triage_vals = []
        for lead in chunk:
            uid = f"uk-{lead['id']}"
            bid = lead["id"]
            username = lead["username"]
            business_name = lead.get("full_name") or username
            location = lead.get("location") or "United Kingdom"
            phone = lead.get("phones") or lead.get("phone")

            triage_vals.append(f"({sql_quote(uid)}, {bid}, {sql_quote(username)}, 'inbox', FALSE)")
            lead_triage_vals.append(
                f"({sql_quote(uid)}, {bid}, {sql_quote(username)}, {sql_quote(business_name)}, "
                f"{sql_quote(location)}, {sql_quote(phone)}, 'inbox', FALSE)"
            )

        sql1 = (
            "INSERT INTO public.agent_reach_triage (uid, id, username, bucket, replied)\nVALUES\n"
            + ",\n".join(triage_vals)
            + "\nON CONFLICT (uid) DO NOTHING;"
        )
        sql2 = (
            "INSERT INTO public.lead_triage (uid, id, username, business_name, location, phone, bucket, replied)\nVALUES\n"
            + ",\n".join(lead_triage_vals)
            + "\nON CONFLICT (uid) DO NOTHING;"
        )
        sql_batches.append(sql1)
        sql_batches.append(sql2)

    # 3. AgentMemory handles & phones registry
    memory_vals = []
    for lead in leads:
        uid = f"uk-{lead['id']}"
        username = lead["username"].strip().lower()
        memory_vals.append(f"('handle:{username}', 'handle', {sql_quote(username)}, {sql_quote(uid)})")
        phone = lead.get("phones") or lead.get("phone")
        if phone:
            raw_phone = "".join(c for c in str(phone) if c.isalnum() or c == "+")
            memory_vals.append(f"('phone:{raw_phone}', 'phone', {sql_quote(raw_phone)}, {sql_quote(uid)})")

    for i in range(0, len(memory_vals), 100):
        chunk = memory_vals[i : i + 100]
        sql = (
            "INSERT INTO public.agent_reach_memory (key, item_type, normalized_value, lead_uid)\nVALUES\n"
            + ",\n".join(chunk)
            + "\nON CONFLICT (key) DO NOTHING;"
        )
        sql_batches.append(sql)

    with open(OUTPUT_SQL_FILE, "w", encoding="utf-8") as f:
        f.write("\n\n-- BATCH BREAK --\n\n".join(sql_batches))

    print(f"Generated {len(sql_batches)} SQL execution batches in {OUTPUT_SQL_FILE}")

if __name__ == "__main__":
    main()
