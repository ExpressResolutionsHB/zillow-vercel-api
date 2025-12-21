export default async function handler(req, res) {
  // --- CORS (temporary permissive to avoid "Load failed") ---
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST for the real request
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // Parse input
  const { street, city, state, name, email, phone, consent } = req.body || {};

  // Basic validation
  if (!street || !city || !state) {
    return res.status(400).json({ error: "Missing address." });
  }
  if (!email || !phone || !consent) {
    return res.status(400).json({ error: "Email, phone, and consent are required." });
  }

  // Env vars (what we're debugging)
  const key = process.env.ZILLOW_API_KEY;
  const endpoint = process.env.ZILLOW_ENDPOINT;

  // ✅ DEBUG: return what Vercel sees for env vars (TEMPORARY)
  return res.status(200).json({
    debug: true,
    hasKey: !!key,
    hasEndpoint: !!endpoint,
    // These extra fields help you verify you're hitting the right deployment:
    received: {
      street,
      city,
      state,
      name: name || null,
      emailProvided: !!email,
      phoneProvided: !!phone,
      consent: !!consent
    }
  });

  // --- After debug is solved, you'll remove the return above and enable Zillow call below ---
  /*
  const zResp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ street, city, state })
  });

  const zData = await zResp.json().catch(() => ({}));
  if (!zResp.ok) {
    return res.status(502).json({ error: "Zillow API error", details: zData });
  }

  return res.status(200).json({
    address: `${street}, ${city}, ${state}`,
    zestimate: zData?.zestimate ?? null,
    rentZestimate: zData?.rentZestimate ?? null,
    lastUpdated: zData?.lastUpdated ?? null,
    zillowUrl: zData?.zillowUrl ?? null
  });
  */
}
