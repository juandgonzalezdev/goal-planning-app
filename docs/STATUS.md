# Estado del proyecto

**Actualizado:** 29-10-2026, sobre `main` en `98addbc` («Add isolated demo
access from Settings»).

Este documento resume qué está probado, qué no y qué falta. Una prueba manual
solo figura como confirmada si Juan la confirmó expresamente, caso por caso.
Una confirmación de un recorrido no sustituye a otro.

## Qué hay hoy

- Prototipo web sin cuentas ni servidor. El espacio propio (Individual o Duo)
  se guarda solo en este navegador, en IndexedDB, **sin cifrar**. Ver
  [STORAGE_AND_RECOVERY.md](STORAGE_AND_RECOVERY.md).
- Protección entre pestañas, formularios sin guardar con Copy What I Typed,
  pantalla de recuperación y Download Both Copies.
- Demo de Alex (año 2026) desde Welcome y desde Settings, aislada del espacio
  propio.
- Duo funciona en un solo dispositivo y todos sus miembros ven todo: la versión
  privada de Duo no existe todavía.

## Pruebas automáticas

En `98addbc`: **598 pruebas en 40 archivos**, lint y build correctos y
`npm audit` con 0 vulnerabilidades (comprobado por Juan en su PC y en la
entrega del parche 05b). Qué cubre cada archivo: [PROJECT_MAP.md](PROJECT_MAP.md#pruebas).

Además, antes de cada entrega se hicieron recorridos automáticos con la build
real en Chromium, con dos pestañas y datos inventados: 15 de 15 en el parche 05
y 21 de 21 en el 05b. No sustituyen a las pruebas manuales.

## Pruebas manuales

### Guardado asíncrono en IndexedDB (parche 04)

| Recorrido | Chrome | Safari / iPhone |
| --- | --- | --- |
| Recargar y conservar el espacio | Confirmado | Sin confirmar |
| Conflicto entre dos pestañas y Open Latest Version | Confirmado | Sin confirmar |
| Download Backup y Restore Backup | Confirmado | Sin confirmar |

La demo también se probó en ventanas privadas, sin indicar en qué navegador.

### Otras pestañas y recuperación (parche 05)

| Recorrido | Chrome | Safari / iPhone |
| --- | --- | --- |
| S1 Dos pestañas con el mismo espacio | Sin confirmar | Sin confirmar |
| S2 Actualización automática con aviso, en la misma pantalla | Confirmado | Sin confirmar |
| S3 y S5 Formulario escrito: se conserva, aviso de conflicto, no se guarda | Confirmado | Sin confirmar |
| S4 y S6 Copy What I Typed y Open Latest Version con confirmación | Confirmado | Sin confirmar |
| S7 Borrado en otra pestaña con un formulario escrito | Confirmado | Confirmado |
| S8 Formulario cerrado como «(closed)» | Confirmado | Sin confirmar |
| S9 Discard and Close con confirmación y Welcome tras recargar | Confirmado | Confirmado |
| S10 Borrado en otra pestaña sin nada escrito | Sin confirmar | **Pendiente** |
| S11 Comprobación al volver a la pestaña | Sin confirmar | Sin confirmar |

### Demo desde Settings (parche 05b)

| Recorrido | Chrome | Safari / iPhone |
| --- | --- | --- |
| D2.1 Entrar, cambiar, Reset Demo y salir: todo lo propio sigue igual | Confirmado | Confirmado |
| D2.2 Recargar después: sigue el espacio propio | Confirmado | Confirmado |
| D2.3 Borrador de New Goal: pregunta, Copy y Keep Editing | Confirmado | Confirmado |
| D2.4 Discard and Open Demo: el borrador no entra ni vuelve | Confirmado | Confirmado |
| D2.5 Exit Demo con algo escrito en la demo | Confirmado | Confirmado |
| D2.6 Otra pestaña guarda durante la demo | Confirmado | Confirmado |
| D2.7 Otra pestaña borra durante la demo | Confirmado | Confirmado |

La pantalla de recuperación, Use Older Copy y Download Both Copies necesitan
datos dañados a propósito. Solo están probados con las pruebas automáticas y en
Chromium.

## Limitaciones conocidas

- **Sin cifrado.** Los datos, Download Backup y Download Both Copies están sin
  cifrar. Ocultar importes solo cambia lo que se ve.
- **Barra de pestañas:** salir de un formulario con ella descarta lo escrito
  sin preguntar, salvo New Goal y Welcome Setup. Ver la decisión pendiente más
  abajo.
- **Avisos no fijos:** los avisos de otras pestañas aparecen arriba, en el
  flujo de la página (decisión de producto). Si se está desplazado hacia abajo,
  se ven al subir o al intentar guardar.
- **Actualización automática:** las pantallas se montan de nuevo. Se conservan
  la pantalla, el mes y las vistas de Data, History y Bills, pero se pierde el
  estado pequeño de cada pantalla (por ejemplo, el modo Spent/Planned de Home).
- **Demo desde Welcome con una operación pendiente:** el botón no hace nada
  durante esa fracción de segundo y no lo explica.
- **Al salir de la demo**, el Home propio empieza arriba.
- **Restore Backup** no comprueba todavía que la copia sea del mismo tipo de
  espacio (Individual o Duo), ni limita el tamaño del archivo.
- **Copias en el portapapeles:** en `http://` de la red local el navegador no
  deja copiar. Aparece el recuadro para copiar a mano.

## Trabajo pendiente

Nada de esta lista está implementado ni autorizado todavía.

- **P1–P5:** decisiones abiertas sobre privacidad y cuentas: pérdida de datos
  sin contraseña ni código de recuperación, método de recuperación, cifrado
  local, formato de la copia de seguridad y analítica.
- Cuentas (primero Individual, con email, contraseña y recuperación), servidor,
  sincronización y cifrado de extremo a extremo.
- Restore Backup: rechazar una copia de otro tipo de espacio y limitar el
  tamaño del archivo.
- Quitar `createLocalStore` (`src/data/localStore.ts`), que ya no usa la app.
- Duo privado.
- Pruebas manuales sin confirmar de las tablas anteriores.

## Decisiones de producto pendientes

- Si salir de un formulario con la barra de pestañas debe preguntar, como ya
  hacen la demo, Open Latest Version y Discard and Close.
