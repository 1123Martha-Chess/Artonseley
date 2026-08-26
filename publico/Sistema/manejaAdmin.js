// manejaAdmin.js
// -------------------------------------------------------------------
// Lógica de admin.html: cargar/reemplazar/borrar leyes, ver la bandeja
// de sugerencias, ver usuarios y su licencia, y gestionar las
// notificaciones del panel 🔔 del sitio principal. Todo habla con las
// rutas /api/admin/* (ver servidor.js), que ya están protegidas por
// sesión + rol admin del lado del servidor — este archivo solo maneja
// la redirección a login si de plano no hay sesión.
// -------------------------------------------------------------------

// Helper compartido por todas las llamadas de este archivo: hace el
// fetch, manda a login si la sesión ya no es válida, y si la respuesta
// no es "ok" lanza un error con el mensaje que mandó el servidor (o la
// lista de errores de validación, cuando aplica) para que cada función
// de arriba decida cómo mostrarlo.
// En pantallas angostas una tabla completa (documentos, sugerencias,
// usuarios) no se encoge bien — en vez de aplastar el texto o
// desbordar toda la página, se mete la tabla en un contenedor que
// scrollea solo ella, horizontalmente (ver ".tabla-scroll" en el
// <style> de admin.html).
function envolverConScroll(tabla) {
  const contenedorScroll = document.createElement('div');
  contenedorScroll.classList.add('tabla-scroll');
  contenedorScroll.appendChild(tabla);
  return contenedorScroll;
}

async function peticionAdmin(url, opciones = {}) {
  const respuesta = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones
  });

  if (respuesta.status === 401) {
    window.location.href = 'login.html';
    throw new Error('Sin sesión');
  }

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const error = new Error(datos.error || 'Ocurrió un error.');
    error.errores = datos.errores;
    throw error;
  }

  return datos;
}

document.getElementById('botonCerrarSesionAdmin').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  window.location.href = 'login.html';
});

// ---------------------------------------------------------------------
// Cargar / reemplazar documento legal
// ---------------------------------------------------------------------

const formularioDocumento = document.getElementById('formularioDocumento');
const campoReemplazar = document.getElementById('campoReemplazar');
const campoNombreDocumento = document.getElementById('campoNombreDocumento');
const campoUltimaReforma = document.getElementById('campoUltimaReforma');
const campoSectorDocumento = document.getElementById('campoSectorDocumento');
const campoJSONArticulos = document.getElementById('campoJSONArticulos');
const campoJSONTextos = document.getElementById('campoJSONTextos');
const resultadoCargaDocumento = document.getElementById('resultadoCargaDocumento');

// Subir un archivo .json vuelca su contenido en el textarea de al lado
// — así "pegar el JSON" y "subir el archivo" terminan usando el mismo
// camino de validación, sin duplicar lógica.
function conectarArchivoConTextarea(idArchivo, textarea) {
  document.getElementById(idArchivo).addEventListener('change', async (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    textarea.value = await archivo.text();
  });
}
conectarArchivoConTextarea('archivoArticulos', campoJSONArticulos);
conectarArchivoConTextarea('archivoTextos', campoJSONTextos);

function mostrarErroresDeCarga(errores) {
  resultadoCargaDocumento.innerHTML = '';
  const caja = document.createElement('div');
  caja.classList.add('lista-errores');

  const titulo = document.createElement('p');
  titulo.classList.add('titulo');
  titulo.textContent = `No se guardó nada — corrige esto y vuelve a intentar (${errores.length} problema${errores.length === 1 ? '' : 's'}):`;
  caja.appendChild(titulo);

  const lista = document.createElement('ul');
  errores.forEach(error => {
    const item = document.createElement('li');
    item.textContent = error;
    lista.appendChild(item);
  });
  caja.appendChild(lista);

  resultadoCargaDocumento.appendChild(caja);
}

function mostrarExitoDeCarga(totalArticulos) {
  resultadoCargaDocumento.innerHTML = '';
  const caja = document.createElement('p');
  caja.classList.add('mensaje-exito');
  caja.textContent = `Guardado correctamente: ${totalArticulos} artículos.`;
  resultadoCargaDocumento.appendChild(caja);
}

