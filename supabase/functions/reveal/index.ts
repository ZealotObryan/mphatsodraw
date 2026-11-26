import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors=(origin:string|null)=>{const allowed=new Set(["https://mphatsodraw-git.vercel.app","http://localhost:3000","http://127.0.0.1:5500"]);return {"Access-Control-Allow-Origin":origin&&allowed.has(origin)?origin:"https://mphatsodraw-git.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};};
const json=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
const sha=async(value:string)=>{const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,"0")).join("");};
Deno.serve(async(req)=>{
 const headers=cors(req.headers.get("origin"));if(req.method==="OPTIONS")return new Response("ok",{headers});if(req.method!=="POST")return json({error:"POST only"},405,headers);
 try{
  const {token}=await req.json();if(typeof token!=="string"||! /^[a-f0-9]{64}$/.test(token))return json({error:"Invalid reveal token."},400,headers);
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
  const limited=await supabase.rpc("consume_draw_rate_limit",{p_key:await sha("reveal:"+ip)});if(limited.error)throw limited.error;if(limited.data!==true)return json({error:"Too many reveal attempts. Please wait 15 minutes and try again."},429,headers);
  const {data:giver,error}=await supabase.from("draw_participants").select("display_name,recipient_id,draw_id").eq("reveal_token_hash",await sha(token)).single();
  if(error||!giver)return json({error:"This reveal link is invalid or has expired."},404,headers);
  const [{data:recipient,error:recipientErr},{data:draw,error:drawErr}]=await Promise.all([
   supabase.from("draw_participants").select("display_name").eq("id",giver.recipient_id).eq("draw_id",giver.draw_id).single(),
   supabase.from("draws").select("title,budget,currency,draw_date,message").eq("id",giver.draw_id).single()
  ]);
  if(recipientErr||drawErr||!recipient||!draw)return json({error:"Assignment unavailable."},404,headers);
  await supabase.from("draw_participants").update({revealed_at:new Date().toISOString()}).eq("reveal_token_hash",await sha(token));
  return json({giver:giver.display_name,recipient:recipient.display_name,event:draw},200,headers);
 }catch(e){console.error(e);return json({error:"Could not load this reveal."},500,headers);}
});