# Candidata local Rumbo 03–08

Rama: `integration/rumbo-03-08`. Base integrada en main: `579117b`.
El hash final se entrega junto al resultado de `git log -1 --oneline`.
Esta candidata no está publicada ni integrada en main.
Base de la revisión de Claude: `8db763e`. Correcciones de código posteriores:
`284fd48` (H1/H3) y `c40f502` (H4 y foco). La documentación final se guarda
en un commit adicional, sin reescribir la versión revisada.

## Qué incluye

- Pago mediante formulario compartido, fecha, cuenta e interés opcional;
  protección de borradores y borrado de cuentas con referencias.
- Left to Pay distingue pasado, presente y futuro. Coming up muestra el
  siguiente mes aparte, sin sumarlo al total, y vuelve al mes de origen.
- Add global para registros y planes, con regreso a la pestaña y posición.
- Barra lateral desde 1024 px y Home en dos columnas desde 1200 px.
- Cuatro gráficas con tablas, teclado y distinción de registros y estimaciones.
- Help & Guide, notas de ayuda, Getting Started y mensajes tras guardar;
  skeleton solo durante la espera real. Movimiento reducido respetado.

Commits, resultados, adaptaciones y pendientes: [WORK_STATUS.md](WORK_STATUS.md)
y [INTEGRATION_NOTES.md](INTEGRATION_NOTES.md).

## Abrir en ordenador y teléfono

Usar esta carpeta de trabajo con la rama candidata; comprobar `git status -sb`
sin borrar ni preparar los archivos ajenos. Las dependencias ya están instaladas;
no hace falta instalar paquetes para esta prueba.

```powershell
npm run dev -- --host 0.0.0.0 --port 5193 --strictPort
```

