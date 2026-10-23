(function () {
  const cart = window.LattenteCart;

  function currentPage() {
    const file = (location.pathname.replace(/\.html$/, "").split("/").pop() || "").toLowerCase();
    if (file === "" || file === "index") return "home";
    if (file === "menu") return "menu";
    if (file === "orders") return "orders";
    if (file === "feedback") return "feedback";
    return "";
  }

  function markActiveNav() {
    const page = currentPage();
    document.querySelectorAll("[data-nav]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.nav === page);
    });
  }

  function showToast(message, type = "ok") {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast is-visible is-${type}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  function updateCartBadge() {
    const count = cart.cartCount();
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  function renderCartDrawer() {
    const list = document.querySelector("[data-cart-list]");
    const total = document.querySelector("[data-cart-total]");
    const totalRow = document.querySelector("[data-cart-total-row]");
    const action = document.querySelector("[data-cart-action]");
    if (!list || !total) return;

    const items = cart.readCart();
    const isOrdersPage = /(?:^|\/)orders\/?$/.test(location.pathname);
    if (!items.length) {
      list.innerHTML = `
        <div class="cart-empty-state">
          <span class="cart-empty-state__icon" aria-hidden="true">＋</span>
          <strong>${isOrdersPage ? "Todavía no elegiste productos" : "Tu carrito está vacío"}</strong>
          <p>${isOrdersPage ? "Agregalos desde el catálogo para ver tu resumen acá." : "Explorá el menú y agregá algo rico para empezar."}</p>
        </div>`;
      total.textContent = cart.formatPrice(0);
      if (totalRow) totalRow.hidden = true;
      if (action) {
        action.href = isOrdersPage ? "#catalog-title" : "/#menu";
        action.textContent = isOrdersPage ? "Volver al catálogo" : "Explorar menú";
      }
      return;
    }

    list.innerHTML = items
      .map(
        (item) => `
      <div class="cart-row">
        <div class="cart-row__main">
          ${item.image_url ? `<img class="cart-row__image" src="${escapeHTML(item.image_url)}" alt="" loading="lazy" />` : `<span class="cart-row__image cart-row__image--empty" aria-hidden="true"></span>`}
          <div class="cart-row__info">
            <strong>${escapeHTML(item.name)}</strong>
            <span class="cart-row__price">${cart.formatPrice(item.price * item.quantity, item.currency)}</span>
          </div>
          <button type="button" class="cart-row__remove" data-remove="${item.id}" aria-label="Quitar ${escapeHTML(item.name)}">×</button>
        </div>
        <div class="cart-row__controls">
          <span class="cart-row__unit-price">${cart.formatPrice(item.price, item.currency)} c/u</span>
          <div class="cart-quantity" aria-label="Cantidad de ${escapeHTML(item.name)}">
            <button type="button" data-cart-quantity="-1" data-id="${item.id}" aria-label="Quitar una unidad de ${escapeHTML(item.name)}">−</button>
            <span aria-live="polite">${item.quantity}</span>
            <button type="button" data-cart-quantity="1" data-id="${item.id}" aria-label="Agregar una unidad de ${escapeHTML(item.name)}">+</button>
          </div>
        </div>
      </div>`
      )
      .join("");

    total.textContent = cart.formatPrice(cart.cartTotal(items));
    if (totalRow) totalRow.hidden = false;
    if (action) {
      action.href = isOrdersPage ? "#order-summary" : "/orders";
      action.textContent = isOrdersPage ? "Ir al resumen" : "Continuar con el pedido";
    }
  }

  function setupCartDrawer() {
    const drawer = document.querySelector("[data-cart-drawer]");
    if (!drawer) return;

    let lastTrigger = null;
    const closeButton = drawer.querySelector("[data-close-cart]");
    const open = (event) => {
      lastTrigger = event?.currentTarget || document.activeElement;
      drawer.classList.add("is-open");
      document.body.classList.add("cart-open");
      renderCartDrawer();
      closeButton?.focus();
    };
    const close = () => {
      drawer.classList.remove("is-open");
      document.body.classList.remove("cart-open");
      lastTrigger?.focus();
    };

    document.querySelectorAll("[data-open-cart]").forEach((btn) => {
      btn.addEventListener("click", open);
    });
    drawer.querySelector("[data-close-cart]")?.addEventListener("click", close);
    drawer.querySelector(".cart-backdrop")?.addEventListener("click", close);
    drawer.querySelector("[data-cart-action]")?.addEventListener("click", (event) => {
      if (event.currentTarget.getAttribute("href")?.startsWith("#")) close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer.classList.contains("is-open")) close();
    });

    drawer.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-remove]");
      if (btn) {
        cart.removeFromCart(Number(btn.dataset.remove));
        return;
      }

      const quantityButton = event.target.closest("[data-cart-quantity]");
      if (!quantityButton) return;
      const id = Number(quantityButton.dataset.id);
      const item = cart.readCart().find((row) => Number(row.id) === id);
      if (!item) return;
      cart.setCartQuantity(id, item.quantity + Number(quantityButton.dataset.cartQuantity));
    });
  }

  async function api(path, options) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Error de servidor");
    }
    return data;
  }

  window.Lattente = {
    api,
    showToast,
    updateCartBadge,
    renderCartDrawer,
  };

  document.addEventListener("DOMContentLoaded", () => {
    markActiveNav();
    updateCartBadge();
    setupCartDrawer();

    document.querySelector("body.home-page .app-header .brand")?.addEventListener("click", (event) => {
      event.preventDefault();
      if (location.hash) {
        history.pushState(null, "", `${location.pathname}${location.search}`);
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });

    document.querySelector("body.home-page [data-nav='menu']")?.addEventListener("click", (event) => {
      event.preventDefault();
      const menu = document.querySelector("#menu");
      if (!menu) return;
      if (location.hash !== "#menu") {
        history.pushState(null, "", `${location.pathname}${location.search}#menu`);
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      menu.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });

  window.addEventListener("lattente:cart", () => {
    updateCartBadge();
    renderCartDrawer();
  });
})();
