(function () {
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
  let searchIndexPromise = null;
  let searchTimer = null;
  let searchGeneration = 0;

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\bcaffe\b/g, "cafe")
      .replace(/\bcoffee\b/g, "cafe")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function cancelPendingSearch() {
    clearTimeout(searchTimer);
    searchTimer = null;
    searchGeneration += 1;
  }

  function queueSearch(query, delay = 260) {
    clearTimeout(searchTimer);
    searchTimer = null;
    const generation = ++searchGeneration;
    const value = String(query || "").trim();
    if (!value) {
      showBrowse();
      return;
    }
    searchTimer = setTimeout(() => showSearchResults(value, generation), delay);
  }

  function getSearchIndex(api) {
    if (!searchIndexPromise) {
      searchIndexPromise = Promise.all([api("/api/products"), api("/api/categories")])
        .then(([products, categories]) => ({ products, categories }))
        .catch((error) => {
          searchIndexPromise = null;
          throw error;
        });
    }
    return searchIndexPromise;
  }

  function browseEl() {
    return document.querySelector("[data-menu-browse]");
  }

  function detailEl() {
    return document.querySelector("[data-category-detail]");
  }

  function animateMenuView(element) {
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.classList.remove("is-entering");
    void element.offsetWidth;
    element.classList.add("is-entering");
    element.addEventListener(
      "animationend",
      () => element.classList.remove("is-entering"),
      { once: true }
    );
  }

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

  function showDetail(animate = true) {
    const browse = browseEl();
    const detail = detailEl();
    if (browse) browse.hidden = true;
    if (detail) detail.hidden = false;
    if (animate) animateMenuView(detail);
    document.querySelector("#menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderFilters() {
    const filters = document.querySelector("[data-menu-filters]");
    if (!filters) return;

    const groups = ["todos", ...new Set(allCategories.map((c) => c.menu_group))];
    filters.innerHTML = groups
      .map(
        (g) => `
      <button type="button" class="menu-chip${g === activeGroup ? " is-active" : ""}" data-group="${g}">
        ${GROUP_LABELS[g] || g}
      </button>`
      )
      .join("");
  }

  function renderGrid() {
    const grid = document.querySelector("[data-category-grid]");
    if (!grid) return;

    const list =
      activeGroup === "todos"
        ? allCategories
        : allCategories.filter((c) => c.menu_group === activeGroup);

    if (!list.length) {
      grid.innerHTML = `<p class="menu-empty">No hay categorías en este filtro.</p>`;
      return;
    }

    grid.innerHTML = list
      .map(
        (cat, i) => `
      <button type="button" class="category-tile" data-open-category="${cat.slug}" style="animation-delay:${Math.min(i, 12) * 35}ms">
        <img src="${cat.image_url}" alt="" loading="lazy" />
        <h2>${cat.name}</h2>
      </button>`
      )
      .join("");
  }

  async function openCategory(slug) {
    cancelPendingSearch();
    const { api, showToast } = window.Lattente;
    const { formatPrice } = window.LattenteCart;

    try {
      const data = await api(`/api/categories/${encodeURIComponent(slug)}`);
      const title = document.querySelector("[data-detail-title]");
      const image = document.querySelector("[data-detail-image]");
      const list = document.querySelector("[data-detail-list]");
      detailEl()?.classList.remove("is-search-results");

      if (title) title.textContent = data.name;
      if (image) {
        image.src = data.image_url || "";
        image.alt = data.name;
      }

      if (list) {
        if (!data.products?.length) {
          list.innerHTML = `<p class="menu-empty">Esta categoría aún no tiene productos.</p>`;
        } else {
          const { renderProductPhotos } = window.LattenteMedia;
          list.innerHTML = data.products
            .map(
              (p, i) => `
            <article class="menu-item" style="animation-delay:${i * 40}ms">
              ${renderProductPhotos(p)}
              <div class="menu-item-body">
                <h3>${p.name}</h3>
                <p>${p.description || ""}</p>
                <p class="price">${formatPrice(p.price, p.currency)}</p>
              </div>
              <button class="add" type="button" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-currency="${p.currency}" aria-label="Agregar ${p.name}">+</button>
            </article>`
            )
            .join("");
        }
      }

      history.replaceState(null, "", `/?category=${encodeURIComponent(slug)}#menu`);
      showDetail();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function showSearchResults(q, generation = ++searchGeneration) {
    const { api, showToast } = window.Lattente;
    const { formatPrice } = window.LattenteCart;
    const title = document.querySelector("[data-detail-title]");
    const list = document.querySelector("[data-detail-list]");
    const detail = detailEl();
    const needle = normalizeSearch(q);
    if (!needle) {
      showBrowse(false);
      return;
    }

    try {
      const { products, categories } = await getSearchIndex(api);
      if (generation !== searchGeneration) return;
      const matchingCategories = categories.filter((category) =>
        [category.name, category.slug, category.menu_group]
          .map(normalizeSearch)
          .some((value) => value.includes(needle))
      );
      const matchingSlugs = new Set(matchingCategories.map((category) => category.slug));
      const matches = products.filter((product) => {
        const searchable = [
          product.name,
          product.description,
          product.category_name,
          product.category_slug,
        ]
          .map(normalizeSearch)
          .join(" ");
        return searchable.includes(needle) || matchingSlugs.has(product.category_slug);
      });

      detail?.classList.add("is-search-results");
      if (title) {
        title.textContent = matches.length
          ? `${matches.length} ${matches.length === 1 ? "producto" : "productos"} para “${q}”`
          : `Resultados para “${q}”`;
      }

      if (list) {
        if (!matches.length) {
          list.innerHTML = `
            <div class="menu-search-empty">
              <span class="menu-search-empty__icon" aria-hidden="true">⌕</span>
              <strong>No encontramos productos con esa búsqueda</strong>
              <p>Probá con otro nombre o buscá una categoría, como “café” o “blends”.</p>
            </div>`;
        } else {
          const { renderProductPhotos } = window.LattenteMedia;
          list.innerHTML = matches
            .map(
              (p, i) => `
            <article class="menu-item" style="animation-delay:${i * 40}ms">
              ${renderProductPhotos(p)}
              <div class="menu-item-body">
                <h3>${p.name}</h3>
                <p>${p.description || p.category_name || ""}</p>
                <p class="price">${formatPrice(p.price, p.currency)}</p>
              </div>
              <button class="add" type="button" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-currency="${p.currency}" aria-label="Agregar ${p.name}">+</button>
            </article>`
            )
            .join("");
        }
      }

      history.replaceState(null, "", `/?q=${encodeURIComponent(q)}#menu`);
      showDetail();
    } catch (err) {
      if (generation === searchGeneration) showToast(err.message, "error");
    }
  }

  async function loadMenu() {
    const { api } = window.Lattente;
    allCategories = await api("/api/categories?home=true");
    renderFilters();
    renderGrid();

    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    const slug = params.get("category");

    if (q) {
      await showSearchResults(q);
      const input = document.querySelector("[data-search] input[name='q']");
      if (input) input.value = q;
    } else if (slug && allCategories.some((c) => c.slug === slug)) {
      await openCategory(slug);
    } else {
      showBrowse(false);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const { showToast } = window.Lattente;
    const { addToCart } = window.LattenteCart;
    if (document.body.classList.contains("home-page")) {
      document.querySelector("[data-search] input[name='q']")?.addEventListener("focus", () => {
        document.querySelector("#menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    try {
      await loadMenu();
    } catch (err) {
      showToast(err.message, "error");
    }

    const searchForm = document.querySelector("[data-search]");
    const searchInput = searchForm?.querySelector("input[name='q']");
    searchInput?.addEventListener("input", (event) => queueSearch(event.currentTarget.value));
    searchForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      queueSearch(searchInput?.value || "", 0);
    });

    document.querySelector("[data-menu-filters]")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-group]");
      if (!btn) return;
      activeGroup = btn.dataset.group;
      renderFilters();
      renderGrid();
      showBrowse();
    });

    document.querySelector("[data-category-grid]")?.addEventListener("click", (e) => {
      const tile = e.target.closest("[data-open-category]");
      if (!tile) return;
      openCategory(tile.dataset.openCategory);
    });

    document.querySelector("[data-back-categories]")?.addEventListener("click", () => {
      showBrowse();
      document.querySelector("#menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    window.LattenteMedia.bindGalleries(document.querySelector("[data-detail-list]") || document);

    document.querySelector("[data-detail-list]")?.addEventListener("click", (e) => {
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
})();