En el ordenador abrir [la candidata local](http://localhost:5193/).
En el teléfono, conectado a la misma Wi-Fi, abrir la dirección **Network** que
muestre el comando, con el puerto 5193. No usar localhost en el teléfono.
La dirección de red depende del ordenador y se consulta al arrancar; no se
guarda aquí. Detener el servidor con Ctrl+C al terminar. Si el puerto está
ocupado, comprobar si es esta sesión antes de abrir otro servidor o detenerlo.

Usar **Explore the App**, con la franja **Demo** visible. Son datos ficticios
de Alex, los cambios de la demo no se guardan. No importar respaldos personales,
borrar el espacio propio ni usar Reset Demo en una pestaña ajena. Para ver
Getting Started en la demo, abrir Help & Guide y Show Getting Started on Home.

## Checklist de Juan (pendiente en esta candidata)

- **Registrar y corregir un pago:** Home/Bills/detalle → Mark as Paid;
  cambiar importe, fecha y cuenta, guardar y desmarcar con confirmación.
  En préstamo, interés opcional sin cambiar Remaining Balance. Alternar
  Change Amount y Mark as Paid: Keep Editing conserva el borrador.
- **Conservar lo escrito:** demo → January 2027 → Show All → sexta factura
  pendiente → Mark as Paid → importe 321 → Show Fewer. Debe preguntar;
  Keep Editing conserva lista y 321. Discard and Leave descarta ese formulario
  y muestra menos facturas. Cancel es un botón del formulario de pago, no del diálogo.
  Probar también cambiar de Gym Membership a Transit Pass con un importe
  modificado: Keep Editing conserva Gym; Discard and Leave abre Transit Pass
  sin guardar el borrador de Gym.
- **Cuentas e historial:** crear Test Delete con saldo 10; Cancel en Delete
  conserva todo, confirmar elimina cuenta y sus saldos. Una cuenta con pagos
  o movimientos vinculados queda bloqueada con explicación. Este recorrido
  ya fue confirmado por Juan en una versión previa; repetir solo como regresión
  de la candidata si procede.
- **Navegar sin perder contexto:** Coming up de diciembre abre enero y Back
  devuelve diciembre y foco. Add → registro → Cancel vuelve al origen.
  History → Balance update abre cuenta, tarjeta o préstamo correcto y vuelve.
- **Leer y ocultar:** gráficas con flechas y Show as Table; Hide All Amounts
  oculta la gráfica de History. This Month con notas abiertas oculta también
  sus ejemplos numéricos. Las estimaciones se identifican como Estimate.
- **Pantallas y ayuda:** redimensionar alrededor de 1024 y 1200 px; en teléfono
  comprobar menú Add, formularios con teclado y ausencia de recorte lateral.
  Abrir ayuda, saltar y retomar Getting Started; probar movimiento reducido.

## Revisión y limitaciones de la entrega

Según REVISION-03-08.md (Claude, 4 de noviembre), Claude abrió los dos paquetes
y ejecutó 813 pruebas, lint y build sobre el snapshot de `8db763e` en Linux,
Node 22. También verificó Show Fewer a 390 y 1280 px y responsive en Chromium
de 320 a 1440 px. Son comprobaciones de Claude sobre esa versión, no ejecuciones
de Codex ni una aprobación de las correcciones posteriores.

H1 protege el cambio de factura con un pago modificado en Home. H4 impide
anunciar un borrado rechazado al revalidar los datos y mejora el foco de Delete.
Se corrigieron el checklist H2 y el comentario H3. Ver resultados y alcance
en WORK_STATUS.md. Las correcciones se entregan a Claude en un diff pequeño.
Codex comprobó las correcciones con 48 pruebas afectadas y cerró el código
`c40f502` con **815 pruebas aprobadas en 59 archivos**, `--maxWorkers=2`,
lint, build y diff check correctos. Claude aprobó este diff en
`review-deliveries/REVISION-correcciones-f7081aa.md`, sin bloqueantes.
Sus comprobaciones de 813 pruebas corresponden a `8db763e`.

Se conserva la confirmación manual de Juan de crear Test Delete con saldo 10,
cancelar y confirmar después en ordenador y teléfono en la versión anterior.
No se atribuye una nueva prueba manual de borrado a esta candidata corregida.
Safari/iPhone y gestos de la candidata final siguen pendientes, al igual que
teclado móvil, movimiento reducido real y gráficas con lector de pantalla.
El navegador integrado de Codex tuvo timeout; los recorridos Chromium de Claude
no se extienden automáticamente a las correcciones posteriores a `8db763e`.
Build conserva el aviso de tamaño del fragmento JavaScript. No se añadieron
dependencias. No se hará push, merge a main ni despliegue sin autorización.

## Validación de los dos ajustes finales

La entrega fija está en `review-deliveries/final-adjustments/<commit-final>/`.
Incluye los dos ajustes posteriores a f7081aa, sus pruebas y los cambios de
coordinación en un commit separado. No añade otras mejoras.
Codex comprobó 53/53 pruebas afectadas, lint y build; se reutilizan esos
resultados porque el código y el entorno no han cambiado.

Con datos ficticios, en la demo:

1. Money → Accounts & Savings: crear Test Delete sin movimientos vinculados.
   Delete enfoca la confirmación; Cancel devuelve el foco a Delete.
   Confirmar el borrado deja el foco en la lista Accounts si quedan cuentas.
2. Para comprobar la última cuenta sin tocar datos propios, borrar en la demo
   todas las cuentas que se puedan borrar (sin forzar las vinculadas). Si hay
   cuentas vinculadas, usar un espacio de prueba vacío en un perfil de navegador
   separado, crear Only account y borrarla. El foco debe quedar en
   Add Your First Account; pulsar Enter debe abrir el formulario.
3. El rechazo coincidente con not-saved o conflict está cubierto por la prueba
   aislada AccountDeletionUi: conserva la cuenta y la confirmación y entrega
   a say el resultado real para mostrar el aviso de guardado. No se pide
   reproducir artificialmente esa coincidencia durante la validación manual.

Estos recorridos siguen pendientes de confirmación expresa de Juan. También
sigue pendiente la revisión de los dos ajustes finales por Claude; su aprobación
de f7081aa no se extiende a ellos.
