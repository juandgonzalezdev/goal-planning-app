# Candidata local Rumbo 03–08

Rama: `integration/rumbo-03-08`. Base integrada en main: `579117b`.
El hash final se entrega junto al resultado de `git log -1 --oneline`.
Esta candidata no está publicada ni integrada en main.

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
  Keep Editing conserva lista y 321. Cancel descarta solo ese formulario.
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

## Limitaciones de la entrega

La revisión de Claude aún no se ha recibido y su acceso no está confirmado.
Las comprobaciones automáticas no equivalen a pruebas manuales. El navegador
integrado de Codex tuvo timeout de conexión: quedan pendientes verificación
visual responsive, Show Fewer en navegador, Safari/iPhone y gestos táctiles.
Build conserva el aviso de tamaño del fragmento JavaScript. No se añadieron
dependencias. No se hará push, merge a main ni despliegue sin autorización.