formularioDocumento.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  resultadoCargaDocumento.innerHTML = '<p class="mensaje-carga">Validando y guardando…</p>';

  let articulos;
  let textos;
  try {
    articulos = JSON.parse(campoJSONArticulos.value);
  } catch {
    return mostrarErroresDeCarga(['El JSON de artículos no es válido — revisa comas, comillas y corchetes.']);
  }
  try {
    textos = JSON.parse(campoJSONTextos.value);
  } catch {
    return mostrarErroresDeCarga(['El JSON de textos no es válido — revisa comas, comillas y corchetes.']);
  }

  try {
    const datos = await peticionAdmin('/api/admin/documentos', {
      method: 'POST',
      body: JSON.stringify({
        nombre: campoNombreDocumento.value.trim(),
        ultimaReforma: campoUltimaReforma.value || null,
        documentoIdAReemplazar: campoReemplazar.value || null,
        sectorId: campoSectorDocumento.value || null,
        articulos,
        textos
      })
    });
    mostrarExitoDeCarga(datos.totalArticulos);
    formularioDocumento.reset();
    await cargarListaDocumentos();
  } catch (error) {
    mostrarErroresDeCarga(error.errores || [error.message]);
  }
});

// ---------------------------------------------------------------------
// Lista de documentos cargados (con opción de reemplazar/eliminar)
// ---------------------------------------------------------------------

async function cargarListaDocumentos() {
  const contenedor = document.getElementById('listaDocumentos');
  try {
    const { documentos } = await peticionAdmin('/api/admin/documentos');
    pintarListaDocumentos(contenedor, documentos);
    pintarOpcionesDeReemplazo(documentos);
  } catch (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
  }
}

function pintarOpcionesDeReemplazo(documentos) {
  const valorActual = campoReemplazar.value;
  campoReemplazar.innerHTML = '<option value="">— Cargar como documento nuevo —</option>';
  documentos.forEach(doc => {
    const opcion = document.createElement('option');
    opcion.value = doc.id;
    opcion.textContent = doc.nombre;
    campoReemplazar.appendChild(opcion);
  });
  campoReemplazar.value = valorActual;
}

function pintarListaDocumentos(contenedor, documentos) {
  contenedor.innerHTML = '';

  if (documentos.length === 0) {
    contenedor.innerHTML = '<p>Todavía no hay ningún documento cargado.</p>';
    return;
  }

  const tabla = document.createElement('table');
  tabla.innerHTML = `
    <thead>
      <tr><th>Documento</th><th>Sector</th><th>Artículos</th><th>Última reforma</th><th>Actualizado</th><th></th></tr>
    </thead>
  `;
  const cuerpo = document.createElement('tbody');

  documentos.forEach(doc => {
    const fila = document.createElement('tr');

    const celdaNombre = document.createElement('td');
    celdaNombre.textContent = doc.nombre;

    const celdaSector = document.createElement('td');
    celdaSector.textContent = doc.sectorNombre || 'Otros';

    const celdaArticulos = document.createElement('td');
    celdaArticulos.textContent = doc.totalArticulos;

    const celdaReforma = document.createElement('td');
    celdaReforma.textContent = doc.ultimaReforma || '—';

    const celdaActualizado = document.createElement('td');
    celdaActualizado.textContent = new Date(doc.actualizadoEn).toLocaleDateString('es-MX');

    const celdaAcciones = document.createElement('td');

    const botonReemplazar = document.createElement('button');
    botonReemplazar.type = 'button';
    botonReemplazar.classList.add('boton-secundario');
    botonReemplazar.textContent = 'Reemplazar';
    botonReemplazar.style.marginRight = '6px';
    botonReemplazar.addEventListener('click', () => {
      campoReemplazar.value = doc.id;
      campoNombreDocumento.value = doc.nombre;
      campoUltimaReforma.value = doc.ultimaReforma || '';
      campoSectorDocumento.value = doc.sectorId || '';
      campoJSONArticulos.value = '';
      campoJSONTextos.value = '';
      resultadoCargaDocumento.innerHTML = '';
      formularioDocumento.scrollIntoView({ behavior: 'smooth' });
    });

    const botonEliminar = document.createElement('button');
    botonEliminar.type = 'button';
    botonEliminar.classList.add('boton-peligro');
    botonEliminar.textContent = 'Eliminar';
    botonEliminar.addEventListener('click', () => eliminarDocumento(doc.id, doc.nombre));

    celdaAcciones.appendChild(botonReemplazar);
    celdaAcciones.appendChild(botonEliminar);

    fila.append(celdaNombre, celdaSector, celdaArticulos, celdaReforma, celdaActualizado, celdaAcciones);
    cuerpo.appendChild(fila);
  });

  tabla.appendChild(cuerpo);
  contenedor.appendChild(envolverConScroll(tabla));
}

