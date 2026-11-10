# UX-01 A–C — Orden de ejecución aprobado

Fecha: 5 de noviembre de 2026. Editor: Codex.
Dirección aprueba implementar A–C, condicionado a cerrar e integrar antes 2A.1.
Este registro concreta la ejecución; no reabre la dirección visual ni amplía alcance.

## 1. Dependencia comprobada: 2A.1 aún no integrado

Git comprobado por Codex:
- Rama actual: codex/increment-2a1-end-subscription.
- HEAD: 4d23540fb5121628d4f88828a352a1df3a210047.
- main: 4112c234a4e8813d3e04ae2f9c70877e41f8ef73.
- Índice vacío.
- Correcciones O1–O7: trece archivos seguidos modificados y una prueba nueva;
  los catorce coinciden byte a byte con las copias de la revisión dirigida.

Se encontró y leyó:
review-deliveries/increment-2a1-end-subscription/observations-working-2026-11-05/REVISION.md.

Claude emite Approved para las siete correcciones. El informe se refiere a contenido
local sin commit, no a una entrega fija por hash. Declara 215/215 dirigidas y lint/build
correctos; son resultados del revisor, no nuevas ejecuciones propias de Codex.
Las 946/946 de Codex y lint/build del seguimiento conservan su vigencia porque
los archivos revisados no han cambiado. No se repiten por este registro documental.

No se encontró un bloqueo técnico nuevo. Pendientes reales:
1. Aceptación manual expresa de Dirección sobre los recorridos de 2A.1.
2. Autorización del commit final de 2A.1 y su cierre/integración.
3. Entrega fija por hash, con comprobación de coincidencia respecto de lo revisado,
   y registro de aceptación y revisión conforme a docs/WORKFLOW.md.
4. Integración autorizada en main, antes de crear la rama de UX-01.

Las notas N1/N2 de Claude son redacción opcional; no se corrigen ahora al margen
del alcance. N3 es la decisión documentada de Active sin cargo elegible cuando los
futuros están pagados o quedan fuera del horizonte. El revisor la considera no
bloqueante; Dirección debe conocerla al validar, sin inventar cargos o alterar payments.
No se presupone aceptación manual ni autorización de merge/push por aprobar UX-01.

## 2. Paso inmediato: aceptación y cierre de 2A.1

Usar los recorridos completos de docs/INCREMENT_2A1.md y los seis énfasis del informe
dirigido, con datos ficticios. Dirección debe comunicar cuáles completó y el resultado.
Incluyen:
- Anual heredada finalizada, y futura: mismo estado en detalle y All Bills.
- Keep Subscription sin guardar, y Cancel de pausa: retorno de foco correcto.
- Un cargo frente a varios; finalización antes del primero sin cargo ficticio.
- Fecha del último cargo y estado independiente del mes consultado.
- Payments intactos, bloqueo por anticipos incompatibles, History y PDF.
- Móvil, teclado/lector, light/dark y concurrencia según guion pendiente.

Tras su aceptación, el cierre delimita los catorce archivos de 2A.1 y excluye
docs/UX_01_TECHNICAL_EVALUATION.md, este documento, review-deliveries y archivos ajenos.
No introducir UX-01 en ese commit. Registrar hash y revisión sin sobrescribir
REVISION.md; no se presupone acceso compartido a conversaciones.

En esta preparación no se modifican los catorce archivos, el informe, el índice,
la rama o main. La comprobación de preservación está en
review-deliveries/ux-01-implementation-preparation/preservation-after.json.

## 3. Rama y arranque de UX-01

Solo después de integrar 2A.1:
- Comprobar status, rama, últimos commits y hash exacto de main.
- Confirmar que ese main contiene el commit final aprobado de 2A.1.
- Crear codex/ux-01-navigation desde ese main, con carpeta limpia para la tarea.
  Si quedan archivos locales ajenos, usar checkout/worktree separado y autorizado;
  no arrastrarlos, descartarlos ni prepararlos con UX-01.
- Registrar base exacta y lista de cada unidad antes de editar.
- Implementar A, después B y C; cada unidad con entrega revisable y aceptación
  de Claude y Dirección. No dar una unidad por aprobada por pasar automatización.

No se crea ahora una rama de UX-01 sobre main antiguo ni sobre el trabajo sucio
de 2A.1. La aprobación de A–C se conserva y no requiere otra propuesta UX.

## 4. Unidades de implementación

