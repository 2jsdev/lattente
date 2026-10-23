(function () {
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.35;

  let galleryBound = false;
  let galleryEl = null;
  let state = {
    images: [],
    index: 0,
    title: "",
    lastFocus: null,
    zoom: 1,
    panX: 0,
    panY: 0,
  };

  let pointers = new Map();
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let dragPointerId = null;
  let dragOrigin = null;
  let swipeStartX = null;
  let swipeStartY = null;
  let didPan = false;

  function escapeAttr(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function safeImageUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, window.location.origin);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function productImages(product) {
    if (Array.isArray(product?.images) && product.images.length) {
      return product.images.map(safeImageUrl).filter(Boolean);
    }
    const image = safeImageUrl(product?.image_url);
    return image ? [image] : [];
  }

  function renderProductPhotos(product) {
    const images = productImages(product);
    if (!images.length) {
      return `<div class="menu-item-photos is-empty" aria-hidden="true"></div>`;
    }

    const payload = escapeAttr(JSON.stringify(images));
    const title = escapeAttr(product.name);
    const visible = images.slice(0, 4);
    const extra = images.length - visible.length;

    const tiles = visible
      .map(
        (src, i) =>
          `<img src="${escapeAttr(src)}" alt="" loading="lazy" data-gallery-index="${i}" />`
      )
      .join("");

    const counter = `<span class="menu-item-photos-count">${
      extra > 0 ? `+${extra}` : images.length
    }</span>`;

    return `
      <button type="button" class="menu-item-photos" data-product-gallery="${payload}" data-gallery-title="${title}" aria-label="Ver fotos de ${title}">
        <span class="menu-item-photos__grid">${tiles}</span>
        ${counter}
      </button>`;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function resetZoom() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    applyZoomTransform();
  }

  function applyZoomTransform() {
    if (!galleryEl) return;
    const img = galleryEl.querySelector("[data-gallery-stage]");
    const stage = galleryEl.querySelector(".photo-gallery__stage");
    const zoomOut = galleryEl.querySelector("[data-gallery-zoom-out]");
    const zoomIn = galleryEl.querySelector("[data-gallery-zoom-in]");
    const zoomLabel = galleryEl.querySelector("[data-gallery-zoom-label]");

    if (img) {
      img.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
      img.classList.toggle("is-zoomed", state.zoom > 1.01);
    }
    if (stage) {
      stage.classList.toggle("is-zoomed", state.zoom > 1.01);
    }
    if (zoomOut) zoomOut.disabled = state.zoom <= MIN_ZOOM + 0.01;
    if (zoomIn) zoomIn.disabled = state.zoom >= MAX_ZOOM - 0.01;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function setZoom(next, originX, originY) {
    const stage = galleryEl?.querySelector(".photo-gallery__stage");
    const prev = state.zoom;
    const zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);

    if (stage && originX != null && originY != null && prev > 0) {
      const rect = stage.getBoundingClientRect();
      const cx = originX - rect.left - rect.width / 2;
      const cy = originY - rect.top - rect.height / 2;
      const ratio = zoom / prev;
      state.panX = cx - (cx - state.panX) * ratio;
      state.panY = cy - (cy - state.panY) * ratio;
    }

    state.zoom = zoom;
    if (zoom <= 1.01) {
      state.panX = 0;
      state.panY = 0;
      state.zoom = 1;
    }
    clampPan();
    applyZoomTransform();
  }

  function clampPan() {
    if (state.zoom <= 1.01) {
      state.panX = 0;
      state.panY = 0;
      return;
    }
    const stage = galleryEl?.querySelector(".photo-gallery__stage");
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const maxX = (rect.width * (state.zoom - 1)) / 2 + 24;
    const maxY = (rect.height * (state.zoom - 1)) / 2 + 24;
    state.panX = clamp(state.panX, -maxX, maxX);
    state.panY = clamp(state.panY, -maxY, maxY);
  }

  function pointerDistance() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function ensureGallery() {
    if (galleryEl) return galleryEl;

    galleryEl = document.createElement("div");
    galleryEl.className = "photo-gallery";
    galleryEl.dataset.photoGallery = "";
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

    galleryEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-gallery-close]")) {
        closeGallery();
        return;
      }
      if (e.target.closest("[data-gallery-prev]")) {
        stepGallery(-1);
        return;
      }
      if (e.target.closest("[data-gallery-next]")) {
        stepGallery(1);
        return;
      }
      if (e.target.closest("[data-gallery-zoom-in]")) {
        setZoom(state.zoom + ZOOM_STEP);
        return;
      }
      if (e.target.closest("[data-gallery-zoom-out]")) {
        setZoom(state.zoom - ZOOM_STEP);
        return;
      }
      if (e.target.closest("[data-gallery-zoom-reset]")) {
        resetZoom();
        return;
      }
      const dot = e.target.closest("[data-gallery-dot]");
      if (dot) {
        goToSlide(Number(dot.dataset.galleryDot), 0);
      }
    });

    const stage = galleryEl.querySelector(".photo-gallery__stage");

    stage.addEventListener(
      "wheel",
      (e) => {
        if (galleryEl.hidden) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom(state.zoom + delta, e.clientX, e.clientY);
      },
      { passive: false }
    );

    stage.addEventListener("dblclick", (e) => {
      if (e.target.closest(".photo-gallery__nav, .photo-gallery__zoom")) return;
      if (state.zoom > 1.2) resetZoom();
      else setZoom(2.2, e.clientX, e.clientY);
    });

    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".photo-gallery__nav, .photo-gallery__zoom")) return;
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      didPan = false;

      if (pointers.size === 2) {
        pinchStartDist = pointerDistance();
        pinchStartZoom = state.zoom;
        dragPointerId = null;
        dragOrigin = null;
        swipeStartX = null;
        return;
      }

      if (state.zoom > 1.01) {
        dragPointerId = e.pointerId;
        dragOrigin = {
          x: e.clientX,
          y: e.clientY,
          panX: state.panX,
          panY: state.panY,
        };
      } else {
        swipeStartX = e.clientX;
        swipeStartY = e.clientY;
      }
    });

    stage.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && pinchStartDist > 0) {
        const dist = pointerDistance();
        const pts = [...pointers.values()];
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        setZoom(pinchStartZoom * (dist / pinchStartDist), midX, midY);
        didPan = true;
        return;
      }

      if (dragPointerId === e.pointerId && dragOrigin) {
        state.panX = dragOrigin.panX + (e.clientX - dragOrigin.x);
        state.panY = dragOrigin.panY + (e.clientY - dragOrigin.y);
        clampPan();
        applyZoomTransform();
        didPan = true;
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);

      if (pointers.size < 2) {
        pinchStartDist = 0;
      }

      if (dragPointerId === e.pointerId) {
        dragPointerId = null;
        dragOrigin = null;
      }

      if (
        swipeStartX != null &&
        state.zoom <= 1.01 &&
        !didPan &&
        pointers.size === 0
      ) {
        const dx = e.clientX - swipeStartX;
        const dy = e.clientY - (swipeStartY ?? e.clientY);
        swipeStartX = null;
        swipeStartY = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
          stepGallery(dx < 0 ? 1 : -1);
        }
        return;
      }

      if (pointers.size === 0) {
        swipeStartX = null;
        swipeStartY = null;
      }
    }

    stage.addEventListener("pointerup", endPointer);
    stage.addEventListener("pointercancel", endPointer);
    stage.addEventListener("lostpointercapture", endPointer);

    return galleryEl;
  }

  function renderDots() {
    const dots = galleryEl.querySelector("[data-gallery-dots]");
    const multi = state.images.length > 1;
    dots.hidden = !multi;
    if (!multi) {
      dots.innerHTML = "";
      return;
    }
    dots.innerHTML = state.images
      .map((_, i) => {
        const active = i === state.index;
        return `<button type="button" class="photo-gallery__dot${active ? " is-active" : ""}" data-gallery-dot="${i}" aria-label="Ir a foto ${i + 1}"${active ? ' aria-current="true"' : ""}></button>`;
      })
      .join("");
  }

  function paintSlide(direction = 0) {
    const img = galleryEl.querySelector("[data-gallery-stage]");
    const counter = galleryEl.querySelector("[data-gallery-counter]");
    const caption = galleryEl.querySelector("[data-gallery-caption]");
    const prev = galleryEl.querySelector("[data-gallery-prev]");
    const next = galleryEl.querySelector("[data-gallery-next]");
    const multi = state.images.length > 1;
    const src = state.images[state.index] || "";

    resetZoom();

    caption.textContent = state.title;
    counter.textContent = multi
      ? `${state.index + 1} / ${state.images.length}`
      : "";
    counter.hidden = !multi;
    prev.hidden = !multi;
    next.hidden = !multi;
    prev.disabled = !multi;
    next.disabled = !multi;

    img.alt = state.title
      ? `${state.title}, foto ${state.index + 1}`
      : `Foto ${state.index + 1}`;

    if (!direction || img.getAttribute("src") === src) {
      img.src = src;
      img.classList.remove(
        "is-exit-next",
        "is-exit-prev",
        "is-enter-next",
        "is-enter-prev"
      );
      renderDots();
      applyZoomTransform();
      return;
    }

    const exitClass = direction > 0 ? "is-exit-next" : "is-exit-prev";
    const enterClass = direction > 0 ? "is-enter-next" : "is-enter-prev";
    img.classList.remove("is-enter-next", "is-enter-prev");
    img.classList.add(exitClass);

    window.setTimeout(() => {
      img.src = src;
      img.classList.remove(exitClass);
      img.classList.add(enterClass);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          img.classList.remove(enterClass);
          applyZoomTransform();
        });
      });
      renderDots();
    }, 160);
  }

  function goToSlide(index, direction = 0) {
    if (!state.images.length) return;
    const len = state.images.length;
    const next = ((index % len) + len) % len;
    if (next === state.index && direction !== 0) return;
    const dir =
      direction ||
      (next > state.index ? 1 : next < state.index ? -1 : 0);
    state.index = next;
    paintSlide(dir);
  }

  function stepGallery(delta) {
    if (state.images.length < 2) return;
    if (state.zoom > 1.05) return;
    goToSlide(state.index + delta, delta > 0 ? 1 : -1);
  }

  function onKeydown(e) {
    if (galleryEl?.hidden) return;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeGallery();
        break;
      case "ArrowLeft":
        e.preventDefault();
        stepGallery(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        stepGallery(1);
        break;
      case "+":
      case "=":
        e.preventDefault();
        setZoom(state.zoom + ZOOM_STEP);
        break;
      case "-":
      case "_":
        e.preventDefault();
        setZoom(state.zoom - ZOOM_STEP);
        break;
      case "0":
        e.preventDefault();
        resetZoom();
        break;
      default:
        break;
    }
  }

  function openGallery(images, title = "", startIndex = 0) {
    if (!images.length) return;
    ensureGallery();
    state.images = images;
    state.title = title;
    state.index = Math.max(0, Math.min(startIndex, images.length - 1));
    state.lastFocus = document.activeElement;
    pointers.clear();
    resetZoom();

    galleryEl.hidden = false;
    document.body.classList.add("photo-gallery-open");
    requestAnimationFrame(() => {
      galleryEl.classList.add("is-open");
    });

    paintSlide(0);
    const closeBtn = galleryEl.querySelector(".photo-gallery__close");
    closeBtn?.focus({ preventScroll: true });
    document.addEventListener("keydown", onKeydown);
  }

  function closeGallery() {
    if (!galleryEl || galleryEl.hidden) return;
    galleryEl.classList.remove("is-open");
    document.body.classList.remove("photo-gallery-open");
    document.removeEventListener("keydown", onKeydown);
    pointers.clear();
    resetZoom();

    window.setTimeout(() => {
      if (galleryEl.classList.contains("is-open")) return;
      galleryEl.hidden = true;
      const img = galleryEl.querySelector("[data-gallery-stage]");
      if (img) {
        img.removeAttribute("src");
        img.style.transform = "";
        img.classList.remove("is-zoomed");
      }
      state.images = [];
      state.index = 0;
      state.title = "";
      if (state.lastFocus && typeof state.lastFocus.focus === "function") {
        state.lastFocus.focus({ preventScroll: true });
      }
      state.lastFocus = null;
    }, 220);
  }

  function bindGalleries(root = document) {
    if (galleryBound && root === document) return;
    if (root === document) galleryBound = true;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-product-gallery]");
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();

      let images = [];
      try {
        images = JSON.parse(btn.dataset.productGallery || "[]");
      } catch {
        images = [];
      }
      if (!images.length) return;

      const title = btn.dataset.galleryTitle || "";
      const tile = e.target.closest("[data-gallery-index]");
      const startIndex = tile ? Number(tile.dataset.galleryIndex) || 0 : 0;
      openGallery(images, title, startIndex);
    });
  }

  window.LattenteMedia = {
    productImages,
    renderProductPhotos,
    bindGalleries,
    openGallery,
    closeGallery,
  };
})();
