const SUPABASE_URL = "https://hlkuewtgwjgywxstzbex.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T78qEAZPPyBqAeHdmyj9Fw_WEzZBts0";
const TRACKING_BASE_URL = "https://katwalanim6-maker.github.io/shreyanvi/track.html?token=";

const { createClient } = window.supabase;
const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const loginPanel = $("#login-panel");
const dashboard = $("#dashboard");
const loginForm = $("#login-form");
const loginButton = $("#login-button");
const loginMessage = $("#login-message");
const logoutButton = $("#logout-button");
const ordersList = $("#orders-list");
const statusOptions = [
  ["received", "Awaiting confirmation"], ["confirmed", "Confirmed"],
  ["preparing", "Preparing"], ["ready_for_pickup", "Ready for pickup"],
  ["out_for_delivery", "Out for delivery"], ["completed", "Completed"],
  ["cancelled", "Cancelled"]
];
const paymentOptions = [["unpaid", "Unpaid"], ["paid", "Paid"]];
const productNames = {
  b0:"Broiler B0", b1:"Broiler B1", b2:"Broiler B2", b3:"Broiler B3",
  g1:"Giriraj G1", g2:"Giriraj G2", g3:"Giriraj G3",
  cattle_feed:"Cattle feed", chockar:"Chockar"
};
let cachedOrders = [];

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = "message" + (type ? " " + type : "");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
}
function showLogin() {
  dashboard.style.display = "none";
  loginPanel.style.display = "block";
  logoutButton.classList.add("hidden");
}
function showDashboard(email) {
  loginPanel.style.display = "none";
  dashboard.style.display = "block";
  logoutButton.classList.remove("hidden");
  $("#admin-email").textContent = email || "Authorised store administrator";
}
async function verifyAdmin() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) { showLogin(); return; }
  const { data, error } = await client.functions.invoke("admin-check", { body: {} });
  if (error || !data?.authenticated || data?.isAdmin !== true) {
    await client.auth.signOut();
    showLogin();
    setMessage(loginMessage, data?.message || "Admin access could not be verified. Sign in with the authorised account.", "error");
    return;
  }
  showDashboard(session.user.email);
  await loadDashboard();
}
async function callAdmin(action, payload = {}) {
  const { data, error } = await client.functions.invoke("admin-api", { body: { action, ...payload } });
  if (error) throw new Error(data?.message || error.message || "The admin service could not be reached.");
  if (!data?.ok) throw new Error(data?.message || "The request could not be completed.");
  return data;
}
function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NP", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value));
}
function updateStats(stats = {}) {
  $("#stat-total").textContent = stats.total ?? 0;
  $("#stat-received").textContent = stats.received ?? 0;
  $("#stat-confirmed").textContent = stats.confirmed ?? 0;
  $("#stat-preparing").textContent = stats.preparing ?? 0;
  $("#stat-completed").textContent = stats.completed ?? 0;
}
async function loadDashboard() {
  ordersList.innerHTML = '<div class="empty">Loading orders…</div>';
  setMessage($("#orders-message"), "");
  try {
    const data = await callAdmin("dashboard");
    cachedOrders = Array.isArray(data.orders) ? data.orders : [];
    updateStats(data.stats);
    renderOrders();
  } catch (error) {
    ordersList.innerHTML = '<div class="empty">Orders could not be loaded.</div>';
    setMessage($("#orders-message"), error.message, "error");
  }
}
function optionMarkup(options, selected) {
  return options.map(([value, label]) =>
    '<option value="' + value + '"' + (value === selected ? " selected" : "") + ">" + label + "</option>"
  ).join("");
}
function renderOrders() {
  const query = $("#order-search").value.trim().toLowerCase();
  const filtered = cachedOrders.filter(order => [
    order.order_number, order.customer_name, order.customer_phone
  ].some(value => String(value || "").toLowerCase().includes(query)));
  if (!filtered.length) {
    ordersList.innerHTML = '<div class="empty">' + (cachedOrders.length ? "No orders match your search." : "No orders yet. Confirm a customer request, then create the first order.") + "</div>";
    return;
  }
  ordersList.innerHTML = filtered.map(order => {
    const items = (order.items || []).map(item =>
      escapeHtml(item.product_name) + " · " + escapeHtml(item.quantity) + " " +
      (item.unit === "50kg_sack" ? "× 50 kg sack" : "kg")
    ).join("<br>");
    const fulfillment = order.fulfillment_method === "delivery" ? "Home delivery" : "Store pickup";
    const payment = order.payment_method === "qr" ? "QR payment" : "Cash";
    return '<article class="order" data-order-id="' + escapeHtml(order.id) + '">' +
      '<div class="order-top"><div><div class="order-number">' + escapeHtml(order.order_number) + '</div>' +
      '<div class="order-date">' + escapeHtml(formatDate(order.created_at)) + '</div></div>' +
      '<div class="order-date">' + escapeHtml(fulfillment) + '</div></div>' +
      '<div class="order-customer">' + escapeHtml(order.customer_name) + '</div>' +
      '<div class="order-meta">' + escapeHtml(order.customer_phone) + ' · ' + escapeHtml(payment) + '</div>' +
      (order.delivery_address ? '<div class="order-meta">' + escapeHtml(order.delivery_address) + '</div>' : '') +
      '<div class="order-items">' + (items || "No item details") + '</div>' +
      (order.customer_note ? '<div class="order-meta">Note: ' + escapeHtml(order.customer_note) + '</div>' : '') +
      '<div class="order-controls"><div><label>Order status</label><select class="status-select">' + optionMarkup(statusOptions, order.status) + '</select></div>' +
      '<div><label>Payment</label><select class="payment-select">' + optionMarkup(paymentOptions, order.payment_status) + '</select></div>' +
      '<button class="btn btn-small save-order" type="button">Save</button></div></article>';
  }).join("");
}
function updateItemRemoveButtons() {
  const rows = $$(".item-row", $("#item-list"));
  rows.forEach(row => { $(".remove-item", row).disabled = rows.length === 1; });
}
function addItemRow() {
  const first = $(".item-row", $("#item-list"));
  const row = first.cloneNode(true);
  $(".item-quantity", row).value = "1";
  $(".item-unit", row).value = "50kg_sack";
  $("#item-list").append(row);
  updateItemRemoveButtons();
}
$("#item-list").addEventListener("click", event => {
  if (event.target.closest(".remove-item")) {
    event.target.closest(".item-row").remove();
    updateItemRemoveButtons();
  }
});
$("#add-item").addEventListener("click", addItemRow);
$("#fulfillment").addEventListener("change", () => {
  $("#address-wrap").classList.toggle("hidden", $("#fulfillment").value !== "delivery");
});
$("#order-search").addEventListener("input", renderOrders);
$("#refresh-button").addEventListener("click", loadDashboard);

