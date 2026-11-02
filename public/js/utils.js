// Funciones que usan varios archivos. Se carga antes que los demás scripts.

// Evita que un texto de la base se interprete como HTML al usar innerHTML
function escapeHtml(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Devuelve la URL solo si es http/https (o una ruta del sitio como /uploads/...)
function urlSegura(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  try {
    const url = new URL(texto, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    return "";
  } catch {
    return "";
  }
}

// Hace un fetch a la API y devuelve el JSON; si el server responde error, lanza el mensaje
async function api(ruta, opciones = {}) {
  const pedido = await fetch(ruta, {
    method: opciones.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opciones.body,
  });

  let resultado = {};
  try {
    resultado = await pedido.json();
  } catch {
    resultado = {};
  }

  if (!pedido.ok) {
    throw new Error(resultado.error || "Error de servidor");
  }
  return resultado;
}
