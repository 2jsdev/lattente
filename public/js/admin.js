// Panel de administración: login, productos, categorías, pedidos, feedback y redes sociales
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

const ORDER_STATUS = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  done: "Completado",
  cancelled: "Cancelado",
};

// ---------- WHATSAPP ----------
// Código de país de Bolivia (se agrega adelante del celular)
const CODIGO_PAIS = "591";

// Arma el link de WhatsApp con el mensaje ya escrito para el cliente.
// wa.me abre WhatsApp (web o celular); el encargado solo aprieta "Enviar".
function linkWhatsApp(pedido) {
  const numero = String(pedido.phone || "").replace(/\D/g, ""); // deja solo los números
  if (!numero) return "";
  const mensaje = `Hola, te escribimos de Lattente. Tu pedido #${pedido.id} ya está listo, puedes pasar a recogerlo.`;
  return `https://wa.me/${CODIGO_PAIS}${numero}?text=${encodeURIComponent(mensaje)}`;
}

let categoriesCache = [];
let toastTimer = null;
let modalReturnFocus = null;
let modalResizeObserver = null;

// Búsqueda y orden de cada tabla: { products: { query, sortColumn, direction }, ... }
const tableStates = {};

// ---------- TOKEN (se guarda en el navegador al iniciar sesión) ----------
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

