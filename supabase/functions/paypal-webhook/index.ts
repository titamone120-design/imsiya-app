import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
async function getToken(base:string,id:string,secret:string){
 const r=await fetch(base+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+btoa(id+":"+secret),"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
 const j=await r.json();if(!r.ok||!j.access_token)throw new Error("PayPal authentication failed");return j.access_token as string;
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const id=Deno.env.get("PAYPAL_CLIENT_ID")!,secret=Deno.env.get("PAYPAL_CLIENT_SECRET")!,webhookId=Deno.env.get("PAYPAL_WEBHOOK_ID")!;
  if(!url||!service||!id||!secret||!webhookId)throw new Error("PayPal webhook is not configured yet");
  const sandbox=(Deno.env.get("PAYPAL_ENV")??"sandbox").toLowerCase()!=="live";
  const base=sandbox?"https://api-m.sandbox.paypal.com":"https://api-m.paypal.com";
  const raw=await req.text();const event=JSON.parse(raw);
  const h=req.headers;
  const headers={
   auth_algo:h.get("paypal-auth-algo"),cert_url:h.get("paypal-cert-url"),
   transmission_id:h.get("paypal-transmission-id"),transmission_sig:h.get("paypal-transmission-sig"),
   transmission_time:h.get("paypal-transmission-time")
  };
  if(Object.values(headers).some(v=>!v))return reply({error:"Missing PayPal signature headers"},400);
  const t=await getToken(base,id,secret);
  const verify=await fetch(base+"/v1/notifications/verify-webhook-signature",{
   method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},
   body:JSON.stringify({...headers,webhook_id:webhookId,webhook_event:event})
  });
  const verdict=await verify.json();
  if(!verify.ok||verdict.verification_status!=="SUCCESS"){
   console.error("PayPal webhook signature rejected",verdict);return reply({error:"Invalid PayPal webhook signature"},401);
  }
  const type=String(event.event_type??""),resource=event.resource??{};
  const subscriptionId=type==="PAYMENT.SALE.COMPLETED"
   ?(resource.billing_agreement_id??resource.supplementary_data?.related_ids?.billing_agreement_id)
   :resource.id;
  const supported=["PAYMENT.SALE.COMPLETED","BILLING.SUBSCRIPTION.CANCELLED","BILLING.SUBSCRIPTION.EXPIRED","BILLING.SUBSCRIPTION.SUSPENDED","BILLING.SUBSCRIPTION.PAYMENT.FAILED"];
  if(supported.includes(type)&&subscriptionId){
   const admin=createClient(url,service);
   const {error}=await admin.rpc("process_paypal_shop_event",{p_event_id:event.id,p_event_type:type,p_subscription_id:subscriptionId});
   if(error)throw error;
  }
  return reply({received:true});
 }catch(e){console.error("PayPal webhook error",e);return reply({error:e instanceof Error?e.message:"Webhook processing failed"},500);}
});