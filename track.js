const SUPABASE_URL = "https://hlkuewtgwjgywxstzbex.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T78qEAZPPyBqAeHdmyj9Fw_WEzZBts0";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const content = document.querySelector("#tracking-content");
const labels = {
  received:"Order received", confirmed:"Order confirmed", preparing:"Preparing your order",
  ready_for_pickup:"Ready for pickup", out_for_delivery:"Out for delivery",
  completed:"Order completed", cancelled:"Order cancelled"
};
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}
function date(value) {
  return value ? new Intl.DateTimeFormat("en-NP",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)) : "";
}
async function loadTracking() {
  const token = new URLSearchParams(location.search).get("token") || "";
  if (!token) { content.textContent = "This tracking link is missing its private token. Please ask the store for a fresh link."; return; }
  const { data, error } = await client.functions.invoke("public-track", { body:{ token } });
  if (error || !data?.ok || !data.order) {
    content.textContent = data?.message || "We could not load this order. Please check the link or contact the store.";
    return;
  }
  const order = data.order;
  const items = (order.items || []).map(item =>
    "<div>" + esc(item.product_name) + " · " + esc(item.quantity) + " " +
    (item.unit === "50kg_sack" ? "× 50 kg sack" : "kg") + "</div>"
  ).join("");
  const history = order.history || [];
  const historyHtml = history.length ? history.map((entry,index) =>
    '<div class="step ' + (index === history.length - 1 ? "current" : "") + '">' +
    '<span class="dot"></span><strong>' + esc(labels[entry.status] || entry.status) + '</strong>' +
    '<small>' + esc(date(entry.created_at)) + '</small>' +
    (entry.note ? '<div class="muted">' + esc(entry.note) + '</div>' : '') + '</div>'
  ).join("") : '<div class="step current"><span class="dot"></span><strong>' +
    esc(labels[order.status] || order.status) + '</strong><small>Latest update</small></div>';
  content.className = "";
  content.innerHTML =
    '<div class="status"><span class="muted">Order number</span><strong>' + esc(order.order_number) +
    '</strong><span class="muted">' + (order.fulfillment_method === "delivery" ? "Home delivery" : "Store pickup") +
    ' · Last updated ' + esc(date(order.updated_at)) + '</span></div>' +
    '<div class="section"><h2>Items in your order</h2><div class="items">' + (items || "Item details unavailable") + '</div></div>' +
    '<div class="section"><h2>Progress</h2><div class="timeline">' + historyHtml + '</div></div>';
}
loadTracking().catch(() => { content.textContent = "The tracking service is temporarily unavailable. Please try again later."; });
