# 01-product-spec.md — MeshCraft Studio

## 1. Visión General del Producto

**MeshCraft Studio** es una aplicación de escritorio *offline-first* para inspeccionar, auditar y optimizar assets 3D en pipelines de WebGL y videojuegos. Se ejecuta de forma nativa en **macOS 12+ (Intel y Apple Silicon)** y **Windows 10 21H2+/11 (x64 y ARM64)**, sin depender de servicios en la nube, sin conexión a internet y sin telemetría.

El diferencial del producto es la **optimización local que preserva materiales, UVs y texturas**: el asset optimizado debe seguir siendo visualmente equivalente al original, no solo más liviano.

**Alcance del MVP:** archivos `.glb` y `.gltf` autocontenidos. La optimización se ejecuta dentro de la aplicación (WASM en un Web Worker), no en un proceso externo.

---

## 2. Casos de Uso Principales

* **Desarrolladores WebGL/Three.js:** inspección de conteo poligonal, dimensiones reales de malla y estimación de memoria gráfica (VRAM) antes de integrar el asset en web.
* **Artistas y Modeladores 3D:** simplificación rápida de geometrías sobrecargadas sin abrir software pesado de modelado, conservando las texturas originales.
* **Creadores de Contenido / Diseñadores:** verificación rápida de mallas y exportación a `.glb` con texturas embebidas.

---

## 3. Desglose de Módulos y Requerimientos Funcionales

### Módulo 1: Gestión de Archivos (File Engine)

* **RF-1.1 Importación:** soporte de *Drag & Drop* y diálogo nativo para `.glb` y `.gltf` **autocontenido** (buffers y texturas embebidos como `data:` URIs o dentro del `.glb`). Los formatos `.obj` y `.fbx` quedan fuera del MVP (ver §5).
* **RF-1.2 Acceso Local Multiplataforma:** lectura de archivos desde el sistema de archivos de macOS y Windows mediante comandos nativos de Tauri v2. El input es **solo lectura**: la aplicación nunca modifica ni sobrescribe el archivo original.
* **RF-1.3 Validación y Errores de Importación:** antes de renderizar se valida extensión, tamaño, estructura del contenedor y disponibilidad de decoders. Todo rechazo produce un error tipado con mensaje accionable (ver §9 de `02-architecture-spec.md`).
* **RF-1.4 Exportación:** exportación del resultado en `.glb` con texturas embebidas, tanto del modelo **optimizado** como del **original sin procesar** ("Guardar como"). La escritura es atómica y requiere confirmación si el destino ya existe. La exportación `.gltf` con recursos externos queda fuera del MVP.

### Módulo 2: Canvas 3D e Inspección Visual (Graphics Engine)

* **RF-2.1 Control de Cámara:** órbita libre 360° (*OrbitControls*), zoom continuo, encuadre automático del modelo (*Center Focus* con margen del 50%), doble clic para reencuadrar y comando de reinicio de vista.
* **RF-2.2 Modos de Renderizado:** el cambio de modo es **no destructivo** (nunca muta los materiales originales):
  * **Shaded (Sólido):** renderizado PBR original con iluminación de estudio. Modo por defecto.
  * **Wireframe (Malla de Alambre):** solo aristas de la geometría sobre material neutro, sin z-fighting.
  * **Normals (Normales):** mapa de color según la orientación de cada cara (`MeshNormalMaterial`).
  * **Unlit (Sin sombras):** mapa difuso plano (`MeshBasicMaterial`) para inspección de texturas.
* **RF-2.3 Entornos de Trabajo:** alternado entre **Studio** (fondo oscuro de estudio, por defecto), **Grid** (grilla técnica neutra) y **Transparent** (fondo alfa, útil para capturas).
* **RF-2.4 Decoders Locales:** soporte de `KHR_draco_mesh_compression`, `KHR_texture_basisu` (KTX2) y `EXT_meshopt_compression`. Los decoders se empaquetan con la aplicación; **nunca** se descargan de un CDN.
* **RF-2.5 Rendimiento del Viewport:** `devicePixelRatio` limitado a 2, liberación de geometrías/materiales/texturas al descargar un modelo y objetivo de 60 fps con 500k triángulos (mínimo 30 fps con 2M) en hardware con aceleración gráfica.

### Módulo 3: Auditoría y Métricas (Analytics Engine)

