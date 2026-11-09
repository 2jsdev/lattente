// Sección "Pedido": catálogo de productos, resumen del carrito y formulario de envío
let allProducts = [];
let activeCategory = "todos";
let searchQuery = "";

// Primera foto del producto
function productImage(product) {
  if (!product) return "";
  if (Array.isArray(product.images) && product.images[0]) return product.images[0];
  return product.image_url || "";
}

function catalogById(id) {
  return allProducts.find((p) => Number(p.id) === Number(id));
}

// Productos según el filtro de categoría y el texto del buscador
function filteredProducts() {
  const needle = searchQuery.toLowerCase().trim();
  return allProducts.filter((p) => {
    if (activeCategory !== "todos" && p.category_slug !== activeCategory) return false;
    const texto = `${p.name} ${p.description || ""} ${p.category_name || ""}`.toLowerCase();
    return texto.includes(needle);
  });
}

// Botones de filtro por categoría (se arman con las categorías de los productos)
function renderCatalogFilters() {
  const root = document.querySelector("[data-catalog-filters]");
  if (!root) return;

  root.innerHTML = `<button type="button" class="orders-chip${activeCategory === "todos" ? " is-active" : ""}" data-cat="todos">Todos</button>`;

  const vistos = [];
  allProducts.forEach((p) => {
    if (vistos.includes(p.category_slug)) return;
    vistos.push(p.category_slug);
    const active = activeCategory === p.category_slug;
    root.innerHTML += `<button type="button" class="orders-chip${active ? " is-active" : ""}" data-cat="${escapeHtml(p.category_slug)}">${escapeHtml(p.category_name)}</button>`;
  });
}

// Tarjetas del catálogo con su botón "Agregar"
function renderCatalog() {
  const grid = document.querySelector("[data-catalog-grid]");
  const empty = document.querySelector("[data-catalog-empty]");
  if (!grid) return;

  const idsEnCarrito = readCart().map((item) => Number(item.id));
  const list = filteredProducts();
  if (empty) empty.hidden = list.length > 0;

  grid.innerHTML = "";
  list.forEach((p) => {
    const img = productImage(p);
    const added = idsEnCarrito.includes(Number(p.id));
    const media = img
      ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" width="120" height="120" />`
      : `<span class="orders-product__placeholder" aria-hidden="true"></span>`;

    grid.innerHTML += `
      <article class="orders-product${added ? " is-in-cart" : ""}" data-product-id="${p.id}">
        <div class="orders-product__top">
          <figure class="orders-product__media">${media}</figure>
          <div class="orders-product__body">
            <p class="orders-product__cat">${escapeHtml(p.category_name || "")}</p>
            <h3>${escapeHtml(p.name)}</h3>
            <p class="orders-product__price">${formatPrice(p.price, p.currency)}</p>
          </div>
        </div>
        <button type="button" class="orders-product__add" data-add-id="${p.id}" aria-label="${added ? "Sumar otra unidad de" : "Agregar"} ${escapeHtml(p.name)}">${added ? "Sumar +" : "Agregar"}</button>
      </article>`;
  });
}

// Resumen del pedido (lo que hay en el carrito) + total
function renderOrderProducts() {
  const box = document.querySelector("[data-order-products]");
  const countEl = document.querySelector("[data-order-count]");
  const totalEl = document.querySelector("[data-order-total]");
  const deliveryFields = document.querySelector(".orders-fields");
  const submitButton = document.querySelector("[data-order-form] [type='submit']");
  const quantityField = document.querySelector("[name='quantity']");
  if (!box) return;

  const cart = readCart();
  const count = cartCount(cart);

  if (quantityField) quantityField.value = String(count);
  if (submitButton) submitButton.disabled = count === 0;
  if (deliveryFields) deliveryFields.hidden = count === 0;
  if (countEl) countEl.textContent = count === 1 ? "1 producto" : `${count} productos`;
  if (totalEl) totalEl.textContent = formatPrice(cartTotal(cart));

  if (cart.length === 0) {
    box.innerHTML = `
      <div class="order-empty">
        <span class="order-empty__icon" aria-hidden="true">＋</span>
        <div>
          <strong>Tu resumen está vacío</strong>
          <p>Elegí productos del catálogo. Después vas a poder indicar dónde entregarlos.</p>
        </div>
      </div>`;
  } else {
    box.innerHTML = "";
    cart.forEach((item) => {
      const img = item.image_url || productImage(catalogById(item.id));
      const nombre = escapeHtml(item.name);
      const media = img
        ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" width="56" height="56" />`
        : `<span class="orders-product__placeholder" aria-hidden="true"></span>`;

      box.innerHTML += `
        <div class="orders-cart-row" data-cart-id="${item.id}">
          <figure class="orders-cart-row__media">${media}</figure>
          <div class="orders-cart-row__body">
            <span class="check-name">${nombre}</span>
            <span class="check-meta">${formatPrice(item.price * item.quantity, item.currency || "Bs.")}</span>
          </div>
          <div class="check-actions">
            <label class="check-qty">
              <span class="visually-hidden">Cantidad</span>
              <button type="button" data-qty-delta="-1" data-id="${item.id}" aria-label="Menos">−</button>
              <input type="number" min="1" value="${item.quantity}" data-qty-input="${item.id}" aria-label="Cantidad de ${nombre}" />
              <button type="button" data-qty-delta="1" data-id="${item.id}" aria-label="Más">+</button>
            </label>
            <button type="button" class="check-remove" data-remove-item="${item.id}" aria-label="Quitar ${nombre}">Quitar</button>
          </div>
        </div>`;
    });
  }

  renderCatalog();
}