async function eliminarDocumento(id, nombre) {
  if (!window.confirm(`¿Eliminar "${nombre}" y todos sus artículos? Esto no se puede deshacer.`)) return;
  try {
    await peticionAdmin(`/api/admin/documentos/${id}`, { method: 'DELETE' });
    await cargarListaDocumentos();
  } catch (error) {
    window.alert(error.message);
  }
}

// ---------------------------------------------------------------------
// Sectores (agrupan documentos en la barra izquierda del buscador)
// ---------------------------------------------------------------------

async function cargarSectores() {
  const contenedor = document.getElementById('listaSectores');
  try {
    const { sectores } = await peticionAdmin('/api/admin/sectores');
    pintarOpcionesDeSector(sectores);
    pintarListaSectores(contenedor, sectores);
  } catch (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
  }
}

// El <select> del formulario de documentos se repinta cada vez que
// cambia la lista de sectores, igual que campoReemplazar con la lista
// de documentos — así un sector recién creado aparece ahí de inmediato.
function pintarOpcionesDeSector(sectores) {
  const valorActual = campoSectorDocumento.value;
  campoSectorDocumento.innerHTML = '<option value="">— Sin sector (aparecerá en "Otros") —</option>';
  sectores.forEach(sector => {
    const opcion = document.createElement('option');
    opcion.value = sector.id;
    opcion.textContent = sector.nombre;
    campoSectorDocumento.appendChild(opcion);
  });
  campoSectorDocumento.value = valorActual;
}

function pintarListaSectores(contenedor, sectores) {
  contenedor.innerHTML = '';

  if (sectores.length === 0) {
    contenedor.innerHTML = '<p>Todavía no hay ningún sector. Agrega el primero abajo.</p>';
    return;
  }

  sectores.forEach(sector => {
    const fila = document.createElement('div');
    fila.classList.add('fila-notificacion');

    const texto = document.createElement('span');
    texto.textContent = sector.nombre;

    const botonEliminar = document.createElement('button');
    botonEliminar.type = 'button';
    botonEliminar.classList.add('boton-peligro');
    botonEliminar.textContent = 'Eliminar';
    botonEliminar.addEventListener('click', () => eliminarSector(sector.id, sector.nombre));

    fila.append(texto, botonEliminar);
    contenedor.appendChild(fila);
  });
}

async function eliminarSector(id, nombre) {
  if (!window.confirm(`¿Eliminar el sector "${nombre}"? Los documentos que lo tengan asignado se quedarán sin sector (pasarán a agruparse en "Otros").`)) return;
  try {
    await peticionAdmin(`/api/admin/sectores/${id}`, { method: 'DELETE' });
    await cargarSectores();
    await cargarListaDocumentos();
  } catch (error) {
    window.alert(error.message);
  }
}

document.getElementById('formularioSector').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const campoNombreSector = document.getElementById('campoNombreSector');

  try {
    await peticionAdmin('/api/admin/sectores', {
      method: 'POST',
      body: JSON.stringify({ nombre: campoNombreSector.value.trim() })
    });
    campoNombreSector.value = '';
    await cargarSectores();
  } catch (error) {
    window.alert(error.message);
  }
});

// ---------------------------------------------------------------------
// Solicitudes de cuenta nuevas (formulario público "Crear Cuenta")
// ---------------------------------------------------------------------

