# Organización del proyecto y decisiones preparatorias

**GPA-ORG-A · 13-11-2026 · Fase A documental.**
El modelo organizativo está aprobado por Dirección. La revisión de su implementación
documental y la autorización de integración se registran por entrega en su informe.
Aprobar el modelo no autoriza por sí solo integrar cambios en main.
Nombre técnico: `goal-planning-app`. Nombre comercial definitivo: pendiente.

## Responsabilidades y fuentes únicas

Dirección define alcance, prioridades y aceptación. Codex es editor habitual;
Claude revisa independientemente cuando se le asigna. Los colaboradores futuros
reciben permisos por tarea, sin edición simultánea del mismo conjunto.
El procedimiento de entrega y revisión vive en [WORKFLOW.md](WORKFLOW.md);
las reglas comunes viven en [AGENTS.md](../AGENTS.md).

| Información | Fuente principal | Regla de mantenimiento |
| --- | --- | --- |
| Visión y principios | [PRODUCT_VISION.md](PRODUCT_VISION.md) | Dirección aprueba cambios; un roadmap fechado no prueba implementación. |
| Estado y evidencia vigente | [STATUS.md](STATUS.md) | Fecha, versión y origen; enlazar informes, no reproducirlos íntegros. |
| Reglas financieras | [FINANCIAL_RULES.md](FINANCIAL_RULES.md) | No duplicar fórmulas en diseño o identidad; consultar incrementos aprobados pertinentes. |
| Persistencia y recuperación | [STORAGE_AND_RECOVERY.md](STORAGE_AND_RECOVERY.md) | Cambios requieren alcance y validación específicos. |
| Mapa técnico | [PROJECT_MAP.md](PROJECT_MAP.md) | Ubicar componentes sin convertirlo en backlog ni historial. |
| Reglas de colaboración | AGENTS y WORKFLOW | CLAUDE remite a las reglas comunes; no mantener políticas paralelas. |
| Organización e identidad híbrida | Este documento | Registrar decisión, estado y condición para implementarla. |
| Evidencia histórica | [WORK_STATUS.md](WORK_STATUS.md) e informes de incremento | Conservar autor, fecha y versión. No reutilizar autorizaciones antiguas. |

Una decisión vigente se registra una vez en su documento principal, con fecha,
responsable, alcance y enlace al incremento. Los otros espacios enlazan esa fuente.
Si hay contradicción con código o entre documentos, registrarla para revisión;
no corregir silenciosamente un documento protegido ni inventar una decisión.
Los informes R1/R2 permanecen como entregas de su época; STATUS sitúa su contenido
en la base actual. La tabla de roadmap de PRODUCT_VISION y varias partes de
PROJECT_MAP/DEVELOPMENT requieren reconciliación futura, sin modificación aquí.

## Estructura conceptual aprobada

No es un inventario de carpetas existentes ni una orden de crearlas.
En esta fase no se crean `brand/`, `product/`, `design/` ni `.github/`,
no se recrea `review-deliveries/` y no se migra contenido.
Cada espacio se abrirá cuando tenga contenido aprobado y un encargo concreto.

| Espacio futuro o actual | Contenido propio y responsable por tarea | Publicable tras aprobación | Fuera de ese espacio / material privado |
| --- | --- | --- | --- |
| `brand/` | Identidad final aprobada, normas, fuentes de recursos y licencias. Responsable de identidad asignado por Dirección. | Solo recursos autorizados para distribución y evidencia de licencia publicable. | Exploraciones, nombres descartados, contratos y materiales confidenciales: laboratorio privado externo. |
| `product/` | Estrategia, requisitos y decisiones de producto aprobados. Responsable de producto. | Especificaciones que Dirección decida hacer públicas. | Investigación con personas identificables, planes comerciales confidenciales; no duplicar PRODUCT_VISION. |
| `design/` | UX/UI aprobado, flujos, especificaciones y accesibilidad. Responsable de diseño. | Material aprobado sin datos personales ni restricciones de licencia. | Pruebas con datos reales, grabaciones privadas, exploraciones de marca; no implementar cálculos paralelos. |
| `docs/` | Documentación técnica, operativa, reglas y evidencia versionada. Editor/revisor asignados. | Documentos revisados sin secretos ni información personal. | Logs temporales, snapshots, backups financieros e informes confidenciales. |
| `src/` | Implementación y pruebas con datos ficticios. Responsable de desarrollo. | Código revisado según permisos y licencia del proyecto. | Diseños exploratorios, datos reales, secretos o archivos de revisión. |
| `public/` | Recursos finales que la web necesita servir. Responsable de desarrollo con aprobación de identidad. | Cada recurso se considera potencialmente público al desplegar. | Originales privados, fuentes sin licencia redistribuible, borradores o secretos. |
| `.github/` | Plantillas y automatización de colaboración/CI aprobadas. Responsable de infraestructura. | Configuración revisada sin credenciales. | Tokens, claves y credenciales; no guardar aquí como solución a los permisos. |

