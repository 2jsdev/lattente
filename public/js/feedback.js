(function () {
  document.addEventListener("DOMContentLoaded", () => {
    document
      .querySelector("[data-feedback-form]")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const { api, showToast } = window.Lattente;
        const form = e.currentTarget;
        const submit = form.querySelector('[type="submit"]');
        const fd = new FormData(form);

        submit.disabled = true;
        try {
          await api("/api/feedback", {
            method: "POST",
            body: JSON.stringify({
              email: fd.get("email"),
              rating: Number(fd.get("rating")),
              comment: fd.get("comment") || "",
            }),
          });
          form.reset();
          showToast("¡Gracias por tu calificación!");
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          submit.disabled = false;
        }
      });
  });
})();