* **RF-3.1 Geometría en Tiempo Real:** vértices de buffer, triángulos (post-triangulación, multiplicados por instancias), sub-mallas (mallas con geometría), materiales únicos y nodos de jerarquía.
* **RF-3.2 Dimensiones Espaciales:** *Bounding Box* del modelo en unidades de mundo, reportando ancho (X), alto (Y) y profundidad (Z), más el centro geométrico usado para el encuadre. No se aplica conversión de unidades: se muestran las unidades del archivo (glTF asume metros por convención).
* **RF-3.3 Análisis de Texturas y VRAM:** texturas únicas (deduplicadas por identidad), nombre, resolución, formato, espacio de color, mipmaps y **VRAM estimada** por textura y total agregado. La estimación es explícita: no incluye overhead del driver ni del compositor.
* **RF-3.4 VRAM de Geometría:** suma de bytes de atributos e índices por malla, reportada como estimación de memoria de buffers.
* **RF-3.5 Reporte de Importación:** advertencias no bloqueantes (modelo sin UVs, texturas referenciadas pero ausentes, extensión desconocida, escena vacía, archivo grande). El reporte queda visible en el footer y en el panel de métricas.

### Módulo 4: Motor de Optimización Local (WASM)

* **RF-4.1 Simplificación Poligonal:** reducción de triángulos configurable de **0% a 80%** (entero), ejecutada en un **Web Worker** con `@gltf-transform/core` + `@gltf-transform/functions` + `meshoptimizer` (WASM). La simplificación es **consciente de atributos**: preserva UVs, normales, materiales y texturas, y respeta las costuras UV.
* **RF-4.2 Limpieza de Malla:** operaciones opcionales de *weld* (fusión de vértices duplicados), eliminación de caras degeneradas, *prune* de nodos/materiales sin uso y *dedup* de recursos. El orden del pipeline está definido en `02-architecture-spec.md` §3.3.
* **RF-4.3 Comparativa de Impacto:** desglose pre vs. post de triángulos, peso en bytes, porcentaje de ahorro, **reducción real alcanzada** (puede ser menor a la solicitada), tiempo de proceso y advertencias.
* **RF-4.4 Progreso y Cancelación:** progreso por etapa (`read → weld → simplify → prune → write`), cancelación efectiva (termina el worker y descarta el resultado) y bloqueo de ejecuciones simultáneas. La UI nunca se congela.
* **RF-4.5 Integridad del Resultado:** el `.glb` de salida debe ser válido, conservar la estructura de escena, materiales y texturas. Si el objetivo de reducción no es alcanzable, se devuelve el mejor resultado posible **con advertencia explícita**; si el resultado es inválido, no se ofrece guardar.
* **RF-4.6 Operación No Destructiva:** el archivo original nunca se modifica. El resultado vive en memoria hasta que el usuario elige guardarlo, y puede descartarse o compararse con el original.
* **RF-4.7 Semántica de Reducción:** `reductionPercent` significa **porcentaje de triángulos a eliminar** (no de vértices). `0%` equivale a limpieza/exportación sin simplificar. Objetivos que dejarían menos de 4 triángulos se rechazan con advertencia.

### Módulo 5: Historial y Persistencia (Database Engine)

* **RF-5.1 Registro Local:** guardado automático en SQLite (en `Application Support` en macOS o `AppData` en Windows, resuelto por Tauri) de cada exportación: rutas de entrada y salida, triángulos originales/optimizados, porcentaje, bytes, tiempo, motor y versión.
* **RF-5.2 Consulta y Borrado:** historial paginado ordenado por fecha descendente, con detalle de cada registro y borrado individual con confirmación.
* **RF-5.3 Resiliencia de Persistencia:** un fallo de base de datos **no bloquea** la inspección, la optimización ni la exportación; se muestra una advertencia y se permite reintentar.
* **RF-5.4 Privacidad Local:** todos los datos permanecen en el equipo del usuario. No hay sincronización, cuentas, analítica ni llamadas de red.

---

## 4. Distribución de la Interfaz de Usuario (UI Layout)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header: MeshCraft | Motor: Listo/Ocupado | FPS | VRAM tex. | [Abrir] [Exportar] │
├──────────────────────┬──────────────────────────────────────┬────────────────┤
│ Sidebar Izquierdo    │ Viewport 3D Principal                │ Sidebar Derecho│
│                      │                                      │ (Controles)    │
│ [Métricas]           │ - Canvas WebGL / Three.js            │                │
│ [Texturas]           │ - Gizmo Orientación XYZ              │ - Modos Render │
│ [Historial]          │ - Drop Zone (estado vacío)           │ - Entorno      │
│                      │                                      │ - Slider 0–80% │
│ - Vértices/Triáng.   │                                      │ - [Optimizar]  │
│ - Bounding Box       │                                      │                │
│ - Texturas + VRAM    │                                      │                │
│ - Historial          │                                      │                │
├──────────────────────┴──────────────────────────────────────┴────────────────┤
│ Footer: ruta local | tamaño (MB) | estado del motor | últimas advertencias     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Reglas de interacción:**

