# 02-architecture-spec.md — MeshCraft Studio

## 1. Stack Tecnológico

| Capa | Tecnología / Librería | Propósito |
| :--- | :--- | :--- |
| **Frontend UI** | React 19.3 + TypeScript 6.0 + Vite 8.3 | Interfaz declarativa y tipada |
| **Estilos & Componentes** | Tailwind CSS 4.3 (`@tailwindcss/vite`) + Lucide Icons + `clsx` / `tailwind-merge` | Estilizado modular y sistema de iconos |
| **Estado Global** | Zustand 5.0 | Estado ligero y reactivo |
| **Graphics Engine** | Three.js 0.186 + `@react-three/fiber` 9.8 + `@react-three/drei` 10.7 | Renderizado 3D WebGL y visualización |
| **Optimización** | `@gltf-transform/core` 4.5 + `@gltf-transform/functions` 4.5 + `meshoptimizer` 1.3 (WASM) | Simplificación con preservación de atributos |
| **Desktop Core** | Tauri 2.12 (Rust 1.99, edición 2024) | Runtime nativo macOS/Windows, acceso a archivos y SQLite |
| **Persistencia Local** | `rusqlite` (feature `bundled`) + `rusqlite_migration` | SQLite embebido, sin dependencia del sistema |
| **Contratos** | `ts-rs` 10.x (dev-dependency) | Generación de tipos TypeScript desde Rust |
| **Utilidades Rust** | `serde`, `thiserror`, `uuid` v4, `chrono`, `tempfile`, `percent-encoding` | Serialización, errores, IDs, escritura atómica y rutas en headers |
| **Pruebas** | Vitest (fijado en Task 1.7) + Testing Library / `cargo test` | Pruebas unitarias de frontend y backend |
| **Gestor de paquetes** | pnpm 12.x | Instalación reproducible con lockfile |

> **Política de versiones:** las versiones exactas se fijan en `package.json`, `pnpm-lock.yaml` y `Cargo.toml` en la Tarea 1.1, verificando la matriz de compatibilidad (React 19 ↔ R3F 9, Tailwind 4 CSS-first). No se usa CDN ni fuente remota: todo se empaqueta.

---

## 2. Arquitectura de Procesos

La aplicación tiene **dos procesos lógicos** y ningún sidecar externo:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React + WebGL + Web Worker)                                      │
│                                                                            │
│  Main thread                          Worker (optimize.worker.ts)          │
│  ┌──────────────────────────┐         ┌──────────────────────────────┐     │
│  │ Three.js / R3F viewport  │         │ gltf-transform + meshoptimizer│     │
│  │ analyzeScene (métricas)  │ ◄─────► │ dedup → prune → weld →        │     │
│  │ Zustand store / UI       │ mensajes│ simplify → prune → write      │     │
│  └────────────┬─────────────┘         └──────────────────────────────┘     │
└───────────────┼────────────────────────────────────────────────────────────┘
                │ Tauri IPC (comandos tipados)
                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ TAURI CORE (Rust)                                                          │
│  - read_mesh_file / save_mesh_file (validación + escritura atómica)        │
│  - SQLite en app_data_dir (migraciones, auditoría)                         │
│  - Resolución de rutas multiplataforma (PathBuf)                           │
└────────────────────────────────────────────────────────────────────────────┘
```

**Flujo de datos:**

1. El usuario elige o arrastra un archivo → `read_mesh_file(path)` → Rust valida y devuelve bytes crudos.
2. El hilo principal parsea con `GLTFLoader.parse()` (decoders registrados) → escena Three.js → `analyzeScene()` → store.
3. Al optimizar, se copia el `ArrayBuffer` original al Worker (transferible) → pipeline gltf-transform → `done` con bytes de salida y métricas.
4. "Ver resultado" parsea la salida en una segunda escena; el original se conserva para revertir.
5. "Guardar" abre el diálogo nativo → `save_mesh_file` escribe atómicamente → `save_audit` persiste el registro.

---

## 3. Contratos de Datos e Interfaces

Los tipos de dominio se definen en Rust (`src-tauri/src/models.rs`) y se **generan** hacia `src/types/generated/models.ts` con `ts-rs`. El archivo generado se versiona y **no se edita a mano**. Los tipos exclusivos de UI viven en `src/types/viewer.ts`.

### 3.1 Modelos de dominio (TS generado)

```typescript
// src/types/generated/models.ts — GENERADO por ts-rs. No editar.
export interface Vec3 { x: number; y: number; z: number; }