// Quita tildes y pasa a minúsculas, para buscar "cafe" y encontrar "Café"
function normalizar(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ---------- BUSCAR Y ORDENAR TABLAS ----------
function tableState(name) {
  if (!tableStates[name]) {
    tableStates[name] = { query: "", sortColumn: null, direction: "asc" };
  }
  return tableStates[name];
}

// Texto de una fila para el buscador (sin los botones ni selects)
function searchableRowText(row) {
  let texto = "";
  Array.from(row.cells).forEach((cell) => {
    if (cell.dataset.searchValue) {
      texto += " " + cell.dataset.searchValue;
    } else {
      const copia = cell.cloneNode(true);
      copia.querySelectorAll("button, select").forEach((control) => control.remove());
      texto += " " + copia.textContent;
    }
  });
  return normalizar(texto);
}

// Valor de una celda para ordenar (número, fecha o texto)
function sortValue(row, column, type) {
  const cell = row.cells[column];
  if (!cell) return "";
  const value = cell.dataset.sortValue !== undefined ? cell.dataset.sortValue : cell.textContent.trim();
  if (type === "number") return Number(value) || 0;
  if (type === "date") return new Date(value).getTime() || 0;
  return value.toLowerCase();
}

// Ordena las filas, oculta las que no coinciden con la búsqueda y actualiza el contador
function applyTableView(name) {
  const tbody = document.querySelector(`[data-table-body="${name}"]`);
  if (!tbody) return;
  const table = tbody.closest("table");
  const state = tableState(name);
  const rows = Array.from(tbody.rows);

  if (state.sortColumn !== null) {
    const sortButton = table.querySelector(`[data-sort-column="${state.sortColumn}"]`);
    const type = sortButton ? sortButton.dataset.sortType || "text" : "text";
    rows.sort((left, right) => {
      const a = sortValue(left, state.sortColumn, type);
      const b = sortValue(right, state.sortColumn, type);
      const order = typeof a === "number"
        ? a - b
        : String(a).localeCompare(String(b), "es", { numeric: true });
      return state.direction === "asc" ? order : -order;
    });
    rows.forEach((row) => tbody.append(row));
  }

  let visibleCount = 0;
  rows.forEach((row) => {
    const matches = !state.query || searchableRowText(row).includes(state.query);
    row.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  const count = document.querySelector(`[data-table-count="${name}"]`);
  if (count) count.textContent = `${visibleCount} de ${rows.length}`;
  const empty = document.querySelector(`[data-table-empty="${name}"]`);
  if (empty) empty.classList.toggle("hidden", visibleCount > 0);

  // Flechita de orden en el encabezado (para lectores de pantalla)
  table.querySelectorAll("[data-sort-column]").forEach((button) => {
    const selected = Number(button.dataset.sortColumn) === state.sortColumn;
    const direccion = state.direction === "asc" ? "ascending" : "descending";
    button.closest("th").setAttribute("aria-sort", selected ? direccion : "none");
  });
}

// ---------- API DEL ADMIN ----------
// Igual que api() de utils.js, pero con el token y la ruta /api/admin.
// Si body es FormData (formularios con fotos) no se pone Content-Type: el navegador lo arma solo.
async function apiAdmin(ruta, opciones = {}) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (opciones.body && !(opciones.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const pedido = await fetch(`/api/admin${ruta}`, {
    method: opciones.method || "GET",
    headers,
    body: opciones.body,
  });

  let resultado = {};
  try {
    resultado = await pedido.json();
  } catch {
    resultado = {};
  }

  if (pedido.status === 401) {
    clearToken();
    showLogin();
    throw new Error(resultado.error || "Sesión expirada");
  }
  if (!pedido.ok) {
    throw new Error(resultado.error || `Error ${pedido.status}`);
  }
  return resultado;
}

function showLogin() {
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
}

// ---------- VENTANA (MODAL) CON FORMULARIO ----------
function closeModal() {
  if (els.modalRoot.classList.contains("hidden")) return;
  els.modalRoot.classList.add("hidden");
  els.modalRoot.innerHTML = "";
  if (modalResizeObserver) modalResizeObserver.disconnect();
  modalResizeObserver = null;
  Array.from(document.body.children).forEach((element) => { element.inert = false; });
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
  if (modalReturnFocus) modalReturnFocus.focus();
  modalReturnFocus = null;
}

// Abre el modal con el HTML del formulario; al guardar llama a onSubmit(FormData)
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
          <span class="modal-scrollbar-thumb"></span>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" data-cancel>Cancelar</button>
          <button type="submit" class="btn">Guardar</button>
        </div>
      </form>
    </div>
  `;
  els.modalRoot.classList.remove("hidden");

  // El resto de la página no recibe clics ni teclado mientras el modal está abierto
  Array.from(document.body.children).forEach((element) => {
    if (element !== els.modalRoot && element !== els.toast) element.inert = true;
  });

  els.modalRoot.querySelector("[data-cancel]").addEventListener("click", closeModal);
  els.modalRoot.querySelector("[data-modal-close]").addEventListener("click", closeModal);
  els.modalRoot.onclick = (e) => {
    if (e.target === els.modalRoot) closeModal();
  };

  const form = els.modalRoot.querySelector("#modal-form");
  setupModalScrollbar(form);
  form.querySelectorAll(".upload-input").forEach(setupUploadField);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    try {
      await onSubmit(new FormData(form));
      closeModal();
    } catch (error) {
      showToast(error.message, true);
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar";
    }
  });

  const primerCampo = form.querySelector("input, select, textarea");
  if (primerCampo) setTimeout(() => primerCampo.focus(), 0);
}

// Campo para subir fotos: muestra el nombre elegido y permite arrastrar imágenes
function setupUploadField(input) {
  const dropzone = input.parentElement.querySelector(".upload-dropzone");
  const status = input.parentElement.querySelector(".upload-status");

  function updateFiles() {
    const files = input.files;
    if (files.length === 0) status.textContent = "Ningún archivo seleccionado";
    else if (files.length === 1) status.textContent = files[0].name;
    else status.textContent = `${files.length} imágenes seleccionadas`;
  }

  input.addEventListener("change", updateFiles);
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    // Se pasan los archivos soltados al <input type="file">
    const transfer = new DataTransfer();
    const elegidos = input.multiple ? files : files.slice(0, 1);
    elegidos.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    updateFiles();
  });
}

// Barra de desplazamiento propia del modal (la del navegador se oculta en el CSS)
function setupModalScrollbar(form) {
  const content = form.querySelector(".modal-form-content");
  const track = form.querySelector(".modal-scrollbar");
  const thumb = form.querySelector(".modal-scrollbar-thumb");

  // Calcula el alto y la posición de la barrita según cuánto se bajó
  function update() {
    const maxScroll = content.scrollHeight - content.clientHeight;
    const trackHeight = track.clientHeight;
    track.hidden = maxScroll <= 0 || trackHeight <= 0;
    if (track.hidden) return;

    const thumbHeight = Math.min(trackHeight, Math.max(38, trackHeight * content.clientHeight / content.scrollHeight));
    const travel = trackHeight - thumbHeight;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.top = `${travel * content.scrollTop / maxScroll}px`;
  }

  content.addEventListener("scroll", update);

  // Clic en la barra: salta a esa posición
  track.addEventListener("pointerdown", (event) => {
    if (event.target !== track) return;
    const bounds = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    content.scrollTop = ratio * (content.scrollHeight - content.clientHeight);
  });

  // Arrastrar la barrita
  let dragY = 0;
  let dragScroll = 0;
  thumb.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    thumb.setPointerCapture(event.pointerId);
    dragY = event.clientY;
    dragScroll = content.scrollTop;
  });
  thumb.addEventListener("pointermove", (event) => {
    if (!thumb.hasPointerCapture(event.pointerId)) return;
    const maxScroll = content.scrollHeight - content.clientHeight;
    const travel = track.clientHeight - thumb.offsetHeight;
    if (maxScroll <= 0 || travel <= 0) return;
    content.scrollTop = dragScroll + (event.clientY - dragY) * maxScroll / travel;
  });

  // Recalcula si cambia el tamaño del contenido
  modalResizeObserver = new ResizeObserver(update);
  modalResizeObserver.observe(content);
  modalResizeObserver.observe(form.querySelector(".modal-form-inner"));
  setTimeout(update, 0);
}

// Escape cierra el modal; Tab no se sale del modal mientras está abierto
document.addEventListener("keydown", (event) => {
  if (els.modalRoot.classList.contains("hidden")) return;
  if (event.key === "Escape") {
    closeModal();
    return;
  }
  if (event.key !== "Tab") return;

  const dialog = els.modalRoot.querySelector("[role='dialog']");
  const focusable = Array.from(
    dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']")
  ).filter((element) => !element.hidden && element.getClientRects().length > 0);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

// ---------- PIEZAS DE FORMULARIO ----------
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
  let options = "";
  categoriesCache.forEach((c) => {
    const selected = Number(c.id) === Number(selectedId) ? "selected" : "";
    options += `<option value="${c.id}" ${selected}>${escapeHtml(c.name)}</option>`;
  });
  return options;
}

// ---------- CARGAR TABLAS (GET) ----------
async function loadCategories() {
  categoriesCache = await apiAdmin("/categories");
  els.categoriesTbody.innerHTML = "";
  categoriesCache.forEach((c) => {
    const enHome = c.show_on_home ? "Sí" : "No";
    els.categoriesTbody.innerHTML += `
      <tr>
        <td>${c.image_url ? `<img class="thumb" src="${escapeHtml(c.image_url)}" alt="" />` : ""}</td>
        <td data-sort-value="${escapeHtml(c.name)}">
          <strong>${escapeHtml(c.name)}</strong>
          <div class="muted">${escapeHtml(c.slug)}</div>
        </td>
        <td data-sort-value="${escapeHtml(c.menu_group)}">${escapeHtml(c.menu_group)}</td>
        <td data-sort-value="${enHome}"><span class="badge ${c.show_on_home ? "on" : "off"}">${enHome}</span></td>
        <td data-sort-value="${Number(c.product_count)}">${c.product_count}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit-cat="${c.id}">Editar</button>
            <button type="button" data-del-cat="${c.id}">Borrar</button>
          </div>
        </td>
      </tr>`;
  });
  applyTableView("categories");
}

async function loadProducts() {
  const products = await apiAdmin("/products");
  els.productsTbody.innerHTML = "";
  products.forEach((p) => {
    const fotos = p.images.length > 1 ? `<div class="muted">${p.images.length} fotos</div>` : "";
    els.productsTbody.innerHTML += `
      <tr>
        <td>${p.image_url ? `<img class="thumb" src="${escapeHtml(p.image_url)}" alt="" />` : ""}</td>
        <td data-sort-value="${escapeHtml(p.name)}">
          <strong>${escapeHtml(p.name)}</strong>
          <div class="muted">${escapeHtml(p.description || "")}</div>
          ${fotos}
        </td>
        <td data-sort-value="${escapeHtml(p.category_name)}">${escapeHtml(p.category_name)}</td>
        <td data-sort-value="${Number(p.price)}">${escapeHtml(p.currency)} ${Number(p.price).toFixed(2)}</td>
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
      </tr>`;
  });
  applyTableView("products");
}

async function loadOrders() {
  const orders = await apiAdmin("/orders");
  els.ordersTbody.innerHTML = "";
  orders.forEach((o) => {
    let total = 0;
    let itemsText = "";
    o.items.forEach((i) => {
      total += Number(i.unit_price) * Number(i.quantity);
      itemsText += (itemsText ? ", " : "") + `${i.quantity}× ${i.product_name}`;
    });

    let options = "";
    Object.keys(ORDER_STATUS).forEach((s) => {
      options += `<option value="${s}" ${o.status === s ? "selected" : ""}>${ORDER_STATUS[s]}</option>`;
    });

    const whatsapp = linkWhatsApp(o);

    els.ordersTbody.innerHTML += `
      <tr>
        <td data-sort-value="${o.id}">${o.id}</td>
        <td>
          <strong>${escapeHtml(o.email)}</strong>
          ${o.phone ? `<div class="muted">Cel. ${escapeHtml(o.phone)}</div>` : ""}
          <div class="muted">${escapeHtml(o.address || "")}</div>
          ${whatsapp ? `<a class="btn whatsapp" href="${escapeHtml(whatsapp)}" target="_blank" rel="noopener">Avisar por WhatsApp</a>` : ""}
          ${o.notes ? `<div class="muted">${escapeHtml(o.notes)}</div>` : ""}
        </td>
        <td data-sort-value="${total}">Bs. ${total.toFixed(2)}</td>
        <td data-sort-value="${escapeHtml(o.status)}" data-search-value="${escapeHtml(ORDER_STATUS[o.status] || o.status)}">
          <select data-order-status="${o.id}">${options}</select>
        </td>
        <td class="muted">${escapeHtml(itemsText || "—")}</td>
        <td class="muted" data-sort-value="${escapeHtml(o.created_at)}">${new Date(o.created_at).toLocaleString("es")}</td>
      </tr>`;
  });
  applyTableView("orders");
}

// Reporte del día: GET /api/admin/report?fecha=AAAA-MM-DD
async function loadReport() {
  const inputFecha = document.getElementById("report-date");
  if (!inputFecha.value) inputFecha.value = new Date().toLocaleDateString("en-CA"); // hoy, en formato AAAA-MM-DD

  const reporte = await apiAdmin(`/report?fecha=${inputFecha.value}`);
  document.getElementById("report-orders").textContent = reporte.pedidos;
  document.getElementById("report-total").textContent = `Bs. ${reporte.total.toFixed(2)}`;

  const tbody = document.getElementById("report-tbody");
  tbody.innerHTML = "";
  if (reporte.productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted">No hay ventas este día.</td></tr>`;
  }
  reporte.productos.forEach((p) => {
    tbody.innerHTML += `
      <tr>
        <td>${escapeHtml(p.nombre)}</td>
        <td>${p.cantidad}</td>
        <td>Bs. ${Number(p.total).toFixed(2)}</td>
      </tr>`;
  });
}

async function loadFeedback() {
  const rows = await apiAdmin("/feedback");
  els.feedbackTbody.innerHTML = "";
  rows.forEach((f) => {
    els.feedbackTbody.innerHTML += `
      <tr>
        <td>${escapeHtml(f.email || "—")}</td>
        <td data-sort-value="${f.rating}">${f.rating}</td>
        <td>${escapeHtml(f.comment || "")}</td>
        <td class="muted" data-sort-value="${escapeHtml(f.created_at)}">${new Date(f.created_at).toLocaleString("es")}</td>
      </tr>`;
  });
  applyTableView("feedback");
}

// Redes sociales: GET /api/redes (la misma ruta que usa el pie de página)
async function loadSocialLinks() {
  const redes = await api("/api/redes");
  const campos = els.socialLinksForm.elements;
  campos.instagram.value = redes.instagram;
  campos.facebook.value = redes.facebook;
  campos.tiktok.value = redes.tiktok;
}

async function refreshAll() {
  await loadCategories();
  await loadProducts();
  await loadOrders();
  await loadReport();
  await loadFeedback();
  await loadSocialLinks();
}

// ---------- FORMULARIOS DE PRODUCTO Y CATEGORÍA ----------
// product = null para uno nuevo, o el producto a modificar
function productFormHtml(product = null) {
  const p = product || {};
  let fotos = [];
  if (Array.isArray(p.images) && p.images.length > 0) fotos = p.images;
  else if (p.image_url) fotos = [p.image_url];
  const precio = p.price !== undefined ? p.price : "";

  return `
    <div class="grid-form">
      <section class="form-section full">
        <h4>Información del producto</h4>
        <div class="form-fields">
          <div class="field full">
            <label for="category_id">Categoría</label>
            <select id="category_id" name="category_id" required>
              ${categoryOptions(p.category_id)}
            </select>
          </div>
          <div class="full">${field("name", "Nombre del producto", p.name || "", "text", 'required maxlength="160"')}</div>
          <div class="field full">
            <label for="description">Descripción</label>
            <textarea id="description" name="description" rows="3" maxlength="1000" placeholder="Contá brevemente qué lo hace especial…">${escapeHtml(p.description || "")}</textarea>
          </div>
        </div>
      </section>

      <section class="form-section full">
        <h4>Precio y visibilidad</h4>
        <div class="form-fields">
          ${field("price", "Precio", precio, "number", 'step="1" min="0" required inputmode="decimal"')}
          ${field("currency", "Moneda", p.currency || "Bs.", "text", 'maxlength="8"')}
          <div class="checkbox-stack checkbox-options full">
            ${checkbox("featured", "Destacado en la home", Boolean(p.featured))}
            ${checkbox("active", "Producto activo", product ? Boolean(p.active) : true)}
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
            <textarea id="images" name="images" rows="3" placeholder="https://… o /multimedia/uploads/…">${escapeHtml(fotos.join("\n"))}</textarea>
          </div>
        </div>
      </section>
    </div>
  `;
}

function categoryFormHtml(cat = null) {
  const c = cat || {};
  let grupos = "";
  ["calientes", "frias", "comida", "extras", "creaciones"].forEach((g) => {
    grupos += `<option value="${g}" ${c.menu_group === g ? "selected" : ""}>${g}</option>`;
  });

  return `
    <div class="grid-form">
      <section class="form-section full">
        <h4>Datos de la categoría</h4>
        <div class="form-fields">
          <div class="full">${field("name", "Nombre", c.name || "", "text", 'required maxlength="120"')}</div>
          <div class="field">
            <label for="slug">Slug (para la URL)</label>
            <input id="slug" name="slug" type="text" value="${escapeHtml(c.slug || "")}" required maxlength="120" pattern="[a-z0-9-]+" placeholder="bebidas-frias" title="Solo minúsculas, números y guiones" />
            <p class="field-help">Solo minúsculas, números y guiones. Ej.: bebidas-frias</p>
          </div>
          <div class="field">
            <label for="menu_group">Grupo del menú</label>
            <select id="menu_group" name="menu_group">${grupos}</select>
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
          <div class="full">${field("image_url", "URL de imagen (opcional)", c.image_url || "")}</div>
          ${field("sort_order", "Orden en el menú", c.sort_order || 0, "number", 'step="1"')}
          <div class="checkbox-stack">${checkbox("show_on_home", "Mostrar en la home", cat ? Boolean(c.show_on_home) : true)}</div>
        </div>
      </section>
    </div>
  `;
}

// Crear (POST) o modificar (PUT) un producto. Se manda FormData porque puede llevar fotos.
function openProductEditor(product = null) {
  const titulo = product ? "Editar producto" : "Nuevo producto";
  openModal(titulo, productFormHtml(product), async (datos) => {
    // Los checkbox solo se envían si están marcados; mandamos el valor siempre.
    datos.set("featured", datos.get("featured") === "on" ? "true" : "false");
    datos.set("active", datos.get("active") === "on" ? "true" : "false");

    if (product) {
      await apiAdmin(`/products/${product.id}`, { method: "PUT", body: datos });
      showToast("Producto actualizado");
    } else {
      await apiAdmin("/products", { method: "POST", body: datos });
      showToast("Producto creado");
    }
    await loadProducts();
  });
}

function openCategoryEditor(cat = null) {
  const titulo = cat ? "Editar categoría" : "Nueva categoría";
  openModal(titulo, categoryFormHtml(cat), async (datos) => {
    datos.set("show_on_home", datos.get("show_on_home") === "on" ? "true" : "false");

    if (cat) {
      await apiAdmin(`/categories/${cat.id}`, { method: "PUT", body: datos });
      showToast("Categoría actualizada");
    } else {
      await apiAdmin("/categories", { method: "POST", body: datos });
      showToast("Categoría creada");
    }
    await loadCategories();
    await loadProducts();
  });
}

// ---------- EVENTOS ----------
// Pestañas: Productos, Categorías, Pedidos...
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.panel !== tab.dataset.tab);
    });
  });
});

