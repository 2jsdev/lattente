// Sección "Menú": categorías, productos de cada categoría y buscador
const GROUP_LABELS = {
  todos: "Todos",
  calientes: "Calientes",
  frias: "Frías",
  comida: "Comida",
  extras: "Extras",
  creaciones: "Creaciones",
};

let allCategories = [];
let activeGroup = "todos";
let searchData = null; // productos y categorías para buscar (se piden una sola vez)
let searchTimer = null;
let searchGeneration = 0; // sirve para ignorar búsquedas viejas si el usuario sigue escribiendo

// "Cafés Fríos" -> "cafes frios" (sin tildes ni mayúsculas, para comparar)
function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bcaffe\b/g, "cafe")
    .replace(/\bcoffee\b/g, "cafe")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cancelPendingSearch() {
  clearTimeout(searchTimer);
  searchGeneration += 1;
}

// Espera un poco a que el usuario termine de escribir antes de buscar
function queueSearch(query, delay = 260) {
  cancelPendingSearch();
  const generation = searchGeneration;
  const value = String(query || "").trim();
  if (!value) {
    showBrowse();
    return;
  }
  searchTimer = setTimeout(() => showSearchResults(value, generation), delay);
}

async function getSearchData() {
  if (searchData) return searchData;
  const [products, categories] = await Promise.all([
    api("/api/products"),
    api("/api/categories"),
  ]);
  searchData = { products, categories };
  return searchData;
}

function browseEl() {
  return document.querySelector("[data-menu-browse]");
}

function detailEl() {
  return document.querySelector("[data-category-detail]");
}

