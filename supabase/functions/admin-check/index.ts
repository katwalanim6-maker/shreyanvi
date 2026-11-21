import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const apiKey = req.headers.get("apikey") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const supabaseKey = publishableKeys.default ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Admin verification is temporarily unavailable." }, 500);
    }
    if (!authorization.startsWith("Bearer ") || !apiKey) {
      return json({ error: "Authentication required." }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Invalid login session." }, 401);

    const { data: isAdmin, error } = await supabase.rpc("is_store_admin");
    if (error) {
      console.error("Admin permission check failed:", error.message);
      return json({ error: "Permission check failed." }, 500);
    }

    return json({
      authenticated: true,
      isAdmin: isAdmin === true,
      message: isAdmin === true
        ? "Shreyanvi admin access verified."
        : "This account does not have store admin permission."
    });
  } catch (error) {
    console.error("Admin check error:", error);
    return json({ error: "Unexpected verification error." }, 500);
  }
});
