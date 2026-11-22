import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
async function getToken(base: string, id: string, secret: string) {
  const res = await fetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(id + ":" + secret), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const d = await res.json();
  if (!res.ok || !d.access_token) throw new Error("PayPal authentication failed");
  return d.access_token as string;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
    const secret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
    if (!url || !anon || !service || !clientId || !secret) throw new Error("Payment configuration is incomplete");
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Please sign in first" }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: "Invalid login session" }, 401);

    const body = await req.json();
    const paypalOrderId = typeof body.paypal_order_id === "string" ? body.paypal_order_id : "";
    if (!paypalOrderId) return json({ error: "PayPal order ID is required" }, 400);

    const admin = createClient(url, service);
    const { data: order, error: oe } = await admin.from("orders")
      .select("id,customer_id,paypal_order_id,payment_status,usd_total_amount")
      .eq("paypal_order_id", paypalOrderId).eq("customer_id", auth.user.id).maybeSingle();
    if (oe) throw oe;
    if (!order) return json({ error: "Order not found for this account" }, 404);
    if (order.payment_status === "paid") return json({ success: true, already_paid: true, order_id: order.id });

    const sandbox = (Deno.env.get("PAYPAL_ENV") ?? "sandbox").toLowerCase() !== "live";
    const base = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    const token = await getToken(base, clientId, secret);
    const inspectRes = await fetch(base + "/v2/checkout/orders/" + encodeURIComponent(paypalOrderId), {
      headers: { Authorization: "Bearer " + token },
    });
    const inspected = await inspectRes.json();
    if (!inspectRes.ok) throw new Error("Could not verify PayPal order");
    const unit = inspected.purchase_units?.find((u: any) => u.custom_id === order.id || u.reference_id === order.id);
    if (!unit || unit.amount?.currency_code !== "USD" ||
        Number(unit.amount?.value).toFixed(2) !== Number(order.usd_total_amount).toFixed(2)) {
      return json({ error: "PayPal order amount or reference does not match IMSIYA order" }, 400);
    }

    let captureData = inspected;
    if (inspected.status !== "COMPLETED") {
      if (inspected.status !== "APPROVED") return json({ error: "PayPal payment has not been approved" }, 409);
      const captureRes = await fetch(base + "/v2/checkout/orders/" + encodeURIComponent(paypalOrderId) + "/capture", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "PayPal-Request-Id": "imsiya-capture-" + order.id },
      });
      captureData = await captureRes.json();
      if (!captureRes.ok) {
        console.error("PayPal capture failed", captureData);
        return json({ error: "PayPal payment capture failed" }, 502);
      }
    }
    if (captureData.status !== "COMPLETED") return json({ error: "PayPal payment is not completed" }, 409);
    const capture = captureData.purchase_units?.flatMap((u: any) => u.payments?.captures ?? [])
      .find((c: any) => c.status === "COMPLETED");
    if (!capture || capture.amount?.currency_code !== "USD" ||
        Number(capture.amount?.value).toFixed(2) !== Number(order.usd_total_amount).toFixed(2)) {
      return json({ error: "Completed PayPal capture amount could not be verified" }, 400);
    }

    const { error: finalizeError } = await admin.rpc("finalize_paypal_paid_order", {
      p_order_id: order.id,
      p_paypal_order_id: paypalOrderId,
      p_paypal_capture_id: capture.id,
    });
    if (finalizeError) throw finalizeError;
    return json({ success: true, order_id: order.id, payment_status: "paid" });
  } catch (error) {
    console.error("PayPal capture verification error", error);
    return json({ error: error instanceof Error ? error.message : "Could not verify PayPal payment" }, 500);
  }
});