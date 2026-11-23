import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) throw new Error("Account deletion service is not configured");
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in as an IMSIYA administrator" }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await caller.auth.getUser();
    if (authError || !auth.user) return json({ error: "Invalid administrator session" }, 401);
    if (!["admin", "super_admin"].includes(String(auth.user.app_metadata?.role ?? ""))) {
      return json({ error: "Only an IMSIYA administrator can process account deletion" }, 403);
    }
    const body = await req.json();
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return json({ error: "A valid account deletion request ID is required" }, 400);
    }
    const admin = createClient(url, service);
    const { data: request, error: requestError } = await admin.from("account_deletion_requests")
      .select("id,requester_id,status").eq("id", requestId).maybeSingle();
    if (requestError) throw requestError;
    if (!request || !["pending", "reviewing"].includes(request.status)) {
      return json({ error: "The account deletion request is missing or already processed" }, 404);
    }
    const targetId = request.requester_id;
    if (targetId === auth.user.id) return json({ error: "Administrators cannot delete their own account through this workflow" }, 400);
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetId);
    if (targetError || !target?.user) return json({ error: "The requested account no longer exists" }, 404);
    if (["admin", "super_admin"].includes(String(target.user.app_metadata?.role ?? ""))) {
      return json({ error: "Administrator accounts cannot be deleted through customer requests" }, 403);
    }
    const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", targetId).maybeSingle();
    if (profileError) throw profileError;
    if (["admin", "super_admin"].includes(String(profile?.role ?? ""))) {
      return json({ error: "Administrator accounts cannot be deleted through customer requests" }, 403);
    }

    const { data: seller, error: sellerError } = await admin.from("seller_profiles").select("id").eq("id", targetId).maybeSingle();
    if (sellerError) throw sellerError;
    if (seller) {
      const { data: wallet, error: walletError } = await admin.from("seller_wallets").select("balance").eq("seller_id", targetId).maybeSingle();
      if (walletError) throw walletError;
      if (Number(wallet?.balance ?? 0) > 0) return json({ error: "This seller still has money in their wallet. Resolve the balance and payouts before deleting the account." }, 409);
      const { data: pendingPayouts, error: payoutError } = await admin.from("payout_requests")
        .select("id").eq("seller_id", targetId).in("status", ["pending", "processing"]).limit(1);
      if (payoutError) throw payoutError;
      if (pendingPayouts?.length) return json({ error: "This seller has an unresolved payout request. Resolve it before deleting the account." }, 409);
      const { data: items, error: itemsError } = await admin.from("order_items").select("order_id").eq("seller_id", targetId);
      if (itemsError) throw itemsError;
      const orderIds = [...new Set((items ?? []).map((item: any) => item.order_id).filter(Boolean))];
      if (orderIds.length) {
        const { data: openOrders, error: ordersError } = await admin.from("orders").select("id")
          .in("id", orderIds).eq("payment_status", "paid").neq("status", "delivered").neq("status", "cancelled").limit(1);
        if (ordersError) throw ordersError;
        if (openOrders?.length) return json({ error: "This seller has paid orders that are not yet completed. Complete or resolve them before deleting the account." }, 409);
      }
      const { error: shopError } = await admin.from("shops").update({ active: false }).eq("owner_id", targetId);
      if (shopError) throw shopError;
      const { error: productError } = await admin.from("products").update({ active: false }).eq("seller_id", targetId);
      if (productError) throw productError;
    }

    const { data: objects, error: storageListError } = await admin.storage.from("product-images").list(targetId, { limit: 1000 });
    if (storageListError) throw storageListError;
    const paths = (objects ?? []).filter((item: any) => item.name && item.id).map((item: any) => targetId + "/" + item.name);
    for (let i = 0; i < paths.length; i += 100) {
      const { error: removeError } = await admin.storage.from("product-images").remove(paths.slice(i, i + 100));
      if (removeError) throw removeError;
    }

    // Foreign keys are set to NULL for retained financial/order history.
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) throw deleteError;
    const { error: completeError } = await admin.from("account_deletion_requests")
      .update({ status: "completed", processed_at: new Date().toISOString(), admin_note: "Account and personal profile deleted. Required marketplace transaction records retained without account identifiers." })
      .eq("id", requestId);
    if (completeError) throw completeError;
    return json({ success: true, deleted_user_id: targetId, retained_transaction_records: true });
  } catch (error) {
    console.error("IMSIYA account deletion processing failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not process account deletion" }, 500);
  }
});