* El sidebar izquierdo usa pestañas (**Métricas / Texturas / Historial**) para no añadir una cuarta columna.
* Estados del viewport: `empty` (drop zone), `loading` (progreso indeterminado), `ready`, `error` (mensaje + reintentar).
* Atajos de teclado: `1–4` modos de render, `F` reencuadrar, `O` abrir, `S` guardar, `Esc` cancelar optimización.
* Toda acción destructiva (borrar historial, sobrescribir archivo) pide confirmación.

---

## 5. Fuera del Alcance (Non-Goals del MVP)

* Edición o ajuste manual de esqueletos (rigging) y animaciones.
* Generación procedimental de texturas o pintura UV directa.
* Sincronización, cuentas o almacenamiento en la nube.
* Importación de `.obj`, `.fbx` u otros formatos distintos de glTF/GLB.
* Exportación `.gltf` con recursos externos y compresión de texturas a KTX2 en la salida.
* Procesamiento por lotes (múltiples archivos), operaciones booleanas, retopología o edición de UVs.
* Versiones móviles o web del producto, y actualización automática en el MVP.

---

## 6. Requisitos No Funcionales (NFR)

| ID | Requisito | Criterio medible |
| :--- | :--- | :--- |
| **NFR-1** | Offline total | La app funciona con la red desconectada: sin CDN, fuentes remotas, decoders descargados ni telemetría. |
| **NFR-2** | Rendimiento | Abrir un GLB de 50 MB: ≤ 3 s. Simplificar 1M de triángulos al 50%: ≤ 8 s. Viewport ≥ 60 fps con 500k triángulos. |
| **NFR-3** | Compatibilidad | macOS 12+ (Intel/ARM) y Windows 10 21H2+/11 (x64/ARM) con WebView2 y WebGL2. |
| **NFR-4** | Resiliencia | Todo error es tipado y accionable; las escrituras son atómicas; un fallo de DB no bloquea el flujo principal. |
| **NFR-5** | Seguridad | Permisos mínimos de Tauri, sin shell ni filesystem genérico expuesto, CSP estricta, validación de rutas y extensiones. |
| **NFR-6** | Accesibilidad | Navegación completa por teclado, foco visible, contraste AA y respeto a `prefers-reduced-motion`. |
| **NFR-7** | Localización | UI en español para el MVP, con todos los textos centralizados para facilitar i18n. |
| **NFR-8** | Huella | Instalador ≤ 40 MB, arranque en frío ≤ 2 s y consumo en reposo ≤ 200 MB de RAM. |

---

## 7. Criterios de Aceptación del MVP

El MVP se considera terminado cuando se cumple el siguiente recorrido completo en **macOS y Windows**:

1. Abrir un `.glb` de ~20 MB con tres texturas 2K y ver métricas correctas (±1% frente a la referencia).
2. Alternar los cuatro modos de render y los tres entornos sin degradación ni pérdida al volver.
3. Optimizar al 50% conservando texturas y UVs visibles, con reducción real reportada.
4. Guardar el `.glb` optimizado y reabrirlo correctamente dentro y fuera de la app.
5. Ver el registro en el historial, reiniciar la app y comprobar que persiste.
6. Ejecutar todo el flujo con la red desconectada.
7. Recibir errores claros y accionables con archivos corruptos, `.obj`, `.gltf` con recursos externos y archivos > 1 GB.
8. Cancelar una optimización en curso sin dejar workers huérfanos ni archivos temporales.

---

## 8. Glosario

| Término | Definición |
| :--- | :--- |
| **GLB / glTF autocontenido** | Contenedor que incluye geometría, materiales y texturas sin archivos externos. |
| **Sub-malla (submesh)** | Malla con geometría propia dentro de la escena (usualmente un *primitive* de glTF). |
| **Triángulo** | Cara triangular tras la triangulación; unidad usada para todas las métricas y para la reducción. |
| **Weld** | Fusión de vértices duplicados para reconstruir la topología antes de simplificar. |
| **VRAM estimada** | Cálculo teórico de memoria de GPU; no incluye overhead del driver. |
| **Reducción real** | Porcentaje de triángulos efectivamente eliminado, que puede diferir del solicitado. |