// Buscador de cada tabla
document.querySelectorAll("[data-table-search]").forEach((input) => {
  input.addEventListener("input", () => {
    const name = input.dataset.tableSearch;
    tableState(name).query = normalizar(input.value.trim());
    applyTableView(name);
  });
});

// Clic en un encabezado: ordena por esa columna (otro clic invierte el orden)
document.querySelectorAll("[data-sort-column]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.closest("table").querySelector("tbody[data-table-body]").dataset.tableBody;
    const state = tableState(name);
    const column = Number(button.dataset.sortColumn);
    state.direction = state.sortColumn === column && state.direction === "asc" ? "desc" : "asc";
    state.sortColumn = column;
    applyTableView(name);
  });
});

// LOGIN: POST /api/admin/login con la contraseña; el server devuelve un token
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = els.loginForm.elements.password.value;
  try {
    const pedido = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const resultado = await pedido.json();
    if (!pedido.ok) throw new Error(resultado.error || "Error de login");

    setToken(resultado.token);
    showApp();
    await refreshAll();
    showToast("Sesión iniciada");
  } catch (error) {
    showToast(error.message, true);
  }
});

els.logoutBtn.addEventListener("click", () => {
  clearToken();
  showLogin();
});

els.newProductBtn.addEventListener("click", () => openProductEditor());
els.newCategoryBtn.addEventListener("click", () => openCategoryEditor());

