// Sección "Feedback": envía la calificación del cliente (POST /api/feedback)
document.querySelector("[data-feedback-form]").addEventListener("submit", enviarFeedback);

async function enviarFeedback(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const submit = form.querySelector("[type='submit']");

  const feedback = {
    email: form.elements.email.value.trim(),
    rating: Number(form.elements.rating.value),
    comment: form.elements.comment.value.trim(),
  };

  submit.disabled = true;
  try {
    await api("/api/feedback", { method: "POST", body: JSON.stringify(feedback) });
    form.reset();
    showToast("¡Gracias por tu calificación!");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    submit.disabled = false;
  }
}
