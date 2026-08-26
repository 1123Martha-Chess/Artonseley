// manejaLogin.js
// -------------------------------------------------------------------
// Lógica del formulario de login.html: manda el correo/contraseña a
// POST /api/login y, si todo sale bien, el servidor deja una cookie de
// sesión (httpOnly, así que este archivo nunca la toca directamente) y
// mandamos al usuario al buscador. Si algo falla (contraseña
// incorrecta, cuenta bloqueada, error de red), se lo mostramos en
// pantalla en vez de dejarlo adivinando por qué no pasó nada.
// -------------------------------------------------------------------

const formulario = document.getElementById('formularioLogin');
const botonEntrar = document.getElementById('botonEntrar');
const mensajeLogin = document.getElementById('mensajeLogin');

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const email = document.getElementById('campoEmail').value.trim();
  const contrasena = document.getElementById('campoContrasena').value;

  mensajeLogin.textContent = 'Entrando…';
  mensajeLogin.classList.remove('error');
  botonEntrar.disabled = true;

  try {
    const respuesta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, contrasena })
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      mensajeLogin.textContent = datos.error || 'No se pudo iniciar sesión. Intenta de nuevo.';
      mensajeLogin.classList.add('error');
      return;
    }

    window.location.href = 'index.html';
  } catch (error) {
    console.error('Error al conectar con el servidor:', error);
    mensajeLogin.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.';
    mensajeLogin.classList.add('error');
  } finally {
    botonEntrar.disabled = false;
  }
});
