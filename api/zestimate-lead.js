export default async function handler(req, res) {
  // CORS (keep permissive for now)
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { street, city, state, email, phone, consent } = req.body || {};
  if (!street || !city || !state) return res.status(400).json({ error: "Missing address." });
  if (!email || !phone || !consent) return res.status(400).json({ error: "Email/phone/consent required." });

  const key = process.env.ZILLOW_API_KEY;
  const endpoint = process.env.ZILLOW_ENDPOINT;
  if (!key || !endpoint) return res.status(500).json({ error: "Missing env vars." });

  const addressString = `${street}, ${city}, ${state}`;

  // Try BOTH common patterns:
  // 1) POST JSON body
  // 2) GET with query param
  // (Zillow APIs differ—this tells us which one yours is.)
  const attempts = [];

  // Attempt A: POST JSON (Bearer)
  attempts.push(async () => {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        address: addressString,
        street,
        city,
        state,
      }),
    });
    return r;
  });

  // Attempt B: GET ?address=... (Bearer)
  attempts.push(async () => {
    const url = new URL(endpoint);
    // Common query keys
    url.searchParams.set("address", addressString);
    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Accept": "application/json",
      },
    });
    return r;
  });

  let last = null;

  for (let i = 0; i < attempts.length; i++) {
    try {
      const r = await attempts[i]();
      const raw = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch {}

      // If success, map best guess fields and return
      if (r.ok) {
        const zestimate =
          parsed?.zestimate ??
          parsed?.data?.zestimate ??
          parsed?.results?.[0]?.zestimate ??
          parsed?.result?.zestimate ??
          null;

        return res.status(200).json({
          address: addressString,
          zestimate,
          rentZestimate:
            parsed?.rentZestimate ??
            parsed?.data?.rentZestimate ??
            parsed?.results?.[0]?.rentZestimate ??
            null,
          // helpful for troubleshooting even on success
          usedMethod: i === 0 ? "POST_JSON" : "GET_QUERY",
        });
      }

      // Save the error details so you can see WHY it failed
      last = {
        usedMethod: i === 0 ? "POST_JSON" : "GET_QUERY",
        status: r.status,
        raw,
        parsed,
      };
    } catch (e) {
      last = { usedMethod: i === 0 ? "POST_JSON" : "GET_QUERY", status: 0, raw: String(e?.message || e) };
    }
  }

  // If both fail, return Zillow error details
  return res.status(502).json({
    error: "Zillow API error",
    details: last,
    hint: "Your Zillow endpoint likely needs different auth header, different method, or different parameters (e.g., zpid).",
  });
}
