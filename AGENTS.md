# Coordinación de Goal Planning App

Estas reglas son comunes a Codex y Claude. Lee también `docs/WORK_STATUS.md`
antes de continuar una tarea y consulta la documentación pertinente de `docs/`.
El procedimiento de entrega y revisión está en [docs/WORKFLOW.md](docs/WORKFLOW.md).
AGENTS.md es la fuente de reglas comunes; CLAUDE.md remite a ella sin duplicarlas.

## Idioma y términos

- Explica el trabajo a Juan en español. La interfaz usa inglés sencillo.
- Conserva los términos `Remaining Balance`, `Contribution` y `payment`.

## Git y coordinación

- Si tienes acceso para ejecutar Git, comprueba directamente `git status --short`,
  `git branch --show-current` y `git log -3 --oneline` antes de trabajar.
  Si no puedes, indícalo y usa el estado y el diff proporcionados por el editor,
  identificándolos como información recibida, no comprobada localmente.
- Las comprobaciones del índice corresponden al editor con acceso a Git.
- Preserva los cambios existentes, incluidos los archivos sin seguimiento.
  No los sobrescribas, descartes ni incluyas en otra tarea por iniciativa propia.
- Un solo asistente edita el código por tarea: Codex implementa y corrige;
  Claude revisa. Claude solo puede escribir su informe en la ubicación acordada
  en `review-deliveries/`; no modifica código, documentación común, pruebas,
  entregas del editor ni el índice de Git.
- Claude confirmó lectura y escritura local en
  [review-deliveries/claude-local-access.md](review-deliveries/claude-local-access.md),
  sin ejecución de comandos. Codex proporciona el estado de Git y las
  comprobaciones; Claude los identifica como información recibida. Leer
  `.git/HEAD` no equivale a comprobar el estado, el índice o los commits con Git.
- Con acceso local confirmado, usar directamente las entregas fijas por commit
  y los informes en `review-deliveries/`, según `docs/WORKFLOW.md`, sin exigir
  ZIP ni adjuntos. No presumir acceso a conversaciones o a otras carpetas.
  Juan comunica cuándo está lista cada entrega o revisión.
- Si Juan pausa una tarea, conserva sus archivos y su contenido preparado.
  No cambies el índice ni reanudes esa tarea sin indicación de Juan. Los cambios
  de otra tarea quedan separados y sin preparar si ese es el alcance autorizado.
- Respeta el alcance indicado por Juan. No hagas commit, push, merge a main
  ni despliegue sin su autorización.

## Datos y comprobaciones

- No añadas datos financieros personales al repositorio. Usa únicamente datos
  inventados en ejemplos, pruebas, capturas y documentación.
- El editor con acceso al entorno ejecuta las comprobaciones necesarias según
  el cambio y las instrucciones de Juan; consulta `docs/DEVELOPMENT.md` para
  el procedimiento del proyecto. El revisor distingue la inspección del material
  recibido de la ejecución de pruebas.
- Reutiliza los resultados vigentes del mismo contenido y entorno. No repitas
  la suite completa por un relevo o una revisión: repítela si hay cambios,
  fallos, riesgos de regresión o una petición de Juan que lo justifiquen.
  Explica el motivo y el alcance de las nuevas comprobaciones.
- Distingue los resultados que has comprobado tú de los comunicados por Juan
  o recogidos en entregas anteriores. Indica qué ejecutaste y qué no.
- No marques una prueba manual como confirmada sin una confirmación expresa
  de Juan para ese recorrido. No deduzcas la causa de una incidencia sin investigarla.
- Al entregar, resume los cambios, las comprobaciones y lo pendiente. Mantén
  `docs/WORK_STATUS.md` actualizado cuando el alcance autorizado lo incluya.
  Usa el formato de entrega de `docs/WORKFLOW.md`.