function scrollToMenu() {
  const menu = document.querySelector("#menu");
  if (menu) menu.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Reinicia la animación de entrada (clase CSS "is-entering")
function animateMenuView(element) {
  if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.classList.remove("is-entering");
  void element.offsetWidth; // obliga al navegador a "olvidar" la animación anterior
  element.classList.add("is-entering");
  element.addEventListener("animationend", () => element.classList.remove("is-entering"), { once: true });
}

// Muestra la grilla de categorías
function showBrowse(animate = true) {
  cancelPendingSearch();
  const browse = browseEl();
  const detail = detailEl();
  if (browse) browse.hidden = false;
  if (detail) detail.hidden = true;
  if (animate) animateMenuView(browse);
  if (location.search) {
    history.replaceState(null, "", `${location.pathname}#menu`);
  }
}

// Muestra la lista de productos (de una categoría o de una búsqueda)
function showDetail() {
  const browse = browseEl();
  const detail = detailEl();
  if (browse) browse.hidden = true;
  if (detail) detail.hidden = false;
  animateMenuView(detail);
  scrollToMenu();
}

// Botones de filtro: Todos, Calientes, Frías...
function renderMenuFilters() {
  const filters = document.querySelector("[data-menu-filters]");
  if (!filters) return;

  const groups = ["todos"];
  allCategories.forEach((c) => {
    if (!groups.includes(c.menu_group)) groups.push(c.menu_group);
  });

  filters.innerHTML = "";
  groups.forEach((g) => {
    const active = g === activeGroup;
    filters.innerHTML += `
      <button type="button" class="menu-chip${active ? " is-active" : ""}" data-group="${escapeHtml(g)}" aria-pressed="${active}">
        ${escapeHtml(GROUP_LABELS[g] || g)}
      </button>`;
  });
}

// Grilla de categorías del filtro elegido
function renderGrid() {
  const grid = document.querySelector("[data-category-grid]");
  if (!grid) return;

  const list = activeGroup === "todos"
    ? allCategories
    : allCategories.filter((c) => c.menu_group === activeGroup);

  if (list.length === 0) {
    grid.innerHTML = `<p class="menu-empty">No hay categorías en este filtro.</p>`;
    return;
  }

  grid.innerHTML = "";
  list.forEach((cat, i) => {
    grid.innerHTML += `
      <button type="button" class="category-tile" data-open-category="${escapeHtml(cat.slug)}" style="animation-delay:${Math.min(i, 12) * 35}ms">
        <img src="${escapeHtml(urlSegura(cat.image_url))}" alt="" loading="lazy" />
        <h2>${escapeHtml(cat.name)}</h2>
      </button>`;
  });
}

// HTML de una tarjeta de producto del menú
function menuItemHtml(p, i, description) {
  return `
    <article class="menu-item" style="animation-delay:${i * 40}ms">
      ${renderProductPhotos(p)}
      <div class="menu-item-body">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(description)}</p>
        <p class="price">${escapeHtml(formatPrice(p.price, p.currency))}</p>
      </div>
      <button class="add" type="button" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" data-price="${escapeHtml(p.price)}" data-currency="${escapeHtml(p.currency)}" aria-label="Agregar ${escapeHtml(p.name)}">+</button>
    </article>`;
}

// Abre una categoría: GET /api/categories/:slug (trae la categoría con sus productos)
async function openCategory(slug) {
  cancelPendingSearch();
  try {
    const categoria = await api(`/api/categories/${encodeURIComponent(slug)}`);
    const title = document.querySelector("[data-detail-title]");
    const image = document.querySelector("[data-detail-image]");
    const list = document.querySelector("[data-detail-list]");
    detailEl().classList.remove("is-search-results");

    title.textContent = categoria.name;
    image.src = urlSegura(categoria.image_url);
    image.alt = categoria.name;

    if (categoria.products.length === 0) {
      list.innerHTML = `<p class="menu-empty">Esta categoría aún no tiene productos.</p>`;
    } else {
      list.innerHTML = "";
      categoria.products.forEach((p, i) => {
        list.innerHTML += menuItemHtml(p, i, p.description || "");
      });
    }

    history.replaceState(null, "", `/?category=${encodeURIComponent(slug)}#menu`);
    showDetail();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Busca en productos y categorías y muestra los resultados
async function showSearchResults(q, generation = searchGeneration) {
  const needle = normalizeSearch(q);
  if (!needle) {
    showBrowse(false);
    return;
  }

  try {
    const { products, categories } = await getSearchData();
    if (generation !== searchGeneration) return; // el usuario ya escribió otra cosa

    // Categorías cuyo nombre coincide: se muestran todos sus productos
    const matchingSlugs = categories
      .filter((c) => normalizeSearch(`${c.name} ${c.slug} ${c.menu_group}`).includes(needle))
      .map((c) => c.slug);

    const matches = products.filter((p) => {
      const texto = normalizeSearch(`${p.name} ${p.description || ""} ${p.category_name} ${p.category_slug}`);
      return texto.includes(needle) || matchingSlugs.includes(p.category_slug);
    });

    const title = document.querySelector("[data-detail-title]");
    const list = document.querySelector("[data-detail-list]");
    detailEl().classList.add("is-search-results");

    if (matches.length === 0) {
      title.textContent = `Resultados para “${q}”`;
      list.innerHTML = `
        <div class="menu-search-empty">
          <span class="menu-search-empty__icon" aria-hidden="true">⌕</span>
          <strong>No encontramos productos con esa búsqueda</strong>
          <p>Probá con otro nombre o buscá una categoría, como “café” o “blends”.</p>
        </div>`;
    } else {
      title.textContent = `${matches.length} ${matches.length === 1 ? "producto" : "productos"} para “${q}”`;
      list.innerHTML = "";
      matches.forEach((p, i) => {
        list.innerHTML += menuItemHtml(p, i, p.description || p.category_name || "");
      });
    }

    history.replaceState(null, "", `/?q=${encodeURIComponent(q)}#menu`);
    showDetail();
  } catch (error) {
    if (generation === searchGeneration) showToast(error.message, "error");
  }
}

// Carga las categorías y, si la URL trae ?q= o ?category=, abre eso directamente
async function loadMenu() {
  allCategories = await api("/api/categories?home=true");
  renderMenuFilters();
  renderGrid();

  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  const slug = params.get("category");

  if (q) {
    const input = document.querySelector("[data-search] input[name='q']");
    if (input) input.value = q;
    await showSearchResults(q);
  } else if (slug && allCategories.some((c) => c.slug === slug)) {
    await openCategory(slug);
  } else {
    showBrowse(false);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const searchForm = document.querySelector("[data-search]");
  const searchInput = document.querySelector("[data-search] input[name='q']");
  const filters = document.querySelector("[data-menu-filters]");
  const grid = document.querySelector("[data-category-grid]");
  const backButton = document.querySelector("[data-back-categories]");
  const detailList = document.querySelector("[data-detail-list]");

  try {
    await loadMenu();
  } catch (error) {
    showToast(error.message, "error");
  }

  // Buscador de arriba
  searchInput.addEventListener("focus", scrollToMenu);
  searchInput.addEventListener("input", () => queueSearch(searchInput.value));
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    queueSearch(searchInput.value, 0);
  });

  // Clic en un filtro
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-group]");
    if (!btn) return;
    activeGroup = btn.dataset.group;
    renderMenuFilters();
    renderGrid();
    showBrowse();
  });

  // Clic en una categoría
  grid.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-open-category]");
    if (tile) openCategory(tile.dataset.openCategory);
  });

  // Volver a las categorías
  backButton.addEventListener("click", () => {
    showBrowse();
    scrollToMenu();
  });

  // Fotos y botón "+" de cada producto
  bindGalleries(detailList);
  detailList.addEventListener("click", (e) => {
    const btn = e.target.closest("button.add[data-id]");
    if (!btn) return;
    const product = {
      id: Number(btn.dataset.id),
      name: btn.dataset.name,
      price: Number(btn.dataset.price),
      currency: btn.dataset.currency,
    };
    addToCart(product);
    showToast(`${product.name} agregado al carrito`);
  });
});
