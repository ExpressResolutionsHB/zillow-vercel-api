// ===== SIMPLE IN-MEMORY CACHE (24 HOURS) =====
const CACHE = globalThis.__CACHE__ || (globalThis.__CACHE__ = new Map());
const TTL = 24 * 60 * 60 * 1000;

function getCache(key) {
  const v = CACHE.get(key);
  if (!v) return null;
  if (Date.now() > v.exp) {
    CACHE.delete(key);
    return null;
  }
  return v.data;
}
function setCache(key, data) {
  CACHE.set(key, { data, exp: Date.now() + TTL });
}

// ===== HANDLER =====
export default async function handler(req, res) {
  // --- CORS ---
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { street, city, state, email, phone, consent } = req.body || {};

  if (!street || !city || !state) {
    return res.status(400).json({ error: "Missing address." });
  }
  if (!email || !phone || !consent) {
    return res.status(400).json({ error: "Lead info required." });
  }

  const ATTOM_KEY = process.env.ATTOM_API_KEY;
  if (!ATTOM_KEY) {
    return res.status(500).json({ error: "Missing ATTOM_API_KEY" });
  }

  const address = `${street}, ${city}, ${state}`;
  const cacheKey = address.toLowerCase();

  const cached = getCache(cacheKey);
  if (cached) {
    return res.status(200).json({ ...cached, cached: true });
  }

  // ===== ATTOM AVM REQUEST =====
  const url = new URL("https://api.gateway.attomdata.com/propertyapi/v1.0.0/valuation/homeequity");

  url.searchParams.set("address1", street);
  url.searchParams.set("address2", `${city}, ${state}`);

  let r;
  try {
    r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "apikey": ATTOM_KEY,
        "Accept": "application/json"
      }
    });
  } catch (e) {
    return res.status(502).json({
      error: "ATTOM unreachable",
      details: String(e)
    });
  }

  const raw = await r.text();
  let data = {};
  try { data = JSON.parse(raw); } catch {}

  if (!r.ok) {
    return res.status(r.status).json({
      error: "ATTOM API error",
      status: r.status,
      response: data || raw
    });
  }

  const value =
    data?.property?.[0]?.avm?.amount?.value ??
    null;

  const out = {
    address,
    estimatedValue: value,
    source: "ATTOM AVM"
  };

  setCache(cacheKey, out);
  return res.status(200).json(out);
}