async function cargarSolicitudesRegistro() {
  const contenedor = document.getElementById('listaSolicitudesRegistro');
  try {
    const { solicitudes } = await peticionAdmin('/api/admin/solicitudes-registro');

    if (solicitudes.length === 0) {
      contenedor.innerHTML = '<p>No hay solicitudes de cuenta pendientes.</p>';
      return;
    }

    const tabla = document.createElement('table');
    tabla.innerHTML = '<thead><tr><th>Fecha</th><th>Correo</th><th>IP</th><th></th></tr></thead>';
    const cuerpo = document.createElement('tbody');

    solicitudes.forEach(s => {
      const fila = document.createElement('tr');

      const celdaFecha = document.createElement('td');
      celdaFecha.textContent = new Date(s.creado_en).toLocaleString('es-MX');

      const celdaCorreo = document.createElement('td');
      celdaCorreo.textContent = s.email;

      const celdaIP = document.createElement('td');
      celdaIP.textContent = s.ip || '—';

      const celdaAcciones = document.createElement('td');
      const botonDescartar = document.createElement('button');
      botonDescartar.type = 'button';
      botonDescartar.classList.add('boton-icono', 'boton-icono-descartar');
      botonDescartar.textContent = '✗';
      botonDescartar.title = 'Descartar y quitar de la bandeja';
      botonDescartar.addEventListener('click', () => eliminarSolicitudRegistro(s.id));
      celdaAcciones.appendChild(botonDescartar);

      fila.append(celdaFecha, celdaCorreo, celdaIP, celdaAcciones);
      cuerpo.appendChild(fila);
    });

    tabla.appendChild(cuerpo);
    contenedor.innerHTML = '';
    contenedor.appendChild(envolverConScroll(tabla));
  } catch (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
  }
}

async function eliminarSolicitudRegistro(id) {
  try {
    await peticionAdmin(`/api/admin/solicitudes-registro/${id}`, { method: 'DELETE' });
    await cargarSolicitudesRegistro();
  } catch (error) {
    window.alert(error.message);
  }
}

// ---------------------------------------------------------------------
// Bandeja de sugerencias
// ---------------------------------------------------------------------

async function cargarSugerencias() {
  const contenedor = document.getElementById('listaSugerencias');
  try {
    const { sugerencias } = await peticionAdmin('/api/admin/sugerencias');

    if (sugerencias.length === 0) {
      contenedor.innerHTML = '<p>No hay sugerencias todavía.</p>';
      return;
    }

    const tabla = document.createElement('table');
    tabla.innerHTML = '<thead><tr><th>Fecha</th><th>Usuario</th><th>Urgencia</th><th>Mensaje</th><th></th></tr></thead>';
    const cuerpo = document.createElement('tbody');

    sugerencias.forEach(s => {
      const fila = document.createElement('tr');

      // Todo lo que viene de la sugerencia (usuario, urgencia, mensaje)
      // se inserta con textContent, nunca con innerHTML: aunque
      // "urgencia" normalmente viene de los 3 botones fijos del buzón,
      // la ruta POST /api/sugerencias no obliga a que así sea, así que
      // se trata igual que cualquier otro texto escrito por un usuario.
      const celdaFecha = document.createElement('td');
      celdaFecha.textContent = new Date(s.creado_en).toLocaleString('es-MX');

      const celdaUsuario = document.createElement('td');
      celdaUsuario.textContent = s.usuario_email || '(usuario eliminado)';

      const celdaUrgencia = document.createElement('td');
      celdaUrgencia.textContent = s.urgencia;

      const celdaMensaje = document.createElement('td');
      celdaMensaje.textContent = s.mensaje;

      // La palomita y la tacha hacen lo mismo: no hay un estado de
      // "atendida" que conservar, así que cualquiera de las dos borra la
      // sugerencia de la bandeja (ver DELETE /api/admin/sugerencias/:id).
      const celdaAcciones = document.createElement('td');
      const contenedorBotones = document.createElement('div');
      contenedorBotones.style.display = 'flex';
      contenedorBotones.style.gap = '6px';

      const botonAtendida = document.createElement('button');
      botonAtendida.type = 'button';
      botonAtendida.classList.add('boton-icono', 'boton-icono-ok');
      botonAtendida.textContent = '✓';
      botonAtendida.title = 'Marcar como atendida y quitar de la bandeja';
      botonAtendida.addEventListener('click', () => eliminarSugerencia(s.id));

      const botonDescartar = document.createElement('button');
      botonDescartar.type = 'button';
      botonDescartar.classList.add('boton-icono', 'boton-icono-descartar');
      botonDescartar.textContent = '✗';
      botonDescartar.title = 'Descartar y quitar de la bandeja';
      botonDescartar.addEventListener('click', () => eliminarSugerencia(s.id));

      contenedorBotones.append(botonAtendida, botonDescartar);
      celdaAcciones.appendChild(contenedorBotones);

      fila.append(celdaFecha, celdaUsuario, celdaUrgencia, celdaMensaje, celdaAcciones);
      cuerpo.appendChild(fila);
    });

    tabla.appendChild(cuerpo);
    contenedor.innerHTML = '';
    contenedor.appendChild(envolverConScroll(tabla));
  } catch (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
  }
}

