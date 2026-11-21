(() => {
  const phone = "9779700068407";
  const cards = [...document.querySelectorAll(".product-card")];
  if (!cards.length) return;

  const cart = [];
  const moneySafe = (value) => String(value).replace(/[<>&"]/g, "");
  const panel = document.createElement("section");
  panel.className = "shopping-cart-panel section-shell";
  panel.innerHTML = `
    <div class="cart-heading"><div><div class="eyebrow"><span></span> YOUR SELECTION</div><h2>Your <em>cart.</em></h2></div><span class="cart-count" id="cartCount">0 items</span></div>
    <div id="cartItems" class="cart-items"><p class="cart-empty">Your cart is empty. Add feed from the catalogue above.</p></div>
    <div class="cart-bottom"><strong id="cartSummary">0 items selected</strong><button class="button button-light" id="checkoutButton" type="button" disabled>Continue to WhatsApp <span>↗</span></button></div>
  `;
  document.querySelector(".product-catalogue").append(panel);

  const checkout = document.createElement("dialog");
  checkout.className = "checkout-dialog";
  checkout.innerHTML = `
    <form id="checkoutForm" class="checkout-form">
      <div class="checkout-top"><div><div class="eyebrow"><span></span> FINAL STEP</div><h2>Order <em>details.</em></h2></div><button class="dialog-close" type="button" aria-label="Close">×</button></div>
      <label>Your name<input name="customerName" autocomplete="name" required maxlength="80" placeholder="Enter your name"></label>
      <label>Phone number<input name="customerPhone" type="tel" autocomplete="tel" required maxlength="20" placeholder="Your contact number"></label>
      <label>How would you like to receive your order?
        <select name="fulfilment" required><option value="Store pickup">Store pickup</option><option value="Home delivery">Home delivery</option></select>
      </label>
      <label id="addressField" hidden>Delivery address<textarea name="address" rows="2" maxlength="300" placeholder="Enter your delivery address"></textarea></label>
      <p class="checkout-hint">Your order will be sent to Shreeyanvi Suppliers on WhatsApp. The store will confirm availability and pricing with you.</p>
      <button class="button button-light checkout-submit" type="submit">Send order on WhatsApp <span>↗</span></button>
    </form>`;
  document.body.append(checkout);

  function renderCart() {
    const list = document.querySelector("#cartItems");
    list.replaceChildren();
    if (!cart.length) {
      list.innerHTML = '<p class="cart-empty">Your cart is empty. Add feed from the catalogue above.</p>';
    } else {
      cart.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "cart-row";
        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = item.name;
        const subtitle = document.createElement("span");
        subtitle.textContent = item.kind === "Sack" ? "50 kg sack(s)" : "Loose feed · kg";
        details.append(title, subtitle);
        const controls = document.createElement("div");
        controls.className = "cart-controls";
        const amount = document.createElement("input");
        amount.type = "number";
        amount.min = "1";
        amount.step = item.kind === "Sack" ? "1" : "any";
        amount.value = String(item.quantity);
        amount.className = "cart-quantity-input";
        amount.setAttribute("aria-label", item.kind === "Sack" ? "Number of 50 kg sacks" : "Loose quantity in kilograms");
        amount.addEventListener("change", () => {
          const value = Number(amount.value);
          if (!Number.isFinite(value) || value < 1 || (item.kind === "Sack" && !Number.isInteger(value))) {
            alert(item.kind === "Loose" ? "Minimum loose order is 1 kg. Please enter a valid quantity." : "Enter a whole number of sacks (minimum 1).");
            amount.value = String(item.quantity);
            return;
          }
          item.quantity = value;
          renderCart();
        });
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "cart-remove"; remove.textContent = "Remove";
        remove.addEventListener("click", () => { cart.splice(index, 1); renderCart(); });
        controls.append(amount, remove);
        row.append(details, controls);
        list.append(row);
      });
    }
    const count = cart.reduce((sum, item) => sum + (item.kind === "Sack" ? item.quantity : 1), 0);
    document.querySelector("#cartCount").textContent = count + (count === 1 ? " item" : " items");
    document.querySelector("#cartSummary").textContent = cart.length + " product type" + (cart.length === 1 ? "" : "s") + " selected";
    document.querySelector("#checkoutButton").disabled = cart.length === 0;
  }

  cards.forEach((card) => {
    const name = card.querySelector("h3")?.textContent.trim();
    const options = card.querySelector(".product-options");
    if (!name || !options) return;
    const controls = document.createElement("div");
    controls.className = "product-add-controls";
    controls.innerHTML = `
      <label class="product-choice">Pack
        <select class="pack-choice" aria-label="Choose pack type for ${moneySafe(name)}"><option value="Sack">50 kg sack</option><option value="Loose">Loose feed</option></select>
      </label>
      <label class="product-choice quantity-choice">Quantity
        <span class="quantity-wrap"><input class="quantity-input" type="number" min="1" step="1" value="1" aria-label="Quantity for ${moneySafe(name)}"><span class="quantity-unit">sack(s)</span></span>
      </label>
      <button type="button" class="add-cart-button">Add to cart <span>+</span></button>`;
    options.after(controls);
    const pack = controls.querySelector(".pack-choice");
    const qty = controls.querySelector(".quantity-input");
    const unit = controls.querySelector(".quantity-unit");
    pack.addEventListener("change", () => {
      const loose = pack.value === "Loose";
      qty.min = "1";
      qty.step = loose ? "any" : "1";
      qty.value = "1";
      unit.textContent = loose ? "kg" : "sack(s)";
    });
    controls.querySelector(".add-cart-button").addEventListener("click", () => {
      const loose = pack.value === "Loose";
      const quantity = Number(qty.value);
      if (!Number.isFinite(quantity) || quantity < 1 || (!loose && !Number.isInteger(quantity))) {
        alert(loose ? "Minimum loose order is 1 kg. Please type the quantity in kilograms." : "Enter a whole number of sacks (minimum 1).");
        return;
      }
      const kind = loose ? "Loose" : "Sack";
      const existing = cart.find(item => item.name === name && item.kind === kind);
      if (existing) existing.quantity += quantity;
      else cart.push({name, kind, quantity});
      renderCart();
      document.querySelector(".shopping-cart-panel").scrollIntoView({behavior:"smooth", block:"nearest"});
    });
  });

  const fulfilment = checkout.querySelector('[name="fulfilment"]');
  const address = checkout.querySelector('[name="address"]');
  const addressField = checkout.querySelector("#addressField");
  fulfilment.addEventListener("change", () => {
    const delivery = fulfilment.value === "Home delivery";
    addressField.hidden = !delivery;
    address.required = delivery;
  });
  checkout.querySelector(".dialog-close").addEventListener("click", () => checkout.close());
  document.querySelector("#checkoutButton").addEventListener("click", () => checkout.showModal());

  checkout.querySelector("#checkoutForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cart.length) return;
    const form = new FormData(event.currentTarget);
    const lines = cart.map(item => "- " + item.name + ": " + (item.kind === "Sack" ? item.quantity + " x 50 kg sack" : String(item.quantity) + " kg loose"));
    const message = [
      "Hello Shreeyanvi Suppliers! I would like to place an order.",
      "",
      "CUSTOMER DETAILS",
      "Name: " + form.get("customerName").trim(),
      "Phone: " + form.get("customerPhone").trim(),
      "Fulfilment: " + form.get("fulfilment"),
      ...(form.get("fulfilment") === "Home delivery" ? ["Address: " + form.get("address").trim()] : []),
      "",
      "ORDER ITEMS",
      ...lines,
      "",
      "Please confirm availability and total price. Thank you!"
    ].join("\n");
    const url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  });

  renderCart();
})();