// Sección "Feedback": envía la calificación (POST /api/feedback) y muestra los comentarios (GET /api/feedback)

// Una carita por cada calificación, como en el formulario
const CARITAS = { 1: "Muy mal", 2: "Mal", 3: "Neutral", 4: "Bien", 5: "Excelente" };

async function enviarFeedback(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const submit = form.querySelector("[type='submit']");

  // Sin cuenta no se puede opinar: se abre el registro (usuarios.js)
  if (!exigirUsuario("Para dejar tu reseña necesitas una cuenta.")) return;

  // El correo no se pide: el servidor lo toma de la cuenta del usuario
  const feedback = {
    rating: Number(form.elements.rating.value),
    comment: form.elements.comment.value.trim(),
  };

  submit.disabled = true;
  try {
    await api("/api/feedback", { method: "POST", body: JSON.stringify(feedback) });
    form.reset();
    showToast("¡Gracias por tu calificación!");
    cargarComentarios(); // para que aparezca el comentario nuevo
  } catch (error) {
    showToast(error.message, "error");
    pintarBotonUsuario(); // por si la sesión venció
  } finally {
    submit.disabled = false;
  }
}

// Dibuja los últimos comentarios con el nombre, las estrellas y la fecha
async function cargarComentarios() {
  const lista = document.querySelector("[data-reviews]");
  const vacio = document.querySelector("[data-reviews-empty]");
  try {
    const comentarios = await api("/api/feedback");
    vacio.hidden = comentarios.length > 0;
    lista.innerHTML = "";
    comentarios.forEach((c) => {
      const estrellas = "★".repeat(c.rating) + "☆".repeat(5 - c.rating);
      lista.innerHTML += `
        <article class="review">
          <p class="review__stars" title="${CARITAS[c.rating]}">${estrellas}</p>
          <p class="review__text">“${escapeHtml(c.comment)}”</p>
          <p class="review__author">${escapeHtml(c.name || "Cliente")} · ${new Date(c.created_at).toLocaleDateString("es")}</p>
        </article>`;
    });
  } catch (error) {
    console.error("Error al cargar comentarios:", error);
  }
}

document.querySelector("[data-feedback-form]").addEventListener("submit", enviarFeedback);
cargarComentarios();
