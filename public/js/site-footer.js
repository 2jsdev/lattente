// Muestra en el pie de página solo las redes sociales que se guardaron en el Admin
async function cargarRedesSociales() {
  const seccion = document.querySelector(".site-footer__social").parentElement;
  try {
    const redes = await api("/api/redes");

    let visibles = 0;
    document.querySelectorAll("[data-social-link]").forEach((link) => {
      const url = redes[link.dataset.socialLink];
      // Solo links completos (https://...); los demás se ocultan hasta corregirlos en el Admin
      if (!url || !url.startsWith("http")) return;
      link.href = url;
      link.hidden = false;
      visibles += 1;
    });
    seccion.hidden = visibles === 0;
  } catch (error) {
    console.error("Error al cargar redes sociales:", error);
    seccion.hidden = true;
  }
}

cargarRedesSociales();
