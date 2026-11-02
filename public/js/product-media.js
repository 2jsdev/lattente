// Fotos de los productos: miniaturas en la tarjeta y galería a pantalla completa con zoom
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.35;

let galleryEl = null;

// Estado de la galería abierta
const gallery = {
  images: [],
  index: 0,
  title: "",
  lastFocus: null,
  zoom: 1,
  panX: 0,
  panY: 0,
};

// Dedos / punteros sobre la foto (para pellizcar y arrastrar)
const pointers = new Map();
let pinchStartDist = 0;
let pinchStartZoom = 1;
let dragPointerId = null;
let dragOrigin = null;
let swipeStartX = null;
let swipeStartY = null;
let didPan = false;

// Lista de fotos del producto (images) o, si no tiene, su image_url
function productImages(product) {
  if (!product) return [];
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images.map(urlSegura).filter(Boolean);
  }
  const image = urlSegura(product.image_url);
  return image ? [image] : [];
}

// HTML de las miniaturas (máximo 4) que abre la galería al hacer clic
function renderProductPhotos(product) {
  const images = productImages(product);
  if (images.length === 0) {
    return `<div class="menu-item-photos is-empty" aria-hidden="true"></div>`;
  }

  const lista = escapeHtml(JSON.stringify(images));
  const title = escapeHtml(product.name);
  const visible = images.slice(0, 4);
  const extra = images.length - visible.length;

  let tiles = "";
  visible.forEach((src, i) => {
    tiles += `<img src="${escapeHtml(src)}" alt="" loading="lazy" data-gallery-index="${i}" />`;
  });

  return `
    <button type="button" class="menu-item-photos" data-product-gallery="${lista}" data-gallery-title="${title}" aria-label="Ver fotos de ${title}">
      <span class="menu-item-photos__grid">${tiles}</span>
      <span class="menu-item-photos-count">${extra > 0 ? `+${extra}` : images.length}</span>
    </button>`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function resetZoom() {
  gallery.zoom = 1;
  gallery.panX = 0;
  gallery.panY = 0;
  applyZoomTransform();
}

// Aplica el zoom y el desplazamiento a la foto y actualiza los botones − 100% +
function applyZoomTransform() {
  if (!galleryEl) return;
  const img = galleryEl.querySelector("[data-gallery-stage]");
  const stage = galleryEl.querySelector(".photo-gallery__stage");
  const zoomOut = galleryEl.querySelector("[data-gallery-zoom-out]");
  const zoomIn = galleryEl.querySelector("[data-gallery-zoom-in]");
  const zoomLabel = galleryEl.querySelector("[data-gallery-zoom-label]");
  const zoomed = gallery.zoom > 1.01;

  img.style.transform = `translate(${gallery.panX}px, ${gallery.panY}px) scale(${gallery.zoom})`;
  img.classList.toggle("is-zoomed", zoomed);
  stage.classList.toggle("is-zoomed", zoomed);
  zoomOut.disabled = gallery.zoom <= MIN_ZOOM + 0.01;
  zoomIn.disabled = gallery.zoom >= MAX_ZOOM - 0.01;
  zoomLabel.textContent = `${Math.round(gallery.zoom * 100)}%`;
}

// Cambia el zoom; si se da (originX, originY), acerca hacia ese punto de la pantalla
function setZoom(next, originX, originY) {
  const stage = galleryEl.querySelector(".photo-gallery__stage");
  const prev = gallery.zoom;
  const zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);

  if (originX !== undefined && originY !== undefined) {
    const rect = stage.getBoundingClientRect();
    const cx = originX - rect.left - rect.width / 2;
    const cy = originY - rect.top - rect.height / 2;
    const ratio = zoom / prev;
    gallery.panX = cx - (cx - gallery.panX) * ratio;
    gallery.panY = cy - (cy - gallery.panY) * ratio;
  }

  gallery.zoom = zoom;
  if (zoom <= 1.01) {
    gallery.zoom = 1;
  }
  clampPan();
  applyZoomTransform();
}