async function eliminarSugerencia(id) {
  try {
    await peticionAdmin(`/api/admin/sugerencias/${id}`, { method: 'DELETE' });
    await cargarSugerencias();
  } catch (error) {
    window.alert(error.message);
  }
}

// ---------------------------------------------------------------------
// Usuarios y licencias: cuentas activas, suspendidas, y eliminadas
// (papelera). Las acciones que cambian el estado de una cuenta
// (suspender, eliminar, reactivar, restaurar) nunca usan
// window.confirm()/prompt()/alert() — esos diálogos nativos del
// navegador se quedaban bloqueando la página y dejaban botones sin
// responder al cerrarse en algunos entornos. En su lugar hay un modal
// propio (abrirModal, más abajo) hecho con HTML normal.
// ---------------------------------------------------------------------

// Aviso no bloqueante para errores/éxitos de estas acciones (reemplaza
// a window.alert()): aparece abajo a la derecha y se quita solo.
function mostrarAviso(mensaje, tipo = 'error') {
  const aviso = document.createElement('div');
  aviso.classList.add('aviso-flotante', tipo === 'error' ? 'aviso-flotante-error' : 'aviso-flotante-exito');
  aviso.textContent = mensaje;
  document.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), 4500);
}

// Modal de confirmación genérico. Devuelve una promesa que resuelve a
// `null` si se cancela, o a `{ valorCampo }` si se confirma (valorCampo
// es el texto del campo numérico opcional, o null si no se pidió uno).
// `validar(valorCampo)` — si se pasa — recibe el valor antes de cerrar
// el modal y puede devolver un mensaje de error para mostrarlo sin
// cerrar el modal, o nada/null si el valor es válido.
function abrirModal({ titulo, mensaje, etiquetaCampo, placeholderCampo, textoConfirmar, claseBotonConfirmar = 'boton-primario', validar }) {
  return new Promise(resolver => {
    const fondo = document.createElement('div');
    fondo.classList.add('fondo-modal');

    const caja = document.createElement('div');
    caja.classList.add('caja-modal');

    const encabezado = document.createElement('h3');
    encabezado.textContent = titulo;

    const parrafoMensaje = document.createElement('p');
    parrafoMensaje.classList.add('mensaje-modal');
    parrafoMensaje.textContent = mensaje;

    caja.append(encabezado, parrafoMensaje);

    let campo = null;
    if (etiquetaCampo) {
      const etiqueta = document.createElement('label');
      etiqueta.textContent = etiquetaCampo;
      campo = document.createElement('input');
      campo.type = 'number';
      campo.min = '1';
      if (placeholderCampo) campo.placeholder = placeholderCampo;
      caja.append(etiqueta, campo);
    }

    const parrafoError = document.createElement('p');
    parrafoError.classList.add('error-modal');
    caja.appendChild(parrafoError);

    const filaBotones = document.createElement('div');
    filaBotones.classList.add('fila-botones-modal');

    const botonCancelar = document.createElement('button');
    botonCancelar.type = 'button';
    botonCancelar.classList.add('boton-secundario');
    botonCancelar.textContent = 'Cancelar';

    const botonConfirmar = document.createElement('button');
    botonConfirmar.type = 'button';
    botonConfirmar.classList.add(claseBotonConfirmar);
    botonConfirmar.style.marginTop = '0';
    botonConfirmar.textContent = textoConfirmar;

    filaBotones.append(botonCancelar, botonConfirmar);
    caja.appendChild(filaBotones);
    fondo.appendChild(caja);
    document.body.appendChild(fondo);

    if (campo) campo.focus();

    function cerrar(resultado) {
      fondo.remove();
      resolver(resultado);
    }

    botonCancelar.addEventListener('click', () => cerrar(null));
    fondo.addEventListener('click', evento => {
      if (evento.target === fondo) cerrar(null);
    });
    botonConfirmar.addEventListener('click', () => {
      const valorCampo = campo ? campo.value.trim() : null;
      const error = validar ? validar(valorCampo) : null;
      if (error) {
        parrafoError.textContent = error;
        parrafoError.style.display = 'block';
        return;
      }
      cerrar({ valorCampo });
    });
  });
}

