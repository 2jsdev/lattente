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

  function renderCartDrawer() {
    const list = document.querySelector("[data-cart-list]");
    const total = document.querySelector("[data-cart-total]");
    if (!list || !total) return;

    const items = cart.readCart();
    if (!items.length) {
      list.innerHTML = `<p class="cart-empty">Tu carrito está vacío.</p>`;
      total.textContent = cart.formatPrice(0);
      return;
    }

    list.innerHTML = items
      .map(
        (item) => `
      <div class="cart-row">
        <strong>${item.name}</strong>
        <button type="button" class="add" data-remove="${item.id}" aria-label="Quitar">×</button>
        <div class="meta">
          <span>× ${item.quantity}</span>
          <span>${cart.formatPrice(item.price * item.quantity, item.currency)}</span>
        </div>
      </div>`
      )
      .join("");

    total.textContent = cart.formatPrice(cart.cartTotal(items));
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

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer.classList.contains("is-open")) close();
    });

    drawer.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-remove]");
      if (!btn) return;
      cart.removeFromCart(Number(btn.dataset.remove));
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
  });

  window.addEventListener("lattente:cart", () => {
    updateCartBadge();
    renderCartDrawer();
  });
})();