// No deja arrastrar la foto más allá de sus bordes
function clampPan() {
  if (gallery.zoom <= 1.01) {
    gallery.panX = 0;
    gallery.panY = 0;
    return;
  }
  const rect = galleryEl.querySelector(".photo-gallery__stage").getBoundingClientRect();
  const maxX = (rect.width * (gallery.zoom - 1)) / 2 + 24;
  const maxY = (rect.height * (gallery.zoom - 1)) / 2 + 24;
  gallery.panX = clamp(gallery.panX, -maxX, maxX);
  gallery.panY = clamp(gallery.panY, -maxY, maxY);
}

// Distancia entre dos dedos (para el pellizco)
function pointerDistance() {
  const pts = Array.from(pointers.values());
  if (pts.length < 2) return 0;
  return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
}

// Crea el HTML de la galería la primera vez que se abre
function ensureGallery() {
  if (galleryEl) return;

  galleryEl = document.createElement("div");
  galleryEl.className = "photo-gallery";
  galleryEl.hidden = true;
  galleryEl.innerHTML = `
    <div class="photo-gallery__backdrop" data-gallery-close tabindex="-1"></div>
    <div class="photo-gallery__dialog" role="dialog" aria-modal="true" aria-labelledby="photo-gallery-title">
      <header class="photo-gallery__header">
        <p class="photo-gallery__title" id="photo-gallery-title" data-gallery-caption></p>
        <button type="button" class="photo-gallery__close" data-gallery-close aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
        </button>
      </header>
      <div class="photo-gallery__stage">
        <button type="button" class="photo-gallery__nav photo-gallery__nav--prev" data-gallery-prev aria-label="Foto anterior">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M14.5 6 9 12l5.5 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div class="photo-gallery__viewport" data-gallery-viewport>
          <img class="photo-gallery__img" data-gallery-stage alt="" draggable="false" />
        </div>
        <button type="button" class="photo-gallery__nav photo-gallery__nav--next" data-gallery-next aria-label="Foto siguiente">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M9.5 6 15 12l-5.5 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div class="photo-gallery__zoom" role="group" aria-label="Zoom">
          <button type="button" class="photo-gallery__zoom-btn" data-gallery-zoom-out aria-label="Alejar">−</button>
          <button type="button" class="photo-gallery__zoom-btn photo-gallery__zoom-label" data-gallery-zoom-reset data-gallery-zoom-label aria-label="Restablecer zoom">100%</button>
          <button type="button" class="photo-gallery__zoom-btn" data-gallery-zoom-in aria-label="Acercar">+</button>
        </div>
      </div>
      <div class="photo-gallery__meta">
        <div class="photo-gallery__pager">
          <span class="photo-gallery__counter" data-gallery-counter></span>
          <div class="photo-gallery__dots" data-gallery-dots></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(galleryEl);

  // Botones: cerrar, anterior, siguiente, zoom y puntitos
  galleryEl.addEventListener("click", (e) => {
    if (e.target.closest("[data-gallery-close]")) return closeGallery();
    if (e.target.closest("[data-gallery-prev]")) return stepGallery(-1);
    if (e.target.closest("[data-gallery-next]")) return stepGallery(1);
    if (e.target.closest("[data-gallery-zoom-in]")) return setZoom(gallery.zoom + ZOOM_STEP);
    if (e.target.closest("[data-gallery-zoom-out]")) return setZoom(gallery.zoom - ZOOM_STEP);
    if (e.target.closest("[data-gallery-zoom-reset]")) return resetZoom();
    const dot = e.target.closest("[data-gallery-dot]");
    if (dot) goToSlide(Number(dot.dataset.galleryDot), 0);
  });

  const stage = galleryEl.querySelector(".photo-gallery__stage");

  // Rueda del mouse = zoom
  stage.addEventListener(
    "wheel",
    (e) => {
      if (galleryEl.hidden) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom(gallery.zoom + delta, e.clientX, e.clientY);
    },
    { passive: false }
  );

  // Doble clic = acercar / volver al 100%
  stage.addEventListener("dblclick", (e) => {
    if (e.target.closest(".photo-gallery__nav, .photo-gallery__zoom")) return;
    if (gallery.zoom > 1.2) resetZoom();
    else setZoom(2.2, e.clientX, e.clientY);
  });

  // Tocar la foto: con 2 dedos empieza el pellizco; con zoom se arrastra; sin zoom se desliza
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".photo-gallery__nav, .photo-gallery__zoom")) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    didPan = false;

    if (pointers.size === 2) {
      pinchStartDist = pointerDistance();
      pinchStartZoom = gallery.zoom;
      dragPointerId = null;
      dragOrigin = null;
      swipeStartX = null;
      return;
    }

    if (gallery.zoom > 1.01) {
      dragPointerId = e.pointerId;
      dragOrigin = { x: e.clientX, y: e.clientY, panX: gallery.panX, panY: gallery.panY };
    } else {
      swipeStartX = e.clientX;
      swipeStartY = e.clientY;
    }
  });

  stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && pinchStartDist > 0) {
      const pts = Array.from(pointers.values());
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      setZoom(pinchStartZoom * (pointerDistance() / pinchStartDist), midX, midY);
      didPan = true;
      return;
    }

    if (dragPointerId === e.pointerId && dragOrigin) {
      gallery.panX = dragOrigin.panX + (e.clientX - dragOrigin.x);
      gallery.panY = dragOrigin.panY + (e.clientY - dragOrigin.y);
      clampPan();
      applyZoomTransform();
      didPan = true;
    }
  });

  // Al soltar: si fue un deslizamiento horizontal largo, pasa a la foto siguiente/anterior
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);

    if (pointers.size < 2) pinchStartDist = 0;

    if (dragPointerId === e.pointerId) {
      dragPointerId = null;
      dragOrigin = null;
    }

    if (swipeStartX !== null && gallery.zoom <= 1.01 && !didPan && pointers.size === 0) {
      const dx = e.clientX - swipeStartX;
      const dy = e.clientY - swipeStartY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
        stepGallery(dx < 0 ? 1 : -1);
      }
    }

    if (pointers.size === 0) {
      swipeStartX = null;
      swipeStartY = null;
    }
  }

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  stage.addEventListener("lostpointercapture", endPointer);
}

// Puntitos debajo de la foto (uno por foto)
function renderDots() {
  const dots = galleryEl.querySelector("[data-gallery-dots]");
  const multi = gallery.images.length > 1;
  dots.hidden = !multi;
  dots.innerHTML = "";
  if (!multi) return;

  gallery.images.forEach((src, i) => {
    const active = i === gallery.index;
    dots.innerHTML += `<button type="button" class="photo-gallery__dot${active ? " is-active" : ""}" data-gallery-dot="${i}" aria-label="Ir a foto ${i + 1}"${active ? ' aria-current="true"' : ""}></button>`;
  });
}

// Muestra la foto actual. direction: 1 = siguiente, -1 = anterior, 0 = sin animación
function paintSlide(direction = 0) {
  const img = galleryEl.querySelector("[data-gallery-stage]");
  const counter = galleryEl.querySelector("[data-gallery-counter]");
  const caption = galleryEl.querySelector("[data-gallery-caption]");
  const prev = galleryEl.querySelector("[data-gallery-prev]");
  const next = galleryEl.querySelector("[data-gallery-next]");
  const multi = gallery.images.length > 1;
  const src = gallery.images[gallery.index] || "";

  resetZoom();

  caption.textContent = gallery.title;
  counter.textContent = multi ? `${gallery.index + 1} / ${gallery.images.length}` : "";
  counter.hidden = !multi;
  prev.hidden = !multi;
  next.hidden = !multi;
  img.alt = `${gallery.title || "Foto"}, foto ${gallery.index + 1}`;

  if (direction === 0 || img.getAttribute("src") === src) {
    img.src = src;
    img.classList.remove("is-exit-next", "is-exit-prev", "is-enter-next", "is-enter-prev");
    renderDots();
    return;
  }

  // Animación: la foto actual sale hacia un lado y la nueva entra desde el otro
  const exitClass = direction > 0 ? "is-exit-next" : "is-exit-prev";
  const enterClass = direction > 0 ? "is-enter-next" : "is-enter-prev";
  img.classList.remove("is-enter-next", "is-enter-prev");
  img.classList.add(exitClass);

  setTimeout(() => {
    img.src = src;
    img.classList.remove(exitClass);
    img.classList.add(enterClass);
    setTimeout(() => img.classList.remove(enterClass), 30);
    renderDots();
  }, 160);
}

function goToSlide(index, direction = 0) {
  const total = gallery.images.length;
  if (total === 0) return;
  const next = ((index % total) + total) % total;
  if (next === gallery.index && direction !== 0) return;

  let dir = direction;
  if (dir === 0 && next > gallery.index) dir = 1;
  if (dir === 0 && next < gallery.index) dir = -1;
  gallery.index = next;
  paintSlide(dir);
}

function stepGallery(delta) {
  if (gallery.images.length < 2 || gallery.zoom > 1.05) return;
  goToSlide(gallery.index + delta, delta > 0 ? 1 : -1);
}

// Teclado: Escape cierra, flechas cambian de foto, + − 0 manejan el zoom
function onGalleryKeydown(e) {
  if (!galleryEl || galleryEl.hidden) return;
  const acciones = {
    Escape: () => closeGallery(),
    ArrowLeft: () => stepGallery(-1),
    ArrowRight: () => stepGallery(1),
    "+": () => setZoom(gallery.zoom + ZOOM_STEP),
    "=": () => setZoom(gallery.zoom + ZOOM_STEP),
    "-": () => setZoom(gallery.zoom - ZOOM_STEP),
    _: () => setZoom(gallery.zoom - ZOOM_STEP),
    0: () => resetZoom(),
  };
  if (acciones[e.key]) {
    e.preventDefault();
    acciones[e.key]();
  }
}

function openGallery(images, title = "", startIndex = 0) {
  if (images.length === 0) return;
  ensureGallery();
  gallery.images = images;
  gallery.title = title;
  gallery.index = clamp(startIndex, 0, images.length - 1);
  gallery.lastFocus = document.activeElement;
  pointers.clear();

  galleryEl.hidden = false;
  document.body.classList.add("photo-gallery-open");
  setTimeout(() => galleryEl.classList.add("is-open"), 20);

  paintSlide(0);
  galleryEl.querySelector(".photo-gallery__close").focus({ preventScroll: true });
  document.addEventListener("keydown", onGalleryKeydown);
}

function closeGallery() {
  if (!galleryEl || galleryEl.hidden) return;
  galleryEl.classList.remove("is-open");
  document.body.classList.remove("photo-gallery-open");
  document.removeEventListener("keydown", onGalleryKeydown);
  pointers.clear();
  resetZoom();

  // Espera a que termine la animación de cierre para ocultarla
  setTimeout(() => {
    if (galleryEl.classList.contains("is-open")) return;
    galleryEl.hidden = true;
    galleryEl.querySelector("[data-gallery-stage]").removeAttribute("src");
    gallery.images = [];
    gallery.index = 0;
    gallery.title = "";
    if (gallery.lastFocus) gallery.lastFocus.focus({ preventScroll: true });
    gallery.lastFocus = null;
  }, 220);
}

// Escucha los clics en las miniaturas dentro de "root" y abre la galería
function bindGalleries(root) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-product-gallery]");
    if (!btn) return;
    e.preventDefault();

    let images = [];
    try {
      images = JSON.parse(btn.dataset.productGallery);
    } catch {
      images = [];
    }

    const tile = e.target.closest("[data-gallery-index]");
    const startIndex = tile ? Number(tile.dataset.galleryIndex) : 0;
    openGallery(images, btn.dataset.galleryTitle || "", startIndex);
  });
}
