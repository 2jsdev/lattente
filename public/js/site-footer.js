// Muestra en el pie de página solo las redes sociales que se guardaron en el Admin
async function cargarRedesSociales() {
  const seccion = document.querySelector(".site-footer__social")?.parentElement;
  try {
    const pedido = await fetch("/api/site-settings/social-links");
    if (!pedido.ok) throw new Error("No se pudieron cargar las redes sociales");
    const links = await pedido.json();

    let visibles = 0;
    document.querySelectorAll("[data-social-link]").forEach((link) => {
      const valor = links[link.dataset.socialLink];
      if (!valor) return;

      try {
        const url = new URL(valor);
        if (!["http:", "https:"].includes(url.protocol)) return;
        link.href = url.href;
        link.hidden = false;
        visibles += 1;
      } catch {
        // Los enlaces guardados que no son válidos se ocultan hasta corregirlos en el Admin.
      }
    });
    if (seccion) seccion.hidden = visibles === 0;
  } catch (error) {
    console.error("Error al cargar redes sociales:", error);
    if (seccion) seccion.hidden = true;
  }
}

cargarRedesSociales();