| Unidad | Trabajo concreto aprobado | Archivos principales | Criterio de entrega |
| --- | --- | --- | --- |
| A — Navegación | Barra flotante inferior móvil, presentación flotante coherente en escritorio, cinco iconos y etiquetas, profundidad y microanimación discreta, navegación desde detalle y edición con guarda de cambios. | App.tsx, components/BottomNav.tsx, components/Icon.tsx, styles/finance.css, styles/tokens.css y ui/useMediaQuery.ts si es necesario. | Una sola navegación, cinco etiquetas legibles, sin controles tapados; formularios y Back intactos; reduced motion, foco y responsive comprobados. |
| B — Encontrar facturas | This Month / All Bills arriba, búsqueda por nombre sin distinguir mayúsculas/tildes, Clear/conteo y conservación del contexto. Mantener Calendar/List y filtros existentes. | features/bills/BillsScreen.tsx, AllBills.tsx, billsView.ts; BillsCalendar.tsx solo si necesita aplicar el filtrado visual. | Buscar sin atravesar calendario; totales financieros sin filtrar; estados 2A.1 y regreso con búsqueda/mes/filtro/foco intactos. |
| C — Detalle y edición | Fila abre Details, Edit Details visible arriba y acceso directo desde All Bills; simplificar acciones/textos repetidos sin quitar ayudas críticas. | App.tsx, features/bills/BillScreen.tsx, BillForm.tsx, BillsScreen.tsx y AllBills.tsx. | Apertura/edición sencilla, sin botones anidados; misma forma y validación; End Subscription visible; payment actual y almacenamiento intactos. |

La búsqueda de este alcance es por nombre, como pidió Dirección; no se amplía
a categoría por heredar la evaluación anterior. No se añade anillo de progreso,
selector 360°, Home nuevo ni identidad visual de UX-03.

## 5. Primera entrega implementable: A

Preparación cerrada para comenzar A en cuanto se satisfaga §3:
- Reutilizar BottomNav y sus cinco destinos, Icon, selectTab y confirmLeave.
- Mantener la guarda de borradores y la navegación Back/Forward existentes.
- Nav visible durante scroll y accesible desde detalles/edición. Conservar contexto
  de origen y Back; no duplicar controles para móvil/escritorio.
- Mantener inicialmente el breakpoint actual de 1024 px y el diseño de Home;
  fondo/depth y medidas coherentes con la dirección aprobada.
- Reservar espacio usando altura real y safe areas, con mensajes y diálogos por
  delante. Probar con teclado virtual sin ocultar o tapar Save/Cancel.
- Microanimación solo decorativa: no transforma el área de selección ni elimina
  etiquetas. Reduced motion cambia el estado sin inclinación/desplazamiento.
- Corregir contraste de los tokens mínimos, con superficie opaca o composición
  verificada; no aplicar toda la paleta del prototipo.
- Preservar nombres accesibles, aria-current, foco visible y navegación por teclado.

Pruebas de A:
- Layout/App, navegación, LeaveForms, retorno y privacidad afectadas.
- Cinco destinos una sola vez; detalle/edición mantienen advertencia de cambios.
- Responsive y transición de ancho sin duplicaciones; último control y mensajes
  accesibles; nombres/aria-current; movimiento reducido.
- Lint, build, diff y verificaciones de accesibilidad disponibles.
- Comprobación real en móvil 320/390 px, escritorio, zoom/texto grande, light/dark,
  teclado/lector y Safari/iPhone. Dirección confirma manualmente el recorrido.

No se implementa A parcialmente en la rama de 2A.1 para adelantar estilos.
Los resultados nuevos se registrarán al ejecutarla, sin atribuirle pruebas de 2A.1.

## 6. Condiciones comunes y exclusiones

- End Subscription continúa visible y funcional en Bill Details.
- Sin cambios de reglas financieras, payments históricos, modelos o persistencia.
- Ayuda breve/progresiva; conservar mensajes de integridad, guardado fallido,
  desconocidos, proveedor y Remaining Balance.
- Ejemplos y documentación ficticios/neutrales, sin participantes reales.
- A–C conserva el flujo actual de payment. No añade Pay en un toque, Undo,
  cuentas por defecto nuevas ni edición bancaria.
- Para entrega posterior quedan registradas las condiciones de Dirección:
  pago sin cuenta sin alterar saldos, fecha editable/validada, préstamos/intereses,
  Undo exacto frente a concurrencia y aviso aproximadamente 8 segundos.
  Details mantiene la posibilidad de corregir después del aviso. Los 8 segundos
  sustituyen recomendaciones temporales anteriores; no se implementan en A–C.
- UX-02 y UX-03 siguen separados.

## 7. Estado de esta preparación y siguiente acción

Solo se añade este documento y evidencia de preservación; sin código, commit,
push, merge, despliegue ni pruebas nuevas de producto. El índice sigue vacío.
Los cambios y archivos ajenos existentes se conservan.

El impedimento actual para comenzar desarrollo no es la dirección visual ni una
nueva decisión de UX: falta completar aceptación/cierre e integrar 2A.1 en main.
Siguiente acción de Dirección: ejecutar/confirmar su validación de 2A.1 y autorizar
su cierre e integración. Después Codex crea la rama independiente e inicia A.
