// MphatsoDraw — create-draw Edge Function
// Deploy with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set as function secrets.
// This endpoint creates the draw and returns one opaque reveal URL per participant.
// It never returns the full assignment mapping.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
};
const sha = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
};
const shuffle = <T>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
function solve(n: number, blocked: Set<string>): number[] | null {
  const order = shuffle(Array.from({ length: n }, (_, i) => i));
  const out = Array(n).fill(-1), used = new Set<number>();
  function dfs(k: number): boolean {
    if (k === n) return true;
    const giver = order[k];
    const options = shuffle(Array.from({ length: n }, (_, r) => r).filter(r => r !== giver && !used.has(r) && !blocked.has(giver + ":" + r)));
    for (const r of options) { out[giver] = r; used.add(r); if (dfs(k + 1)) return true; used.delete(r); out[giver] = -1; }
    return false;
  }
  return dfs(0) ? out : null;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json();
    const names = Array.isArray(body.names) ? body.names.map((x: unknown) => String(x).trim()).filter(Boolean) : [];
    if (names.length < 3 || names.length > 120) return json({ error: "Add between 3 and 120 participants." }, 400);
    if (new Set(names.map(n => n.toLocaleLowerCase())).size !== names.length) return json({ error: "Participant names must be unique." }, 400);
    const exclusions = Array.isArray(body.exclusions) ? body.exclusions : [];
    const blocked = new Set<string>();
    for (const pair of exclusions) {
      if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || !Number.isInteger(pair[1]) || pair[0] < 0 || pair[1] < 0 || pair[0] >= names.length || pair[1] >= names.length || pair[0] === pair[1]) return json({ error: "Invalid exclusion pair." }, 400);
      blocked.add(pair[0] + ":" + pair[1]); blocked.add(pair[1] + ":" + pair[0]);
    }
    const assignment = solve(names.length, blocked);
    if (!assignment) return json({ error: "No valid draw with these exclusions. Remove a restriction and try again." }, 422);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const event = { title: String(body.event || "Secret Santa").slice(0, 120), budget: body.budget ? Number(body.budget) : null, currency: String(body.currency || "MWK").slice(0, 3), draw_date: body.date || null, message: String(body.message || "").slice(0, 1000) };
    if (event.budget !== null && (!Number.isFinite(event.budget) || event.budget < 0)) return json({ error: "Budget must be a non-negative number." }, 400);
    const { data: draw, error: drawErr } = await supabase.from("draws").insert(event).select("id").single();
    if (drawErr) throw drawErr;
    const tokens = names.map(() => randomToken());
    const rows = names.map((name, i) => ({ draw_id: draw.id, display_name: name, reveal_token_hash: "" }));
    for (let i = 0; i < rows.length; i++) rows[i].reveal_token_hash = await sha(tokens[i]);
    const { data: people, error: peopleErr } = await supabase.from("draw_participants").insert(rows).select("id,display_name");
    if (peopleErr) throw peopleErr;
    const updates = people.map((p: {id:string}, i: number) => ({ id: p.id, recipient_id: people[assignment[i]].id }));
    for (const u of updates) { const { error } = await supabase.from("draw_participants").update({ recipient_id: u.recipient_id }).eq("id", u.id); if (error) throw error; }
    return json({ drawId: draw.id, event, revealLinks: people.map((p: {display_name:string}, i: number) => ({ name: p.display_name, url: `${Deno.env.get("PUBLIC_APP_URL") || "https://mphatsodraw-git.vercel.app"}/#reveal=${tokens[i]}` })) });
  } catch (e) { console.error(e); return json({ error: "Draw could not be created. Please retry." }, 500); }
});