export interface Dimensions3D { width: number; height: number; depth: number; }

export interface TextureInfo {
  name: string;
  width: number;
  height: number;
  format: string;                 // "png" | "jpeg" | "webp" | "ktx2" | "unknown"
  colorSpace: 'srgb' | 'linear' | 'unknown';
  mipmapped: boolean;
  compressed: boolean;
  estimatedVramMb: number;
}

export interface MeshStats {
  fileName: string;
  fileSizeBytes: number;
  vertexCount: number;            // vértices de buffer (no únicos)
  triangleCount: number;          // triángulos post-triangulación, × instancias
  submeshCount: number;
  materialCount: number;          // materiales únicos
  nodeCount: number;              // Object3D de la escena, sin el contenedor raíz
  dimensions: Dimensions3D;
  center: Vec3;
  geometryVramMb: number;
  textures: TextureInfo[];
  totalTextureVramMb: number;
  warnings: string[];
}

export interface OptimizationParams {
  reductionPercent: number;       // entero 0–80 (% de triángulos a eliminar)
  cleanMesh: boolean;             // dedup + prune + weld + degenerados
  lockBorders: boolean;           // no colapsar bordes topológicos (default true)
}

export interface OptimizationOutcome {
  originalTriangles: number;
  optimizedTriangles: number;
  requestedReductionPercent: number;
  achievedReductionPercent: number;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  elapsedMs: number;
  engine: string;                 // "gltf-transform+meshoptimizer"
  engineVersion: string;
  warnings: string[];
}

export interface NewAuditRecord {
  fileName: string;
  inputPath: string;
  outputPath: string | null;
  originalTriangles: number;
  optimizedTriangles: number;
  reductionPercent: number;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  processingMs: number;
  engine: string;
  engineVersion: string;
}

export interface AuditRecord extends NewAuditRecord {
  id: string;                     // UUID v4 generado en Rust
  createdAt: string;              // RFC3339 UTC
}

export interface AuditPage {
  items: AuditRecord[];
  total: number;
}

export interface AppInfo {
  appVersion: string;
  dbPath: string;
  dbAvailable: boolean;
}

export type AppErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'MISSING_EXTERNAL_RESOURCES'
  | 'FILE_TOO_LARGE'
  | 'READ_FAILED'
  | 'PARSE_FAILED'
  | 'EMPTY_SCENE'
  | 'DECODER_UNAVAILABLE'
  | 'OPTIMIZATION_FAILED'
  | 'TARGET_UNREACHABLE'
  | 'WORKER_CRASHED'
  | 'CANCELLED'
  | 'SAVE_FAILED'
  | 'DB_FAILED';

export interface AppError {
  code: AppErrorCode;
  message: string;                // mensaje accionable en español
  details?: string;
}
```

**Equivalencia Rust ↔ TS:** cada `struct` de `models.rs` deriva `serde::Serialize`, `serde::Deserialize` y `ts_rs::TS`, con `#[serde(rename_all = "camelCase")]` para que el JSON de Tauri coincida con el tipo generado. Los enums usan `#[serde(rename_all = "SCREAMING_SNAKE_CASE")]`.

### 3.2 Tipos exclusivos de UI

