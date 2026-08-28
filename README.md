# Artonseley

Buscador de leyes y artículos jurídicos de México, por palabra clave (con
sinónimos) o por número de artículo. Backend Node.js/Express + SQLite. Todo
el contenido y la interfaz están en español. Ver `CLAUDE.md` para el detalle
de arquitectura.

## Correrlo en tu computadora

Requisitos: Node.js 22.5 o más nuevo (trae SQLite integrado; no hace falta
compilar nada).

```
npm install
npm run migrar-datos                                  # carga las leyes de ejemplo
npm run crear-usuario -- tu@correo.com "TuContraseña" admin 24
npm start
```

Abre `http://localhost:3000`. El primer usuario tiene que crearse por la
terminal; de ahí en adelante todo se administra desde el panel (ver abajo).

## Variables de entorno

Copia `.env.example` a `.env` y ajústalo. Las que importan:

| Variable | Para qué | Valor por defecto |
|---|---|---|
| `CARPETA_DATOS` | Carpeta donde vive `artonseley.db`. **En producción debe apuntar a un disco persistente.** | `./data` |
| `SECRETO_COOKIES` | Firma las cookies de sesión. Obligatoria en producción. | secreto inseguro de desarrollo |
| `NODE_ENV` | `production` activa cookies `secure`, el redirect al host canónico y los avisos de seguridad. | (vacío) |
| `CONFIA_EN_PROXY` | `1` cuando hay un proxy delante (Render). Necesario para que los límites por IP funcionen. | `0` |
| `DIAS_DURACION_SESION` | Cuánto dura una sesión iniciada. | `7` |
| `PORT` | Puerto del servidor. | `3000` |

## Despliegue en Render (disco persistente)

**Esto es lo más importante del despliegue.** El sistema de archivos de
Render es *efímero*: en cada despliegue (y en cada reinicio del servicio)
se borra todo lo que esté dentro del proyecto. Si la base de datos
`artonseley.db` vive ahí, **cada deploy borra todos los usuarios, las
licencias, las sesiones y las leyes cargadas**. Por eso hay que ponerla en
un disco persistente, que sí sobrevive a los despliegues.

> El plan **Free de Render no permite discos persistentes.** Hace falta el
> plan **Starter** (o superior) para el servicio web.

### Si el servicio ya existe (lo más probable)

En el panel de Render, sobre tu servicio web:

1. **Disks → Add Disk**
   - Name: `datos`
   - Mount Path: `/var/data`
   - Size: `1 GB`
2. **Environment → Add Environment Variable**
   - `CARPETA_DATOS` = `/var/data`
   - `NODE_ENV` = `production`
   - `CONFIA_EN_PROXY` = `1`
   - `SECRETO_COOKIES` = (un valor largo y aleatorio; genéralo con
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
3. **Settings → Build & Deploy:** `Auto-Deploy = Yes`, `Branch = main`,
   `Build Command = npm install`, `Start Command = npm start`.
4. **Manual Deploy → Deploy latest commit.**
5. Cuando termine, abre la **Shell** del servicio y siembra la base de
   datos (una sola vez, porque el disco arranca vacío):
   ```
   npm run migrar-datos
   npm run crear-usuario -- tu@correo.com "TuContraseña" admin 24
   ```

A partir de aquí, **nada se pierde en los despliegues** y todo el manejo
de usuarios se hace desde el panel — ya no hace falta volver a la Shell.

### Si creas el servicio desde cero

El repo incluye `render.yaml`: en Render, **New → Blueprint**, apunta al
repo y se crea el servicio con el disco y las variables ya configurados.
Igual hay que correr el `migrar-datos` / `crear-usuario` inicial una vez
en la Shell.

### Comprobar que quedó bien

En los logs de arranque **no** debe aparecer el aviso
`⚠️  CARPETA_DATOS no está definida`. Si aparece, la base de datos todavía
está en disco efímero.

## Administrar usuarios (desde el panel, sin terminal)

Entra a `/admin.html` con una cuenta de rol `admin`. Desde ahí:

- **Solicitudes de cuenta nuevas** — las que llegan del formulario público
  "Crear Cuenta". Botón **✓ Aprobar**: crea la cuenta real (la persona
  inicia sesión con la contraseña que ya eligió); solo defines rol y
  vigencia. **✗ Descartar**: la quita de la bandeja sin crear nada.
- **Crear usuario manualmente** — para un cliente que ya pagó, o para dar
  de alta otro administrador. Defines correo, contraseña, rol y vigencia.
- **Usuarios y licencias** — **Renovar licencia** (nueva fecha, en meses
  desde hoy o fecha exacta), **Suspender**, **Eliminar** (a la papelera).

La "vigencia" en cualquiera de estos formularios se escribe como un número
de meses a partir de hoy (`24`) o como una fecha exacta (`2027-08-28`).

Los scripts de terminal (`npm run crear-usuario`, `npm run
actualizar-licencia`) siguen existiendo y hacen lo mismo — útiles para el
primer admin o para automatizar.
