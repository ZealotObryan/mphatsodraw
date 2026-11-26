// MphatsoDraw — reveal Edge Function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sha = async (token: string) => { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)); return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join(""); };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { token } = await req.json();
    if (typeof token !== "string" || token.length !== 64) return json({ error: "Invalid reveal token." }, 400);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: giver, error } = await supabase.from("draw_participants").select("display_name,recipient_id,draw_id").eq("reveal_token_hash", await sha(token)).single();
    if (error || !giver) return json({ error: "This reveal link is invalid or has expired." }, 404);
    const { data: recipient } = await supabase.from("draw_participants").select("display_name").eq("id", giver.recipient_id).single();
    const { data: draw } = await supabase.from("draws").select("title,budget,currency,draw_date,message").eq("id", giver.draw_id).single();
    if (!recipient || !draw) return json({ error: "Assignment unavailable." }, 404);
    await supabase.from("draw_participants").update({ revealed_at: new Date().toISOString() }).eq("reveal_token_hash", await sha(token));
    return json({ giver: giver.display_name, recipient: recipient.display_name, event: draw });
  } catch { return json({ error: "Could not load this reveal." }, 500); }
});
