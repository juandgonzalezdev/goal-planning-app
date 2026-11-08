# UX-02 — Brief de prototipo para Claude

Fecha: 2026-11-07. Preparado por Codex para diseño UX/UI y revisión independiente.
Estado: material de trabajo; ninguna composición queda aprobada por este brief.
Informe de contexto: docs/UX_02_COMPOSITION_EVALUATION.md.

## Objetivo y límites

Diseñar una composición clara de cabecera, herramientas globales/de Home y
selector continuo. Mantener Simple first, details when needed y las áreas
This Month, Left to Pay y Money & Goals. El mes activo debe ser protagonista;
el año, asociado pero diferenciado; los vecinos deben parecer controles.

No rehacer UX-01A, Details/Edit/retornos de UX-01B/C, gráficos/anillos UX-03,
pagos ni dominio financiero. No cambiar modelos, backup, datos ni almacenamiento.
El prototipo será autónomo, sin conectar a la app ni guardar datos financieros.
Usar datos ficticios neutrales, por ejemplo Example Bill50 y Example Account.

## Fuentes que debes abrir

1. AGENTS.md y docs/WORKFLOW.md: Codex edita producto, Claude diseña/revisa.
2. docs/UX_02_COMPOSITION_EVALUATION.md: hallazgos, nueve capturas y decisiones.
3. review-deliveries/ux-02/corrections-2026-11-07/REVISION.md: Approved with observations.
4. review-deliveries/ux-redesign/PROPUESTA.md §3,§4,§7 y prototype.html: referencia
   histórica de rueda; NO importar sus otras pantallas, gráficos ni límites.
5. src/components/MonthSwitch.tsx; src/features/home/HomeScreen.tsx:234;
   src/App.tsx:918; src/styles/finance.css; src/styles/tokens.css.
6. ui/privacy.tsx y ui/amountVisibility.ts: ojo global/ojos individuales y alcance.

Las capturas de composition-audit-2026-11-07 son anteriores a O3/O4. El código
actual ya prioriza el mes seleccionado al abrir y corrige el aviso de lint.
No confundir esos cambios técnicos con una aprobación de la composición actual.

## Propuesta para desarrollar, sujeta a Dirección

Primer candidato recomendado A:
- + Add permanece en cabecera; Settings mantiene el patrón responsive actual
  (riel desde1024px, cabecera móvil). No añadir un segundo Settings.
- Ojo global y Home options en una fila de herramientas de Home, separada de la
  fecha; ojos individuales en sus tres áreas. No mezclar organización/privacidad
  con el selector ni esconder privacidad dentro de + Add.
- Selector compacto centrado en la columna útil. Explorar18–22rem como punto
  inicial de escritorio, sin fijarlo como requisito aprobado. Mes activo completo
  con mayor presencia que hoy, año en su propio nivel; vecinos próximos.
- Tres posiciones legibles que se desplazan en el sentido elegido, sin giros
  repetidos, caras enfocables ocultas ni texto superpuesto. Probar esta solución
  antes de justificar un cilindro completo de doce caras.

Si Dirección quiere evaluar privacidad realmente global en cabecera, mostrar
como única alternativa B: ojo junto a + Add, Home options permanece en Home.
Explicar saturación a320px y eliminación de accesos duplicados equivalentes en
Bills/History sin eliminar funciones. No producir variaciones adicionales sin
una decisión real que lo justifique.

Decisiones pendientes que debes hacer visibles en el prototipo:
- A o B y disponibilidad de herramientas al hacer scroll.
- Ancho/alineación y tamaño mes/año.
- Intensidad y sentido de profundidad/movimiento; versión reducida.
No resolverlas silenciosamente en un único mock ni llamar aprobado al candidato.

## Interacciones mínimas del prototipo

- Previous/Next, clic en vecinos, swipe horizontal y teclado cambian mes/año en
  ambas direcciones; diciembre/enero no detienen la rueda. No usar un listado
  fijo de2026/2027. El año técnico sigue YYYY-MM.
- Tres controles accesibles en reposo. Mes central abre una sola cuadrícula modal
  de doce meses; foco inicial en seleccionado, Escape/Close devuelve al disparador.
- Year admite borrador vacío y escritura1999. Inválido deshabilita selección sin
  sustituir silenciosamente un año distinto. No abrir teclado al abrir el modal.
- Cambio visual direccional tras selección aceptada; una sola actualización por
  swipe, scroll vertical intacto y sin perder la primera activación de teclado.
- Reduced motion elimina rotación/desplazamiento, conservando selección y foco.
- + Add, Hide/Show All Amounts y Home options tienen funciones simuladas distintas:
  menú global existente; máscara de importes; Expand/Collapse/Customize locales.
  Mantener Contribution y payment y no alterar el significado de Remaining Balance.
- Navegar Home↔Bills conserva mes. History tiene período propio/filtros, admite
  futuro vacío sin inventar registros y conserva el filtro al salir/volver.
- No añadir estados financieros nuevos ni botón Pay simplificado de UX-03/mock viejo.

## Pantallas y estados de entrega

Mostrar móvil320×640 y390×844, y escritorio1280×800, en claro/oscuro. Añadir
comprobación alrededor de1024px para no duplicar Settings ni perder + Add.

Matriz mínima del candidato:
1. Home cerrado, vecinos en reposo y hover/focus/pressed reconocibles.
2. Home tras scroll: qué queda fijo y dónde se encuentran ojo/opciones.
3. + Add abierto y Home options abierto, por separado y con sus acciones reales.
4. Cuadrícula abierta; Year vacío/1999; mes seleccionado; Escape/Close.
5. Diciembre→enero y vuelta con animación normal/reducida.
6. Bills con mes compartido y History con filtro independiente/futuro.

Probar al menos44×44px en cada objetivo. Sin recortes de September ni seis
meses de la cuadrícula. Sin barra sticky desproporcionada al abrir el panel.
Verificar zoom/texto200%, altura reducida, lector/teclado y teclado virtual en
Safari/iPhone cuando haya acceso; una emulación Chromium se etiqueta como tal.

## Entrega y coordinación

Ruta propuesta para el prototipo nuevo, a ratificar por Juan:
review-deliveries/ux-02/composition-prototype-v1/

Material sugerido: prototype.html autónomo, README.md (decisiones y cómo probar),
capturas numeradas y DESIGN_NOTES.md (A/B, compromisos, pendientes y medidas).
Esta ruta NO autoriza cambiar src/, estilos de producto, pruebas, documentación
común, índice ni entregas anteriores. Cualquier excepción al rol de revisión se
limita al artefacto de prototipo solicitado por Dirección y a la ruta que acuerde.
Si el alcance necesita otros archivos, Juan debe acordarlo primero.

Juan transmite el brief y comunica cuándo están listos prototipo/revisión.
No se presupone acceso compartido a conversaciones ni se mandan mensajes por
iniciativa propia. Codex evalúa viabilidad; Dirección aprueba distribución y
profundidad; después se autoriza una implementación acotada. Sin commit, merge,
push ni publicación hasta las autorizaciones correspondientes.
