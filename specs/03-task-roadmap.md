# 03-task-roadmap.md — MeshCraft Studio

## Convenciones

* **Esfuerzo:** `S` ≤ 0.5 día · `M` 1–2 días · `L` 3–5 días (referencia para una persona).
* **Dependencias:** una tarea no se inicia hasta que sus predecesoras cumplen su *Definition of Done*.
* **DoD (Definition of Done):** la tarea está terminada cuando todos sus checkboxes se cumplen y `pnpm verify` pasa en verde.
* **`pnpm verify`** = `typecheck` + `vitest run` + `cargo test` + `cargo clippy -- -D warnings`.
* Las decisiones de diseño que sustentan el roadmap están en `04-decisions.md` (ADR-001…012).

> **Fase 0 (completada):** revisión y congelación de especificaciones. Las decisiones de motor, formatos, persistencia, contratos y permisos quedaron registradas en `04-decisions.md`. No se escribe código de producto hasta cerrar esta fase.

---

## 1. Fase 1: Inicialización, Contratos y Cimientos

### [Task 1.1] Scaffold Tauri v2 + React 19 + TypeScript + Tailwind 4

* **Estado:** ✅ Completada (2026-10-28)
* **Esfuerzo:** `M` · **Depende de:** Fase 0
* **Objetivo:** Inicializar el proyecto multiplataforma con tooling reproducible y versiones pineadas.
* **Archivos:** `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`, `src/`, `src-tauri/`, `.gitignore`, `README.md`.
* **Instrucciones:**
  1. Crear el proyecto con la plantilla Tauri v2 + React + TypeScript + Vite, fijando **Node 26 LTS** y **pnpm 12**.
  2. Configurar Tailwind CSS 4 con `@tailwindcss/vite` (CSS-first, **sin** `tailwind.config.js`).
  3. Instalar `lucide-react`, `clsx`, `tailwind-merge`, `zustand`, `three`, `@react-three/fiber`, `@react-three/drei`, `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions`, `meshoptimizer`, `draco3d`.
  4. Añadir scripts: `dev`, `build`, `typecheck`, `test`, `gen:types`, `copy-decoders`, `verify`. `postinstall` ejecuta `copy-decoders`.
  5. `git init`, `.gitignore` (`node_modules`, `dist`, `target`, `*.db`, `public/decoders`) y README con requisitos y comandos.
  6. Verificar la matriz React 19 ↔ R3F 9 ↔ Tailwind 4 con un *smoke test*.
* **DoD:**
  - [x] `pnpm tauri dev` abre una ventana con estilos Tailwind aplicados.
  - [x] `pnpm typecheck` y `pnpm build` pasan sin errores.
  - [x] `pnpm copy-decoders` deja DRACO, Basis y Meshopt en `public/decoders/`.
  - [x] Primer commit con specs + scaffold.

### [Task 1.2] Configuración de Tauri v2, CSP y Capacidades

* **Estado:** 🟡 Implementada — pendiente prueba manual de diálogos (2026-10-28)
* **Esfuerzo:** `S` · **Depende de:** 1.1
* **Objetivo:** Dejar la ventana, la seguridad y los permisos listos para el resto del proyecto.
* **Archivos:** `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs`.
* **Instrucciones:**
  1. Ventana principal 1280×800, mínimo 1024×700, título "MeshCraft Studio".
  2. Registrar `tauri-plugin-dialog` y `tauri-plugin-opener`.
  3. Declarar únicamente `core:default`, `dialog:allow-open`, `dialog:allow-save`, `opener:allow-reveal-item-in-dir`.
  4. Aplicar la CSP de `02-architecture-spec.md` §4.3 (incluye `wasm-unsafe-eval` y `worker-src`).
  5. **No** instalar `tauri-plugin-fs` ni `tauri-plugin-shell`.
* **DoD:**
  - [x] La consola no muestra violaciones de CSP.
  - [ ] `open()` y `save()` del diálogo funcionan; "revelar en carpeta" abre el explorador.
  - [x] `cargo clippy` sin advertencias.

### [Task 1.3] Modelos Rust, Errores y Generación de Tipos con ts-rs

* **Esfuerzo:** `M` · **Depende de:** 1.1
* **Objetivo:** Convertir Rust en la fuente única de verdad de los contratos.
* **Archivos:** `src-tauri/src/models.rs`, `src-tauri/src/error.rs`, `src/types/generated/models.ts`, `src/types/viewer.ts`.
* **Instrucciones:**
  1. Implementar todos los structs y enums de `02-architecture-spec.md` §3.1 con `serde` + `ts_rs::TS` y `rename_all = "camelCase"`.
  2. Implementar `AppError` con `thiserror` y serialización a `{ code, message, details }`.
  3. Configurar `ts-rs` para exportar a `src/types/generated/models.ts` y añadir `pnpm gen:types`.
  4. Definir los tipos de UI de §3.2 en `viewer.ts`.
  5. Versionar el archivo generado y documentar que no se edita a mano.