function pintarBotonAccion(texto, clase, alHacerClick) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.classList.add(clase);
  boton.textContent = texto;
  boton.addEventListener('click', alHacerClick);
  return boton;
}

function celdaLicencia(u) {
  const celda = document.createElement('td');
  celda.textContent = new Date(u.licenciaVenceEn).toLocaleDateString('es-MX');
  const etiqueta = document.createElement('span');
  etiqueta.classList.add('etiqueta-estado', u.licenciaVigente ? 'etiqueta-activa' : 'etiqueta-vencida');
  etiqueta.textContent = u.licenciaVigente ? 'Vigente' : 'Vencida';
  etiqueta.style.marginLeft = '6px';
  celda.appendChild(etiqueta);
  return celda;
}

function pintarTabla(contenedor, columnas, filas) {
  contenedor.innerHTML = '';
  if (filas.length === 0) {
    contenedor.innerHTML = '<p>No hay ninguna cuenta aquí.</p>';
    return;
  }
  const tabla = document.createElement('table');
  tabla.innerHTML = `<thead><tr>${columnas.map(c => `<th>${c}</th>`).join('')}<th></th></tr></thead>`;
  const cuerpo = document.createElement('tbody');
  filas.forEach(fila => cuerpo.appendChild(fila));
  tabla.appendChild(cuerpo);
  contenedor.appendChild(envolverConScroll(tabla));
}

