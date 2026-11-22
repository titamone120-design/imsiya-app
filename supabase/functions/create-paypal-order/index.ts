import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

async function paypalToken(base: string, clientId: string, secret: string) {
  const auth = btoa(`${clientId}:${secret}`);
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("PayPal authentication failed");
  return data.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let orderId: string | null = null;
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
    const user = auth.user;

    const body = await req.json();
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return json({ error: "Cart items are required" }, 400);
    }

    const admin = createClient(url, service);
    const seen = new Set<string>();
    const lineItems: Array<{product_id:string;seller_id:string;quantity:number;unit_price:number;name:string}> = [];
    let totalKes = 0;

    for (const item of body.items) {
      if (typeof item.product_id !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || seen.has(item.product_id)) {
        return json({ error: "Invalid or duplicate cart item" }, 400);
      }
      seen.add(item.product_id);
      const { data: product, error: pe } = await admin.from("products")
        .select("id,seller_id,shop_id,name,price,stock,active").eq("id", item.product_id).maybeSingle();
      if (pe || !product || product.active !== true || Number(product.stock) < item.quantity) {
        return json({ error: "A product is unavailable or stock is insufficient" }, 400);
      }
      const { data: shop } = await admin.from("shops").select("id,active").eq("id", product.shop_id).maybeSingle();
      const { data: seller } = await admin.from("seller_profiles").select("id,approved").eq("id", product.seller_id).maybeSingle();
      if (!shop?.active || !seller?.approved) return json({ error: "A seller shop is not active or approved" }, 400);
      const { data: paidSubscription, error: subscriptionError } = await admin.from("shop_subscriptions")
        .select("id").eq("shop_id", product.shop_id).eq("status", "paid")
        .gt("expires_at", new Date().toISOString()).limit(1).maybeSingle();
      if (subscriptionError) throw subscriptionError;
      if (!paidSubscription) return json({ error: "A seller shop subscription is expired or unpaid" }, 400);
      const price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0) return json({ error: "Invalid product price" }, 400);
      totalKes += price * item.quantity;
      lineItems.push({ product_id: product.id, seller_id: product.seller_id, quantity: item.quantity, unit_price: price, name: product.name });
    }

    const fxRes = await fetch("https://open.er-api.com/v6/latest/USD", { headers: { Accept: "application/json" } });
    if (!fxRes.ok) throw new Error("Exchange-rate provider unavailable");
    const fx = await fxRes.json();
    const kesPerUsd = Number(fx?.rates?.KES);
    const updatedAt = Number(fx?.time_last_update_unix);
    if (fx?.result !== "success" || !Number.isFinite(kesPerUsd) || kesPerUsd <= 0 ||
        !Number.isFinite(updatedAt) || Date.now()/1000 - updatedAt > 36*60*60) {
      throw new Error("A fresh KES/USD exchange rate is not available");
    }
    const usd = (Math.round((totalKes / kesPerUsd + Number.EPSILON) * 100) / 100).toFixed(2);
    if (Number(usd) < 0.01) return json({ error: "Converted amount is below PayPal minimum" }, 400);

    const { data: order, error: oe } = await admin.from("orders").insert({
      customer_id: user.id, total_amount: totalKes, currency: "KES",
      usd_total_amount: Number(usd), kes_usd_rate: kesPerUsd,
      fx_rate_timestamp: new Date(updatedAt*1000).toISOString(),
      status: "pending", payment_status: "unpaid", payment_method: "paypal",
    }).select("id").single();
    if (oe) throw oe;
    orderId = order.id;

    const { error: ie } = await admin.from("order_items").insert(lineItems.map(i => ({
      order_id: order.id, product_id: i.product_id, seller_id: i.seller_id,
      quantity: i.quantity, unit_price: i.unit_price,
    })));
    if (ie) {
      await admin.from("orders").delete().eq("id", order.id);
      throw ie;
    }

    const sandbox = (Deno.env.get("PAYPAL_ENV") ?? "sandbox").toLowerCase() !== "live";
    const base = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    const token = await paypalToken(base, clientId, secret);
    const ppRes = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `imsiya-order-${order.id}` },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: order.id,
          custom_id: order.id,
          description: "IMSIYA customer order",
          amount: { currency_code: "USD", value: usd },
        }],
        payment_source: { paypal: { experience_context: {
          user_action: "PAY_NOW",
          return_url: body.platform === "web" ? "https://titamone120-design.github.io/imsiya-app/?imsiya_payment=order" : "imsiya://order-success",
          cancel_url: body.platform === "web" ? "https://titamone120-design.github.io/imsiya-app/?imsiya_payment=order-cancel" : "imsiya://order-cancel",
          ...(body.platform === "web" ? {} : { app_switch_context: {
            native_app: {
              os_type: "ANDROID",
              return_app_url: "imsiya://order-success",
              cancel_app_url: "imsiya://order-cancel",
            },
          }}),
        }}},
      }),
    });
    const pp = await ppRes.json();
    if (!ppRes.ok || !pp.id) {
      await admin.from("order_items").delete().eq("order_id", order.id);
      await admin.from("orders").delete().eq("id", order.id);
      console.error("PayPal create order failed", pp);
      return json({ error: "PayPal could not start checkout" }, 502);
    }
    const approval = (pp.links ?? []).find((l: any) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (!approval) throw new Error("PayPal approval link was not returned");
    const { error: updateError } = await admin.from("orders").update({ paypal_order_id: pp.id }).eq("id", order.id);
    if (updateError) throw updateError;

    return json({ success: true, checkout_url: approval, order_id: order.id, kes_amount: totalKes.toFixed(2), usd_amount: usd, fx_rate: kesPerUsd, fx_timestamp: new Date(updatedAt*1000).toISOString() });
  } catch (error) {
    console.error("PayPal order creation error", error);
    if (orderId) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await admin.from("order_items").delete().eq("order_id", orderId);
      await admin.from("orders").delete().eq("id", orderId).eq("payment_status", "unpaid");
    }
    return json({ error: error instanceof Error ? error.message : "Could not create PayPal order" }, 500);
  }
});