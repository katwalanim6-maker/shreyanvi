const SUPABASE_URL = "https://hlkuewtgwjgywxstzbex.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T78qEAZPPyBqAeHdmyj9Fw_WEzZBts0";

const { createClient } = window.supabase;
const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginPanel = document.querySelector("#login-panel");
const dashboardPanel = document.querySelector("#dashboard-panel");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const message = document.querySelector("#message");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = "message" + (type ? " " + type : "");
}

function showLogin() {
  dashboardPanel.style.display = "none";
  loginPanel.style.display = "block";
}

function showDashboard(email) {
  loginPanel.style.display = "none";
  dashboardPanel.style.display = "block";
  document.querySelector("#admin-email").textContent = email || "Store administrator";
}

async function verifyAdmin() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    showLogin();
    return;
  }

  const { data, error } = await client.functions.invoke("admin-check", {
    body: {}
  });

  if (error || !data?.authenticated || data?.isAdmin !== true) {
    await client.auth.signOut();
    showLogin();
    showMessage(
      data?.message || "Admin access could not be verified. Please sign in with the authorised account.",
      "error"
    );
    return;
  }

  showDashboard(session.user.email);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = "Checking access…";
  showMessage("");

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    showMessage("Sign-in failed. Check your email and password, then try again.", "error");
    loginButton.disabled = false;
    loginButton.textContent = "Sign in to store admin";
    return;
  }

  await verifyAdmin();
  loginButton.disabled = false;
  loginButton.textContent = "Sign in to store admin";
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  await client.auth.signOut();
  showLogin();
  showMessage("You have been signed out.", "success");
});

client.auth.onAuthStateChange((_event, session) => {
  if (!session) showLogin();
});

verifyAdmin().catch((error) => {
  console.error("Admin verification error:", error);
  showLogin();
  showMessage("Could not connect to the admin service. Please try again.", "error");
});