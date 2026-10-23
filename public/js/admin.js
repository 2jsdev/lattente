const TOKEN_KEY = "lattente_admin_token";

const els = {
  loginView: document.getElementById("login-view"),
  appView: document.getElementById("app-view"),
  loginForm: document.getElementById("login-form"),
  logoutBtn: document.getElementById("logout-btn"),
  productsTbody: document.getElementById("products-tbody"),
  categoriesTbody: document.getElementById("categories-tbody"),
  ordersTbody: document.getElementById("orders-tbody"),
  feedbackTbody: document.getElementById("feedback-tbody"),
  modalRoot: document.getElementById("modal-root"),
  toast: document.getElementById("toast"),
  newProductBtn: document.getElementById("new-product-btn"),
  newCategoryBtn: document.getElementById("new-category-btn"),
  refreshOrdersBtn: document.getElementById("refresh-orders-btn"),
  refreshFeedbackBtn: document.getElementById("refresh-feedback-btn"),
};

let categoriesCache = [];
let toastTimer = null;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("is-error", isError);
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && options.body != null && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 401) {
    clearToken();
    showLogin();
    throw new Error(data?.error || "Sesión expirada");
  }

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status}`);
  }

  return data;
}

function showLogin() {
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
}

function closeModal() {
  els.modalRoot.classList.add("hidden");
  els.modalRoot.innerHTML = "";
}

function openModal(title, bodyHtml, onSubmit) {
  els.modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3>${escapeHtml(title)}</h3>
      <form id="modal-form">${bodyHtml}
        <div class="toolbar" style="margin-top:1rem;margin-bottom:0">
          <button type="button" class="btn secondary" data-cancel>Cancelar</button>
          <button type="submit" class="btn">Guardar</button>
        </div>
      </form>
    </div>
  `;
  els.modalRoot.classList.remove("hidden");

  els.modalRoot.querySelector("[data-cancel]").addEventListener("click", closeModal);
  els.modalRoot.addEventListener(
    "click",
    (e) => {
      if (e.target === els.modalRoot) closeModal();
    },
    { once: true }
  );

  const form = els.modalRoot.querySelector("#modal-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await onSubmit(new FormData(form));
      closeModal();
    } catch (err) {
      showToast(err.message, true);
      submitBtn.disabled = false;
    }
  });
}

function field(name, label, value = "", type = "text", extra = "") {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra} />
    </div>
  `;
}

function checkbox(name, label, checked = false) {
  return `
    <div class="field inline">
      <input id="${name}" name="${name}" type="checkbox" ${checked ? "checked" : ""} />
      <label for="${name}">${label}</label>
    </div>
  `;
}

function categoryOptions(selectedId) {
  return categoriesCache
    .map(
      (c) =>
        `<option value="${c.id}" ${Number(c.id) === Number(selectedId) ? "selected" : ""}>${escapeHtml(c.name)}</option>`
    )
    .join("");
}

async function loadCategories() {
  categoriesCache = await api("/categories");
  els.categoriesTbody.innerHTML = categoriesCache
    .map(
      (c) => `
      <tr>
        <td>${c.image_url ? `<img class="thumb" src="${escapeHtml(c.image_url)}" alt="" />` : ""}</td>
        <td>
          <strong>${escapeHtml(c.name)}</strong>
          <div class="muted">${escapeHtml(c.slug)}</div>
        </td>
        <td>${escapeHtml(c.menu_group)}</td>
        <td><span class="badge ${c.show_on_home ? "on" : "off"}">${c.show_on_home ? "Sí" : "No"}</span></td>
        <td>${c.product_count}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit-cat="${c.id}">Editar</button>
            <button type="button" data-del-cat="${c.id}">Borrar</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

