// Simple in-memory cache (24h)
const CACHE = globalThis.__ZCACHE__ || (globalThis.__ZCACHE__ = new Map());
const TTL = 24 * 60 * 60 * 1000;

const getCache = (k) => {
  const v = CACHE.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) {
    CACHE.delete(k);
    return null;
  }
  return v.data;
};

const setCache = (k, data) => {
  CACHE.set(k, { data, exp: Date.now() + TTL });
};

export default async function handler(req, res) {
  // --- CORS ---
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { street, city, state, email, phone, consent } = req.body || {};
  if (!street || !city || !state)
    return res.status(400).json({ error: "Missing address." });
  if (!email || !phone || !consent)
    return res.status(400).json({ error: "Email, phone, and consent required." });

  const key = process.env.ZILLOW_API_KEY;
  const endpoint = process.env.ZILLOW_ENDPOINT;
  if (!key || !endpoint)
    return res.status(500).json({ error: "Missing env vars." });

  const address = `${street}, ${city}, ${state}`;
  const cacheKey = address.toLowerCase();

  const cached = getCache(cacheKey);
  if (cached) return res.status(200).json({ ...cached, cached: true });

  let r;
  try {
    r = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Accept": "application/json",
      },
    });
  } catch (e) {
    return res.status(502).json({
      error: "Failed to reach Zillow",
      details: String(e),
    });
  }

  const raw = await r.text();
  let data = {};
  try { data = JSON.parse(raw); } catch {}

  if (r.status === 429) {
    return res.status(429).json({
      error: "Rate limited",
      message: "Too many requests. Try again in a minute.",
    });
  }

  if (!r.ok) {
    return res.status(502).json({
      error: "Zillow API error",
      status: r.status,
      response: data || raw,
    });
  }

  const zestimate =
    data?.zestimate ??
    data?.data?.zestimate ??
    data?.results?.[0]?.zestimate ??
    null;

  const out = {
    address,
    zestimate,
    rentZestimate:
      data?.rentZestimate ??
      data?.data?.rentZestimate ??
      null,
  };

  setCache(cacheKey, out);
  return res.status(200).json(out);
}
