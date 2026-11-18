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

// Devuelve la URL solo si es http/https (o una ruta del sitio como /multimedia/uploads/...)
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

// ---------- SESIÓN DEL USUARIO ----------
// Al registrarse o ingresar, el navegador guarda { token, usuario } en localStorage
const SESION_KEY = "lattente_sesion";

function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(SESION_KEY));
  } catch {
    return null;
  }
}

// Hace un fetch a la API y devuelve el JSON; si el server responde error, lanza el mensaje.
// Si hay sesión, manda el token para que el servidor sepa quién es.
async function api(ruta, opciones = {}) {
  const sesion = leerSesion();
  const headers = { "Content-Type": "application/json" };
  if (sesion) headers.Authorization = "Bearer " + sesion.token;

  const pedido = await fetch(ruta, {
    method: opciones.method || "GET",
    headers,
    body: opciones.body,
  });

  // 401 = el servidor no reconoce la sesión: se borra para que vuelva a ingresar
  if (pedido.status === 401) localStorage.removeItem(SESION_KEY);

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
