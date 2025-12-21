export default async function handler(req, res) {
  // ✅ CHANGE THIS to your Carrot domain later
  res.setHeader("Access-Control-Allow-Origin", "https://YOURCARROTSITE.com");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { street, city, state, email, phone, consent } = req.body || {};
  if (!street || !city || !state) return res.status(400).json({ error: "Missing address." });
  if (!email || !phone || !consent) return res.status(400).json({ error: "Email/phone/consent required." });

  const key = process.env.ZILLOW_API_KEY;
  const endpoint = process.env.ZILLOW_ENDPOINT;
  if (!key || !endpoint) return res.status(500).json({ error: "Missing env vars." });

  const zResp = await fetch(endpoint, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ street, city, state })
  });

  const zData = await zResp.json().catch(() => ({}));
  if (!zResp.ok) return res.status(502).json({ error: "Zillow API error", details: zData });

  return res.json({
    address: `${street}, ${city}, ${state}`,
    zestimate: zData?.zestimate ?? null,
    rentZestimate: zData?.rentZestimate ?? null
  });
}