```typescript
// src/types/viewer.ts
export type RenderMode = 'shaded' | 'wireframe' | 'normals' | 'unlit';
export type EnvironmentMode = 'studio' | 'grid' | 'transparent';
export type SidebarTab = 'metrics' | 'textures' | 'history';
export type EngineStatus = 'idle' | 'processing' | 'error';

export interface CurrentFile {
  path: string;
  fileName: string;
  sizeBytes: number;
}

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  at: number;                     // epoch ms
}
```

### 3.3 Protocolo del Web Worker

La optimización no usa IPC de Tauri: es un protocolo de mensajes entre el hilo principal y `optimize.worker.ts`. Los `ArrayBuffer` se transfieren (zero-copy).

```typescript
export type OptimizationStage = 'read' | 'weld' | 'simplify' | 'prune' | 'write';

export type OptimizeRequest = {
  type: 'optimize';
  jobId: string;
  input: ArrayBuffer;
  params: OptimizationParams;
};

export type OptimizeResponse =
  | { type: 'progress'; jobId: string; stage: OptimizationStage; progress: number } // 0–100
  | { type: 'done'; jobId: string; output: ArrayBuffer; outcome: OptimizationOutcome }
  | { type: 'error'; jobId: string; error: AppError }
  | { type: 'cancelled'; jobId: string };
```

**Pipeline del Worker:**

```text
WebIO.readBinary(input)
  → [si cleanMesh] dedup() → prune() → weld() → eliminar primitivas degeneradas
  → [si reductionPercent > 0] simplify({ ratio = 1 - reductionPercent/100,
                                           error = 0.005,
                                           lockBorder = params.lockBorders })
  → prune()
  → WebIO.writeBinary(document)
```

* `meshoptimizer` debe inicializarse con `await MeshoptSimplifier.ready` antes del primer job.
* La extensión `EXT_meshopt_compression` se soporta de forma nativa; `KHR_texture_basisu` se trata como dato opaco (pasa sin recompresión); `KHR_draco_mesh_compression` requiere `draco3d` registrado en el `WebIO`.
* **Cancelación:** las operaciones de gltf-transform no son interrumpibles; se termina el worker (`worker.terminate()`), se descarta el job y se crea uno nuevo. La cancelación debe reflejarse en < 200 ms.
* **Objetivo inalcanzable:** si tras simplificar la reducción real es menor que la solicitada, o el resultado tendría < 4 triángulos, se devuelve el mejor resultado válido con `TARGET_UNREACHABLE` en `warnings` (no como error).
* **Memoria:** el worker libera el `Document` al terminar; el hilo principal libera la escena al descargar un modelo.

---

## 4. Protocolo IPC y Comandos de Tauri

### 4.1 Comandos Rust expuestos al frontend

| Comando | Entrada | Salida | Notas |
| :--- | :--- | :--- | :--- |
| `read_mesh_file` | `path: String` | `Response` (bytes crudos) | Valida extensión, tamaño y existencia |
| `save_mesh_file` | `Request` crudo + header `x-output-path` | `()` | Escritura atómica; solo `.glb` |
| `save_audit` | `NewAuditRecord` | `AuditRecord` | Genera `id` y `createdAt` en Rust |
| `list_audits` | `limit: u32, offset: u32` | `AuditPage` | `createdAt DESC`; `limit` ≤ 200 |
| `delete_audit` | `id: String` | `()` | Idempotente (no falla si no existe) |
| `app_info` | — | `AppInfo` | Versión, ruta de DB y disponibilidad |

```rust
// src-tauri/src/commands/fs.rs
#[tauri::command]
async fn read_mesh_file(path: String) -> Result<tauri::ipc::Response, AppError>;

// El cuerpo es binario crudo; la ruta viaja percent-encoded en el header.
#[tauri::command]
async fn save_mesh_file(request: tauri::ipc::Request<'_>) -> Result<(), AppError>;

// src-tauri/src/commands/db.rs
#[tauri::command]
async fn save_audit(record: NewAuditRecord) -> Result<AuditRecord, AppError>;

#[tauri::command]
async fn list_audits(limit: u32, offset: u32) -> Result<AuditPage, AppError>;

#[tauri::command]
async fn delete_audit(id: String) -> Result<(), AppError>;

#[tauri::command]
async fn app_info(state: tauri::State<'_, AppState>) -> AppInfo;
```

