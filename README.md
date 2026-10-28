# MeshCraft Studio

Aplicación de escritorio **offline-first** para inspeccionar, auditar y optimizar assets 3D glTF (`.glb` / `.gltf` autocontenido) en pipelines WebGL y videojuegos. Preserva UVs, materiales y texturas al simplificar, y no modifica nunca el archivo original.

> **Estado:** Fase 1 — scaffold del proyecto. La app todavía no procesa modelos; el flujo funcional se construye en las fases 2–5 descritas en [`specs/03-task-roadmap.md`](specs/03-task-roadmap.md).

## Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- **3D:** Three.js + `@react-three/fiber` + `@react-three/drei`
- **Optimización:** `@gltf-transform` + `meshoptimizer` (WASM en un Web Worker)
- **Desktop:** Tauri v2 (Rust)
- **Persistencia:** SQLite embebido en Rust (fases posteriores)

## Requisitos

| Herramienta | Versión |
| :--- | :--- |
| Node.js | ≥ 22.12 (probado con 26.12 LTS) |
| pnpm | ≥ 10 (probado con 12.15) |
| Rust | stable ≥ 1.80 (probado con 1.99) |
| macOS | Xcode Command Line Tools |
| Windows | WebView2 + Visual Studio Build Tools (C++) |

Instalación de Rust (macOS/Linux):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Puesta en marcha

```bash
pnpm install        # instala dependencias y copia los decoders a public/decoders
pnpm tauri dev      # abre la ventana nativa con hot reload
```

## Comandos

| Comando | Descripción |
| :--- | :--- |
| `pnpm dev` | Solo el frontend en el navegador (sin APIs de Tauri) |
| `pnpm tauri dev` | App nativa en modo desarrollo (comando principal) |
| `pnpm build` | Typecheck + build del frontend |
| `pnpm typecheck` | Verificación de tipos sin emitir |
| `pnpm copy-decoders` | Copia DRACO, Basis/KTX2 y Meshopt a `public/decoders` |
| `pnpm tauri build` | Genera el instalador (`.app` / `.dmg` en macOS) |

## Estructura

```text
.
├── specs/                 # Producto, arquitectura, roadmap y ADRs
├── public/decoders/       # Generado en postinstall (no se versiona)
├── scripts/               # Utilidades de build
├── src/                   # Frontend React
├── src-tauri/             # Núcleo Rust + configuración de Tauri
└── index.html
```

## Documentación

- [`specs/01-product-spec.md`](specs/01-product-spec.md) — qué hace el producto y para quién.
- [`specs/02-architecture-spec.md`](specs/02-architecture-spec.md) — stack, contratos, IPC, persistencia.
- [`specs/03-task-roadmap.md`](specs/03-task-roadmap.md) — 32 tareas en 6 fases con criterios de aceptación.
- [`specs/04-decisions.md`](specs/04-decisions.md) — decisiones de arquitectura (ADRs).

## Licencia

[MIT](LICENSE) © 2026 Jorge Emilio Cervantes