* **DoD:**
  - [ ] `pnpm gen:types` regenera el archivo sin cambios manuales.
  - [ ] `pnpm typecheck` pasa con los tipos generados.
  - [ ] Los enums se serializan en `SCREAMING_SNAKE_CASE` (test unitario).
  - [ ] El archivo generado está commiteado.

### [Task 1.4] Comandos Rust de Archivos con Escritura Atómica

* **Esfuerzo:** `M` · **Depende de:** 1.2, 1.3
* **Objetivo:** Implementar lectura y escritura binaria eficiente y segura.
* **Archivos:** `src-tauri/src/commands/fs.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/error.rs`.
* **Instrucciones:**
  1. `read_mesh_file`: canonicalizar, rechazar directorios, validar extensión `.glb`/`.gltf` y límite de 1 GB; devolver `tauri::ipc::Response` con bytes crudos.
  2. `save_mesh_file`: leer ruta percent-encoded del header `x-output-path`, aceptar solo `.glb`, validar cuerpo `InvokeBody::Raw` y escribir con `NamedTempFile` + `persist`.
  3. Implementar errores `READ_FAILED`, `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `SAVE_FAILED`.
  4. Añadir pruebas unitarias con `tempfile` (lectura exacta, escritura atómica, rechazos).
* **DoD:**
  - [ ] Leer un GLB de 50 MB devuelve exactamente los mismos bytes.
  - [ ] Una escritura interrumpida no deja archivos `.tmp` ni destino parcial.
  - [ ] Rutas con acentos y espacios funcionan en macOS y Windows.
  - [ ] `cargo test` cubre los cuatro códigos de error.

### [Task 1.5] Store Global con Zustand

* **Esfuerzo:** `S` · **Depende de:** 1.3
* **Objetivo:** Centralizar el estado de la aplicación sin acoplar objetos de Three.js.
* **Archivos:** `src/store/useMeshStore.ts`, `src/types/viewer.ts`.
* **Instrucciones:**
  1. Modelar estado: `currentFile`, `meshStats`, `renderMode` (default `shaded`), `environment` (default `studio`), `sidebarTab` (default `metrics`), `engineStatus`, `logs`, `history`, `historyTotal` y el bloque `optimization` (`params` default 50%, `cleanMesh` true, `lockBorders` true).
  2. Exponer acciones puras: `setFile`, `setStats`, `setRenderMode`, `setEnvironment`, `setTab`, `setEngineStatus`, `log`, `reset`.
  3. Limitar `logs` a 200 entradas.
  4. Selectores derivados para el header (VRAM, FPS) sin recalcular en cada render.
* **DoD:**
  - [ ] Tests unitarios de transiciones y reseteo.
  - [ ] El store no contiene `Object3D`, materiales ni texturas.
  - [ ] Cambiar de archivo limpia métricas y logs del anterior.

### [Task 1.6] Capa IPC Tipada y Manejo de Errores

* **Esfuerzo:** `S` · **Depende de:** 1.3, 1.4
* **Objetivo:** Evitar `invoke` disperso y mensajes de error inconsistentes.
* **Archivos:** `src/lib/ipc.ts`, `src/lib/errors.ts`, `src/components/ui/`.
* **Instrucciones:**
  1. Envolver cada comando en una función tipada que devuelva `{ ok, data } | { ok: false, error: AppError }`.
  2. Normalizar errores desconocidos a `AppError` con código `READ_FAILED`/`SAVE_FAILED` según contexto.
  3. Mapear cada código a un mensaje en español y a una acción sugerida.
  4. Crear un sistema mínimo de notificaciones (toast/banner) accesible.
* **DoD:**
  - [ ] No queda ningún `invoke` fuera de `ipc.ts`.
  - [ ] Todos los códigos de la taxonomía tienen mensaje y test.
  - [ ] Un error de IPC no rompe la UI ni deja estados colgados.

### [Task 1.7] Arnés de Pruebas y Verificación Continua

* **Esfuerzo:** `S` · **Depende de:** 1.1
* **Objetivo:** Que "terminado" sea verificable desde el primer día.
* **Archivos:** `vite.config.ts`, `tests/setup.ts`, `src-tauri/src/lib.rs` (tests), `package.json`.
* **Instrucciones:**
  1. Configurar Vitest + jsdom + Testing Library.
  2. Añadir un test de humo en frontend y otro en Rust.
  3. Implementar `pnpm verify` (typecheck, tests, `cargo test`, `cargo clippy -D warnings`).
  4. Documentar el comando en el README.
* **DoD:**
  - [ ] `pnpm verify` pasa en verde desde cero.
  - [ ] Un test fallido devuelve código de salida distinto de cero.
  - [ ] Tiempo de `pnpm verify` < 2 minutos en el equipo de referencia.

---

## 2. Fase 2: Shell de Interfaz, Viewport y Carga Real

### [Task 2.1] Shell UI de Tres Columnas con Pestañas

* **Esfuerzo:** `M` · **Depende de:** 1.5, 1.6
* **Objetivo:** Construir el layout definitivo del producto.
* **Archivos:** `src/App.tsx`, `src/components/layout/Header.tsx`, `Footer.tsx`, `SidebarLeft.tsx`, `SidebarRight.tsx`, `src/components/ui/`.
* **Instrucciones:**
  1. Maquetar header, tres columnas y footer según `01-product-spec.md` §4.
  2. Sidebar izquierdo con pestañas **Métricas / Texturas / Historial** accesibles por teclado (`role="tablist"`).
  3. Sidebar derecho reservado para modos, entorno y optimización.
  4. Estados visuales de foco, hover y deshabilitado; sin overflow a 1024×700.
* **DoD:**
  - [ ] El layout coincide con el diagrama y no rompe a la resolución mínima.
  - [ ] Las pestañas son navegables con teclado y anunciadas por lectores de pantalla.
  - [ ] Modo claro/oscuro no requerido; se usa el tema Studio oscuro.

### [Task 2.2] Canvas 3D, Cámara y Estado Vacío

* **Esfuerzo:** `M` · **Depende de:** 2.1
* **Objetivo:** Tener un viewport funcional incluso sin modelo.
* **Archivos:** `src/components/viewport/MeshViewport.tsx`, `SceneEnvironment.tsx`, `EmptyDropZone.tsx`, `CameraRig.tsx`.
* **Instrucciones:**
  1. Canvas R3F con cámara perspectiva 45°, `dpr={[1, 2]}` y `gl={{ antialias: true }}`.
  2. Luces de estudio (key, fill, rim) y `OrbitControls` con damping, zoom y paneo.
  3. `Grid` técnico y `GizmoHelper`/`GizmoViewport` no interactivo.
  4. Drop zone con instrucciones "Arrastra un .glb / .gltf" y botón "Abrir archivo".
  5. `onCreated` verifica WebGL2 y muestra un error claro si no está disponible.
* **DoD:**
  - [ ] La escena vacía renderiza a 60 fps.
  - [ ] Órbita, zoom y paneo funcionan; el gizmo no intercepta clics.
  - [ ] Sin WebGL2 se muestra un mensaje bloqueante y accionable.

### [Task 2.3] Carga Real de Archivos (Diálogo, Drag & Drop y Decoders)

* **Esfuerzo:** `L` · **Depende de:** 1.4, 2.2
* **Objetivo:** Abrir archivos locales de forma robusta en macOS y Windows.
* **Archivos:** `src/hooks/useFileDrop.ts`, `src/components/viewport/MeshModel.tsx`, `src/lib/ipc.ts`, `src/lib/errors.ts`.
* **Instrucciones:**
  1. Diálogo nativo con filtros `.glb`/`.gltf`; drag & drop con `getCurrentWebview().onDragDropEvent()`.
  2. Validar extensión y `.gltf` autocontenido antes de leer (ver `02` §7.2).
  3. Leer bytes con `read_mesh_file` y parsear con `GLTFLoader.parse()`.
  4. Registrar `DRACOLoader` (`/decoders/draco/`), `KTX2Loader` (`/decoders/basis/`) y `MeshoptDecoder`.
  5. Mostrar estados `loading`/`error`, registrar advertencias y limpiar el archivo anterior.
  6. Probar fixtures con Draco y KTX2.
* **DoD:**
  - [ ] Un GLB con Draco + KTX2 carga correctamente.
  - [ ] `.obj`, `.gltf` con recursos externos y archivo corrupto muestran el error tipado correcto.
  - [ ] Drag & drop funciona en macOS y Windows sin emitir eventos HTML5.
  - [ ] El archivo original no se modifica.

### [Task 2.4] Auto-Encuadre, Reinicio y Redimensionado

* **Esfuerzo:** `S` · **Depende de:** 2.3
* **Objetivo:** Que el modelo siempre quede visible y centrado al cargar.
* **Archivos:** `src/lib/frameScene.ts`, `src/components/viewport/CameraRig.tsx`.
* **Instrucciones:**
  1. Calcular `Box3.setFromObject(scene)` y el centro.
  2. Ajustar cámara y `controls.target` con margen del 50% según el FOV y el aspect ratio.
  3. Exponer `frame()` y `reset()`; doble clic reencuadra.
  4. Recalcular en `resize` sin alterar la orientación del usuario salvo que no haya interacción.
* **DoD:**
  - [ ] Cualquier modelo, desde 1 cm hasta 100 m, queda completamente visible.
  - [ ] `reset` vuelve a la vista inicial y `F` reencuadra.
  - [ ] Redimensionar la ventana mantiene el encuadre y el aspect ratio.

### [Task 2.5] Análisis de Escena y Panel de Métricas

* **Esfuerzo:** `M` · **Depende de:** 2.3
* **Objetivo:** Una única fuente de verdad para todas las métricas geométricas.
* **Archivos:** `src/lib/analyzeScene.ts`, `src/components/panels/MetricsPanel.tsx`.
* **Instrucciones:**
  1. Implementar `analyzeScene(scene)` según `01-product-spec.md` RF-3.1/3.2/3.4.
  2. Contar triángulos con índice o sin él, multiplicando por `InstancedMesh.count`.
  3. Deduplicar materiales por `uuid`; contar nodos `Object3D` sin el contenedor raíz.
  4. Calcular dimensiones, centro y VRAM de geometría (bytes de atributos + índices).
  5. Renderizar tarjetas de vértices, triángulos, sub-mallas, materiales, nodos, dimensiones y VRAM.
  6. Tests unitarios con escenas sintéticas (indexada, no indexada, instanciada, vacía).
* **DoD:**
  - [ ] Las métricas coinciden con el fixture de referencia (±1%).
  - [ ] Un `InstancedMesh` multiplica correctamente sus triángulos.
  - [ ] Una escena vacía no produce `NaN` ni división por cero.

### [Task 2.6] Panel de Texturas y VRAM

* **Esfuerzo:** `M` · **Depende de:** 2.5
* **Objetivo:** Cubrir el requisito de auditoría de texturas del producto.
* **Archivos:** `src/components/panels/TexturesPanel.tsx`, `src/lib/analyzeScene.ts`, `src/lib/format.ts`.
* **Instrucciones:**
  1. Recolectar mapas (`map`, `normalMap`, `roughnessMap`, `metalnessMap`, `emissiveMap`, `aoMap`, `alphaMap`) y deduplicar por `texture.uuid`.
  2. Obtener resolución desde `texture.source.data` o `mipmaps[0]`, formato desde el MIME/origen y `colorSpace`.
  3. Implementar la fórmula: `w × h × 4 × (mipmapped ? 4/3 : 1)`; para texturas comprimidas usar la suma de mipmaps disponible y marcar `compressed`.
  4. Mostrar tabla con nombre, resolución, formato, mips, VRAM y total; tooltip con la fórmula.
  5. Tests con texturas duplicadas y comprimidas simuladas.
* **DoD:**
  - [ ] Tres materiales que comparten textura cuentan como una sola.
  - [ ] El total es la suma exacta de las filas.
  - [ ] Las texturas KTX2 se marcan como comprimidas y no rompen el cálculo.

### [Task 2.7] Ciclo de Vida, Liberación de Memoria y Estados de Error

* **Esfuerzo:** `S` · **Depende de:** 2.3, 2.5
* **Objetivo:** Evitar fugas al abrir muchos modelos y dejar la UI resiliente.
* **Archivos:** `src/components/viewport/MeshModel.tsx`, `src/components/viewport/MeshViewport.tsx`, `src/store/useMeshStore.ts`.
* **Instrucciones:**
  1. Al desmontar o reemplazar: `dispose()` de geometrías, materiales y texturas; limpiar `THREE.Cache`.
  2. Cancelar cargas en curso si llega un archivo nuevo.
  3. Renderizar estados `loading`, `error` y `empty` sin parpadeos.
  4. Verificar que un error de parseo no deja el store inconsistente.
* **DoD:**
  - [ ] Cargar 10 archivos secuencialmente mantiene la memoria estable.
  - [ ] Un archivo nuevo cancela la carga anterior.
  - [ ] Tras un error se puede volver a cargar sin reiniciar la app.

---

## 3. Fase 3: Modos de Renderizado, Entornos y Estado

### [Task 3.1] Modos de Renderizado No Destructivos

* **Esfuerzo:** `M` · **Depende de:** 2.3
* **Objetivo:** Alternar Shaded, Wireframe, Normals y Unlit sin perder los materiales originales.
* **Archivos:** `src/lib/materialVariants.ts`, `src/components/viewport/MeshModel.tsx`, `src/components/panels/RenderModeSelector.tsx`.
* **Instrucciones:**
  1. Construir variantes por malla al cargar: `shaded` (original), `unlit` (`MeshBasicMaterial` con `map` y color), `wireframe` (material neutro con `wireframe: true`), `normals` (`MeshNormalMaterial` compartido).
  2. Cambiar la variante según `renderMode` sin mutar el material original.
  3. Gestionar correctamente mallas con `material` en array.
  4. Deshabilitar el selector mientras `engineStatus === 'processing'` solo si afecta al resultado.
* **DoD:**
  - [ ] Alternar 20 veces entre modos conserva exactamente el render Shaded original.
  - [ ] Unlit mantiene la textura difusa; Normals muestra el mapa de color.
  - [ ] No hay parpadeos ni fugas de materiales variantes al descargar el modelo.

### [Task 3.2] Entornos de Trabajo

* **Esfuerzo:** `S` · **Depende de:** 2.2
* **Objetivo:** Implementar Studio, Grid y Transparent.
* **Archivos:** `src/components/viewport/SceneEnvironment.tsx`, `src/components/panels/EnvironmentSelector.tsx`.
* **Instrucciones:**
  1. Studio: fondo oscuro con gradiente y luces de estudio (default).
  2. Grid: fondo neutro con grilla técnica y ejes.
  3. Transparent: `alpha: true` y fondo transparente, sin grid.
  4. Mantener la selección al cambiar de archivo.
* **DoD:**
  - [ ] Los tres entornos se alternan sin recargar el modelo.
  - [ ] Transparent produce alfa real (verificable en captura).
  - [ ] La iluminación no altera las métricas ni los materiales originales.

### [Task 3.3] Header y Footer con Estado Real

* **Esfuerzo:** `S` · **Depende de:** 2.5, 3.1
* **Objetivo:** Mostrar información operativa sin abrir paneles.
* **Archivos:** `src/components/layout/Header.tsx`, `Footer.tsx`, `src/hooks/useFps.ts`.
* **Instrucciones:**
  1. Header: nombre, estado del motor (`Listo`/`Ocupado`/`Error`), FPS (1 Hz), VRAM total estimada, botones Abrir/Exportar.
  2. Footer: ruta, tamaño, última advertencia y últimos logs (máx. 3).
  3. FPS desde `renderer.info`/`useFrame` sin provocar re-renders innecesarios.
  4. Todos los textos centralizados para i18n.
* **DoD:**
  - [ ] El FPS se actualiza una vez por segundo y no baja el rendimiento del viewport.
  - [ ] El estado del motor refleja inicio, progreso, fin y error.
  - [ ] El footer muestra la ruta completa y el tamaño en MB.

### [Task 3.4] Atajos de Teclado y Accesibilidad

* **Esfuerzo:** `S` · **Depende de:** 2.1, 3.1
* **Objetivo:** Cumplir NFR-6 sin sacrificar velocidad de uso.
* **Archivos:** `src/hooks/useKeyboardShortcuts.ts`, componentes de UI.
* **Instrucciones:**
  1. `1–4` modos, `F` reencuadrar, `O` abrir, `S` guardar, `Esc` cancelar.
  2. Ignorar atajos cuando el foco está en un input o dialog.
  3. Añadir `aria-label`, foco visible, contraste AA y respeto a `prefers-reduced-motion`.
* **DoD:**
  - [ ] Todo el flujo principal es operable solo con teclado.
  - [ ] Los atajos no se disparan al escribir en campos de texto.
  - [ ] Auditoría de contraste AA en los colores principales.

---

## 4. Fase 4: Motor de Optimización y Exportación

### [Task 4.1] Worker de Optimización y Pipeline gltf-transform

* **Esfuerzo:** `L` · **Depende de:** 1.3, 2.5
* **Objetivo:** Simplificar mallas preservando UVs, materiales y texturas.
* **Archivos:** `src/workers/optimize.worker.ts`, `src/lib/optimization/engine.ts`, `src/lib/optimization/pipeline.ts`, `src/types/generated/models.ts`.
* **Instrucciones:**
  1. Crear el worker con `WebIO`, extensiones (`ALL_EXTENSIONS`) y `MeshoptSimplifier.ready`.
  2. Implementar el pipeline: `dedup → prune → weld → simplify → prune`; limpieza opcional según `cleanMesh`.
  3. Calcular `ratio = 1 - reductionPercent / 100`; fijar `error = 0.005` y `lockBorder = params.lockBorders`.
  4. Transferir `ArrayBuffer` de entrada y salida; liberar el `Document` al terminar.
  5. Calcular `OptimizationOutcome` con triángulos, bytes, tiempo, motor y versión.
  6. Verificar que la salida es un GLB válido y que conserva texturas y materiales.
* **DoD:**
  - [ ] Un GLB de 1M de triángulos se simplifica al 50% sin perder texturas.
  - [ ] La salida se reabre en la app y en un visor externo (p. ej. gltf-viewer).
  - [ ] `0%` solo aplica limpieza y devuelve un GLB válido.
  - [ ] Test de integración con fixture multi-primitive y con Draco.

### [Task 4.2] Progreso, Cancelación y Guardas de Seguridad

* **Esfuerzo:** `M` · **Depende de:** 4.1
* **Objetivo:** Que el proceso sea observable, interrumpible y sin estados corruptos.
* **Archivos:** `src/lib/optimization/engine.ts`, `src/hooks/useOptimizer.ts`, `src/store/useMeshStore.ts`.
* **Instrucciones:**
  1. Emitir `progress` por etapa y reflejarlo en el store (0–100).
  2. Cancelar con `worker.terminate()`, descartar buffers y recrear el worker; respuesta en < 200 ms.
  3. Bloquear doble ejecución mientras `engineStatus === 'processing'`.
  4. Guardas: `reductionPercent` entero 0–80; resultado con < 4 triángulos → `TARGET_UNREACHABLE` con el mejor resultado; reducción real < solicitada → advertencia.
  5. Manejar excepciones no capturadas como `WORKER_CRASHED` y reiniciar.
* **DoD:**
  - [ ] Cancelar deja el motor en `idle` y sin workers vivos.
  - [ ] El progreso avanza de forma monótona y nunca supera 100.
  - [ ] Los objetivos imposibles se reportan con advertencia, no como error.
  - [ ] Doble clic en "Optimizar" no lanza dos jobs.

### [Task 4.3] Panel de Optimización y Comparativa

* **Esfuerzo:** `M` · **Depende de:** 4.2
* **Objetivo:** Conectar la UI con el motor y comunicar el impacto real.
* **Archivos:** `src/components/panels/OptimizationPanel.tsx`, `src/components/ui/`.
* **Instrucciones:**
  1. Slider 0–80 (paso 1, default 50) con valor numérico editable.
  2. Toggles de limpieza y `lockBorders`, con tooltips explicativos.
  3. Botón "Optimizar malla" con estados `idle`, `processing` (progreso + cancelar), `done`, `error`.
  4. Tarjetas comparativas: triángulos, bytes, reducción solicitada vs. real, tiempo.
  5. Mostrar advertencias y deshabilitar acciones sin archivo cargado.
* **DoD:**
  - [ ] La comparativa coincide exactamente con `OptimizationOutcome`.
  - [ ] El botón se deshabilita correctamente en cada estado.
  - [ ] Los tooltips y el slider son accesibles por teclado.

### [Task 4.4] Visualización del Resultado Optimizado

* **Esfuerzo:** `S` · **Depende de:** 4.1
* **Objetivo:** Comparar visualmente sin perder el original.
* **Archivos:** `src/components/viewport/MeshModel.tsx`, `src/store/useMeshStore.ts`, `src/components/panels/OptimizationPanel.tsx`.
* **Instrucciones:**
  1. Parsear los bytes optimizados en una segunda escena y conservar los originales.
  2. Toggle "Original / Optimizado" que intercambia la escena activa sin recargar el archivo.
  3. Mostrar métricas del resultado y permitir volver al original.
  4. Liberar la escena descartada cuando se genera un nuevo resultado.
* **DoD:**
  - [ ] El toggle es instantáneo y conserva cámara y modo de render.
  - [ ] Las texturas se ven correctamente en el resultado.
  - [ ] Volver al original restaura las métricas originales.

### [Task 4.5] Exportación GLB

* **Esfuerzo:** `M` · **Depende de:** 4.1, 1.4
* **Objetivo:** Guardar el resultado (u original) de forma segura.
* **Archivos:** `src/lib/ipc.ts`, `src/components/layout/Header.tsx`, `src/components/panels/OptimizationPanel.tsx`.
* **Instrucciones:**
  1. Diálogo `save` con nombre sugerido `<nombre>_optimized.glb` y directorio del input.
  2. Confirmar sobrescritura si el destino existe.
  3. Llamar `save_mesh_file` con cuerpo crudo y header percent-encoded.
  4. Ofrecer "Mostrar en carpeta" después de guardar.
  5. Permitir "Guardar original" sin optimizar.
* **DoD:**
  - [ ] El archivo guardado se reabre correctamente dentro y fuera de la app.
  - [ ] Cancelar el diálogo no escribe nada.
  - [ ] No se sobrescribe sin confirmación.
  - [ ] Funciona con rutas con acentos y espacios en ambos SO.

---

## 5. Fase 5: Persistencia, Historial y Trazabilidad

### [Task 5.1] Base de Datos SQLite Nativa y Migraciones

* **Esfuerzo:** `M` · **Depende de:** 1.1, 1.3
* **Objetivo:** Persistir auditorías de forma segura y versionada.
* **Archivos:** `src-tauri/src/db.rs`, `src-tauri/src/commands/db.rs`, `src-tauri/migrations/001_init.sql`, `src-tauri/src/lib.rs`.
* **Instrucciones:**
  1. Añadir `rusqlite` con `bundled`, `rusqlite_migration`, `uuid` y `chrono`.
  2. En `setup()`: crear `app_data_dir`, abrir conexión, aplicar `WAL`, `foreign_keys`, `busy_timeout` y migraciones.
  3. Guardar `Mutex<Connection>` en `AppState`; si falla, `dbAvailable = false`.
  4. Implementar `save_audit` (UUID + RFC3339 en Rust), `list_audits` (paginado, `limit ≤ 200`), `delete_audit` (idempotente) y `app_info`.
  5. Tests: esquema desde cero, migración idempotente, CRUD y DB corrupta.
* **DoD:**
  - [ ] Una instalación nueva crea el esquema y `PRAGMA user_version` correcto.
  - [ ] `save_audit` devuelve el registro con `id` y `createdAt`.
  - [ ] `list_audits` ordena por fecha descendente y pagina correctamente.
  - [ ] Una DB corrupta no impide arrancar (`dbAvailable = false`).

### [Task 5.2] Panel de Historial

* **Esfuerzo:** `M` · **Depende de:** 5.1, 2.1
* **Objetivo:** Hacer consultable y gestionable la auditoría.
* **Archivos:** `src/components/panels/HistoryPanel.tsx`, `src/lib/ipc.ts`, `src/store/useMeshStore.ts`.
* **Instrucciones:**
  1. Cargar la primera página al abrir la pestaña y al guardar una exportación.
  2. Lista con fecha, archivo, triángulos, reducción y ahorro; detalle al seleccionar.
  3. Paginación con total; estado vacío explicativo.
  4. Borrado con confirmación y actualización optimista.
* **DoD:**
  - [ ] 50 registros paginan correctamente sin duplicados.
  - [ ] Borrar actualiza la lista y el total.
  - [ ] El estado vacío y el de error de DB son claros.
  - [ ] La fecha se muestra en hora local, almacenada en UTC.

### [Task 5.3] Registro Automático de Auditoría

* **Esfuerzo:** `S` · **Depende de:** 4.5, 5.1
* **Objetivo:** Que cada exportación quede trazada sin bloquear al usuario.
* **Archivos:** `src/lib/ipc.ts`, `src/components/panels/OptimizationPanel.tsx`, `src/store/useMeshStore.ts`.
* **Instrucciones:**
  1. Tras un guardado exitoso, construir `NewAuditRecord` con los datos de `OptimizationOutcome` y las rutas.
  2. Llamar `save_audit` y refrescar el historial.
  3. Si falla (`DB_FAILED`), mostrar advertencia no bloqueante y permitir reintentar.
  4. No registrar exportaciones canceladas ni fallidas.
* **DoD:**
  - [ ] Cada exportación produce exactamente un registro.
  - [ ] Un fallo de DB no impide guardar el GLB.
  - [ ] Los campos coinciden con la comparativa mostrada.

### [Task 5.4] Reabrir y Revelar desde el Historial

* **Esfuerzo:** `S` · **Depende de:** 5.2
* **Objetivo:** Convertir el historial en una herramienta de trabajo real.
* **Archivos:** `src/components/panels/HistoryPanel.tsx`, `src/lib/ipc.ts`.
* **Instrucciones:**
  1. Acción "Revelar en carpeta" si `outputPath` existe.
  2. Acción "Cargar resultado" que lee el GLB y lo abre en el viewport.
  3. Manejar archivos movidos o eliminados con advertencia clara.
* **DoD:**
  - [ ] Revelar y cargar funcionan con rutas existentes.
  - [ ] Un archivo ausente muestra un error accionable sin romper la UI.
  - [ ] Cargar desde historial actualiza todas las métricas.

---

## 6. Fase 6: Endurecimiento, Rendimiento y Distribución

### [Task 6.1] Suite de Pruebas y Cobertura

* **Esfuerzo:** `M` · **Depende de:** todas las fases funcionales
* **Objetivo:** Proteger la lógica crítica antes del release.
* **Archivos:** `tests/fixtures/`, `tests/`, `src-tauri/src/**`.
* **Instrucciones:**
  1. Crear fixtures: GLB simple, multi-primitive, Draco, KTX2, corrupto, `.gltf` externo, `.obj`, GLB grande generado por script.
  2. Cubrir `analyzeScene`, pipeline de optimización (mock de worker), validaciones, DB y formato.
  3. Añadir un test de regresión para la preservación de texturas tras simplificar.
  4. Alcanzar ≥ 70% en lógica pura.
* **DoD:**
  - [ ] `pnpm verify` verde con todos los fixtures.
  - [ ] La cobertura reportada cumple el objetivo.
  - [ ] El fixture grande se genera bajo demanda y no se versiona.

### [Task 6.2] Presupuesto de Rendimiento y Perfilado

* **Esfuerzo:** `M` · **Depende de:** 4.1, 6.1
* **Objetivo:** Verificar y ajustar los NFR de rendimiento.
* **Archivos:** `tests/perf/`, `README.md`.
* **Instrucciones:**
  1. Medir apertura de 50 MB, simplificación de 1M de triángulos y FPS con 500k.
  2. Perfilar memoria en cargas repetidas y en optimización.
  3. Ajustar `dpr`, memoización y liberación de recursos según resultados.
  4. Documentar el hardware de referencia y los números obtenidos.
* **DoD:**
  - [ ] Se cumplen NFR-2 y NFR-8 en el hardware de referencia.
  - [ ] No hay crecimiento de memoria tras 10 ciclos de carga/optimización.
  - [ ] Resultados documentados en el README.

### [Task 6.3] Empaquetado y Firma

* **Esfuerzo:** `M` · **Depende de:** 6.2
* **Objetivo:** Producir instaladores distribuibles.
* **Archivos:** `src-tauri/tauri.conf.json`, `src-tauri/icons/`, `README.md`.
* **Instrucciones:**
  1. Configurar `identifier`, iconos y metadatos de la app.
  2. Compilar `.dmg` (macOS) y `.msi`/NSIS (Windows).
  3. Configurar firma y notarización en macOS; firma de código en Windows.
  4. Documentar variables de entorno y pasos de release.
* **DoD:**
  - [ ] Instaladores generados en macOS y Windows.
  - [ ] La app firmada/notarizada abre sin advertencias del sistema.
  - [ ] El instalador pesa ≤ 40 MB.

### [Task 6.4] QA Multiplataforma y Regresión

* **Esfuerzo:** `M` · **Depende de:** 6.3
* **Objetivo:** Validar el producto en la matriz soportada.
* **Archivos:** checklist de QA en `specs/` o `docs/`.
* **Instrucciones:**
  1. Probar en macOS 12+ Intel/ARM y Windows 10/11 x64/ARM.
  2. Ejecutar el checklist de aceptación del MVP (`01-product-spec.md` §7).
  3. Verificar drag & drop, rutas con acentos, guardado y notarización.
  4. Registrar excepciones conocidas con su justificación.
* **DoD:**
  - [ ] Checklist al 100% o con excepciones documentadas y aprobadas.
  - [ ] No hay bloqueos ni crashes en el flujo principal.
  - [ ] Rendimiento dentro de los márgenes en ambos SO.

### [Task 6.5] Documentación y Cierre

* **Esfuerzo:** `S` · **Depende de:** 6.4
* **Objetivo:** Dejar el proyecto mantenible.
* **Archivos:** `README.md`, `docs/`, `specs/04-decisions.md`.
* **Instrucciones:**
  1. README con requisitos, instalación, comandos, build y troubleshooting.
  2. Guía de usuario breve (abrir, inspeccionar, optimizar, exportar, historial).
  3. Índice de ADRs y guía para añadir un motor nativo futuro (sidecar) sin tocar la UI.
* **DoD:**
  - [ ] Un desarrollador nuevo compila y ejecuta siguiendo solo el README.
  - [ ] La guía cubre el flujo completo con capturas.
  - [ ] ADRs actualizados con cualquier decisión tomada durante la implementación.

---

## 7. Matriz de Trazabilidad Requisito → Tarea

| Requisito | Tareas |
| :--- | :--- |
| RF-1.1 Importación GLB/GLTF | 2.3, 1.4 |
| RF-1.2 Acceso local | 1.4, 2.3 |
| RF-1.3 Validación y errores | 1.3, 1.6, 2.3, 2.7 |
| RF-1.4 Exportación | 1.4, 4.5, 5.3 |
| RF-2.1 Cámara | 2.2, 2.4 |
| RF-2.2 Modos de renderizado | 3.1 |
| RF-2.3 Entornos | 3.2 |
| RF-2.4 Decoders locales | 2.3, 1.1 |
| RF-2.5 Rendimiento del viewport | 2.7, 6.2 |
| RF-3.1 Geometría | 2.5 |
| RF-3.2 Dimensiones | 2.4, 2.5 |
| RF-3.3 Texturas y VRAM | 2.6 |
| RF-3.4 VRAM de geometría | 2.5 |
| RF-3.5 Reporte de importación | 2.3, 2.7, 3.3 |
| RF-4.1 Simplificación | 4.1 |
| RF-4.2 Limpieza de malla | 4.1 |
| RF-4.3 Comparativa | 4.3 |
| RF-4.4 Progreso y cancelación | 4.2 |
| RF-4.5 Integridad del resultado | 4.1, 6.1 |
| RF-4.6 No destructivo | 4.4, 4.5 |
| RF-4.7 Semántica de reducción | 4.2, 4.3 |
| RF-5.1 Registro local | 5.1, 5.3 |
| RF-5.2 Consulta y borrado | 5.2 |
| RF-5.3 Resiliencia de persistencia | 5.1, 5.3 |
| RF-5.4 Privacidad local | 1.2, 5.1 |
| NFR-1 Offline total | 1.1, 2.3 |
| NFR-2 Rendimiento | 6.2 |
| NFR-3 Compatibilidad | 1.1, 1.2, 6.3, 6.4 |
| NFR-4 Resiliencia | 1.3, 1.6, 5.3 |
| NFR-5 Seguridad | 1.2 |
| NFR-6 Accesibilidad | 3.4 |
| NFR-7 Localización | 2.1, 3.3 |
| NFR-8 Huella | 6.2, 6.3 |

---

## 8. Hitos

| Hito | Contenido | Criterio de salida |
| :--- | :--- | :--- |
| **M0 — Specs congeladas** | Fase 0 + ADRs | Sin contradicciones ni requisitos huérfanos |
| **M1 — Inspección** | Fases 1–2 | Abrir GLB, ver viewport y métricas completas |
| **M2 — Análisis visual** | Fase 3 | 4 modos, 3 entornos, header/footer operativos |
| **M3 — Optimización** | Fase 4 | Simplificar, comparar, ver resultado y guardar |
| **M4 — Trazabilidad** | Fase 5 | Historial persistente y exportaciones auditadas |
| **M5 — Release** | Fase 6 | Instaladores firmados y QA multiplataforma |

---

## 9. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| La simplificación WASM no alcanza la reducción pedida en mallas muy densas | Alto | Reportar reducción real, tests con 1M de triángulos y ajuste de `error` en Fase 4 |
| Consumo de memoria en archivos > 300 MB | Alto | Advertencia, límite de 1 GB, transferencias zero-copy y liberación estricta |
| DRACO/KTX2 no inicializan en algún WebView | Medio | Fixtures por SO y error `DECODER_UNAVAILABLE` desde Fase 2 |
| Incompatibilidad React 19 ↔ R3F 9 ↔ Tailwind 4 | Medio | Smoke test en 1.1 y versiones pineadas |
| Firma/notarización macOS bloquea el release | Medio | Preparar cuentas y certificados desde Fase 5 |
| gltf-transform altera escenas multi-primitive | Alto | Fixture multi-primitive y verificación de estructura/materiales en 4.1 |
| El cuerpo crudo de `save_mesh_file` falla en alguna versión de Tauri | Bajo | Plan B documentado con `tauri-plugin-fs` y scope del diálogo |