**Lectura de bytes.** El comando devuelve `tauri::ipc::Response::new(bytes)` para evitar serializar un `Vec<u8>` como array JSON.

**Escritura de bytes.** Enviar cientos de MB como array JSON es inviable, por lo que se usa el mismo mecanismo que `tauri-plugin-fs`: cuerpo crudo + header con la ruta.

```typescript
// src/lib/ipc.ts
const headerPath = encodeURIComponent(outputPath);
await invoke('save_mesh_file', new Uint8Array(glbBytes), {
  headers: { 'x-output-path': headerPath },
});
```

```rust
let path = request
    .headers()
    .get("x-output-path")
    .and_then(|v| v.to_str().ok())
    .map(|v| percent_encoding::percent_decode_str(v).decode_utf8())
    .transpose()
    .map_err(|_| AppError::save_failed("Ruta no válida"))?
    .ok_or(AppError::save_failed("Ruta de destino ausente"))?;

// Igual que tauri-plugin-fs: aceptar cuerpo crudo y, como fallback, array JSON.
let bytes: Cow<'_, [u8]> = match request.body() {
    tauri::ipc::InvokeBody::Raw(data) => Cow::Borrowed(data),
    tauri::ipc::InvokeBody::Json(serde_json::Value::Array(data)) => Cow::Owned(
        data.iter()
            .map(|v| v.as_u64().and_then(|n| u8::try_from(n).ok()))
            .collect::<Option<Vec<u8>>>()
            .ok_or(AppError::save_failed("Bytes no válidos"))?,
    ),
    _ => return Err(AppError::save_failed("Se esperaban bytes binarios")),
};
```

El comando es `async` y recibe `tauri::ipc::Request<'_>` (el mismo patrón que usa `tauri-plugin-fs` en su comando `write_file`, verificado contra la implementación oficial). La escritura usa `tempfile::NamedTempFile` en el mismo directorio + `persist(path)`, garantizando atomicidad y evitando archivos parciales. En Windows se elimina el destino previo solo tras confirmación explícita del usuario.

> **Contingencia documentada:** si el paso de cuerpo crudo resultara problemático en alguna versión de Tauri, el plan B es `tauri-plugin-fs` con un scope concedido por el diálogo nativo. No se adopta por defecto para no ampliar permisos.

### 4.2 Capacidades y permisos

`src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Permisos mínimos de MeshCraft Studio",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "opener:allow-reveal-item-in-dir"
  ]
}
```

No se instalan `tauri-plugin-fs` ni `tauri-plugin-shell`. El acceso a disco ocurre exclusivamente a través de los comandos propios, que validan ruta y extensión.

### 4.3 Content Security Policy

```json
"security": {
  "csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src ipc: http://ipc.localhost; worker-src 'self' blob:; font-src 'self'"
}
```

`'wasm-unsafe-eval'` es necesario para `meshoptimizer` y los decoders. No se permite ningún origen remoto: esto materializa el requisito *offline-first*.

---

## 5. Persistencia (SQLite)

**Ubicación:** `app.path().app_data_dir()/meshcraft.db` (creado con `create_dir_all` al arrancar).

**Inicialización:** en `setup()`, abrir conexión, aplicar `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000` y ejecutar migraciones con `rusqlite_migration`. La conexión se guarda en `AppState` como `Mutex<Connection>`.

