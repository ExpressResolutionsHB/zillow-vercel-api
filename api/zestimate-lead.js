export default async function handler(req, res) {
  // --- CORS (TEMP: allow your site) ---
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { street, city, state, name, email, phone, consent } = req.body || {};

  if (!street || !city || !state) return res.status(400).json({ error: "Missing address." });
  if (!email || !phone || !consent) return res.status(400).json({ error: "Email, phone, and consent are required." });

  const key = process.env.ZILLOW_API_KEY;
  const endpoint = process.env.ZILLOW_ENDPOINT;

  if (!key || !endpoint) return res.status(500).json({ error: "Missing env vars." });

  // ✅ Call Zillow
  let zResp;
  try {
    // Most Zillow endpoints either want:
    // (A) one combined address string, OR (B) separate fields.
    // We'll send BOTH styles to maximize compatibility.
    const payload = {
      address: `${street}, ${city}, ${state}`,
      street,
      city,
      state
    };

    zResp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return res.status(502).json({ error: "Failed to reach Zillow endpoint.", details: String(e?.message || e) });
  }

  const raw = await zResp.text();
  let zData = {};
  try { zData = JSON.parse(raw); } catch { /* leave as {} */ }

  if (!zResp.ok) {
    return res.status(502).json({
      error: "Zillow API error",
      status: zResp.status,
      details: zData,
      raw
    });
  }

  // ✅ Map response (your Zillow API may use different field names)
  const zestimate =
    zData?.zestimate ??
    zData?.data?.zestimate ??
    zData?.results?.[0]?.zestimate ??
    null;

  const rentZestimate =
    zData?.rentZestimate ??
    zData?.data?.rentZestimate ??
    zData?.results?.[0]?.rentZestimate ??
    null;

  return res.status(200).json({
    address: `${street}, ${city}, ${state}`,
    zestimate,
    rentZestimate,
    lastUpdated: zData?.lastUpdated ?? zData?.data?.lastUpdated ?? null,
    zillowUrl: zData?.zillowUrl ?? null
  });
}
