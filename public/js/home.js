(function () {
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("[data-search]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = new FormData(e.currentTarget).get("q");
      if (q) {
        location.href = `/menu?q=${encodeURIComponent(String(q))}`;
      }
    });
  });
})();