El repositorio de aplicación no es un almacén privado por defecto. Antes de
incorporar material, comprobar audiencia, confidencialidad, licencia y necesidad.
El histórico Git también retiene contenido: borrar un archivo en otro incremento
no equivale a retirar una divulgación previa.

## Identidad híbrida

1. Explorar nombres, logos, eslóganes y paletas en un laboratorio privado e
   independiente del repositorio de aplicación.
2. Dirección selecciona y aprueba una versión identificada. Verificar procedencia,
   licencias de fuentes e imágenes, permisos de redistribución y restricciones.
   La aprobación visual por sí sola no acredita esos derechos.
3. Incorporar únicamente los recursos aprobados y publicables a `brand/`
   mediante tarea posterior autorizada, con versión y referencia a la aprobación.
4. Un incremento de desarrollo autorizado copia o deriva los recursos necesarios
   para la web en `public/` o la ubicación técnica justificada. Registrar origen,
   transformación y versión para evitar dos originales divergentes.
5. Revisar presentación, accesibilidad y licencias antes de publicar.
   Cambiar marca comercial no implica renombrar el repositorio.

No se crea ahora laboratorio, repositorio privado ni carpeta de marca; tampoco
se restauran `brand/rumbo/`, diseños o recursos anteriores.
Los borradores y acuerdos confidenciales permanecen fuera del repositorio.
No se integra ninguna identidad visual en la app en GPA-ORG-A.

## Gestión de trabajo para un equipo pequeño

Dirección aprueba conversaciones con asistentes junto a un tablero profesional.
GitHub Projects es la opción propuesta para evaluación e implantación posterior,
no un servicio configurado. Estados objetivo:

| Estado | Criterio propuesto para uso posterior |
| --- | --- |
| Ideas | Oportunidad registrada; sin autorización de implementación. |
| Ready | Alcance, base, dependencias y criterios definidos; autorización identificada. |
| In progress | Editor asignado trabajando dentro del alcance. |
| Review | Entrega identificada y evidencia listas para revisión independiente. |
| Done | Aceptación de Dirección y cierre del alcance, con integración/publicación solo si estaban incluidas y se comprobaron. |
| Blocked | Dependencia, condición crítica o decisión pendiente identificada. |

Cada tarea debe enlazar sus decisiones y entrega, indicar editor/revisor,
permisos, exclusiones y siguiente paso. El tablero sigue el trabajo; no sustituye
la fuente documental de decisiones ni convierte una conversación en evidencia
de ejecución. No se crean Issues, tablero, workflows o automatizaciones aquí.

## Conservación de WORK_STATUS

Se leyó el archivo completo de la base: 153.211 bytes, 2.420 líneas de contenido
más el salto final. Contiene entradas del 3 al 12 de noviembre, con bloques
insertados al inicio y otros añadidos al final; su orden no es estrictamente
cronológico. Hay decisiones vigentes mezcladas con estados ya sustituidos,
resultados de varias versiones y referencias a entregas locales eliminadas.

**Decisión aplicada:** conservar WORK_STATUS íntegro, sin resumirlo ni moverlo.
AGENTS, README, WORKFLOW y STATUS aclaran su función histórica. No se considera
seguro sustituirlo en esta fase: varios pendientes y aceptaciones dependen de
informes locales que ya no forman parte del árbol verificable.

| Información identificada | Conservación aplicada | Tratamiento futuro propuesto |
| --- | --- | --- |
| Decisiones financieras: payment no cambia principal; borrado de cuenta con solo saldos; protección de payments históricos | Texto íntegro; fuentes normativas e informes enlazados desde STATUS cuando corresponde. | Reconciliar decisión por decisión con FINANCIAL_RULES y código antes de extraerla. |
| UX: mes compartido/History independiente, navegación y guardas, anillo, Pulse por mes/dispositivo, cobertura parcial | Texto íntegro y visión protegida sin cambios. | Matriz decisión → versión → documento principal, con aprobación para cada traslado. |
| QA automática y revisiones | Fechas, autores, cifras y versiones originales intactas. | No sumar suites ni confundir resultados recibidos con ejecución propia. |
| Aceptaciones manuales | Confirmaciones exactas, sus dispositivos y límites intactos; STATUS enlaza el registro. | Cerrar pendientes solo tras evidencia específica, sin generalizar aceptación. |
| Autorizaciones de commit/integración históricas | Intactas; no son permisos reutilizables. | Mantener como historial, fuera del estado operativo breve. |
| Referencias locales y archivos retirados | Intactas como referencias históricas, algunas inaccesibles. | Resolver solo las necesarias con archivo de procedencia verificable o declarar pérdida de evidencia. |
| Pendientes no trasladados íntegramente | O2/O3 de Bills, N1–N3 de 2A.1, heurística de teclado, MarkPaid intermitente, observaciones UX-02.1 y QA física | Tabla completa de reconciliación antes de cualquier sustitución; no declararlos resueltos. |
| Cleanup y copias archivadas | Registro de inventarios/hashes y rutas conservado. | Verificar disponibilidad del archivo; el texto no prueba que esas copias sigan accesibles. |