els.refreshOrdersBtn.addEventListener("click", async () => {
  try {
    await loadOrders();
    showToast("Pedidos actualizados");
  } catch (error) {
    showToast(error.message, true);
  }
});

// Al cambiar el día del reporte, se vuelve a pedir
document.getElementById("report-date").addEventListener("change", async () => {
  try {
    await loadReport();
  } catch (error) {
    showToast(error.message, true);
  }
});

els.refreshFeedbackBtn.addEventListener("click", async () => {
  try {
    await loadFeedback();
    showToast("Feedback actualizado");
  } catch (error) {
    showToast(error.message, true);
  }
});

// Guardar redes sociales: PUT /api/admin/redes
els.socialLinksForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const campos = els.socialLinksForm.elements;
  const submitButton = els.socialLinksForm.querySelector("[type='submit']");
  const redes = {
    instagram: campos.instagram.value.trim(),
    facebook: campos.facebook.value.trim(),
    tiktok: campos.tiktok.value.trim(),
  };

  submitButton.disabled = true;
  try {
    await apiAdmin("/redes", { method: "PUT", body: JSON.stringify(redes) });
    showToast("Enlaces de redes guardados");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

// Botones Editar / Borrar de la tabla de productos
els.productsTbody.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-prod]");
  const delBtn = e.target.closest("[data-del-prod]");

  if (editBtn) {
    const products = await apiAdmin("/products");
    const product = products.find((p) => Number(p.id) === Number(editBtn.dataset.editProd));
    if (product) openProductEditor(product);
  }

  if (delBtn && confirm("¿Borrar este producto?")) {
    try {
      await apiAdmin(`/products/${delBtn.dataset.delProd}`, { method: "DELETE" });
      showToast("Producto borrado");
      await loadProducts();
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

// Botones Editar / Borrar de la tabla de categorías
els.categoriesTbody.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-cat]");
  const delBtn = e.target.closest("[data-del-cat]");

  if (editBtn) {
    const cat = categoriesCache.find((c) => Number(c.id) === Number(editBtn.dataset.editCat));
    if (cat) openCategoryEditor(cat);
  }

  if (delBtn && confirm("¿Borrar esta categoría? También puede fallar si tiene productos.")) {
    try {
      await apiAdmin(`/categories/${delBtn.dataset.delCat}`, { method: "DELETE" });
      showToast("Categoría borrada");
      await loadCategories();
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

// Cambiar el estado de un pedido: PATCH /api/admin/orders/:id
els.ordersTbody.addEventListener("change", async (e) => {
  const select = e.target.closest("[data-order-status]");
  if (!select) return;

  const celda = select.closest("td");
  celda.dataset.sortValue = select.value;
  celda.dataset.searchValue = ORDER_STATUS[select.value];
  applyTableView("orders");

  try {
    await apiAdmin(`/orders/${select.dataset.orderStatus}`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value }),
    });
    showToast("Estado actualizado");
    await loadReport(); // un pedido cancelado deja de sumar en el reporte
  } catch (error) {
    showToast(error.message, true);
  }
});

// Al abrir la página: si hay token guardado, se cargan los datos; si no sirve, se pide login
async function boot() {
  if (!getToken()) {
    showLogin();
    return;
  }
  try {
    showApp();
    await refreshAll();
  } catch {
    clearToken();
    showLogin();
  }
}

boot();
