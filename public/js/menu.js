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

  function browseEl() {
    return document.querySelector("[data-menu-browse]");
  }

  function detailEl() {
    return document.querySelector("[data-category-detail]");
  }

  function showBrowse() {
    const browse = browseEl();
    const detail = detailEl();
    if (browse) browse.hidden = false;
    if (detail) detail.hidden = true;
    if (location.search) {
      history.replaceState(null, "", `${location.pathname}#menu`);
    }
  }

  function showDetail() {
    const browse = browseEl();
    const detail = detailEl();
    if (browse) browse.hidden = true;
    if (detail) detail.hidden = false;
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
    const { api, showToast } = window.Lattente;
    const { formatPrice } = window.LattenteCart;

    try {
      const data = await api(`/api/categories/${encodeURIComponent(slug)}`);
      const title = document.querySelector("[data-detail-title]");
      const image = document.querySelector("[data-detail-image]");
      const list = document.querySelector("[data-detail-list]");

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

  async function showSearchResults(q) {
    const { api, showToast } = window.Lattente;
    const { formatPrice } = window.LattenteCart;
    const title = document.querySelector("[data-detail-title]");
    const image = document.querySelector("[data-detail-image]");
    const list = document.querySelector("[data-detail-list]");
    const needle = q.toLowerCase().trim();

    try {
      const products = await api("/api/products");
      const matches = products.filter((p) =>
        String(p.name || "")
          .toLowerCase()
          .includes(needle)
      );

      if (title) title.textContent = `Resultados: “${q}”`;
      if (image) {
        image.src = matches[0]?.image_url || "";
        image.alt = matches[0]?.name || "Búsqueda";
      }

      if (list) {
        if (!matches.length) {
          list.innerHTML = `<p class="menu-empty">No encontramos productos con ese nombre.</p>`;
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
      showToast(err.message, "error");
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
      showBrowse();
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const { showToast } = window.Lattente;
    const { addToCart } = window.LattenteCart;

    try {
      await loadMenu();
    } catch (err) {
      showToast(err.message, "error");
    }

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

    document.querySelector("[data-search]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = new FormData(e.currentTarget).get("q");
      if (q) {
        showSearchResults(String(q));
      }
    });
  });
})();
