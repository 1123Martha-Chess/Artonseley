# ChecarLeyes — revisión diaria de leyes vigentes

Herramienta aparte de la app (no la carga `servidor.js`). Revisa todos los días la Cámara de Diputados y el DOF.

## Archivos

| Archivo | Qué es | Quién lo modifica |
|---|---|---|
| `leyes_artonseley.csv` | **Original.** Tabla de las 32 leyes de Artonseley. | La **Cámara de Diputados**: llena/actualiza "Última reforma" y la columna "Pendiente de actualizar" (Sí si "Última reforma" es posterior a "Actualizado en Artonseley"). |
| `leyes_artonseley_DOF.csv` | **Copia** de la tabla (creada una sola vez a partir del original). | Solo el **DOF**: si un decreto reforma/adiciona/deroga una de nuestras leyes, pone esa fecha en "Última reforma". Separado para que un falso positivo del DOF no ensucie el original. |
| `historial_cambios.csv` | Una fila por cada fecha de reforma que cambió (fuente, anterior, nueva, archivo, enlace). | Ambos. |
| `bitacora_DOF_y_Camara.md` | Documento con **cada revisión y su fecha/hora**, aunque no haya nada nuevo. Primero ⭐ lo que toca a nuestras leyes; luego TODO lo nuevo de la Cámara (lista de vigentes y "Actualizaciones") y del DOF (todas las publicaciones de todas las ediciones). | Ambos. |
| `leyes_artonseley.xlsx` | Las 3 tablas anteriores con formato, una pestaña por tabla (encabezado fijo, filtros, fechas reales, enlaces, pendientes resaltados en amarillo). Para abrirlo con **Hojas de cálculo de Google** (subirlo a Drive → "Abrir con Hojas de cálculo de Google"); no hace falta Excel. Los CSV siguen siendo la fuente: el .xlsx se rehace entero en cada revisión y no se edita a mano. | `generarExcel.js`, al final de cada revisión (o a mano: `npm run excel`). |
| `estado/estado.json` | Memoria interna entre corridas (foto de la lista de la Cámara, último día del DOF revisado, publicaciones ya vistas). No editar. | El script. |

## Uso

```
node checarLeyes.js          # revisión manual (o: npm run checar)
powershell -ExecutionPolicy Bypass -File programarTarea.ps1 -Hora 20:00   # (re)programar la tarea diaria
Unregister-ScheduledTask -TaskName "ChecarLeyes Artonseley" -Confirm:$false  # quitarla
```

La tarea de Windows "ChecarLeyes Artonseley" corre diario a las 20:00; si la computadora estaba apagada, corre en cuanto se prende. Si pasan varios días sin correr, el DOF se pone al corriente solo (hasta 60 días por corrida).

## Fuentes

- Cámara: `https://www.diputados.gob.mx/LeyesBiblio/index.htm` (lista de vigentes, codificación windows-1252) y `actual/ultima.htm`.
- DOF: `https://dof.gob.mx/index.php?year=AAAA&month=MM&day=DD` (+ ediciones `&edicion=VES`/otras cuando el índice las enlaza). `www.dof.gob.mx` tiene certificado inválido: usar sin `www`.
- Sin cuentas ni datos personales: solo lectura de páginas públicas con un User-Agent genérico.

## Notas

- Se busca por **"Nombre oficial"**. La Cámara a veces agrega el complemento ("Ley de Amparo, Reglamentaria de…"); se acepta `nombre + ","`.
- Si una ley deja de aparecer en la lista de vigentes, la bitácora lo marca con ⚠️.
- Primera revisión: 23/09/2026, con el DOF revisado desde el 28/08/2026 (la fecha más antigua de "Actualizado en Artonseley").
