(() => {
  const phone = "9779700068407";
  const cards = [...document.querySelectorAll(".product-card")];
  if (!cards.length) return;

  // Temporary catalogue rates. Products not listed here require store confirmation.
  const pricesPerKg = { B0: 90, B1: 90, B2: 85, B3: 85 };
  const priceFor = (name) => pricesPerKg[name.trim().toUpperCase()] ?? null;
  const formatMoney = (value) => "Rs. " + value.toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });

  const cart = [];
  const moneySafe = (value) => String(value).replace(/[<>&"]/g, "");
  const panel = document.createElement("section");
  panel.className = "shopping-cart-panel section-shell";
  panel.innerHTML = `
    <div class="cart-heading"><div><div class="eyebrow"><span></span> YOUR SELECTION</div><h2>Your <em>cart.</em></h2></div><span class="cart-count" id="cartCount">0 items</span></div>
    <div id="cartItems" class="cart-items"><p class="cart-empty">Your cart is empty. Add feed from the catalogue above.</p></div>
    <div class="cart-bottom">
      <div class="cart-totals">
        <strong id="cartSummary">0 products selected</strong>
        <strong id="cartTotal">Estimated total: Rs. 0</strong>
        <small id="cartPriceNote">Add products to see your total.</small>
      </div>
      <button class="button button-light" id="checkoutButton" type="button" disabled>Confirm order <span>↗</span></button>
    </div>
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
      <p class="checkout-hint">Prices shown for B0–B3 are temporary estimates. Other feed prices and final availability will be confirmed by the store.</p>
      <p class="checkout-hint checkout-send-instruction"><strong>Choose how to confirm:</strong> We will open your selected messaging app with the order details ready. Please press <strong>Send</strong> there to submit your order.</p>
      <div class="checkout-contact-options">
        <button class="button button-light checkout-submit" type="submit" name="contactMethod" value="whatsapp">Confirm with WhatsApp <span>↗</span></button>
        <button class="button checkout-submit checkout-sms" type="submit" name="contactMethod" value="sms">Confirm with SMS <span>↗</span></button>
      </div>
    </form>`;
  document.body.append(checkout);

  const itemKilograms = (item) => item.kind === "Sack" ? item.quantity * 50 : item.quantity;
  const itemTotal = (item) => item.pricePerKg === null ? null : itemKilograms(item) * item.pricePerKg;

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
        subtitle.textContent = item.kind === "Sack"
          ? item.quantity + " × 50 kg sack(s)"
          : String(item.quantity) + " kg loose";
        const lineTotal = document.createElement("span");
        lineTotal.className = "cart-line-total";
        const total = itemTotal(item);
        lineTotal.textContent = total === null
          ? "Price to be confirmed"
          : formatMoney(total) + " · " + formatMoney(item.pricePerKg) + "/kg";
        details.append(title, subtitle, lineTotal);

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
        remove.type = "button";
        remove.className = "cart-remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => { cart.splice(index, 1); renderCart(); });
        controls.append(amount, remove);
        row.append(details, controls);
        list.append(row);
      });
    }

    const count = cart.reduce((sum, item) => sum + (item.kind === "Sack" ? item.quantity : 1), 0);
    const knownSubtotal = cart.reduce((sum, item) => sum + (itemTotal(item) ?? 0), 0);
    const unpricedCount = cart.filter(item => item.pricePerKg === null).length;
    document.querySelector("#cartCount").textContent = count + (count === 1 ? " item" : " items");
    document.querySelector("#cartSummary").textContent =
      cart.length + " product type" + (cart.length === 1 ? "" : "s") + " selected";

    const totalLabel = document.querySelector("#cartTotal");
    const priceNote = document.querySelector("#cartPriceNote");
    if (!cart.length) {
      totalLabel.textContent = "Estimated total: Rs. 0";
      priceNote.textContent = "Add products to see your total.";
    } else if (unpricedCount > 0) {
      totalLabel.textContent = "Known-price subtotal: " + formatMoney(knownSubtotal);
      priceNote.textContent = unpricedCount + " product type(s) still need price confirmation. Final total may be higher.";
    } else {
      totalLabel.textContent = "Estimated total: " + formatMoney(knownSubtotal);
      priceNote.textContent = "Based on current listed rates; the store will confirm the final amount.";
    }
    document.querySelector("#checkoutButton").disabled = cart.length === 0;
  }

  cards.forEach((card) => {
    const name = card.querySelector("h3")?.textContent.trim();
    const options = card.querySelector(".product-options");
    if (!name || !options) return;

    const priceNote = document.createElement("p");
    priceNote.className = "product-price-note";
    const rate = priceFor(name);
    priceNote.textContent = rate === null
      ? "Price to be confirmed"
      : formatMoney(rate) + "/kg · " + formatMoney(rate * 50) + " per 50 kg sack";

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
    options.after(priceNote, controls);

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
      else cart.push({name, kind, quantity, pricePerKg: priceFor(name)});
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
    const knownSubtotal = cart.reduce((sum, item) => sum + (itemTotal(item) ?? 0), 0);
    const hasUnpricedItems = cart.some(item => item.pricePerKg === null);
    const lines = cart.map(item => {
      const quantityText = item.kind === "Sack"
        ? item.quantity + " x 50 kg sack(s)"
        : String(item.quantity) + " kg loose";
      const total = itemTotal(item);
      return "- " + item.name + ": " + quantityText + (total === null
        ? " — price to be confirmed"
        : " — " + formatMoney(total) + " (" + formatMoney(item.pricePerKg) + "/kg)");
    });
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
      (hasUnpricedItems ? "Known-price subtotal: " : "Estimated total: ") + formatMoney(knownSubtotal),
      ...(hasUnpricedItems ? ["Some product prices are pending confirmation; this is not the final order total."] : ["Estimate based on current listed rates; please confirm the final amount."]),
      "",
      "Please confirm availability and final total. I am sending this message to confirm my order. Thank you!"
    ].join("\n");
    const contactMethod = event.submitter?.value || "whatsapp";
    if (contactMethod === "sms") {
      window.location.href = "sms:+" + phone + "?body=" + encodeURIComponent(message);
    } else {
      const url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });

  renderCart();
})();