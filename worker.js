import sydneyLeads from "./web/src/data/sydney_dog_groomers_50_leads.json";
import ukLeads from "./web/src/data/uk_tree_surgeons_100_leads.json";

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
      const campaign = url.searchParams.get("campaign") || "sydney-dog-groomers";
      const format = url.searchParams.get("format") || "json";

      let leads = [];
      if (campaign === "uk-tree-surgeons") {
        leads = ukLeads;
      } else if (campaign === "all") {
        leads = [
          ...sydneyLeads.map((l) => ({ ...l, campaign: "sydney-dog-groomers" })),
          ...ukLeads.map((l) => ({ ...l, campaign: "uk-tree-surgeons" })),
        ];
      } else {
        leads = sydneyLeads;
      }

      if (format === "csv") {
        const headers = [
          "id",
          "username",
          "business_name",
          "location",
          "country",
          "website_status",
          "contact_route",
          "phone",
          "followers",
          "posts",
          "services",
          "pitch_angle",
          "profile_url",
        ];
        const rows = [
          headers.join(","),
          ...leads.map((l) =>
            headers
              .map((h) => escapeCsv(l[h] ?? l.full_name ?? l.phones ?? l.service_evidence ?? ""))
              .join(",")
          ),
        ];
        return new Response(rows.join("\n"), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Content-Disposition": `attachment; filename="${campaign}_leads.csv"`,
          },
        });
      }

      const payload = {
        meta: {
          campaign,
          count: leads.length,
          totals: {
            sydneyDogGroomers: sydneyLeads.length,
            ukTreeSurgeons: ukLeads.length,
            total: sydneyLeads.length + ukLeads.length,
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
