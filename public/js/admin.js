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
  socialLinksForm: document.getElementById("social-links-form"),
  modalRoot: document.getElementById("modal-root"),
  toast: document.getElementById("toast"),
  newProductBtn: document.getElementById("new-product-btn"),
  newCategoryBtn: document.getElementById("new-category-btn"),
  refreshOrdersBtn: document.getElementById("refresh-orders-btn"),
  refreshFeedbackBtn: document.getElementById("refresh-feedback-btn"),
};

let categoriesCache = [];
let toastTimer = null;
let modalReturnFocus = null;
let modalResizeObserver = null;
const tableStates = new Map();

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

function tableState(name) {
  if (!tableStates.has(name)) {
    tableStates.set(name, { query: "", sortColumn: null, direction: "asc" });
  }
  return tableStates.get(name);
}

function searchableRowText(row) {
  return Array.from(row.cells)
    .map((cell) => {
      if (cell.dataset.searchValue) return cell.dataset.searchValue;
      const clone = cell.cloneNode(true);
      clone.querySelectorAll("button, select").forEach((control) => control.remove());
      return clone.textContent;
    })
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function sortValue(row, column, type) {
  const cell = row.cells[column];
  if (!cell) return "";
  const value = cell.dataset.sortValue ?? cell.textContent.trim();
  if (type === "number") return Number(value) || 0;
  if (type === "date") return new Date(value).getTime() || 0;
  return value.toLocaleLowerCase("es");
}

function applyTableView(name) {
  const tbody = document.querySelector(`[data-table-body="${name}"]`);
  if (!tbody) return;

  const state = tableState(name);
  const rows = Array.from(tbody.rows);
  if (state.sortColumn !== null) {
    const sortButton = tbody.closest("table")?.querySelector(
      `[data-sort-column="${state.sortColumn}"]`
    );
    const type = sortButton?.dataset.sortType || "text";
    rows.sort((left, right) => {
      const a = sortValue(left, state.sortColumn, type);
      const b = sortValue(right, state.sortColumn, type);
      const order = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
      return order * (state.direction === "asc" ? 1 : -1);
    });
    rows.forEach((row) => tbody.append(row));
  }

  const needle = state.query.trim().toLocaleLowerCase("es");
  let visibleCount = 0;
  rows.forEach((row) => {
    const matches = !needle || searchableRowText(row).includes(needle);
    row.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  const count = document.querySelector(`[data-table-count="${name}"]`);
  if (count) count.textContent = `${visibleCount} de ${rows.length}`;
  const empty = document.querySelector(`[data-table-empty="${name}"]`);
  if (empty) empty.classList.toggle("hidden", visibleCount > 0);

  tbody.closest("table")?.querySelectorAll("[data-sort-column]").forEach((button) => {
    const selected = Number(button.dataset.sortColumn) === state.sortColumn;
    const th = button.closest("th");
    if (th) th.setAttribute("aria-sort", selected
      ? state.direction === "asc" ? "ascending" : "descending"
      : "none");
    button.setAttribute("aria-label", selected
      ? `Ordenar por ${button.textContent.trim()}, ${state.direction === "asc" ? "ascendente" : "descendente"}`
      : `Ordenar por ${button.textContent.trim()}`);
  });
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
  modalResizeObserver?.disconnect();
  modalResizeObserver = null;
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
  modalReturnFocus?.focus();
  modalReturnFocus = null;
}

function openModal(title, bodyHtml, onSubmit) {
  modalReturnFocus = document.activeElement;
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
  els.modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
      <div class="modal-head">
        <h3 id="modal-title">${escapeHtml(title)}</h3>
        <button type="button" class="modal-close" data-modal-close aria-label="Cerrar formulario">×</button>
      </div>
      <form id="modal-form" class="modal-form">
        <div id="modal-scroll-content" class="modal-form-content" tabindex="0">
          <div class="modal-form-inner">${bodyHtml}</div>
        </div>
        <div class="modal-scrollbar" aria-hidden="true">
          <span class="modal-scrollbar-thumb" role="scrollbar" aria-label="Desplazamiento del formulario" aria-controls="modal-scroll-content" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"></span>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" data-cancel>Cancelar</button>
          <button type="submit" class="btn">Guardar</button>
        </div>
      </form>
    </div>
  `;
  els.modalRoot.classList.remove("hidden");

  els.modalRoot.querySelector("[data-cancel]").addEventListener("click", closeModal);
  els.modalRoot.querySelector("[data-modal-close]").addEventListener("click", closeModal);
  els.modalRoot.onclick = (e) => {
    if (e.target === els.modalRoot) closeModal();
  };

  const form = els.modalRoot.querySelector("#modal-form");
  setupModalScrollbar(form);
  form.querySelectorAll(".upload-input").forEach((input) => {
    const dropzone = input.parentElement.querySelector(".upload-dropzone");
    const status = input.parentElement.querySelector(".upload-status");
    const updateFiles = () => {
      const files = Array.from(input.files || []);
      status.textContent = files.length
        ? files.length === 1
          ? files[0].name
          : `${files.length} imágenes seleccionadas`
        : "Ningún archivo seleccionado";
    };

    input.addEventListener("change", updateFiles);
    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
      });
    });
    dropzone.addEventListener("drop", (event) => {
      const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
        file.type.startsWith("image/")
      );
      if (!files.length) return;
      const transfer = new DataTransfer();
      (input.multiple ? files : files.slice(0, 1)).forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      updateFiles();
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    try {
      await onSubmit(new FormData(form));
      closeModal();
    } catch (err) {
      showToast(err.message, true);
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar";
    }
  });

  requestAnimationFrame(() => form.querySelector("input, select, textarea")?.focus());
}

function setupModalScrollbar(form) {
  const content = form.querySelector(".modal-form-content");
  const track = form.querySelector(".modal-scrollbar");
  const thumb = form.querySelector(".modal-scrollbar-thumb");
  if (!content || !track || !thumb) return;

  const update = () => {
    const maxScroll = content.scrollHeight - content.clientHeight;
    const trackHeight = track.clientHeight;
    if (maxScroll <= 0 || trackHeight <= 0) {
      track.hidden = true;
      return;
    }

    track.hidden = false;
    const thumbHeight = Math.min(trackHeight, Math.max(38, trackHeight * content.clientHeight / content.scrollHeight));
    const travel = trackHeight - thumbHeight;
    const progress = content.scrollTop / maxScroll;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.top = `${travel * progress}px`;
    thumb.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  };

  content.addEventListener("scroll", update, { passive: true });
  track.addEventListener("pointerdown", (event) => {
    if (event.target !== track) return;
    const bounds = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    content.scrollTop = ratio * (content.scrollHeight - content.clientHeight);
  });

  thumb.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    thumb.setPointerCapture(event.pointerId);
    thumb.dataset.dragY = String(event.clientY);
    thumb.dataset.dragScroll = String(content.scrollTop);
  });
  thumb.addEventListener("pointermove", (event) => {
    if (!thumb.hasPointerCapture(event.pointerId)) return;
    const maxScroll = content.scrollHeight - content.clientHeight;
    const travel = track.clientHeight - thumb.offsetHeight;
    if (maxScroll <= 0 || travel <= 0) return;
    const delta = event.clientY - Number(thumb.dataset.dragY || 0);
    content.scrollTop = Number(thumb.dataset.dragScroll || 0) + delta * maxScroll / travel;
  });
  thumb.addEventListener("keydown", (event) => {
    const steps = { ArrowDown: 40, ArrowUp: -40, PageDown: content.clientHeight, PageUp: -content.clientHeight };
    if (event.key === "Home") content.scrollTop = 0;
    else if (event.key === "End") content.scrollTop = content.scrollHeight;
    else if (steps[event.key]) content.scrollTop += steps[event.key];
    else return;
    event.preventDefault();
  });

  modalResizeObserver = new ResizeObserver(update);
  modalResizeObserver.observe(content);
  modalResizeObserver.observe(form.querySelector(".modal-form-inner"));
  requestAnimationFrame(update);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.modalRoot.classList.contains("hidden")) closeModal();
});

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
        <td data-sort-value="${escapeHtml(c.name)}">
          <strong>${escapeHtml(c.name)}</strong>
          <div class="muted">${escapeHtml(c.slug)}</div>
        </td>
        <td data-sort-value="${escapeHtml(c.menu_group)}">${escapeHtml(c.menu_group)}</td>
        <td data-sort-value="${c.show_on_home ? "Sí" : "No"}"><span class="badge ${c.show_on_home ? "on" : "off"}">${c.show_on_home ? "Sí" : "No"}</span></td>
        <td data-sort-value="${Number(c.product_count) || 0}">${c.product_count}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit-cat="${c.id}">Editar</button>
            <button type="button" data-del-cat="${c.id}">Borrar</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
  applyTableView("categories");
}

async function loadProducts() {
  const products = await api("/products");
  els.productsTbody.innerHTML = products
    .map(
      (p) => `
      <tr>
        <td>${p.image_url ? `<img class="thumb" src="${escapeHtml(p.image_url)}" alt="" />` : ""}</td>
        <td data-sort-value="${escapeHtml(p.name)}">
          <strong>${escapeHtml(p.name)}</strong>
          <div class="muted">${escapeHtml(p.description || "")}</div>
          ${
            Array.isArray(p.images) && p.images.length > 1
              ? `<div class="muted">${p.images.length} fotos</div>`
              : ""
          }
        </td>
        <td data-sort-value="${escapeHtml(p.category_name)}">${escapeHtml(p.category_name)}</td>
        <td data-sort-value="${Number(p.price) || 0}">${escapeHtml(p.currency)} ${Number(p.price).toFixed(2)}</td>
        <td data-sort-value="${p.active ? "Activo" : "Inactivo"} ${p.featured ? "Destacado" : ""}">
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
  applyTableView("products");
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
        <td data-sort-value="${Number(o.id) || 0}">${o.id}</td>
        <td>
          <strong>${escapeHtml(o.email)}</strong>
          <div class="muted">${escapeHtml(o.address || "")}</div>
          ${o.notes ? `<div class="muted">${escapeHtml(o.notes)}</div>` : ""}
        </td>
        <td data-sort-value="${total}">Bs. ${total.toFixed(2)}</td>
        <td data-sort-value="${escapeHtml(o.status)}" data-search-value="${escapeHtml({ pending: "Pendiente", confirmed: "Confirmado", done: "Completado", cancelled: "Cancelado" }[o.status] || o.status)}">
          <select data-order-status="${o.id}">
            ${["pending", "confirmed", "done", "cancelled"]
              .map(
                (s) =>
                  `<option value="${s}" ${o.status === s ? "selected" : ""}>${{
                    pending: "Pendiente",
                    confirmed: "Confirmado",
                    done: "Completado",
                    cancelled: "Cancelado",
                  }[s]}</option>`
              )
              .join("")}
          </select>
        </td>
        <td class="muted">${escapeHtml(itemsText || "—")}</td>
        <td class="muted" data-sort-value="${escapeHtml(o.created_at)}">${new Date(o.created_at).toLocaleString("es")}</td>
      </tr>`;
    })
    .join("");
  applyTableView("orders");
}

async function loadFeedback() {
  const rows = await api("/feedback");
  els.feedbackTbody.innerHTML = rows
    .map(
      (f) => `
      <tr>
        <td>${escapeHtml(f.email || "—")}</td>
        <td data-sort-value="${Number(f.rating) || 0}">${f.rating ?? "—"}</td>
        <td>${escapeHtml(f.comment || "")}</td>
        <td class="muted" data-sort-value="${escapeHtml(f.created_at)}">${new Date(f.created_at).toLocaleString("es")}</td>
      </tr>`
    )
    .join("");
  applyTableView("feedback");
}

async function loadSocialLinks() {
  const links = await api("/site-settings/social-links");
  Object.entries(links).forEach(([name, url]) => {
    const input = els.socialLinksForm.elements.namedItem(name);
    if (input) input.value = url || "";
  });
}

async function refreshAll() {
  await loadCategories();
  await loadProducts();
  await loadOrders();
  await loadFeedback();
  await loadSocialLinks();
}

function productFormHtml(product = null) {
  return `
    <div class="grid-form">
      <section class="form-section full">
        <h4>Información del producto</h4>
        <div class="form-fields">
          <div class="field full">
            <label for="category_id">Categoría</label>
            <select id="category_id" name="category_id" required>
              ${categoryOptions(product?.category_id)}
            </select>
          </div>
          <div class="full">${field("name", "Nombre del producto", product?.name || "", "text", 'required maxlength="160"')}</div>
          <div class="field full">
            <label for="description">Descripción</label>
            <textarea id="description" name="description" rows="3" maxlength="1000" placeholder="Contá brevemente qué lo hace especial…">${escapeHtml(product?.description || "")}</textarea>
          </div>
        </div>
      </section>

      <section class="form-section full">
        <h4>Precio y visibilidad</h4>
        <div class="form-fields">
          ${field("price", "Precio", product?.price ?? "", "number", 'step="1" min="0" required inputmode="decimal"')}
          ${field("currency", "Moneda", product?.currency || "Bs.", "text", 'maxlength="8"')}
          <div class="checkbox-stack checkbox-options full">
            ${checkbox("featured", "Destacado en la home", Boolean(product?.featured))}
            ${checkbox("active", "Producto activo", product ? Boolean(product.active) : true)}
          </div>
        </div>
      </section>

      <section class="form-section full">
        <h4>Imágenes</h4>
        <div class="form-fields">
          <div class="field full">
            <span class="field-label">Fotos del producto</span>
            <div class="upload-field">
              <input class="upload-input" id="photos" name="photos" type="file" accept="image/*" multiple aria-describedby="photos-help photos-status" />
              <label class="upload-dropzone" for="photos">
                <span class="upload-icon" aria-hidden="true">↑</span>
                <span class="upload-copy"><strong>Elegí imágenes</strong><span>o arrastralas hasta acá</span></span>
                <span class="upload-format">JPG, PNG o WebP · Podés elegir varias</span>
              </label>
              <span class="upload-status" id="photos-status" aria-live="polite">Ningún archivo seleccionado</span>
            </div>
            <p class="field-help" id="photos-help">La primera imagen queda como portada; las demás se muestran en la galería.</p>
          </div>
          <div class="field full">
            <label for="images">URLs de fotos (una por línea)</label>
            <textarea id="images" name="images" rows="3" placeholder="https://… o /uploads/…">${escapeHtml(
              (Array.isArray(product?.images) && product.images.length
                ? product.images
                : product?.image_url
                  ? [product.image_url]
                  : []
              ).join("\n")
            )}</textarea>
          </div>
        </div>
      </section>
    </div>
  `;
}

function categoryFormHtml(cat = null) {
  return `
    <div class="grid-form">
      <section class="form-section full">
        <h4>Datos de la categoría</h4>
        <div class="form-fields">
          <div class="full">${field("name", "Nombre", cat?.name || "", "text", 'required maxlength="120"')}</div>
          ${field("slug", "Slug (opcional)", cat?.slug || "", "text", 'maxlength="120"')}
          <div class="field">
            <label for="menu_group">Grupo del menú</label>
            <select id="menu_group" name="menu_group">
              ${["calientes", "frias", "comida", "extras", "creaciones"]
                .map(
                  (g) =>
                    `<option value="${g}" ${cat?.menu_group === g ? "selected" : ""}>${g}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>
      </section>
      <section class="form-section full">
        <h4>Portada y orden</h4>
        <div class="form-fields">
          <div class="field full">
            <span class="field-label">Imagen de portada</span>
            <div class="upload-field">
              <input class="upload-input" id="photo" name="photo" type="file" accept="image/*" aria-describedby="photo-status" />
              <label class="upload-dropzone upload-dropzone--compact" for="photo">
                <span class="upload-icon" aria-hidden="true">↑</span>
                <span class="upload-copy"><strong>Elegí una imagen</strong><span>o arrastrala hasta acá</span></span>
                <span class="upload-format">JPG, PNG o WebP</span>
              </label>
              <span class="upload-status" id="photo-status" aria-live="polite">Ningún archivo seleccionado</span>
            </div>
          </div>
          <div class="full">${field("image_url", "URL de imagen (opcional)", cat?.image_url || "")}</div>
          ${field("sort_order", "Orden en el menú", cat?.sort_order ?? 0, "number", 'step="1"')}
          <div class="checkbox-stack">${checkbox("show_on_home", "Mostrar en la home", cat ? Boolean(cat.show_on_home) : true)}</div>
        </div>
      </section>
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

document.querySelectorAll("[data-table-search]").forEach((input) => {
  input.addEventListener("input", () => {
    const name = input.dataset.tableSearch;
    tableState(name).query = input.value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es");
    applyTableView(name);
  });
});

document.querySelectorAll("[data-sort-column]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.closest("table")?.querySelector("tbody[data-table-body]")?.dataset.tableBody;
    if (!name) return;
    const state = tableState(name);
    const column = Number(button.dataset.sortColumn);
    state.direction = state.sortColumn === column && state.direction === "asc" ? "desc" : "asc";
    state.sortColumn = column;
    applyTableView(name);
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

els.socialLinksForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = els.socialLinksForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const links = Object.fromEntries(new FormData(els.socialLinksForm));
    const saved = await api("/site-settings/social-links", {
      method: "PUT",
      body: JSON.stringify(links),
    });
    Object.entries(saved).forEach(([name, url]) => {
      const input = els.socialLinksForm.elements.namedItem(name);
      if (input) input.value = url || "";
    });
    showToast("Enlaces de redes guardados");
  } catch (err) {
    showToast(err.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

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
  const statusLabels = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    done: "Completado",
    cancelled: "Cancelado",
  };
  select.closest("td").dataset.sortValue = select.value;
  select.closest("td").dataset.searchValue = statusLabels[select.value] || select.value;
  applyTableView("orders");
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