async function cargarCuentas() {
  const contenedorActivas = document.getElementById('listaUsuariosActivos');
  const contenedorSuspendidas = document.getElementById('listaUsuariosSuspendidos');
  const contenedorEliminadas = document.getElementById('listaUsuariosEliminados');

  try {
    const { activos, suspendidos, eliminados } = await peticionAdmin('/api/admin/usuarios');

    pintarTabla(
      contenedorActivas,
      ['Correo', 'Rol', 'Registrado', 'Licencia vence'],
      activos.map(u => {
        const fila = document.createElement('tr');
        const celdaCorreo = document.createElement('td');
        celdaCorreo.textContent = u.email;
        const celdaRol = document.createElement('td');
        celdaRol.textContent = u.rol;
        const celdaRegistrado = document.createElement('td');
        celdaRegistrado.textContent = new Date(u.creadoEn).toLocaleDateString('es-MX');

        const celdaAcciones = document.createElement('td');
        const contenedorBotones = document.createElement('div');
        contenedorBotones.style.display = 'flex';
        contenedorBotones.style.gap = '6px';
        contenedorBotones.append(
          pintarBotonAccion('Suspender', 'boton-peligro', () => suspenderCuenta(u)),
          pintarBotonAccion('Eliminar', 'boton-peligro', () => eliminarCuenta(u))
        );
        celdaAcciones.appendChild(contenedorBotones);

        fila.append(celdaCorreo, celdaRol, celdaRegistrado, celdaLicencia(u), celdaAcciones);
        return fila;
      })
    );

    pintarTabla(
      contenedorSuspendidas,
      ['Correo', 'Rol', 'Suspendida hasta'],
      suspendidos.map(u => {
        const fila = document.createElement('tr');
        const celdaCorreo = document.createElement('td');
        celdaCorreo.textContent = u.email;
        const celdaRol = document.createElement('td');
        celdaRol.textContent = u.rol;

        const celdaHasta = document.createElement('td');
        celdaHasta.textContent = u.suspendidoHasta
          ? new Date(u.suspendidoHasta).toLocaleString('es-MX')
          : 'Indefinida';
        if (u.suspensionVencida) {
          const etiqueta = document.createElement('span');
          etiqueta.classList.add('etiqueta-estado', 'etiqueta-suspendida');
          etiqueta.textContent = 'Ya se cumplió el tiempo';
          etiqueta.style.marginLeft = '6px';
          celdaHasta.appendChild(etiqueta);
        }

        const celdaAcciones = document.createElement('td');
        celdaAcciones.appendChild(pintarBotonAccion('Reactivar', 'boton-secundario', () => reactivarCuenta(u)));

        fila.append(celdaCorreo, celdaRol, celdaHasta, celdaAcciones);
        return fila;
      })
    );

    pintarTabla(
      contenedorEliminadas,
      ['Correo', 'Rol', 'Eliminada el'],
      eliminados.map(u => {
        const fila = document.createElement('tr');
        const celdaCorreo = document.createElement('td');
        celdaCorreo.textContent = u.email;
        const celdaRol = document.createElement('td');
        celdaRol.textContent = u.rol;
        const celdaEliminada = document.createElement('td');
        celdaEliminada.textContent = new Date(u.eliminadoEn).toLocaleString('es-MX');

        const celdaAcciones = document.createElement('td');
        celdaAcciones.appendChild(pintarBotonAccion('Reactivar y reutilizar', 'boton-secundario', () => restaurarCuenta(u)));

        fila.append(celdaCorreo, celdaRol, celdaEliminada, celdaAcciones);
        return fila;
      })
    );
  } catch (error) {
    [contenedorActivas, contenedorSuspendidas, contenedorEliminadas].forEach(contenedor => {
      contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
    });
  }
}

async function suspenderCuenta(usuario) {
  const resultado = await abrirModal({
    titulo: 'Suspender cuenta',
    mensaje: `¿Suspender la cuenta de "${usuario.email}"? Se cerrará su sesión de inmediato y no podrá iniciar sesión hasta que la reactives.`,
    etiquetaCampo: 'Días de suspensión (déjalo vacío para suspensión indefinida)',
    placeholderCampo: 'ej. 30',
    textoConfirmar: 'Suspender',
    claseBotonConfirmar: 'boton-peligro',
    validar(valorCampo) {
      if (!valorCampo) return null;
      const dias = Number(valorCampo);
      if (!Number.isFinite(dias) || dias <= 0) {
        return 'Escribe un número de días mayor a 0, o déjalo vacío.';
      }
      return null;
    }
  });
  if (!resultado) return;

  const hasta = resultado.valorCampo
    ? new Date(Date.now() + Number(resultado.valorCampo) * 24 * 60 * 60_000).toISOString()
    : null;

  try {
    await peticionAdmin(`/api/admin/usuarios/${usuario.id}/suspender`, {
      method: 'POST',
      body: JSON.stringify({ hasta })
    });
    mostrarAviso(`Cuenta de "${usuario.email}" suspendida.`, 'exito');
    await cargarCuentas();
  } catch (error) {
    mostrarAviso(error.message);
  }
}

async function reactivarCuenta(usuario) {
  const resultado = await abrirModal({
    titulo: 'Reactivar cuenta',
    mensaje: `¿Reactivar la cuenta de "${usuario.email}"? Podrá volver a iniciar sesión de inmediato.`,
    textoConfirmar: 'Reactivar',
    claseBotonConfirmar: 'boton-primario'
  });
  if (!resultado) return;

  try {
    await peticionAdmin(`/api/admin/usuarios/${usuario.id}/reactivar`, { method: 'POST' });
    mostrarAviso(`Cuenta de "${usuario.email}" reactivada.`, 'exito');
    await cargarCuentas();
  } catch (error) {
    mostrarAviso(error.message);
  }
}