async function loadProducts() {
  const products = await api("/products");
  els.productsTbody.innerHTML = products
    .map(
      (p) => `
      <tr>
        <td>${p.image_url ? `<img class="thumb" src="${escapeHtml(p.image_url)}" alt="" />` : ""}</td>
        <td>
          <strong>${escapeHtml(p.name)}</strong>
          <div class="muted">${escapeHtml(p.description || "")}</div>
          ${
            Array.isArray(p.images) && p.images.length > 1
              ? `<div class="muted">${p.images.length} fotos</div>`
              : ""
          }
        </td>
        <td>${escapeHtml(p.category_name)}</td>
        <td>${escapeHtml(p.currency)} ${Number(p.price).toFixed(2)}</td>
        <td>
          <span class="badge ${p.active ? "on" : "off"}">${p.active ? "Activo" : "Off"}</span>
          ${p.featured ? '<span class="badge on">Destacado</span>' : ""}
        </td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit-prod="${p.id}">Editar</button>
            <button type="button" data-del-prod="${p.id}">Borrar</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

async function loadOrders() {
  const orders = await api("/orders");
  els.ordersTbody.innerHTML = orders
    .map((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const itemsText = items
        .map((i) => `${i.quantity}× ${i.product_name}`)
        .join(", ");
      const total = items.reduce(
        (sum, i) => sum + Number(i.unit_price) * Number(i.quantity),
        0
      );
      return `
      <tr>
        <td>${o.id}</td>
        <td>
          <strong>${escapeHtml(o.email)}</strong>
          <div class="muted">${escapeHtml(o.address || "")}</div>
          ${o.notes ? `<div class="muted">${escapeHtml(o.notes)}</div>` : ""}
        </td>
        <td>Bs. ${total.toFixed(2)}</td>
        <td>
          <select data-order-status="${o.id}">
            ${["pending", "confirmed", "done", "cancelled"]
              .map(
                (s) =>
                  `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`
              )
              .join("")}
          </select>
        </td>
        <td class="muted">${escapeHtml(itemsText || "—")}</td>
        <td class="muted">${new Date(o.created_at).toLocaleString("es")}</td>
      </tr>`;
    })
    .join("");
}

async function loadFeedback() {
  const rows = await api("/feedback");
  els.feedbackTbody.innerHTML = rows
    .map(
      (f) => `
      <tr>
        <td>${escapeHtml(f.email || "—")}</td>
        <td>${f.rating ?? "—"}</td>
        <td>${escapeHtml(f.comment || "")}</td>
        <td class="muted">${new Date(f.created_at).toLocaleString("es")}</td>
      </tr>`
    )
    .join("");
}

async function refreshAll() {
  await loadCategories();
  await loadProducts();
  await loadOrders();
  await loadFeedback();
}

function productFormHtml(product = null) {
  return `
    <div class="grid-form">
      <div class="field full">
        <label for="category_id">Categoría</label>
        <select id="category_id" name="category_id" required>
          ${categoryOptions(product?.category_id)}
        </select>
      </div>
      <div class="full">${field("name", "Nombre", product?.name || "", "text", "required")}</div>
      <div class="field full">
        <label for="description">Descripción</label>
        <textarea id="description" name="description">${escapeHtml(product?.description || "")}</textarea>
      </div>
      ${field("price", "Precio", product?.price ?? "", "number", 'step="0.01" min="0" required')}
      ${field("currency", "Moneda", product?.currency || "Bs.")}
      <div class="field full">
        <label for="photos">Subir fotos</label>
        <input id="photos" name="photos" type="file" accept="image/*" multiple />
      </div>
      <div class="field full">
        <label for="images">Fotos actuales / URLs (una por línea)</label>
        <textarea id="images" name="images" rows="4" placeholder="https://... o /uploads/...">${escapeHtml(
          (Array.isArray(product?.images) && product.images.length
            ? product.images
            : product?.image_url
              ? [product.image_url]
              : []
          ).join("\n")
        )}</textarea>
      </div>
      ${field("sort_order", "Orden", product?.sort_order ?? 0, "number")}
      <div class="full">${checkbox("featured", "Destacado", Boolean(product?.featured))}</div>
      <div class="full">${checkbox("active", "Activo", product ? Boolean(product.active) : true)}</div>
    </div>
  `;
}

function categoryFormHtml(cat = null) {
  return `
    <div class="grid-form">
      <div class="full">${field("name", "Nombre", cat?.name || "", "text", "required")}</div>
      ${field("slug", "Slug (opcional)", cat?.slug || "")}
      <div class="field">
        <label for="menu_group">Grupo</label>
        <select id="menu_group" name="menu_group">
          ${["calientes", "frias", "comida", "extras", "creaciones"]
            .map(
              (g) =>
                `<option value="${g}" ${cat?.menu_group === g ? "selected" : ""}>${g}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="field full">
        <label for="photo">Subir foto</label>
        <input id="photo" name="photo" type="file" accept="image/*" />
      </div>
      <div class="full">${field("image_url", "URL de foto (opcional)", cat?.image_url || "")}</div>
      ${field("sort_order", "Orden", cat?.sort_order ?? 0, "number")}
      <div class="full">${checkbox("show_on_home", "Mostrar en home", cat ? Boolean(cat.show_on_home) : true)}</div>
    </div>
  `;
}

function openProductEditor(product = null) {
  openModal(product ? "Editar producto" : "Nuevo producto", productFormHtml(product), async (fd) => {
    // Checkboxes only appear when checked; send explicit flags for multipart.
    fd.set("featured", fd.get("featured") === "on" ? "true" : "false");
    fd.set("active", fd.get("active") === "on" ? "true" : "false");

    if (product) {
      await api(`/products/${product.id}`, { method: "PUT", body: fd });
      showToast("Producto actualizado");
    } else {
      await api("/products", { method: "POST", body: fd });
      showToast("Producto creado");
    }
    await loadProducts();
  });
}

function openCategoryEditor(cat = null) {
  openModal(cat ? "Editar categoría" : "Nueva categoría", categoryFormHtml(cat), async (fd) => {
    fd.set(
      "show_on_home",
      fd.get("show_on_home") === "on" ? "true" : "false"
    );

    if (cat) {
      await api(`/categories/${cat.id}`, { method: "PUT", body: fd });
      showToast("Categoría actualizada");
    } else {
      await api("/categories", { method: "POST", body: fd });
      showToast("Categoría creada");
    }
    await loadCategories();
    await loadProducts();
  });
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.panel !== name);
    });
  });
});

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = new FormData(els.loginForm).get("password");
  try {
    const data = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error de login");
      return json;
    });
    setToken(data.token);
    showApp();
    await refreshAll();
    showToast("Sesión iniciada");
  } catch (err) {
    showToast(err.message, true);
  }
});

