import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...cors,"Content-Type":"application/json"}});
async function token(base:string,id:string,secret:string){
 const r=await fetch(base+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+btoa(id+":"+secret),"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
 const j=await r.json(); if(!r.ok||!j.access_token) throw new Error("PayPal authentication failed"); return j.access_token as string;
}
async function pp(base:string,t:string,path:string,method="GET",body?:unknown){
 const r=await fetch(base+path,{method,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json(); if(!r.ok) {console.error("PayPal API error",j);throw new Error("PayPal subscription setup failed");} return j;
}
async function saveConfig(admin:any,key:string,value:string){
 const {error}=await admin.from("paypal_billing_config").upsert({config_key:key,config_value:value,updated_at:new Date().toISOString()});
 if(error){console.error("Could not save PayPal billing config",key,error);throw new Error("PayPal plan was created but IMSIYA could not save its ID. Please contact support; no subscription charge was made.");}
 const {data, error:readError}=await admin.from("paypal_billing_config").select("config_value").eq("config_key",key).maybeSingle();
 if(readError||data?.config_value!==value){console.error("PayPal billing config verification failed",key,readError);throw new Error("IMSIYA could not verify the saved PayPal plan. No subscription charge was made.");}
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return out({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const id=Deno.env.get("PAYPAL_CLIENT_ID")!, secret=Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  if(!url||!anon||!service||!id||!secret) throw new Error("Payment configuration is incomplete");
  const authorization=req.headers.get("Authorization"); if(!authorization?.startsWith("Bearer ")) return out({error:"Please sign in first"},401);
  const uc=createClient(url,anon,{global:{headers:{Authorization:authorization}}}); const {data:a,error:ae}=await uc.auth.getUser();
  if(ae||!a.user) return out({error:"Invalid login session"},401);
  const body=await req.json();
  const admin=createClient(url,service);
  if(body.action==="setup_plan_only"){
    const {data:profile,error:profileError}=await admin.from("profiles").select("role").eq("id",a.user.id).maybeSingle();
    if(profileError) throw profileError;
    if(profile?.role!=="super_admin") return out({error:"Admin access required"},403);
    if((Deno.env.get("PAYPAL_ENV")??"").toLowerCase()!=="live") throw new Error("PayPal LIVE is not configured; no plan was created.");
    const base="https://api-m.paypal.com", t=await token(base,id,secret);
    let productId="", planId=Deno.env.get("PAYPAL_SUBSCRIPTION_PLAN_ID")??"";
    const {data:cfg,error:cfgError}=await admin.from("paypal_billing_config").select("config_key,config_value");
    if(cfgError) throw new Error("Could not read PayPal billing configuration");
    for(const row of (cfg??[])){ if(row.config_key==="live_product_id") productId=row.config_value; if(row.config_key==="live_plan_id"&&!planId) planId=row.config_value; }
    if(planId){
      const verified=await pp(base,t,"/v1/billing/plans/"+encodeURIComponent(planId));
      if(verified.status!=="ACTIVE") throw new Error("Configured PayPal LIVE plan is not ACTIVE");
      await saveConfig(admin,"live_plan_id",planId);
      return out({success:true,created:false,plan_id:planId,status:verified.status,amount:"20.00",currency:"USD"});
    }
    if(!productId){
      const product=await pp(base,t,"/v1/catalogs/products","POST",{name:"IMSIYA Seller Shop Subscription",description:"Monthly IMSIYA shop access",type:"SERVICE",category:"SOFTWARE"});
      productId=product.id;
      if(!productId) throw new Error("PayPal did not return a product ID");
      await saveConfig(admin,"live_product_id",productId);
    }
    const plan=await pp(base,t,"/v1/billing/plans","POST",{
      product_id:productId,name:"IMSIYA Shop - $20 monthly",description:"Monthly subscription to keep an IMSIYA seller shop active",status:"ACTIVE",
      billing_cycles:[{frequency:{interval_unit:"MONTH",interval_count:1},tenure_type:"REGULAR",sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:"20.00",currency_code:"USD"}}}],
      payment_preferences:{auto_bill_outstanding:true,setup_fee_failure_action:"CONTINUE",payment_failure_threshold:3}
    });
    planId=plan.id;
    if(!planId) throw new Error("PayPal did not return a subscription plan ID");
    await saveConfig(admin,"live_plan_id",planId);
    return out({success:true,created:true,plan_id:planId,product_id:productId,status:plan.status,amount:"20.00",currency:"USD"});
  }
  const shopId=body.shop_id;
  if(typeof shopId!=="string") return out({error:"shop_id is required"},400);
  const {data:shop,error:se}=await admin.from("shops").select("id,owner_id,shop_name").eq("id",shopId).eq("owner_id",a.user.id).maybeSingle();
  if(se) throw se; if(!shop) return out({error:"Shop not found or not owned by you"},403);
  const {data:seller,error:sellerError}=await admin.from("seller_profiles").select("approved").eq("id",a.user.id).maybeSingle();
  if(sellerError) throw sellerError; if(!seller?.approved) return out({error:"Dukaanka waa inuu marka hore maamulka oggolaadaa."},403);
  const {data:active}=await admin.from("shop_subscriptions").select("id").eq("shop_id",shopId).eq("status","paid").gt("expires_at",new Date().toISOString()).limit(1);
  if(active?.length) return out({error:"Dukaankaagu hore ayuu u leeyahay subscription shaqaynaya."},409);
  const paypalEnv=(Deno.env.get("PAYPAL_ENV")??"").toLowerCase();
  if(paypalEnv!=="live") throw new Error("PayPal LIVE is not configured; sandbox payments are disabled for IMSIYA.");
  const sandbox=false;
  const base="https://api-m.paypal.com";
  const t=await token(base,id,secret);

  // If the seller returns from PayPal without approving, reopen the same
  // approval link instead of blocking them or creating a second recurring plan.
  const {data:pendingSubscription,error:pendingError}=await admin.from("shop_subscriptions")
    .select("id,paypal_subscription_id")
    .eq("shop_id",shopId)
    .eq("status","pending")
    .order("created_at",{ascending:false})
    .limit(1)
    .maybeSingle();
  if(pendingError) throw new Error("Could not check for an existing pending subscription");
  if(pendingSubscription) {
    if(!pendingSubscription.paypal_subscription_id) {
      return out({error:"Your previous PayPal request needs support review before another subscription can be started.",pending:true},409);
    }
    const existing=await pp(base,t,"/v1/billing/subscriptions/"+encodeURIComponent(pendingSubscription.paypal_subscription_id));
    if(existing.status==="APPROVAL_PENDING") {
      const existingApproval=(existing.links??[]).find((x:any)=>x.rel==="approve")?.href;
      if(existingApproval) {
        return out({success:true,approval_url:existingApproval,subscription_id:existing.id,amount:"20.00",currency:"USD",reused:true});
      }
      return out({error:"PayPal is still waiting for approval. Please try again shortly or contact IMSIYA support.",pending:true},409);
    }
    if(existing.status==="APPROVED"||existing.status==="ACTIVE") {
      return out({error:"PayPal has received your approval. IMSIYA is waiting for payment confirmation; please do not start another subscription.",pending:true},409);
    }
    if(existing.status==="CANCELLED"||existing.status==="EXPIRED") {
      const {error:updatePendingError}=await admin.from("shop_subscriptions")
        .update({status:existing.status.toLowerCase()})
        .eq("id",pendingSubscription.id)
        .eq("status","pending");
      if(updatePendingError) throw new Error("Could not close the old PayPal request safely");
    } else {
      return out({error:"Your PayPal subscription is being checked. Please wait for confirmation before trying again.",pending:true},409);
    }
  }
  let planId=Deno.env.get("PAYPAL_SUBSCRIPTION_PLAN_ID")??"";
  if(!planId){
    const {data:cfg,error:cfgError}=await admin.from("paypal_billing_config").select("config_value").eq("config_key",sandbox?"sandbox_plan_id":"live_plan_id").maybeSingle();
    if(cfgError) throw new Error("Could not read PayPal billing configuration");
    planId=cfg?.config_value??"";
  }
  if(!planId){
    let productId="";
    const {data:prodCfg,error:prodCfgError}=await admin.from("paypal_billing_config").select("config_value").eq("config_key",sandbox?"sandbox_product_id":"live_product_id").maybeSingle();
    if(prodCfgError) throw new Error("Could not read PayPal product configuration");
    productId=prodCfg?.config_value??"";
    if(!productId){
      const product=await pp(base,t,"/v1/catalogs/products","POST",{name:"IMSIYA Seller Shop Subscription",description:"Monthly IMSIYA shop access",type:"SERVICE",category:"SOFTWARE"});
      productId=product.id;
      if(!productId) throw new Error("PayPal did not return a product ID");
      await saveConfig(admin,sandbox?"sandbox_product_id":"live_product_id",productId);
    }
    const plan=await pp(base,t,"/v1/billing/plans","POST",{
      product_id:productId,name:"IMSIYA Shop - $20 monthly",description:"Monthly subscription to keep an IMSIYA seller shop active",status:"ACTIVE",
      billing_cycles:[{frequency:{interval_unit:"MONTH",interval_count:1},tenure_type:"REGULAR",sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:"20.00",currency_code:"USD"}}}],
      payment_preferences:{auto_bill_outstanding:true,setup_fee_failure_action:"CONTINUE",payment_failure_threshold:3}
    });
    planId=plan.id;
    if(!planId) throw new Error("PayPal did not return a subscription plan ID");
    await saveConfig(admin,sandbox?"sandbox_plan_id":"live_plan_id",planId);
  }
  const sub=await pp(base,t,"/v1/billing/subscriptions","POST",{
    plan_id:planId,custom_id:shopId,subscriber:{...(a.user.email?{email_address:a.user.email}:{})},
    application_context:{brand_name:"IMSIYA",locale:"en-KE",user_action:"SUBSCRIBE_NOW",payment_method:{payer_selected:"PAYPAL",payee_preferred:"IMMEDIATE_PAYMENT_REQUIRED"},return_url:body.platform==="web"?"https://titamone120-design.github.io/imsiya-app/?imsiya_payment=subscription":"imsiya://subscription-success",cancel_url:body.platform==="web"?"https://titamone120-design.github.io/imsiya-app/?imsiya_payment=subscription-cancel":"imsiya://subscription-cancel"}
  });
  const approve=(sub.links??[]).find((x:any)=>x.rel==="approve")?.href;
  if(!sub.id||!approve) throw new Error("PayPal did not return subscription approval link");
  const {error:insertError}=await admin.from("shop_subscriptions").insert({
    shop_id:shopId,amount:20,currency:"USD",status:"pending",payment_reference:sub.id,
    paypal_subscription_id:sub.id,paypal_plan_id:planId
  });
  if(insertError) throw insertError;
  return out({success:true,approval_url:approve,subscription_id:sub.id,amount:"20.00",currency:"USD"});
 }catch(e){console.error("PayPal subscription creation error",e);return out({error:e instanceof Error?e.message:"Could not create PayPal subscription"},500);}
});