async function eliminarCuenta(usuario) {
  const resultado = await abrirModal({
    titulo: 'Eliminar cuenta',
    mensaje: `¿Eliminar la cuenta de "${usuario.email}"? Se cerrará su sesión de inmediato y no podrá volver a iniciar sesión. Quedará en la papelera, de donde la puedes restaurar si fue un error.`,
    textoConfirmar: 'Eliminar',
    claseBotonConfirmar: 'boton-peligro'
  });
  if (!resultado) return;

  try {
    await peticionAdmin(`/api/admin/usuarios/${usuario.id}`, { method: 'DELETE' });
    mostrarAviso(`Cuenta de "${usuario.email}" movida a la papelera.`, 'exito');
    await cargarCuentas();
  } catch (error) {
    mostrarAviso(error.message);
  }
}

async function restaurarCuenta(usuario) {
  const resultado = await abrirModal({
    titulo: 'Restaurar cuenta',
    mensaje: `¿Restaurar la cuenta de "${usuario.email}"? Volverá a quedar activa, con el mismo correo e id que tenía.`,
    textoConfirmar: 'Restaurar',
    claseBotonConfirmar: 'boton-primario'
  });
  if (!resultado) return;

  try {
    await peticionAdmin(`/api/admin/usuarios/${usuario.id}/restaurar`, { method: 'POST' });
    mostrarAviso(`Cuenta de "${usuario.email}" restaurada.`, 'exito');
    await cargarCuentas();
  } catch (error) {
    mostrarAviso(error.message);
  }
}

// ---------------------------------------------------------------------
// Notificaciones del panel 🔔
// ---------------------------------------------------------------------

async function cargarNotificaciones() {
  const contenedor = document.getElementById('listaNotificaciones');
  try {
    const { notificaciones } = await peticionAdmin('/api/admin/notificaciones');
    contenedor.innerHTML = '';

    if (notificaciones.length === 0) {
      contenedor.innerHTML = '<p>Todavía no hay ninguna notificación.</p>';
      return;
    }

    notificaciones.forEach(n => {
      const fila = document.createElement('div');
      fila.classList.add('fila-notificacion');
      if (!n.activa) fila.classList.add('inactiva');

      const texto = document.createElement('span');
      texto.textContent = n.texto;
      texto.style.color = n.color || '#222222';

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.classList.add('boton-secundario');
      boton.textContent = n.activa ? 'Desactivar' : 'Activar';
      boton.addEventListener('click', async () => {
        await peticionAdmin(`/api/admin/notificaciones/${n.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ activa: !n.activa })
        });
        await cargarNotificaciones();
      });

      const botonEliminar = document.createElement('button');
      botonEliminar.type = 'button';
      botonEliminar.classList.add('boton-peligro');
      botonEliminar.textContent = 'Eliminar';
      botonEliminar.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar esta notificación para siempre? Esto no se puede deshacer.')) return;
        await peticionAdmin(`/api/admin/notificaciones/${n.id}`, { method: 'DELETE' });
        await cargarNotificaciones();
      });

      const contenedorBotones = document.createElement('div');
      contenedorBotones.style.display = 'flex';
      contenedorBotones.style.gap = '6px';
      contenedorBotones.append(boton, botonEliminar);

      fila.append(texto, contenedorBotones);
      contenedor.appendChild(fila);
    });
  } catch (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
  }
}

document.getElementById('formularioNotificacion').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const campoTexto = document.getElementById('campoTextoNotificacion');
  const campoColor = document.getElementById('campoColorNotificacion');

  try {
    await peticionAdmin('/api/admin/notificaciones', {
      method: 'POST',
      body: JSON.stringify({ texto: campoTexto.value.trim(), color: campoColor.value })
    });
    campoTexto.value = '';
    await cargarNotificaciones();
  } catch (error) {
    window.alert(error.message);
  }
});

// ---------------------------------------------------------------------
// Arranque: cargar las seis secciones en paralelo.
// ---------------------------------------------------------------------
cargarSectores();
cargarListaDocumentos();
cargarSolicitudesRegistro();
cargarSugerencias();
cargarCuentas();
cargarNotificaciones();
