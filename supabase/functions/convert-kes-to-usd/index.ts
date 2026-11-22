import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const kesAmount = Number(body?.kes_amount);
    if (!Number.isFinite(kesAmount) || kesAmount <= 0 || kesAmount > 100000000) {
      return json({ error: "A valid positive kes_amount is required" }, 400);
    }

    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) throw new Error("Exchange-rate provider unavailable");

    const data = await response.json();
    const kesPerUsd = Number(data?.rates?.KES);
    const updatedAt = Number(data?.time_last_update_unix);
    const nextUpdateAt = Number(data?.time_next_update_unix);

    if (data?.result !== "success" || !Number.isFinite(kesPerUsd) || kesPerUsd <= 0 ||
        !Number.isFinite(updatedAt) || Date.now() / 1000 - updatedAt > 36 * 60 * 60) {
      throw new Error("A fresh KES/USD exchange rate is not available");
    }

    const usdAmount = Math.round((kesAmount / kesPerUsd + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(usdAmount) || usdAmount < 0.01) {
      return json({ error: "The converted amount is below PayPal's minimum" }, 400);
    }

    return json({
      kes_amount: Math.round(kesAmount * 100) / 100,
      usd_amount: usdAmount.toFixed(2),
      display_currency: "USD",
      rate_timestamp: new Date(updatedAt * 1000).toISOString(),
      next_rate_update: Number.isFinite(nextUpdateAt) ? new Date(nextUpdateAt * 1000).toISOString() : null,
      rate_source: "ExchangeRate-API",
      attribution: "Rates By Exchange Rate API",
    });
  } catch (error) {
    console.error("KES/USD conversion error:", error);
    return json({ error: error instanceof Error ? error.message : "Currency conversion failed" }, 503);
  }
});