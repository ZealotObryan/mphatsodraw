import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors = (origin: string | null) => {
  const allowed = new Set(["https://mphatsodraw-git.vercel.app","http://localhost:3000","http://127.0.0.1:5500"]);
  const safe = origin && allowed.has(origin) ? origin : "https://mphatsodraw-git.vercel.app";
  return {"Access-Control-Allow-Origin":safe,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
};
const json=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
const sha=async(value:string)=>{const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,"0")).join("");};
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
const shuffle=<T>(a:T[])=>{for(let i=a.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function solve(n:number,blocked:Set<string>):number[]|null{
 const order=shuffle(Array.from({length:n},(_,i)=>i)),out=Array(n).fill(-1),used=new Set<number>();
 function dfs(k:number):boolean{if(k===n)return true;const giver=order[k];const options=shuffle(Array.from({length:n},(_,r)=>r).filter(r=>r!==giver&&!used.has(r)&&!blocked.has(giver+":"+r)));for(const r of options){out[giver]=r;used.add(r);if(dfs(k+1))return true;used.delete(r);out[giver]=-1;}return false;}
 return dfs(0)?out:null;
}
Deno.serve(async(req)=>{
 const headers=cors(req.headers.get("origin"));
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"POST only"},405,headers);
 try{
  const body=await req.json(),names=Array.isArray(body.names)?body.names.map((x:unknown)=>String(x).trim()).filter(Boolean):[];
  if(names.length<3||names.length>120)return json({error:"Add between 3 and 120 participants."},400,headers);
  if(names.some((n:string)=>n.length>80)||new Set(names.map((n:string)=>n.toLocaleLowerCase())).size!==names.length)return json({error:"Names must be unique and no longer than 80 characters."},400,headers);
  const exclusions=Array.isArray(body.exclusions)?body.exclusions:[],blocked=new Set<string>();
  for(const pair of exclusions){if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||!Number.isInteger(pair[1])||pair[0]<0||pair[1]<0||pair[0]>=names.length||pair[1]>=names.length||pair[0]===pair[1])return json({error:"Invalid exclusion pair."},400,headers);blocked.add(pair[0]+":"+pair[1]);blocked.add(pair[1]+":"+pair[0]);}
  const assignment=solve(names.length,blocked);if(!assignment)return json({error:"No valid draw with these exclusions. Remove a restriction and try again."},422,headers);
  const budget=body.budget===""||body.budget==null?null:Number(body.budget);
  if(budget!==null&&(!Number.isFinite(budget)||budget<0))return json({error:"Budget must be a non-negative number."},400,headers);
  const date=body.date?String(body.date):null;if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({error:"Enter a valid exchange date."},400,headers);
  const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase=createClient(url,key);
  const ip=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
  const limited=await supabase.rpc("consume_draw_rate_limit",{p_key:await sha("create:"+ip)});
  if(limited.error)throw limited.error;if(limited.data!==true)return json({error:"Too many draw attempts. Please wait 15 minutes and try again."},429,headers);
  const tokens=names.map(()=>token()),hashes=await Promise.all(tokens.map(sha));
  const event={title:String(body.event||"Secret Santa").slice(0,120),budget,currency:String(body.currency||"MWK").slice(0,3),draw_date:date,message:String(body.message||"").slice(0,1000)};
  const {data,error}=await supabase.rpc("create_private_draw",{p_event:event,p_names:names,p_token_hashes:hashes,p_assignment:assignment});
  if(error)throw error;
  const base=Deno.env.get("PUBLIC_APP_URL")||"https://mphatsodraw-git.vercel.app";
  return json({drawId:data.draw_id,event,revealLinks:names.map((name:string,i:number)=>({name,url:base+"/#reveal="+tokens[i]}))},200,headers);
 }catch(e){console.error(e);return json({error:"Draw could not be created. Please retry."},500,headers);}
});