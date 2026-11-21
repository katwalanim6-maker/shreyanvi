import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers:corsHeaders });
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:corsHeaders });
  if (req.method !== "POST") return json({ ok:false, message:"Method not allowed." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[a-f0-9]{64}$/i.test(token)) return json({ ok:false, message:"This tracking link is invalid or incomplete." }, 400);

    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !secretKey) return json({ ok:false, message:"Tracking service is temporarily unavailable." }, 500);
    const admin = createClient(supabaseUrl, secretKey, { auth:{ persistSession:false, autoRefreshToken:false } });
    const tokenHash = await sha256(token);

    const { data: order, error } = await admin.from("orders")
      .select("id,order_number,status,fulfillment_method,created_at,updated_at")
      .eq("tracking_token_hash", tokenHash).maybeSingle();
    if (error) return json({ ok:false, message:"Could not look up this order." }, 500);
    if (!order) return json({ ok:false, message:"No order was found for this tracking link." }, 404);

    const [itemsResult, historyResult] = await Promise.all([
      admin.from("order_items").select("product_name,unit,quantity").eq("order_id", order.id),
      admin.from("order_status_history").select("status,note,created_at").eq("order_id", order.id).order("created_at", { ascending:true })
    ]);
    if (itemsResult.error || historyResult.error) return json({ ok:false, message:"Order details are temporarily unavailable." }, 500);
    return json({
      ok:true,
      order:{
        order_number:order.order_number, status:order.status,
        fulfillment_method:order.fulfillment_method, created_at:order.created_at,
        updated_at:order.updated_at, items:itemsResult.data || [],
        history:historyResult.data || []
      }
    });
  } catch (error) {
    console.error("public-track error:", error);
    return json({ ok:false, message:"Unexpected tracking error. Please try again later." }, 500);
  }
});
