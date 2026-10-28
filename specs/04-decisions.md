# 04-decisions.md — Registro de Decisiones de Arquitectura (ADRs)

Este documento registra las decisiones que dieron forma a las especificaciones y evita que se reviertan sin contexto. Cada ADR indica qué se decidió, por qué, qué se sacrificó y qué alternativas se descartaron.

**Estado:** todos los ADRs están **Aceptados** y congelados antes del inicio de la implementación (2026-10-27).

---

## ADR-001 — Optimización en WASM dentro de la app, sin sidecar Python

**Contexto.** La especificación original proponía un sidecar Python (`trimesh` + PyInstaller) para la decimación. `trimesh.simplify_quadric_decimation` se apoya en `fast-simplification`, que devuelve únicamente vértices y caras: se pierden UVs, materiales y texturas. Eso contradice RF-1.3 (exportación con texturas integradas). Además, el sidecar obligaba a compilar un binario por target-triple, firmarlo, notarizarlo y resolver un contrato CLI/STDOUT adicional.

**Decisión.** La optimización se ejecuta en un **Web Worker** con `@gltf-transform/core`, `@gltf-transform/functions` y `meshoptimizer` (WASM). Se elimina Python, PyInstaller, `externalBin`, los target-triples y el contrato CLI.

**Consecuencias.**
- ✅ Preserva UVs, normales, materiales y texturas; respeta costuras UV.
- ✅ Un solo runtime multiplataforma; sin binarios extra que firmar.
- ✅ Motor detrás de una interfaz (`OptimizationEngine`) para poder añadir un sidecar nativo en el futuro.
- ⚠️ No procesa `.obj`/`.fbx` (ver ADR-002).
- ⚠️ Archivos muy grandes consumen memoria del WebView (mitigado con límites y liberación).

**Alternativas descartadas.** Sidecar Python con `trimesh` (pierde texturas), `gltf-transform` CLI como sidecar Node (reintroduce binario y CI), `pymeshlab` (bundle enorme y licencia GPL), `meshopt` en Rust (requiere parsear y reconstruir glTF en Rust; mayor esfuerzo para el MVP).

---

## ADR-002 — Formatos del MVP: GLB y glTF autocontenido

**Contexto.** El producto prometía `.gltf`, `.glb`, `.obj` y `.fbx`, pero el roadmap solo contemplaba `GLTFLoader`. `.gltf` con `.bin`/texturas externas exige resolver rutas relativas y permisos de directorio; `.fbx` depende de assimp y complica el empaquetado y la licencia.

**Decisión.** El MVP soporta `.glb` y `.gltf` **autocontenido**. `.obj` y `.fbx` se declaran *non-goals*. La exportación es `.glb` con texturas embebidas.

**Consecuencias.**
- ✅ Cubre el pipeline web/juegos real, donde GLB es el formato dominante.
- ✅ Elimina la resolución de recursos externos y sus vectores de error.
- ✅ Mantiene el motor WASM simple.
- ⚠️ Usuarios con OBJ/FBX necesitan convertir previamente.
- 🔁 Reevaluar si aparece demanda real; el motor está aislado tras una interfaz.

---

## ADR-003 — Acceso a archivos por bytes vía IPC, sin asset protocol

**Contexto.** Cargar un modelo con `useLoader(GLTFLoader, "C:\\ruta\\modelo.glb")` no funciona en el WebView. La alternativa `convertFileSrc` + `assetProtocol` requiere configurar y ampliar scopes dinámicamente, y falla con rutas Windows, acentos y caracteres especiales.

**Decisión.** Rust lee el archivo y devuelve bytes crudos (`tauri::ipc::Response`); el frontend parsea con `GLTFLoader.parse()`. El drag & drop usa `getCurrentWebview().onDragDropEvent()`, que sí entrega rutas.

**Consecuencias.**
- ✅ Sin scopes ni URLs especiales; comportamiento idéntico en macOS y Windows.
- ✅ El archivo original permanece intacto y validado en Rust.
- ⚠️ Los bytes viajan por IPC (aceptable para los tamaños del MVP).
- ⚠️ El protocolo de escritura usa cuerpo crudo + header para evitar arrays JSON.

---

## ADR-004 — SQLite en Rust con `rusqlite` (bundled)

**Contexto.** La especificación mezclaba `tauri-plugin-sql` (que se usa desde JavaScript) con un `db.rs` y comandos Rust. Eran dos arquitecturas incompatibles.

**Decisión.** Toda la persistencia vive en Rust con `rusqlite` (feature `bundled`) + `rusqlite_migration`. El frontend solo consume comandos tipados. La base se guarda en `app_data_dir()`.

**Consecuencias.**
- ✅ Un único dueño de los datos y del esquema.
- ✅ SQLite embebido: sin dependencia del sistema en Windows.
- ✅ Migraciones versionadas y testeables.
- ⚠️ Más código Rust que usando el plugin (compensado por tipado y control).

---

## ADR-005 — Rust como fuente de verdad de los contratos (`ts-rs`)

**Contexto.** Mantener a mano los structs Rust y las interfaces TypeScript garantiza divergencias silenciosas en IPC.

**Decisión.** Los modelos de dominio se definen en `src-tauri/src/models.rs` y se generan a `src/types/generated/models.ts` con `ts-rs`. Los tipos exclusivos de UI permanecen en `src/types/viewer.ts`.

