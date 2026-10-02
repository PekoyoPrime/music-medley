/*
  Cloudflare Worker: Deezer API CORS proxy
  Deploy this as a separate Worker.
  Then put the Worker URL into the Music Medley "API URL" setting.
*/

const DEEZER = "https://api.deezer.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60"
};

export default {
  async fetch(request) {
    const origin = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: cors
      });
    }

    // Only expose the endpoints this app needs.
    if (origin.pathname !== "/search") {
      return new Response("Not Found", { status: 404, headers: cors });
    }

    const q = origin.searchParams.get("q");
    if (!q) {
      return new Response(JSON.stringify({ data: [] }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const target = `${DEEZER}/search?q=${encodeURIComponent(q)}`;

    try {
      const upstream = await fetch(target, {
        headers: { "Accept": "application/json" }
      });

      const body = await upstream.text();

      return new Response(body, {
        status: upstream.status,
        headers: {
          ...cors,
          "Content-Type": upstream.headers.get("Content-Type") || "application/json"
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({
        error: "Deezer request failed"
      }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }
};