els.logoutBtn.addEventListener("click", () => {
  clearToken();
  showLogin();
});

els.newProductBtn.addEventListener("click", () => openProductEditor());
els.newCategoryBtn.addEventListener("click", () => openCategoryEditor());
els.refreshOrdersBtn.addEventListener("click", () =>
  loadOrders().then(() => showToast("Pedidos actualizados")).catch((e) => showToast(e.message, true))
);
els.refreshFeedbackBtn.addEventListener("click", () =>
  loadFeedback().then(() => showToast("Feedback actualizado")).catch((e) => showToast(e.message, true))
);

els.productsTbody.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit-prod]")?.dataset.editProd;
  const delId = e.target.closest("[data-del-prod]")?.dataset.delProd;
  if (editId) {
    const products = await api("/products");
    const product = products.find((p) => Number(p.id) === Number(editId));
    if (product) openProductEditor(product);
  }
  if (delId && confirm("¿Borrar este producto?")) {
    try {
      await api(`/products/${delId}`, { method: "DELETE" });
      showToast("Producto borrado");
      await loadProducts();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

els.categoriesTbody.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit-cat]")?.dataset.editCat;
  const delId = e.target.closest("[data-del-cat]")?.dataset.delCat;
  if (editId) {
    const cat = categoriesCache.find((c) => Number(c.id) === Number(editId));
    if (cat) openCategoryEditor(cat);
  }
  if (delId && confirm("¿Borrar esta categoría? También puede fallar si tiene productos.")) {
    try {
      await api(`/categories/${delId}`, { method: "DELETE" });
      showToast("Categoría borrada");
      await loadCategories();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

els.ordersTbody.addEventListener("change", async (e) => {
  const select = e.target.closest("[data-order-status]");
  if (!select) return;
  try {
    await api(`/orders/${select.dataset.orderStatus}`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value }),
    });
    showToast("Estado actualizado");
  } catch (err) {
    showToast(err.message, true);
  }
});

async function boot() {
  if (!getToken()) {
    showLogin();
    return;
  }
  try {
    await api("/me");
    showApp();
    await refreshAll();
  } catch {
    clearToken();
    showLogin();
  }
}

boot();
