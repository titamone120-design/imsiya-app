import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

// Bound PayPal API calls to prevent stalled upstream requests from holding
// this webhook until the Supabase worker is terminated (504/546).
async function paypalFetch(input: string | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("PayPal API request timed out after 12000ms");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getToken(base: string, id: string, secret: string) {
  const response = await paypalFetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(id + ":" + secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("PayPal authentication failed");
  return data.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
    const secret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID")!;
    if (!url || !service || !clientId || !secret || !webhookId) {
      throw new Error("PayPal webhook is not configured yet");
    }

    const env = (Deno.env.get("PAYPAL_ENV") ?? "").toLowerCase();
    if (env !== "live" && env !== "sandbox") throw new Error("PAYPAL_ENV must be explicitly set to live or sandbox");
    const base = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const raw = await req.text();
    const event = JSON.parse(raw);
    const headers = {
      auth_algo: req.headers.get("paypal-auth-algo"),
      cert_url: req.headers.get("paypal-cert-url"),
      transmission_id: req.headers.get("paypal-transmission-id"),
      transmission_sig: req.headers.get("paypal-transmission-sig"),
      transmission_time: req.headers.get("paypal-transmission-time"),
    };
    if (Object.values(headers).some((value) => !value)) {
      return reply({ error: "Missing PayPal signature headers" }, 400);
    }

    const token = await getToken(base, clientId, secret);
    const verification = await paypalFetch(base + "/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ ...headers, webhook_id: webhookId, webhook_event: event }),
    });
    const verdict = await verification.json();
    if (!verification.ok || verdict.verification_status !== "SUCCESS") {
      console.error("PayPal webhook signature rejected", verdict);
      return reply({ error: "Invalid PayPal webhook signature" }, 401);
    }

    const admin = createClient(url, service);
    const type = String(event.event_type ?? "");
    const resource = event.resource ?? {};

    // Capture approved customer orders on the server. This also works when the
    // customer closes the browser/app before returning from PayPal.
    if (type === "CHECKOUT.ORDER.APPROVED") {
      const paypalOrderId = typeof resource.id === "string" ? resource.id : "";
      if (!paypalOrderId) throw new Error("Approved PayPal order ID is missing");

      const { data: order, error: orderError } = await admin.from("orders")
        .select("id,paypal_order_id,payment_status,usd_total_amount")
        .eq("paypal_order_id", paypalOrderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) throw new Error("IMSIYA order not found yet; PayPal should retry this webhook");
      if (order.payment_status === "paid") return reply({ received: true, already_paid: true });

      const inspectedResponse = await paypalFetch(base + "/v2/checkout/orders/" + encodeURIComponent(paypalOrderId), {
        headers: { Authorization: "Bearer " + token },
      });
      const inspected = await inspectedResponse.json();
      if (!inspectedResponse.ok) throw new Error("Could not verify approved PayPal order");

      const unit = inspected.purchase_units?.find((item: any) =>
        item.custom_id === order.id || item.reference_id === order.id
      );
      if (!unit || unit.amount?.currency_code !== "USD" ||
          Number(unit.amount?.value).toFixed(2) !== Number(order.usd_total_amount).toFixed(2)) {
        throw new Error("PayPal order amount or IMSIYA reference does not match");
      }

      let completed = inspected;
      if (inspected.status !== "COMPLETED") {
        if (inspected.status !== "APPROVED") {
          throw new Error("PayPal order is not approved and cannot be captured");
        }
        const captureResponse = await paypalFetch(base + "/v2/checkout/orders/" + encodeURIComponent(paypalOrderId) + "/capture", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            "PayPal-Request-Id": "imsiya-capture-" + order.id,
          },
        });
        completed = await captureResponse.json();
        if (!captureResponse.ok) {
          console.error("PayPal webhook capture failed", completed);
          throw new Error("PayPal order capture failed; webhook retry is required");
        }
      }

      if (completed.status !== "COMPLETED") throw new Error("PayPal order capture is not completed");
      const capture = completed.purchase_units?.flatMap((item: any) => item.payments?.captures ?? [])
        .find((item: any) => item.status === "COMPLETED");
      if (!capture || capture.amount?.currency_code !== "USD" ||
          Number(capture.amount?.value).toFixed(2) !== Number(order.usd_total_amount).toFixed(2)) {
        throw new Error("Completed PayPal capture amount could not be verified");
      }

      const { error: finalizeError } = await admin.rpc("finalize_paypal_paid_order", {
        p_order_id: order.id,
        p_paypal_order_id: paypalOrderId,
        p_paypal_capture_id: capture.id,
      });
      if (finalizeError) throw finalizeError;
      return reply({ received: true, order_paid: true });
    }

    // If the app captured the payment first, the capture webhook is a second,
    // independently verified path to the same idempotent finalization routine.
    if (type === "PAYMENT.CAPTURE.COMPLETED") {
      const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
      const captureId = resource.id;
      if (typeof paypalOrderId !== "string" || typeof captureId !== "string") {
        throw new Error("PayPal capture references are missing");
      }
      const { data: order, error: orderError } = await admin.from("orders")
        .select("id,paypal_order_id,payment_status,usd_total_amount")
        .eq("paypal_order_id", paypalOrderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) throw new Error("IMSIYA order not found for PayPal capture; retry webhook");
      if (resource.status !== "COMPLETED" || resource.amount?.currency_code !== "USD" ||
          Number(resource.amount?.value).toFixed(2) !== Number(order.usd_total_amount).toFixed(2)) {
        throw new Error("PayPal capture status or amount does not match IMSIYA order");
      }
      const { error: finalizeError } = await admin.rpc("finalize_paypal_paid_order", {
        p_order_id: order.id,
        p_paypal_order_id: paypalOrderId,
        p_paypal_capture_id: captureId,
      });
      if (finalizeError) throw finalizeError;
      return reply({ received: true, order_paid: true });
    }

    // Seller subscription lifecycle. The database routine is idempotent by
    // PayPal event ID and only opens a shop after a verified subscription sale.
    const subscriptionId = type === "PAYMENT.SALE.COMPLETED"
      ? (resource.billing_agreement_id ?? resource.supplementary_data?.related_ids?.billing_agreement_id)
      : resource.id;
    const subscriptionEvents = [
      "PAYMENT.SALE.COMPLETED",
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
      "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    ];
    if (subscriptionEvents.includes(type) && typeof subscriptionId === "string" && subscriptionId) {
      const { error } = await admin.rpc("process_paypal_shop_event", {
        p_event_id: event.id,
        p_event_type: type,
        p_subscription_id: subscriptionId,
      });
      if (error) throw error;
    }

    return reply({ received: true });
  } catch (error) {
    console.error("PayPal webhook error", error);
    return reply({ error: error instanceof Error ? error.message : "Webhook processing failed" }, 500);
  }
});