function addProductById(id) {
  const product = catalogById(id);
  if (!product) return;
  addToCart({
    id: Number(product.id),
    name: product.name,
    price: Number(product.price),
    currency: product.currency || "Bs.",
    image_url: productImage(product),
  });
}

// Envía el pedido: POST /api/orders
async function enviarPedido(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const submit = form.querySelector("[type='submit']");
  const cart = readCart();

  if (cart.length === 0) {
    showToast("Agrega al menos un producto a tu pedido", "error");
    return;
  }

  const items = cart.map((item) => ({
    productId: Number(item.id),
    name: item.name,
    price: Number(item.price),
    quantity: Number(item.quantity) || 1,
  }));

  const pedido = {
    email: form.elements.email.value.trim(),
    phone: form.elements.phone.value.trim(),
    address: form.elements.address.value.trim(),
    quantity: cartCount(cart),
    notes: "",
    items,
  };

  submit.disabled = true;
  try {
    const total = cartTotal(cart); // se guarda antes de vaciar el carrito
    const respuesta = await api("/api/orders", { method: "POST", body: JSON.stringify(pedido) });
    clearCart();
    form.reset();
    mostrarQrDePago(respuesta.order.id, total);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    submit.disabled = false;
    renderOrderProducts();
  }
}

// Después de enviar: esconde el formulario y muestra el QR con el total a pagar
function mostrarQrDePago(idPedido, total) {
  document.querySelector("[data-qr-order-id]").textContent = "#" + idPedido;
  document.querySelector("[data-qr-total]").textContent = formatPrice(total);
  document.querySelector("[data-order-form]").hidden = true;
  document.querySelector("[data-order-qr]").hidden = false;
}

// Botón "Hacer otro pedido": vuelve a mostrar el formulario
function cerrarQrDePago() {
  document.querySelector("[data-order-qr]").hidden = true;
  document.querySelector("[data-order-form]").hidden = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    allProducts = await api("/api/products");
    renderCatalogFilters();
    renderOrderProducts();
  } catch (error) {
    showToast(error.message, "error");
  }

  // Cada vez que cambia el carrito se vuelve a dibujar el resumen
  window.addEventListener("lattente:cart", renderOrderProducts);

  document.querySelector("[data-catalog-search]").addEventListener("input", (e) => {
    searchQuery = e.currentTarget.value;
    renderCatalog();
  });

  document.querySelector("[data-catalog-filters]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    renderCatalogFilters();
    renderCatalog();
  });

  document.querySelector("[data-catalog-grid]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-id]");
    if (!btn) return;
    addProductById(Number(btn.dataset.addId));
    showToast("Agregado al pedido");
  });

  const resumen = document.querySelector("[data-order-products]");

  // Botones −, + y Quitar del resumen
  resumen.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove-item]");
    if (removeBtn) {
      removeFromCart(Number(removeBtn.dataset.removeItem));
      return;
    }

    const deltaBtn = e.target.closest("[data-qty-delta]");
    if (!deltaBtn) return;
    const id = Number(deltaBtn.dataset.id);
    const item = readCart().find((row) => Number(row.id) === id);
    if (item) setCartQuantity(id, item.quantity + Number(deltaBtn.dataset.qtyDelta));
  });

  // Escribir la cantidad a mano
  resumen.addEventListener("change", (e) => {
    const input = e.target.closest("[data-qty-input]");
    if (input) setCartQuantity(Number(input.dataset.qtyInput), Number(input.value));
  });

  document.querySelector("[data-order-form]").addEventListener("submit", enviarPedido);
  document.querySelector("[data-qr-close]").addEventListener("click", cerrarQrDePago);
  // Si agrega un producto mientras ve el QR, vuelve a aparecer el formulario
  window.addEventListener("lattente:cart", () => {
    if (readCart().length > 0) cerrarQrDePago();
  });
});