**Consecuencias.**
- ✅ El compilador detecta cualquier desajuste entre capas.
- ✅ El archivo generado se versiona y se verifica en `pnpm verify`.
- ⚠️ Requiere ejecutar `pnpm gen:types` tras cambiar modelos.
- ❌ Descartado `tauri-specta` por añadir maquinaria innecesaria para seis comandos.

---

## ADR-006 — Three.js como única fuente de métricas

**Contexto.** Se definía `inspect_mesh_file` en Rust y, a la vez, el cálculo de métricas en el frontend tras cargar el modelo. Dos implementaciones implican dos resultados distintos, especialmente en texturas y bounding boxes.

**Decisión.** Se elimina `inspect_mesh_file`. `analyzeScene(scene)` en el frontend calcula todas las métricas sobre la escena ya decodificada. Rust solo entrega bytes y metadata de archivo.

**Consecuencias.**
- ✅ Números consistentes con lo que el usuario ve.
- ✅ Las texturas y el bounding box se obtienen sin duplicar parsers.
- ⚠️ Las métricas requieren cargar la escena en memoria (ya necesario para renderizar).

---

## ADR-007 — Semántica única de reducción: porcentaje entero de triángulos

**Contexto.** La UI hablaba de 0–80%, el CLI de `0.35` y los parámetros omitían `cleanVertices` y `exportFormat`. Tres contratos distintos para el mismo concepto.

**Decisión.** `reductionPercent` es un entero de 0 a 80 que representa el **porcentaje de triángulos a eliminar**. El motor calcula `ratio = 1 - reductionPercent / 100`. Se reporta la reducción real alcanzada y se advierte si difiere de la solicitada o si el resultado tendría menos de 4 triángulos.

**Consecuencias.**
- ✅ Un solo contrato en UI, worker y auditoría.
- ✅ Comportamiento predecible y auditable.
- ⚠️ La reducción real puede ser menor en mallas con muchas costuras o bordes bloqueados.

---

## ADR-008 — Esquema de auditoría ampliado y fechas en RFC3339 UTC

**Contexto.** El esquema original guardaba solo métricas básicas, usaba `DATETIME DEFAULT CURRENT_TIMESTAMP` (formato distinto al `string` de TS) y generaba el `id` en el cliente. No permitía reabrir ni localizar el resultado.

**Decisión.** El esquema incluye rutas de entrada/salida, tiempos, motor y versión, con `created_at` en RFC3339 UTC generado en Rust, `id` UUID v4 y un índice por fecha. `outputPath` es nullable.

**Consecuencias.**
- ✅ Historial útil para reabrir, comparar y auditar.
- ✅ Sin ambigüedad de zonas horarias (UTC en storage, local en UI).
- ⚠️ Cambios de esquema futuros requieren migración (previsto con `rusqlite_migration`).

---

## ADR-009 — Sidebar izquierdo con pestañas en lugar de una cuarta columna

**Contexto.** El layout definía tres columnas, pero el historial, las texturas y el reporte de importación no tenían ubicación. Añadir una cuarta columna reduce el viewport y rompe la jerarquía visual.

**Decisión.** El sidebar izquierdo usa pestañas **Métricas / Texturas / Historial**. El estado del motor y el FPS viven en el header; las advertencias en el footer.

**Consecuencias.**
- ✅ Todos los requisitos tienen lugar sin sacrificar viewport.
- ✅ Navegación accesible por teclado (`role="tablist"`).
- ⚠️ Solo se ve un panel a la vez (aceptable para el flujo de inspección).

---

## ADR-010 — Decoders empaquetados localmente

**Contexto.** Muchos GLB reales usan Draco, KTX2 o meshopt. Cargar decoders desde un CDN rompería el requisito *offline-first* y añadiría una dependencia de red en runtime.

**Decisión.** DRACO, Basis/KTX2 y Meshopt se copian desde `node_modules` a `public/decoders/` en `postinstall` y se sirven localmente. No se permiten orígenes remotos en la CSP.

**Consecuencias.**
- ✅ Funcionamiento garantizado sin red.
- ✅ Versiones de decoders alineadas con las dependencias.
- ⚠️ El instalador crece unos pocos MB (dentro de NFR-8).
- ⚠️ Si un decoder no inicializa, el error es explícito (`DECODER_UNAVAILABLE`).

---

## ADR-011 — Permisos mínimos: sin `tauri-plugin-fs` ni `tauri-plugin-shell`

**Contexto.** El acceso genérico al filesystem y la ejecución de comandos del sistema amplían la superficie de ataque y complican los scopes multiplataforma.

**Decisión.** Solo se habilitan `core`, `dialog` y `opener`. La lectura y escritura se hacen mediante comandos Rust propios que validan ruta, extensión y tamaño, y escriben de forma atómica.

**Consecuencias.**
- ✅ Superficie de ataque mínima y comportamiento auditable.
- ✅ Sin scopes de FS que mantener.
- ⚠️ Cada operación de archivo requiere un comando propio (coste bajo y acotado).

---

## ADR-012 — NFRs, matriz de trazabilidad y DoD como criterio de cierre

**Contexto.** Los requisitos no tenían tareas asociadas y las tareas no tenían un criterio verificable de "terminado". El proyecto podía declararse completo con requisitos sin implementar.

**Decisión.** Se añaden NFRs medibles, una matriz RF→Tarea y un DoD con checkboxes por tarea. `pnpm verify` (typecheck + tests + clippy) es obligatorio para cerrar cualquier tarea.

**Consecuencias.**
- ✅ El avance es objetivo y verificable.
- ✅ Ningún requisito queda huérfano (la matriz lo evidencia).
- ⚠️ Requiere disciplina de actualización cuando cambie el alcance.
