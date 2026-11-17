import ukLeads from "./web/src/data/uk_tree_surgeons_350_leads.json";

function escapeCsv(val) {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API Route: /api/leads
    if (url.pathname === "/api/leads") {
      const batch = url.searchParams.get("batch") || "all";
      const format = url.searchParams.get("format") || "json";

      let leads = ukLeads;
      if (batch === "batch-1") {
        leads = ukLeads.filter((l) => l.batch === "Batch 1" || l.id <= 100);
      } else if (batch === "batch-2") {
        leads = ukLeads.filter((l) => l.batch === "Batch 2" || (l.id > 100 && l.id <= 200));
      } else if (batch === "batch-3") {
        leads = ukLeads.filter((l) => l.batch === "Batch 3" || l.id > 200);
      }

      if (format === "csv") {
        const headers = [
          "id",
          "batch",
          "username",
          "full_name",
          "location",
          "country",
          "website_status",
          "contact_route",
          "phones",
          "emails",
          "followers",
          "posts",
          "service_evidence",
          "pitch_angle",
          "profile_url",
        ];
        const rows = [
          headers.join(","),
          ...leads.map((l) =>
            headers.map((h) => escapeCsv(l[h] ?? "")).join(",")
          ),
        ];
        return new Response(rows.join("\n"), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Content-Disposition": `attachment; filename="uk_tree_surgeons_${batch}_leads.csv"`,
          },
        });
      }

      const payload = {
        meta: {
          campaign: "uk-tree-surgeons",
          batch,
          count: leads.length,
          totals: {
            ukTreeSurgeons: ukLeads.length,
            batch1: ukLeads.filter((l) => l.batch === "Batch 1" || l.id <= 100).length,
            batch2: ukLeads.filter((l) => l.batch === "Batch 2" || (l.id > 100 && l.id <= 200)).length,
            batch3: ukLeads.filter((l) => l.batch === "Batch 3" || l.id > 200).length,
            total: ukLeads.length,
          },
          deduplication: {
            engine: "agentmemory",
            engineUrl: "https://github.com/rohitg00/agentmemory",
            status: "ACTIVE",
            policy: "Zero duplicate leads across all sessions (Strict)",
          },
          generatedAt: new Date().toISOString(),
        },
        leads,
      };

      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Static Assets from Next.js export
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      if (response.status === 404 && !url.pathname.includes(".")) {
        return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
      }
      return response;
    }

    return new Response("Static assets binding not found", { status: 500 });
  },
};
