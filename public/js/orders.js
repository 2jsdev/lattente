(function () {
  let allProducts = [];
  let activeCategory = "todos";
  let searchQuery = "";
  let rendering = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function productImage(product) {
    if (Array.isArray(product?.images) && product.images[0]) return product.images[0];
    return product?.image_url || "";
  }

  function catalogById(id) {
    return allProducts.find((p) => Number(p.id) === Number(id));
  }

  function syncQuantityField(cart) {
    const qty = document.querySelector('[name="quantity"]');
    if (!qty) return;
    const total = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    qty.value = String(Math.max(0, total));
  }

  function filteredProducts() {
    const needle = searchQuery.toLowerCase().trim();
    return allProducts.filter((p) => {
      const catOk =
        activeCategory === "todos" ||
        String(p.category_slug || "") === activeCategory ||
        String(p.category_name || "") === activeCategory;
      if (!catOk) return false;
      if (!needle) return true;
      const hay = `${p.name} ${p.description || ""} ${p.category_name || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }

  function renderFilters() {
    const root = document.querySelector("[data-catalog-filters]");
    if (!root) return;

    const cats = [];
    const seen = new Set();
    allProducts.forEach((p) => {
      const key = p.category_slug || p.category_name;
      if (!key || seen.has(key)) return;
      seen.add(key);
      cats.push({
        key,
        label: p.category_name || p.category_slug,
      });
    });

    root.innerHTML =
      `<button type="button" class="orders-chip${activeCategory === "todos" ? " is-active" : ""}" data-cat="todos">Todos</button>` +
      cats
        .map(
          (c) =>
            `<button type="button" class="orders-chip${activeCategory === c.key ? " is-active" : ""}" data-cat="${escapeAttr(c.key)}">${escapeHtml(c.label)}</button>`
        )
        .join("");
  }

  function renderCatalog() {
    const grid = document.querySelector("[data-catalog-grid]");
    const empty = document.querySelector("[data-catalog-empty]");
    if (!grid) return;

    const { formatPrice, readCart } = window.LattenteCart;
    const inCart = new Set(readCart().map((item) => Number(item.id)));
    const list = filteredProducts();

    if (empty) empty.hidden = list.length > 0;

    grid.innerHTML = list
      .map((p) => {
        const img = productImage(p);
        const added = inCart.has(Number(p.id));
        return `
      <article class="orders-product${added ? " is-in-cart" : ""}" data-product-id="${p.id}">
        <div class="orders-product__top">
          <figure class="orders-product__media">
            ${
              img
                ? `<img src="${escapeAttr(img)}" alt="" loading="lazy" width="120" height="120" />`
                : `<span class="orders-product__placeholder" aria-hidden="true"></span>`
            }
          </figure>
          <div class="orders-product__body">
            <p class="orders-product__cat">${escapeHtml(p.category_name || "")}</p>
            <h3>${escapeHtml(p.name)}</h3>
            <p class="orders-product__price">${formatPrice(p.price, p.currency)}</p>
          </div>
        </div>
        <button
          type="button"
          class="orders-product__add"
          data-add-id="${p.id}"
          aria-label="${added ? "Sumar otra unidad de" : "Agregar"} ${escapeAttr(p.name)}"
        >${added ? "Sumar +" : "Agregar"}</button>
      </article>`;
      })
      .join("");
  }

  function renderOrderProducts() {
    const { readCart, formatPrice, cartTotal, cartCount } = window.LattenteCart;
    const box = document.querySelector("[data-order-products]");
    const countEl = document.querySelector("[data-order-count]");
    const totalEl = document.querySelector("[data-order-total]");
    const deliveryFields = document.querySelector(".orders-fields");
    const submitButton = document.querySelector('[data-order-form] [type="submit"]');
    if (!box || rendering) return;

    rendering = true;
    const cart = readCart();
    syncQuantityField(cart);

    const count = cartCount(cart);
    if (submitButton) submitButton.disabled = count === 0;
    if (deliveryFields) deliveryFields.hidden = count === 0;
    if (countEl) {
      countEl.textContent =
        count === 0
          ? "0 productos"
          : count === 1
            ? "1 producto"
            : `${count} productos`;
    }
    if (totalEl) totalEl.textContent = formatPrice(cartTotal(cart));

    if (!cart.length) {
      box.innerHTML = `
        <div class="order-empty">
          <span class="order-empty__icon" aria-hidden="true">＋</span>
          <div>
            <strong>Tu resumen está vacío</strong>
            <p>Elegí productos del catálogo. Después vas a poder indicar dónde entregarlos.</p>
          </div>
        </div>`;
    } else {
      box.innerHTML = cart
        .map((item) => {
          const catalog = catalogById(item.id);
          const img = item.image_url || productImage(catalog) || "";
          return `
        <div class="orders-cart-row" data-cart-id="${item.id}">
          <figure class="orders-cart-row__media">
            ${
              img
                ? `<img src="${escapeAttr(img)}" alt="" loading="lazy" width="56" height="56" />`
                : `<span class="orders-product__placeholder" aria-hidden="true"></span>`
            }
          </figure>
          <div class="orders-cart-row__body">
            <span class="check-name">${escapeHtml(item.name)}</span>
            <span class="check-meta">${formatPrice(
              Number(item.price) * Number(item.quantity),
              item.currency || "Bs."
            )}</span>
          </div>
          <div class="check-actions">
            <label class="check-qty">
              <span class="visually-hidden">Cantidad</span>
              <button type="button" data-qty-delta="-1" data-id="${item.id}" aria-label="Menos">−</button>
              <input type="number" min="1" value="${item.quantity}" data-qty-input="${item.id}" aria-label="Cantidad de ${escapeAttr(item.name)}" />
              <button type="button" data-qty-delta="1" data-id="${item.id}" aria-label="Más">+</button>
            </label>
            <button type="button" class="check-remove" data-remove-item="${item.id}" aria-label="Quitar ${escapeAttr(item.name)}">Quitar</button>
          </div>
        </div>`;
        })
        .join("");
    }

    rendering = false;
    renderCatalog();
  }

  function addProductById(id) {
    const product = catalogById(id);
    if (!product) return;
    const { addToCart } = window.LattenteCart;
    addToCart({
      id: Number(product.id),
      name: product.name,
      price: Number(product.price),
      currency: product.currency || "Bs.",
      image_url: productImage(product),
    });
  }

  async function loadCatalog() {
    const { api } = window.Lattente;
    allProducts = await api("/api/products");
    renderFilters();
    renderOrderProducts();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const { api, showToast } = window.Lattente;
    const { clearCart, readCart, setCartQuantity, removeFromCart } =
      window.LattenteCart;

    try {
      await loadCatalog();
    } catch (err) {
      showToast(err.message, "error");
    }

    window.addEventListener("lattente:cart", () => {
      renderOrderProducts();
    });

    document
      .querySelector("[data-catalog-search]")
      ?.addEventListener("input", (e) => {
        searchQuery = e.currentTarget.value || "";
        renderCatalog();
      });

    document
      .querySelector("[data-catalog-filters]")
      ?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cat]");
        if (!btn) return;
        activeCategory = btn.dataset.cat || "todos";
        renderFilters();
        renderCatalog();
      });

    document
      .querySelector("[data-catalog-grid]")
      ?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-add-id]");
        if (!btn) return;
        addProductById(Number(btn.dataset.addId));
        showToast("Agregado al pedido");
      });

    document
      .querySelector("[data-order-products]")
      ?.addEventListener("click", (e) => {
        const removeBtn = e.target.closest("[data-remove-item]");
        if (removeBtn) {
          removeFromCart(Number(removeBtn.dataset.removeItem));
          return;
        }

        const deltaBtn = e.target.closest("[data-qty-delta]");
        if (deltaBtn) {
          const id = Number(deltaBtn.dataset.id);
          const item = readCart().find((row) => Number(row.id) === id);
          if (!item) return;
          const next = Number(item.quantity) + Number(deltaBtn.dataset.qtyDelta);
          setCartQuantity(id, next);
        }
      });

    document
      .querySelector("[data-order-products]")
      ?.addEventListener("change", (e) => {
        const input = e.target.closest("[data-qty-input]");
        if (!input) return;
        setCartQuantity(Number(input.dataset.qtyInput), Number(input.value));
      });

    document.querySelector("[data-order-form]")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      const fd = new FormData(form);
      const cart = readCart();

      if (!cart.length) {
        showToast("Agrega al menos un producto a tu pedido", "error");
        return;
      }

      const items = cart.map((item) => ({
        productId: Number(item.id),
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity) || 1,
      }));

      submit.disabled = true;
      try {
        await api("/api/orders", {
          method: "POST",
          body: JSON.stringify({
            email: fd.get("email"),
            address: fd.get("address"),
            quantity: items.reduce((sum, item) => sum + item.quantity, 0),
            notes: "",
            items,
          }),
        });
        clearCart();
        form.reset();
        showToast("Pedido enviado. Gracias");
        renderOrderProducts();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        submit.disabled = false;
      }
    });
  });
})();