$("#create-order-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("#create-button");
  const items = $$(".item-row", $("#item-list")).map(row => ({
    product_code: $(".product-code", row).value,
    unit: $(".item-unit", row).value,
    quantity: Number($(".item-quantity", row).value)
  }));
  const payload = {
    customer_name: $("#customer-name").value.trim(),
    customer_phone: $("#customer-phone").value.trim(),
    fulfillment_method: $("#fulfillment").value,
    delivery_address: $("#delivery-address").value.trim(),
    payment_method: $("#payment-method").value,
    customer_note: $("#customer-note").value.trim(),
    items
  };
  if (payload.fulfillment_method === "delivery" && !payload.delivery_address) {
    setMessage($("#create-message"), "Enter the delivery address for a delivery order.", "error");
    return;
  }
  if (items.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0 ||
      (item.unit === "kg" && (item.quantity < 0.5 || Math.round(item.quantity * 2) !== item.quantity * 2)) ||
      (item.unit === "50kg_sack" && !Number.isInteger(item.quantity)))) {
    setMessage($("#create-message"), "Check quantities. Loose feed must be at least 0.5 kg in 0.5 kg steps; sacks must be whole numbers.", "error");
    return;
  }
  button.disabled = true;
  button.textContent = "Creating order…";
  setMessage($("#create-message"), "");
  $("#created-result").style.display = "none";
  try {
    const data = await callAdmin("create-order", payload);
    const link = data.tracking_url;
    const result = $("#created-result");
    const phoneDigits = payload.customer_phone.replace(/\\D/g, "");
    const waNumber = phoneDigits.startsWith("977") ? phoneDigits :
      phoneDigits.startsWith("0") ? "977" + phoneDigits.slice(1) :
      phoneDigits.length === 10 ? "977" + phoneDigits : phoneDigits;
    const waText = "Hello " + payload.customer_name + ", your Shreyanvi Suppliers order " +
      data.order_number + " has been created. Track its progress here: " + link;
    const whatsappUrl = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(waText);
    result.innerHTML = '<strong>Order ' + escapeHtml(data.order_number) + ' created.</strong><br>' +
      'Private tracking link:<br><a href="' + escapeHtml(link) + '" target="_blank" rel="noopener">' + escapeHtml(link) + '</a><br>' +
      '<button type="button" class="btn btn-small" id="copy-tracking" style="margin:10px 6px 0 0">Copy tracking link</button>' +
      '<a class="btn btn-small" style="display:inline-block;margin-top:10px;text-decoration:none" href="' + escapeHtml(whatsappUrl) + '" target="_blank" rel="noopener">Open WhatsApp message</a>';
    result.style.display = "block";
    $("#copy-tracking").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); $("#copy-tracking").textContent = "Copied"; }
      catch { $("#copy-tracking").textContent = "Copy unavailable — select the link"; }
    });
    $("#create-order-form").reset();
    $("#item-list").innerHTML = firstItemTemplate();
    $("#address-wrap").classList.add("hidden");
    updateItemRemoveButtons();
    setMessage($("#create-message"), "Order saved successfully. Copy the link above and send it to the customer.", "success");
    await loadDashboard();
  } catch (error) {
    setMessage($("#create-message"), error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Create order & generate tracking link";
  }
});
function firstItemTemplate() {
  return '<div class="item-row"><div><label>Product</label><select class="product-code">' +
    Object.entries(productNames).map(([code,name]) => '<option value="' + code + '">' + name + '</option>').join("") +
    '</select></div><div><label>Pack type</label><select class="item-unit"><option value="50kg_sack">50 kg sack</option><option value="kg">Loose (kg)</option></select></div>' +
    '<div><label>Quantity</label><input class="item-quantity" type="number" min="0.5" step="0.5" value="1" required></div>' +
    '<button class="remove-item" type="button" aria-label="Remove item" disabled>×</button></div>';
}
ordersList.addEventListener("click", async event => {
  const button = event.target.closest(".save-order");
  if (!button) return;
  const card = button.closest(".order");
  const order_id = card.dataset.orderId;
  const status = $(".status-select", card).value;
  const payment_status = $(".payment-select", card).value;
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    await callAdmin("update-order", { order_id, status, payment_status });
    setMessage($("#orders-message"), "Order updated.", "success");
    await loadDashboard();
  } catch (error) {
    setMessage($("#orders-message"), error.message, "error");
    button.disabled = false;
    button.textContent = "Save";
  }
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = "Checking access…";
  setMessage(loginMessage, "");
  const { error } = await client.auth.signInWithPassword({
    email: $("#email").value.trim(),
    password: $("#password").value
  });
  if (error) {
    setMessage(loginMessage, "Sign-in failed. Check your email and password, then try again.", "error");
    loginButton.disabled = false;
    loginButton.textContent = "Sign in to store admin";
    return;
  }
  try { await verifyAdmin(); }
  catch (error) { showLogin(); setMessage(loginMessage, error.message, "error"); }
  loginButton.disabled = false;
  loginButton.textContent = "Sign in to store admin";
});
logoutButton.addEventListener("click", async () => {
  await client.auth.signOut();
  showLogin();
  setMessage(loginMessage, "You have been signed out.", "success");
});
client.auth.onAuthStateChange((_event, session) => {
  if (!session) showLogin();
});
verifyAdmin().catch(error => {
  console.error("Admin startup error:", error);
  showLogin();
  setMessage(loginMessage, "Could not connect to the admin service. Please refresh and try again.", "error");
});
