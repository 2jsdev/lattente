(function () {
  const script = document.currentScript;
  if (!script || document.querySelector(".site-footer")) return;

  script.insertAdjacentHTML(
    "beforebegin",
    `
      <footer class="site-footer">
        <div class="site-footer__inner">
          <figure class="site-footer__photo">
            <img
              src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1600&q=80"
              alt="Croissants recién horneados"
              loading="lazy"
            />
          </figure>
          <section class="site-footer__contact" aria-label="Contacto">
            <div>
              <h2>Dirección</h2>
              <address>Av. América 763, Cochabamba</address>
            </div>
            <div>
              <h2>Redes sociales</h2>
              <nav class="site-footer__social" aria-label="Redes sociales">
                <a href="#" data-social-link="instagram" aria-label="Instagram" target="_blank" rel="noopener" hidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle class="site-footer__icon-dot" cx="17.5" cy="6.8" r="1" />
                  </svg>
                </a>
                <a href="#" data-social-link="facebook" aria-label="Facebook" target="_blank" rel="noopener" hidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M13.6 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.5 1.6-1.5h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.4v3.2h2.8V21h3.4Z" />
                  </svg>
                </a>
                <a href="#" data-social-link="tiktok" aria-label="TikTok" target="_blank" rel="noopener" hidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M19.6 5.6a5.7 5.7 0 0 1-3.5-4.8V.5h-3.7v15.1a3.2 3.2 0 1 1-2.2-3.1V8.7a7 7 0 1 0 6 6.9V8a9.4 9.4 0 0 0 5.5 1.8V6.1a5.7 5.7 0 0 1-2.1-.5Z" />
                  </svg>
                </a>
              </nav>
            </div>
            <a class="site-footer__email" href="mailto:hola@lattente.bo">Email ↗</a>
          </section>
        </div>
      </footer>
    `
  );

  const socialSection = document.querySelector(".site-footer__social")?.parentElement;
  fetch("/api/site-settings/social-links")
    .then((response) => {
      if (!response.ok) throw new Error("No se pudieron cargar las redes sociales");
      return response.json();
    })
    .then((links) => {
      let visibleLinks = 0;
      document.querySelectorAll("[data-social-link]").forEach((link) => {
        const value = links[link.dataset.socialLink];
        if (!value) return;

        try {
          const url = new URL(value);
          if (!["http:", "https:"].includes(url.protocol)) return;
          link.href = url.href;
          link.hidden = false;
          visibleLinks += 1;
        } catch {
          // Invalid saved links stay hidden until corrected in Admin.
        }
      });
      if (socialSection) socialSection.hidden = visibleLinks === 0;
    })
    .catch(() => {
      if (socialSection) socialSection.hidden = true;
    });
})();
