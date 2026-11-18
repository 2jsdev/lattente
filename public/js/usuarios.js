// Usuarios: registro, ingreso y cierre de sesión.
// Para hacer un pedido o dejar una reseña hay que estar registrado.
// leerSesion() y SESION_KEY están en utils.js.

const dialogo = document.querySelector("[data-auth-dialog]");
const formRegistro = document.querySelector("[data-register-form]");
const formIngreso = document.querySelector("[data-login-form]");
const botonUsuario = document.querySelector("[data-user-button]");

// Muestra el formulario de registro o el de ingreso
function mostrarFormulario(cual) {
  formRegistro.hidden = cual !== "register";
  formIngreso.hidden = cual !== "login";
}

// Abre la ventana. "motivo" explica por qué se pide (por ejemplo, para pedir)
function abrirRegistro(motivo = "") {
  document.querySelector("[data-auth-reason]").textContent = motivo;
  mostrarFormulario("register");
  dialogo.showModal();
}

// Devuelve true si hay sesión. Si no, abre el registro y devuelve false.
// La usan orders.js y feedback.js antes de enviar.
function exigirUsuario(motivo) {
  if (leerSesion()) return true;
  abrirRegistro(motivo);
  return false;
}

// Cambia el botón de la cabecera: "Registrarse" o "Salir (nombre)"
function pintarBotonUsuario() {
  const sesion = leerSesion();
  botonUsuario.textContent = sesion ? `Salir (${sesion.usuario.name.split(" ")[0]})` : "Registrarse";
}

// En el pedido muestra a nombre de quién va (el correo y el celular salen de la cuenta)
function mostrarDatosDelPedido() {
  const texto = document.querySelector("[data-order-user]");
  const sesion = leerSesion();
  texto.hidden = !sesion;
  if (sesion) {
    const u = sesion.usuario;
    texto.textContent = `A nombre de ${u.name} · ${u.email} · Cel. ${u.phone}`;
  }
}

// Guarda la sesión que devuelve el servidor y actualiza la página
function guardarSesion(respuesta) {
  localStorage.setItem(SESION_KEY, JSON.stringify(respuesta));
  dialogo.close();
  pintarBotonUsuario();
  mostrarDatosDelPedido();
  showToast(`¡Hola, ${respuesta.usuario.name.split(" ")[0]}! Ya puedes pedir y opinar`);
}

// Registro: POST /api/register
formRegistro.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const datos = {
    name: formRegistro.elements.name.value.trim(),
    email: formRegistro.elements.email.value.trim(),
    phone: formRegistro.elements.phone.value.trim(),
    password: formRegistro.elements.password.value,
  };
  try {
    const respuesta = await api("/api/register", { method: "POST", body: JSON.stringify(datos) });
    formRegistro.reset();
    guardarSesion(respuesta);
  } catch (error) {
    showToast(error.message, "error");
  }
});

// Ingreso: POST /api/login
formIngreso.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const datos = {
    email: formIngreso.elements.email.value.trim(),
    password: formIngreso.elements.password.value,
  };
  try {
    const respuesta = await api("/api/login", { method: "POST", body: JSON.stringify(datos) });
    formIngreso.reset();
    guardarSesion(respuesta);
  } catch (error) {
    showToast(error.message, "error");
  }
});

// Botón de la cabecera: abre el registro o cierra la sesión
botonUsuario.addEventListener("click", () => {
  if (!leerSesion()) {
    abrirRegistro();
    return;
  }
  // Cerrar sesión: se borra la sesión guardada en el navegador
  localStorage.removeItem(SESION_KEY);
  pintarBotonUsuario();
  mostrarDatosDelPedido();
  showToast("Cerraste sesión");
});

// Enlaces "Ingresar" / "Registrarme" dentro de la ventana
document.querySelectorAll("[data-auth-show]").forEach((boton) => {
  boton.addEventListener("click", () => mostrarFormulario(boton.dataset.authShow));
});

document.querySelector("[data-auth-close]").addEventListener("click", () => dialogo.close());

pintarBotonUsuario();
mostrarDatosDelPedido();
