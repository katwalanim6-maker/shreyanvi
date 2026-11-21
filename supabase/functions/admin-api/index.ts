import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const statuses = ["received", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "completed", "cancelled"];
const paymentStatuses = ["unpaid", "paid"];
const products: Record<string, string> = {
  b0:"Broiler B0", b1:"Broiler B1", b2:"Broiler B2", b3:"Broiler B3",
  g1:"Giriraj G1", g2:"Giriraj G2", g3:"Giriraj G3",
  cattle_feed:"Cattle feed", chockar:"Chockar"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
function randomHex(bytes: number) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map(value => value.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}
function requiredString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok:false, message:"Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const publishableKey = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishableKey || !secretKey) {
      return json({ ok:false, message:"Server configuration is incomplete. Ask the project owner to check Edge Function secrets." }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ ok:false, message:"Please sign in again." }, 401);
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession:false, autoRefreshToken:false }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ ok:false, message:"Your session is invalid. Please sign in again." }, 401);

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_store_admin");
    if (adminError || isAdmin !== true) return json({ ok:false, message:"This account is not authorised for store administration." }, 403);

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession:false, autoRefreshToken:false }
    });
    const body = await req.json().catch(() => ({}));
    const action = requiredString(body.action, 40);

    if (action === "dashboard") {
      const [ordersResult, totalResult, receivedResult, confirmedResult, preparingResult, completedResult] = await Promise.all([
        admin.from("orders").select("id,order_number,customer_name,customer_phone,fulfillment_method,delivery_address,payment_method,payment_status,status,customer_note,created_at,updated_at").order("created_at", { ascending:false }).limit(200),
        admin.from("orders").select("id", { count:"exact", head:true }),
        admin.from("orders").select("id", { count:"exact", head:true }).eq("status", "received"),
        admin.from("orders").select("id", { count:"exact", head:true }).eq("status", "confirmed"),
        admin.from("orders").select("id", { count:"exact", head:true }).eq("status", "preparing"),
        admin.from("orders").select("id", { count:"exact", head:true }).eq("status", "completed")
      ]);
      const firstError = ordersResult.error || totalResult.error || receivedResult.error || confirmedResult.error || preparingResult.error || completedResult.error;
      if (firstError) return json({ ok:false, message:"Could not load orders: " + firstError.message }, 500);
      const orders = ordersResult.data || [];
      const ids = orders.map(order => order.id);
      let itemsByOrder: Record<string, unknown[]> = {};
      if (ids.length) {
        const { data: items, error } = await admin.from("order_items")
          .select("order_id,product_code,product_name,unit,quantity,unit_price,line_total")
          .in("order_id", ids);
        if (error) return json({ ok:false, message:"Could not load order items: " + error.message }, 500);
        for (const item of items || []) {
          (itemsByOrder[item.order_id] ||= []).push(item);
        }
      }
      return json({
        ok:true,
        stats:{
          total:totalResult.count || 0, received:receivedResult.count || 0,
          confirmed:confirmedResult.count || 0, preparing:preparingResult.count || 0,
          completed:completedResult.count || 0
        },
        orders:orders.map(order => ({ ...order, items:itemsByOrder[order.id] || [] }))
      });
    }

    if (action === "create-order") {
      const customer_name = requiredString(body.customer_name, 100);
      const customer_phone = requiredString(body.customer_phone, 30);
      const fulfillment_method = body.fulfillment_method;
      const delivery_address = requiredString(body.delivery_address, 500);
      const payment_method = body.payment_method;
      const customer_note = requiredString(body.customer_note, 1000);
      if (!customer_name || !customer_phone) return json({ ok:false, message:"Customer name and phone number are required." }, 400);
      if (!["pickup", "delivery"].includes(fulfillment_method)) return json({ ok:false, message:"Choose pickup or delivery." }, 400);
      if (fulfillment_method === "delivery" && !delivery_address) return json({ ok:false, message:"A delivery address is required." }, 400);
      if (!["cash", "qr"].includes(payment_method)) return json({ ok:false, message:"Choose cash or QR payment." }, 400);
      if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) return json({ ok:false, message:"Add between 1 and 20 order items." }, 400);

      const normalizedItems = [];
      for (const item of body.items) {
        const product_code = requiredString(item.product_code, 30);
        const unit = item.unit;
        const quantity = Number(item.quantity);
        if (!products[product_code]) return json({ ok:false, message:"An item has an invalid product." }, 400);
        if (!["kg", "50kg_sack"].includes(unit) || !Number.isFinite(quantity) || quantity <= 0) {
          return json({ ok:false, message:"An item has an invalid unit or quantity." }, 400);
        }
        if (unit === "kg" && (quantity < 0.5 || Math.round(quantity * 2) !== quantity * 2)) {
          return json({ ok:false, message:"Loose feed must be at least 0.5 kg and use 0.5 kg steps." }, 400);
        }
        if (unit === "50kg_sack" && !Number.isInteger(quantity)) {
          return json({ ok:false, message:"Sack quantities must be whole numbers." }, 400);
        }
        normalizedItems.push({
          product_code, product_name:products[product_code], unit, quantity,
          unit_price:null, line_total:null
        });
      }

      const token = randomHex(32);
      const tracking_token_hash = await sha256(token);
      const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      const order_number = "SH-" + datePart + "-" + randomHex(3).toUpperCase();
      const { data: order, error: orderError } = await admin.from("orders").insert({
        order_number, tracking_token_hash, customer_name, customer_phone,
        fulfillment_method, delivery_address:fulfillment_method === "delivery" ? delivery_address : null,
        payment_method, payment_status:"unpaid", status:"received", customer_note:customer_note || null
      }).select("id,order_number").single();
      if (orderError) return json({ ok:false, message:"Could not create order: " + orderError.message }, 500);

      const { error: itemsError } = await admin.from("order_items").insert(
        normalizedItems.map(item => ({ ...item, order_id:order.id }))
      );
      if (itemsError) {
        await admin.from("orders").delete().eq("id", order.id);
        return json({ ok:false, message:"Order items could not be saved. No partial order was kept." }, 500);
      }
      const tracking_url = "https://katwalanim6-maker.github.io/shreyanvi/track.html?token=" + token;
      return json({ ok:true, order_number:order.order_number, tracking_url });
    }

    if (action === "update-order") {
      const order_id = requiredString(body.order_id, 60);
      const patch: Record<string, string> = {};
      if (body.status !== undefined) {
        if (!statuses.includes(body.status)) return json({ ok:false, message:"Invalid order status." }, 400);
        patch.status = body.status;
      }
      if (body.payment_status !== undefined) {
        if (!paymentStatuses.includes(body.payment_status)) return json({ ok:false, message:"Invalid payment status." }, 400);
        patch.payment_status = body.payment_status;
      }
      if (!order_id || !Object.keys(patch).length) return json({ ok:false, message:"Choose an order and at least one field to update." }, 400);
      const { data, error } = await admin.from("orders").update(patch).eq("id", order_id)
        .select("id,order_number,status,payment_status").single();
      if (error) return json({ ok:false, message:"Could not update order: " + error.message }, 500);
      return json({ ok:true, order:data });
    }

    return json({ ok:false, message:"Unknown admin action." }, 400);
  } catch (error) {
    console.error("admin-api error:", error);
    return json({ ok:false, message:"Unexpected server error. Check the Edge Function logs." }, 500);
  }
});