```sql
-- src-tauri/migrations/001_init.sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id                  TEXT PRIMARY KEY NOT NULL,
    created_at          TEXT NOT NULL,              -- RFC3339 UTC
    file_name           TEXT NOT NULL,
    input_path          TEXT NOT NULL,
    output_path         TEXT,
    original_triangles  INTEGER NOT NULL CHECK (original_triangles >= 0),
    optimized_triangles INTEGER NOT NULL CHECK (optimized_triangles >= 0),
    reduction_percent   REAL NOT NULL,
    original_bytes      INTEGER NOT NULL,
    optimized_bytes     INTEGER NOT NULL,
    saved_bytes         INTEGER NOT NULL,
    processing_ms       INTEGER NOT NULL,
    engine              TEXT NOT NULL,
    engine_version      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC);
```

**Mapeo de columnas:** `camelCase` en TS ↔ `snake_case` en SQL, resuelto explícitamente en `db.rs` (sin `serde` mágico sobre filas).

**Resiliencia:** si la apertura o la migración fallan, la app arranca con `dbAvailable = false`; las operaciones de inspección y optimización siguen funcionando y `save_audit` devuelve `DB_FAILED` para que la UI advierta sin bloquear la exportación.

---

## 6. Estructura de Directorios

```text
MeshCraft/
├── specs/
│   ├── 01-product-spec.md
│   ├── 02-architecture-spec.md
│   ├── 03-task-roadmap.md
│   └── 04-decisions.md
├── public/
│   └── decoders/                  # Copiados en postinstall, nunca descargados
│       ├── draco/
│       ├── basis/
│       └── meshopt/
├── scripts/
│   └── copy-decoders.mjs
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── SidebarLeft.tsx
│   │   │   └── SidebarRight.tsx
│   │   ├── viewport/
│   │   │   ├── MeshViewport.tsx
│   │   │   ├── MeshModel.tsx
│   │   │   ├── SceneEnvironment.tsx
│   │   │   ├── CameraRig.tsx
│   │   │   └── EmptyDropZone.tsx
│   │   ├── panels/
│   │   │   ├── MetricsPanel.tsx
│   │   │   ├── TexturesPanel.tsx
│   │   │   ├── HistoryPanel.tsx
│   │   │   ├── RenderModeSelector.tsx
│   │   │   ├── EnvironmentSelector.tsx
│   │   │   └── OptimizationPanel.tsx
│   │   └── ui/                    # Botones, tabs, toasts, tooltips
│   ├── hooks/
│   │   ├── useFileDrop.ts
│   │   ├── useFps.ts
│   │   └── useOptimizer.ts
│   ├── lib/
│   │   ├── ipc.ts                 # Wrappers tipados de invoke
│   │   ├── errors.ts              # Normalización de AppError
│   │   ├── format.ts              # Bytes, porcentajes, resoluciones
│   │   ├── analyzeScene.ts        # Única fuente de métricas
│   │   ├── frameScene.ts          # Center focus y reset
│   │   ├── materialVariants.ts    # Modos de render no destructivos
│   │   └── optimization/
│   │       ├── engine.ts          # Ciclo de vida del worker
│   │       └── pipeline.ts        # Pipeline gltf-transform
│   ├── store/
│   │   └── useMeshStore.ts
│   ├── types/
│   │   ├── generated/models.ts    # Generado por ts-rs
│   │   ├── viewer.ts
│   │   └── index.ts
│   ├── workers/
│   │   └── optimize.worker.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/
│   ├── capabilities/default.json
│   ├── icons/
│   ├── migrations/001_init.sql
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs                 # Builder, plugins, state, comandos
│   │   ├── models.rs              # Structs + derive TS
│   │   ├── error.rs               # AppError + serialización
│   │   ├── db.rs                  # Conexión, migraciones, CRUD
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── fs.rs
│   │       └── db.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tests/                         # Pruebas Vitest y fixtures
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 7. Estrategia de Archivos, Drag & Drop y Memoria

### 7.1 Apertura

1. **Diálogo nativo:** `@tauri-apps/plugin-dialog` `open({ multiple: false, filters: [{ name: 'glTF', extensions: ['glb', 'gltf'] }] })`.
2. **Drag & Drop:** `getCurrentWebview().onDragDropEvent()`. Con `dragDropEnabled: true` (por defecto), el WebView **no** emite eventos HTML5 de drop; la drop zone se ilumina con `payload.type === 'over'` y procesa `payload.type === 'drop'` con `payload.paths[0]`.
3. Rust valida y devuelve bytes; el frontend **no** usa `convertFileSrc` ni `assetProtocol`.

### 7.2 Validación previa

* Extensión en `{glb, gltf}` (comparación case-insensitive).
* Tamaño: advertencia ≥ 300 MB, bloqueo ≥ 1 GB (`FILE_TOO_LARGE`).
* `.gltf`: parsear el JSON y verificar que todos los `buffers[].uri` e `images[].uri` sean `data:`; si no, `MISSING_EXTERNAL_RESOURCES`.
* Parseo con `GLTFLoader.parse(buffer, '', onLoad, onError)`; nunca `useLoader` con una ruta absoluta.
* Escena sin geometría → `EMPTY_SCENE`.

### 7.3 Memoria y ciclo de vida

* Un archivo puede existir simultáneamente como bytes originales, escena Three.js, `Document` de gltf-transform (worker) y bytes de salida. Con archivos grandes esto puede superar 3–4× el tamaño del archivo: de ahí el umbral de advertencia.
* `ArrayBuffer` se transfiere al worker para evitar copias; el hilo principal conserva una copia solo si necesita revertir.
* Al reemplazar o descargar un modelo: `geometry.dispose()`, `material.dispose()`, `texture.dispose()`, y limpiar `THREE.Cache`.
* Al cancelar: `worker.terminate()`, descartar buffers y recrear el worker.

### 7.4 Escritura

* Diálogo `save({ defaultPath: <inputDir>/<name>_optimized.glb, filters: [glb] })`.
* Validación de extensión `.glb`; confirmación explícita si el archivo existe.
* Escritura atómica en Rust; tras guardar se ofrece "Mostrar en carpeta" (`revealItemInDir`).

---

## 8. Decoders Locales y Offline

`scripts/copy-decoders.mjs` (ejecutado en `postinstall` y antes de `build`) copia desde `node_modules`:

| Decoder | Origen | Destino | Uso |
| :--- | :--- | :--- | :--- |
| DRACO | `three/examples/jsm/libs/draco/` | `public/decoders/draco/` | `DRACOLoader.setDecoderPath('/decoders/draco/')` |
| Basis/KTX2 | `three/examples/jsm/libs/basis/` | `public/decoders/basis/` | `KTX2Loader.setTranscoderPath('/decoders/basis/')` |
| Meshopt | `meshoptimizer` (WASM) | `public/decoders/meshopt/` | `MeshoptDecoder` (viewer) / `meshoptimizer` (worker) |
| Draco (worker) | `draco3d` | bundle del worker | Lectura de GLB con Draco en gltf-transform |

`KTX2Loader.detectSupport(renderer)` debe ejecutarse una vez tras crear el renderer. Si un decoder no inicializa, el error es `DECODER_UNAVAILABLE` y el modelo no se carga (nunca se muestra una escena incompleta silenciosamente).

---

## 9. Taxonomía de Errores

| Código | Causa | Mensaje / UX | Recuperable |
| :--- | :--- | :--- | :--- |
| `UNSUPPORTED_FORMAT` | `.obj`, `.fbx`, otro | "Formato no soportado en el MVP. Usa .glb o un .gltf autocontenido." | Sí, elegir otro |
| `MISSING_EXTERNAL_RESOURCES` | `.gltf` con `.bin`/texturas externas | "Este .gltf referencia archivos externos. Expórtalo como .glb." | Sí |
| `FILE_TOO_LARGE` | ≥ 1 GB | "El archivo supera el límite de 1 GB del MVP." | Sí |
| `READ_FAILED` | Permisos, archivo movido | "No se pudo leer el archivo: <detalle>." | Sí |
| `PARSE_FAILED` | GLB corrupto | "El archivo no es un glTF válido." | Sí |
| `EMPTY_SCENE` | Sin geometría | "El archivo no contiene ninguna malla." | Sí |
| `DECODER_UNAVAILABLE` | Draco/KTX2/Meshopt | "Falta el decoder necesario para este archivo." | No en la sesión |
| `OPTIMIZATION_FAILED` | Error del pipeline | "La optimización falló. Se conserva el original." | Sí |
| `TARGET_UNREACHABLE` | Reducción no alcanzable | Advertencia con la reducción real | — (no es error) |
| `WORKER_CRASHED` | Excepción no capturada | "El motor de optimización se reinició." | Automático |
| `CANCELLED` | Acción del usuario | "Optimización cancelada." | — |
| `SAVE_FAILED` | Disco lleno, permisos | "No se pudo guardar el archivo." | Sí |
| `DB_FAILED` | SQLite no disponible | Advertencia en footer; el flujo continúa | Sí, reintentar |

Las advertencias (`warnings: string[]`) son siempre no bloqueantes y se muestran en el footer y en el reporte de importación.

---

## 10. Seguridad y Privacidad

* **Permisos mínimos:** solo `core`, `dialog` y `opener`; sin shell, sin filesystem genérico, sin HTTP.
* **Validación en Rust:** canonicalizar la ruta, rechazar directorios, extensión whitelist, límite de tamaño antes de leer.
* **Escritura atómica** y sin rutas temporales fuera del directorio destino.
* **CSP estricta** y sin orígenes remotos.
* **Cero red:** no hay telemetría, analítica, actualizaciones automáticas ni carga de fuentes/decoders desde internet.
* **Datos locales:** la base de datos vive en el directorio de datos de la app y contiene únicamente rutas y métricas, nunca el contenido de los modelos.

---

## 11. Estrategia de Pruebas

| Nivel | Herramienta | Alcance |
| :--- | :--- | :--- |
| Unitario frontend | Vitest | `analyzeScene`, `format`, `materialVariants`, store, protocolo del worker (mock) |
| Unitario backend | `cargo test` | Migraciones, CRUD de auditoría, validación de rutas, escritura atómica |
| Integración manual | Checklist | Flujo completo en macOS (Intel/ARM) y Windows 10/11 (x64/ARM) |
| Fixtures | `tests/fixtures/` | GLB simple, GLB multi-primitive, GLB con Draco, GLB con KTX2, GLB corrupto, `.gltf` externo, `.obj` |

**Cobertura objetivo:** ≥ 70% en lógica pura (análisis, optimización, DB, validaciones). La UI se valida con el checklist de aceptación del producto.

---

## 12. Compatibilidad y Versionado

| Requisito | Valor |
| :--- | :--- |
| macOS | 12 Monterey o superior; Intel y Apple Silicon |
| Windows | 10 21H2+ / 11; x64 y ARM64; WebView2 Evergreen |
| GPU | WebGL2 obligatorio; mensaje claro si no está disponible |
| Node / pnpm | Node 26 LTS / pnpm 12 |
| Rust | 1.99+ (edición 2024) |

**Reglas de versionado:**

1. Las versiones exactas se fijan en la Tarea 1.1 y se validan con un *smoke test* (arranque, viewport, worker).
2. `pnpm-lock.yaml` y `Cargo.lock` se versionan.
3. `ts-rs` regenera tipos en cada cambio de `models.rs`; el CI local (`pnpm verify`) falla si hay diferencias sin commitear.
4. No se aceptan dependencias que requieran red en runtime.
