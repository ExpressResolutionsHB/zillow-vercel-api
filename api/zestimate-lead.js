export default async function handler(req, res) {
  // -------- CORS --------
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // -------- INPUT --------
  const { street, city, state, email, phone, consent } = req.body || {};

  if (!street || !city || !state) {
    return res.status(400).json({ error: "Missing address." });
  }

  if (!email || !phone || !consent) {
    return res.status(400).json({ error: "Email, phone, and consent are required." });
  }

  // -------- ENV VARS --------
  const ZILLOW_API_KEY = process.env.ZILLOW_API_KEY;
  const ZILLOW_ENDPOINT = process.env.ZILLOW_ENDPOINT;

  if (!ZILLOW_API_KEY || !ZILLOW_ENDPOINT) {
    return res.status(500).json({ error: "Missing env vars." });
  }

  const addressString = `${street}, ${city}, ${state}`;

  // -------- CALL ZILLOW API --------
  let response;
  try {
    response = await fetch(ZILLOW_ENDPOINT, {
      method: "POST", // adjust to GET if your API requires it
      headers: {
        "Authorization": `Bearer ${ZILLOW_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        address: addressString,
        street,
        city,
        state
      })
    });
  } catch (err) {
    return res.status(502).json({
      error: "Failed to reach Zillow API",
      details: String(err)
    });
  }

  const raw = await response.text();
  let data = {};
  try { data = JSON.parse(raw); } catch {}

  if (!response.ok) {
    return res.status(502).json({
      error: "Zillow API error",
      status: response.status,
      response: data || raw
    });
  }

  // -------- MAP RESPONSE --------
  const zestimate =
    data?.zestimate ??
    data?.data?.zestimate ??
    data?.results?.[0]?.zestimate ??
    null;

  const rentZestimate =
    data?.rentZestimate ??
    data?.data?.rentZestimate ??
    data?.results?.[0]?.rentZestimate ??
    null;

  // -------- FINAL RESPONSE --------
  return res.status(200).json({
    address: addressString,
    zestimate,
    rentZestimate,
    source: "Zillow API"
  });
}
