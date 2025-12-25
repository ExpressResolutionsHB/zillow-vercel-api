export default async function handler(req, res) {
  // -------- CORS --------
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  // -------- INPUT --------
  const { street, city, state, email, phone, consent } = req.body || {};
  if (!street || !city || !state) return res.status(400).json({ error: "Missing address." });
  if (!email || !phone || !consent) return res.status(400).json({ error: "Email/phone/consent required." });

  // -------- ENV VARS --------
  const key = process.env.ZILLOW_API_KEY;
  const endpoint = process.env.ZILLOW_ENDPOINT;

  if (!key || !endpoint) return res.status(500).json({ error: "Missing env vars." });

  const address = `${street}, ${city}, ${state}, ${zip}`;

  // Helper
  const tryJson = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

  // Attempt A: GET ?address=
  async function attemptGet() {
    const url = new URL(endpoint);
    url.searchParams.set("address", address);

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    });

    const raw = await r.text();
    return { usedMethod: "GET_QUERY", status: r.status, ok: r.ok, raw, parsed: tryJson(raw) };
  }

  // Attempt B: POST JSON body
  async function attemptPost() {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
       x-rapidapi-key": key, 
  "x-rapidapi-host": "zllw-working-api.p.rapidapi.com",
      },
      body: JSON.stringify({
        address,
        street,
        city,
        state,
      }),
    });

    const raw = await r.text();
    return { usedMethod: "POST_JSON", status: r.status, ok: r.ok, raw, parsed: tryJson(raw) };
  }

  // Run attempts (GET then POST)
  let a;
  try {
    a = await attemptGet();
    if (a.ok) return res.status(200).json({ address, upstream: a });

    const b = await attemptPost();
    if (b.ok) return res.status(200).json({ address, upstream: b });

    // If both fail, return both responses (THIS IS THE GOLD)
    return res.status(502).json({
      error: "Upstream API rejected the request",
      address,
      attempts: [a, b],
      note: "This tells us exactly what the API wants (auth/method/params).",
    });
  } catch (e) {
    return res.status(502).json({
      error: "Failed to reach upstream endpoint",
      address,
      details: String(e?.message || e),
    });
  }
}
