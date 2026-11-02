// Funciones generales de la página: avisos, carrito lateral, navegación y video de portada
const SECCIONES = ["menu", "orders", "feedback"];
let toastTimer = null;

// Qué sección está activa según el #hash de la URL (para marcar el menú de arriba)
function currentPage() {
  const hash = location.hash.replace("#", "").toLowerCase();
  if (hash === "order-summary" || hash === "catalog-title") return "orders";
  if (SECCIONES.includes(hash)) return hash;
  return "home";
}

function markActiveNav() {
  const page = currentPage();
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.nav === page);
  });
}

// Aviso flotante abajo de la pantalla. type: "ok" o "error"
function showToast(message, type = "ok") {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `toast is-visible is-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2800);
}

// Número de productos sobre el ícono del carrito
function updateCartBadge() {
  const count = cartCount();
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = String(count);
    el.hidden = count === 0;
  });
}

function isOrdersSection() {
  return currentPage() === "orders";
}

// Dibuja los productos dentro del carrito lateral
function renderCartDrawer() {
  const list = document.querySelector("[data-cart-list]");
  const total = document.querySelector("[data-cart-total]");
  const totalRow = document.querySelector("[data-cart-total-row]");
  const action = document.querySelector("[data-cart-action]");
  if (!list || !total) return;

  const items = readCart();
  const onOrders = isOrdersSection();

  if (items.length === 0) {
    list.innerHTML = `
      <div class="cart-empty-state">
        <span class="cart-empty-state__icon" aria-hidden="true">＋</span>
        <strong>${onOrders ? "Todavía no elegiste productos" : "Tu carrito está vacío"}</strong>
        <p>${onOrders ? "Agregalos desde el catálogo para ver tu resumen acá." : "Explorá el menú y agregá algo rico para empezar."}</p>
      </div>`;
    total.textContent = formatPrice(0);
    if (totalRow) totalRow.hidden = true;
    if (action) {
      action.href = onOrders ? "#catalog-title" : "#menu";
      action.textContent = onOrders ? "Volver al catálogo" : "Explorar menú";
    }
    return;
  }

  list.innerHTML = "";
  items.forEach((item) => {
    const nombre = escapeHtml(item.name);
    const imagen = item.image_url
      ? `<img class="cart-row__image" src="${escapeHtml(item.image_url)}" alt="" loading="lazy" />`
      : `<span class="cart-row__image cart-row__image--empty" aria-hidden="true"></span>`;

    list.innerHTML += `
      <div class="cart-row">
        <div class="cart-row__main">
          ${imagen}
          <div class="cart-row__info">
            <strong>${nombre}</strong>
            <span class="cart-row__price">${formatPrice(item.price * item.quantity, item.currency)}</span>
          </div>
          <button type="button" class="cart-row__remove" data-remove="${item.id}" aria-label="Quitar ${nombre}">×</button>
        </div>
        <div class="cart-row__controls">
          <span class="cart-row__unit-price">${formatPrice(item.price, item.currency)} c/u</span>
          <div class="cart-quantity" aria-label="Cantidad de ${nombre}">
            <button type="button" data-cart-quantity="-1" data-id="${item.id}" aria-label="Quitar una unidad de ${nombre}">−</button>
            <span aria-live="polite">${item.quantity}</span>
            <button type="button" data-cart-quantity="1" data-id="${item.id}" aria-label="Agregar una unidad de ${nombre}">+</button>
          </div>
        </div>
      </div>`;
  });

  total.textContent = formatPrice(cartTotal(items));
  if (totalRow) totalRow.hidden = false;
  if (action) {
    action.href = onOrders ? "#order-summary" : "#orders";
    action.textContent = onOrders ? "Ir al resumen" : "Continuar con el pedido";
  }
}

// Abrir / cerrar el carrito lateral y sus botones (+, −, quitar)
function setupCartDrawer() {
  const drawer = document.querySelector("[data-cart-drawer]");
  if (!drawer) return;

  const closeButton = drawer.querySelector("[data-close-cart]");
  const backdrop = drawer.querySelector(".cart-backdrop");
  const actionLink = drawer.querySelector("[data-cart-action]");
  let lastTrigger = null;

  // Mientras el carrito está abierto, el resto de la página no recibe clics ni teclado
  function setBackgroundInert(inert) {
    Array.from(document.body.children).forEach((element) => {
      if (element !== drawer) element.inert = inert;
    });
  }

  function open(event) {
    if (drawer.classList.contains("is-open")) return;
    lastTrigger = event.currentTarget;
    drawer.classList.add("is-open");
    document.body.classList.add("cart-open");
    setBackgroundInert(true);
    renderCartDrawer();
    if (closeButton) closeButton.focus();
  }

  function close() {
    if (!drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    document.body.classList.remove("cart-open");
    setBackgroundInert(false);
    if (lastTrigger) lastTrigger.focus();
  }

  document.querySelectorAll("[data-open-cart]").forEach((btn) => {
    btn.addEventListener("click", open);
  });
  if (closeButton) closeButton.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);
  if (actionLink) actionLink.addEventListener("click", close);

  // Escape cierra; Tab no se sale del carrito mientras está abierto
  document.addEventListener("keydown", (event) => {
    if (!drawer.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusables = Array.from(
      drawer.querySelectorAll("a[href], button:not([disabled]), input:not([disabled])")
    ).filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  drawer.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
      removeFromCart(Number(removeButton.dataset.remove));
      return;
    }

    const quantityButton = event.target.closest("[data-cart-quantity]");
    if (!quantityButton) return;
    const id = Number(quantityButton.dataset.id);
    const item = readCart().find((row) => Number(row.id) === id);
    if (!item) return;
    setCartQuantity(id, item.quantity + Number(quantityButton.dataset.cartQuantity));
  });
}

// La portada tiene 2 videos iguales: cuando uno termina, el otro aparece con un fundido
function setupHeroVideoLoop() {
  const videos = Array.from(document.querySelectorAll("[data-hero-video]"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (videos.length < 2 || reduceMotion) return;

  const fadeMs = 800;
  let active = videos.find((video) => video.classList.contains("is-active")) || videos[0];
  let transitioning = false;

  videos.forEach((video) => {
    video.loop = false;
    video.muted = true;
    video.playsInline = true;
  });

  active.play().catch(() => {});

  videos.forEach((video) => {
    video.addEventListener("timeupdate", async () => {
      if (video !== active || transitioning || !Number.isFinite(video.duration)) return;
      if (video.duration - video.currentTime > fadeMs / 1000) return;

      transitioning = true;
      const next = videos.find((otro) => otro !== active);
      try {
        next.currentTime = 0;
        await next.play();
        next.classList.add("is-active");

        const previous = active;
        active = next;
        setTimeout(() => {
          previous.classList.remove("is-active");
          previous.pause();
          previous.currentTime = 0;
          transitioning = false;
        }, fadeMs);
      } catch {
        transitioning = false;
      }
    });
  });
}

// Baja suavemente hasta la sección #id
function scrollToHashTarget(hash, updateHistory = true) {
  const id = String(hash || "").replace("#", "");
  const target = document.getElementById(id);
  if (!id || !target) return;

  if (updateHistory && location.hash !== `#${id}`) {
    history.pushState(null, "", `${location.pathname}${location.search}#${id}`);
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  markActiveNav();
}

// Los links del menú de arriba bajan a su sección sin recargar la página
function setupInPageNav() {
  const brand = document.querySelector(".app-header .brand");
  if (brand) {
    brand.addEventListener("click", (event) => {
      event.preventDefault();
      if (location.hash) {
        history.pushState(null, "", `${location.pathname}${location.search}`);
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      markActiveNav();
    });
  }

  document.querySelectorAll(".header-nav [data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      event.preventDefault();
      scrollToHashTarget(href);
    });
  });

  window.addEventListener("hashchange", markActiveNav);
  window.addEventListener("popstate", markActiveNav);

  if (location.hash) {
    scrollToHashTarget(location.hash, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  markActiveNav();
  updateCartBadge();
  setupCartDrawer();
  setupHeroVideoLoop();
  setupInPageNav();
});

// Cada vez que cambia el carrito, se actualizan el número y el carrito lateral
window.addEventListener("lattente:cart", () => {
  updateCartBadge();
  renderCartDrawer();
});
