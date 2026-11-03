# Coordinación de Goal Planning App

Estas reglas son comunes a Codex y Claude. Lee también `docs/WORK_STATUS.md`
antes de continuar una tarea y consulta la documentación pertinente de `docs/`.

## Idioma y términos

- Explica el trabajo a Juan en español. La interfaz usa inglés sencillo.
- Conserva los términos `Remaining Balance`, `Contribution` y `payment`.

## Git y coordinación

- Antes de trabajar, revisa `git status --short`, `git branch --show-current`
  y `git log -3 --oneline` para conocer el estado real del repositorio.
- Preserva los cambios existentes, incluidos los archivos sin seguimiento.
  No los sobrescribas, descartes ni incluyas en otra tarea por iniciativa propia.
- Un solo asistente modifica cada tarea; el otro revisa. Antes de editar,
  deja claro quién modifica y quién revisa. No editéis la misma tarea a la vez.
- Respeta el alcance indicado por Juan. No hagas commit, push ni merge sin
  indicación de Juan.

## Datos y comprobaciones

- No añadas datos financieros personales al repositorio. Usa únicamente datos
  inventados en ejemplos, pruebas, capturas y documentación.
- Ejecuta las comprobaciones necesarias según el cambio y las instrucciones
  de Juan; consulta `docs/DEVELOPMENT.md` para el procedimiento del proyecto.
- Distingue los resultados que has comprobado tú de los comunicados por Juan
  o recogidos en entregas anteriores. Indica qué ejecutaste y qué no.
- No marques una prueba manual como confirmada sin una confirmación expresa
  de Juan para ese recorrido. No deduzcas la causa de una incidencia sin investigarla.
- Al entregar, resume los cambios, las comprobaciones y lo pendiente. Mantén
  `docs/WORK_STATUS.md` actualizado cuando el alcance autorizado lo incluya.