Una Fase B podrá proponer una consolidación documental y trasladar el histórico
solo tras inventario completo de decisiones, aprobaciones y pendientes, con
tabla de conservación revisada. Git conserva el archivo rastreado de esta base;
no recupera automáticamente los antiguos paquetes locales no rastreados.
No se ha eliminado ninguna decisión ni se usa Git como justificación para perder
evidencia que nunca estuvo versionada.

## Seguridad e infraestructura: situación y evaluación futura

Aquí «verificado» significa presencia en código/documentación de esta base,
no auditoría externa ni ejecución de controles de cuenta/proveedor.

| Área | Estado de evidencia | Próximo estudio o decisión |
| --- | --- | --- |
| Persistencia local, revisiones y Demo | Existentes por inspección de `useSpace`, `indexedDbStore` y documentación; QA comunicada en R2. | Mantener guardas y estudiar recuperación con datos ficticios. |
| Datos financieros y backups | Almacenamiento local sin cifrar; aislamiento Demo existente. | Amenazas, minimización, exportación, recuperación y eventual cifrado/gestión de claves. |
| Permisos de repositorio, MFA y protección de ramas | No verificados en cuentas remotas; controles propuestos. | Definir roles mínimos y requisitos de acceso para colaboradores. |
| Escaneo de secretos y dependencias | Automatización no verificada; R2 comunica 10 vulnerabilidades moderadas. | Evaluar escaneo, responsables de remediación y revisiones de dependencias. |
| Desarrollo, preview y producción | DEVELOPMENT describe Cloudflare Pages; configuración efectiva y acceso a previews no inspeccionados. | Separación de entornos, datos ficticios y acceso/restricción de previews. |
| Backup y recuperación operativa | Existen mecanismos locales; continuidad y recuperación de servicios futuros sin evaluar. | Objetivos de recuperación, restauración ensayada y responsables. |
| Autenticación de usuarios | Preview de UI; sin cuentas operativas. | Modelo de identidad, recuperación, sesiones y permisos. |
| Sincronización multidispositivo | Pendiente de evaluación; no implementada. | Modelo de datos, consistencia, conflictos, disponibilidad y costes. |
| Duo privado | Pendiente; el espacio actual no restringe por miembro. | Matriz de permisos, invitaciones, revocación y efectos de conflictos. |
| Cifrado | No implementado como protección del almacenamiento financiero local. | Evaluar tránsito/reposo/extremo a extremo y recuperación de claves; no prometer una solución. |
| RGPD y proveedores | Evaluación pendiente, sin conclusión de cumplimiento. | Finalidades, roles, retención, derechos, ubicación, contratos y costes; revisión competente antes de servicios reales. |

El siguiente encargo deberá comparar proveedores, costes y límites técnicos con
requisitos concretos. No se crean cuentas, backend, autenticación, bases remotas,
servicios ni configuración en esta fase.

## Recomendación para Fase B

Después de la revisión independiente y decisión de Dirección:

1. Reconciliar el backlog histórico y documentos protegidos mediante tareas
   separadas; conservar las pruebas y autorizaciones originales.
2. Definir fichas de trabajo y evaluar GitHub Projects sin automatizar por defecto.
3. Encargar exploración de identidad en el laboratorio privado y aprobar recursos
   antes de crear `brand/`. UX/UI y marca mantienen responsables y entregas distintos.
4. Encargar evaluación de seguridad e infraestructura con requisitos, escenarios,
   costes y decisiones de privacidad; después decidir implementación.
5. Crear cada carpeta conceptual únicamente al incorporar contenido aprobado.
   No migrar por estética ni duplicar las fuentes vigentes.

UX-05.5-R3 mantiene su prioridad funcional separada. Ninguno de estos pasos
constituye autorización de implementación, integración o publicación.
