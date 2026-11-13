# Desarrollo, entrega y revisión

[AGENTS.md](../AGENTS.md) establece las reglas comunes;
[STATUS.md](STATUS.md) resume el estado vigente y
[WORK_STATUS.md](WORK_STATUS.md) conserva las evidencias históricas fechadas.
[ORGANIZATION.md](ORGANIZATION.md) define responsabilidades y fuentes documentales.
[DEVELOPMENT.md](DEVELOPMENT.md) contiene comandos y guiones técnicos: el alcance
y este flujo determinan qué comprobaciones corresponden, sin exigir siempre las
cuatro comprobaciones de su sección histórica.

## Preparar el encargo

Dirección define objetivo, base, archivos permitidos, exclusiones, criterios de
aceptación, editor, revisor, ubicación del informe y permisos Git. Las decisiones
nuevas o ampliaciones vuelven a Dirección. El editor verifica acceso, rama, HEAD, estado e índice antes
de editar; conserva los cambios ajenos. Si falta una condición crítica, lo comunica.

No se presume entorno compartido. Acuerda una ubicación accesible o adjuntos;
no es obligatorio crear `review-deliveries/` ni usar ninguna ruta única.
No se depende de antiguos informes locales para arrancar una tarea.
No recrees directorios eliminados para satisfacer documentación histórica.

## Modalidad A: rama de trabajo

1. Dirección autoriza el alcance.
2. El editor utiliza la rama aislada indicada, o crea una si está autorizado.
3. Implementa únicamente los cambios permitidos y preserva el índice existente.
4. Ejecuta verificaciones pertinentes y distingue resultados propios de recibidos.
5. Entrega el diff completo, incluidos archivos nuevos, y el informe.
6. El revisor independiente inspecciona esa entrega identificada; no edita la
   implementación. Registra hallazgos, riesgos y límites en el informe acordado.
7. Dirección acepta, solicita correcciones o rechaza. El editor responde a cada
   hallazgo y entrega otra versión identificada si cambia el contenido.
8. Solo con autorización expresa se prepara contenido nuevo para commit y se
   ejecutan commit, merge o push. Despliegue y publicación requieren su permiso
   correspondiente; un push puede activar el despliegue automático documentado.

La auditoría puede preceder al commit. Una entrega sin commit se fija mediante
base exacta, parche acumulado, manifiesto y huellas SHA-256. Nunca atribuyas los
cambios sin commit al HEAD que solo contiene la base. Si ya existe commit
autorizado, identifica base y extremo completos.

## Modalidad B: copia verificable y parche

1. Establece la base exacta y su procedencia: commit y árbol/blobs verificados,
   archivo Git exportado o snapshot cuya identidad pueda comprobarse.
2. Implementa en una copia independiente. Identifica si es snapshot sin Git;
   no declares una rama ni un índice local que no has inspeccionado.
3. Genera un parche completo de todos los cambios propios respecto de esa base,
   incluidos archivos nuevos. Separa cambios previos de Dirección.
4. Comprueba `git apply --check` sobre una copia limpia compatible. Prueba también
   el estado previo requerido por el encargo cuando difiera de la base limpia.
   No fuerces la aplicación con `--reject` ni ignores diferencias.
5. Entrega parche, SHA-256, manifiesto, informe, verificaciones, límites y riesgos.
   Si no compartes entorno con el revisor, adjunta los archivos necesarios.
6. La revisión independiente precede a la aplicación o integración posterior.
   Dirección autoriza expresamente esas operaciones; entregar un parche no las
   autoriza ni modifica el ordenador del destinatario.

Conserva versiones anteriores de entrega fuera de los commits de producción.
Una corrección genera nueva versión y huellas; no sustituye silenciosamente
la evidencia que ya se revisó.

## Contenido mínimo de la entrega

| Campo | Contenido |
| --- | --- |
| Identidad | Tarea, versión de entrega, fecha, editor, revisor previsto y objetivo. |
| Base y acceso | Commit completo, rama real o snapshot, origen y límites de acceso. |
| Cambios | Lista exacta; distinguir preparados previamente, no preparados y nuevos. Diff acumulado completo. |
| Evidencia | Comandos o recorridos ejecutados, resultado, fecha, contenido y responsable; separar evidencia recibida. |
| Preservación | Trabajo ajeno conservado y, cuando proceda, comparación del diff preparado binario y SHA-256. |
| Límites | Qué no se probó, riesgos residuales, documentos protegidos y pendientes. |
| Próximo paso | Qué revisa cada responsable y qué autorización falta. |

El revisor identifica la entrega revisada por hash y base, incluso sin commit.
Cada hallazgo lleva prioridad, archivo o referencia, problema, efecto y
comprobación propuesta. El editor relaciona cada hallazgo con su resolución
o justificación. Dirección comunica cuándo está lista cada revisión.

## Verificación proporcional

- **Solo documentación, sin configuración ni código:** inspección íntegra del diff,
  enlaces/rutas, coherencia, alcance, documentos protegidos e índice.
  Ejecutar `git diff --check` y `git diff --cached --check` si hay repositorio.
  En snapshot sin Git, declarar esa limitación y usar diff sin índice y
  `git apply --check --no-index` en la copia. Una simulación no sustituye ni se
  presenta como el índice real de Windows.
  No se exige suite completa, build o audit por una edición documental.
- **Código o configuración:** pruebas dirigidas y comprobaciones adecuadas según
  DEVELOPMENT y el encargo. Añadir suite completa, lint, build o audit cuando el
  alcance o riesgo lo justifique. No elevar timeouts para ocultar fallos.
- Cada resultado registra fecha, versión, responsable y entorno. No sumar
  dirigidas y completas si se solapan. Las ejecuciones históricas conservan su
  atribución; no se presentan como nuevas.
- Los recorridos manuales se entregan con datos ficticios y resultado esperado.
  Solo se consideran confirmados por aceptación expresa de Dirección, para
  la versión, navegador, dispositivo y recorrido indicados.

## Índice y cierre

Registrar el resumen operativo nuevo en STATUS y el detalle de pruebas y decisiones
en el informe del incremento, conforme a AGENTS. WORK_STATUS solo se amplía con
autorización expresa de Dirección; esta regla rige hasta una decisión posterior.

Cuando se exige preservación exacta, guardar antes y después el diff preparado
binario completo con `git diff --cached --binary`, su SHA-256, lista preparada,
estado y `git diff --cached --check`. Capturar bytes sin recodificación de la
salida nativa de Git. Detenerse si el índice inicial difiere del autorizado o si
la comparación final no coincide; no intentar corregirlo mediante reset o add.

Los cambios nuevos quedan sin preparar cuando así se haya indicado. El informe
del editor no sustituye a una comprobación local del índice del destinatario.

Integrar solo el contenido revisado y autorizado. Comprobar referencias y
estado Git antes/después de cada operación permitida. Un push satisfactorio no
acredita publicación; registrar el despliegue únicamente con evidencia propia
o confirmación atribuida. La revisión independiente no autoriza por sí sola
commit, integración ni publicación.
