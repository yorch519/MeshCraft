import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

const GLTF_FILTER = { name: "glTF", extensions: ["glb", "gltf"] };

export default function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [status, setStatus] = useState("Sin acciones todavía.");

  async function handleOpen() {
    try {
      const result = await open({
        multiple: false,
        directory: false,
        filters: [GLTF_FILTER],
      });
      const path = typeof result === "string" ? result : null;
      setSelectedPath(path);
      setStatus(path ? `Seleccionado: ${path}` : "Apertura cancelada.");
    } catch (error) {
      setStatus(`Error al abrir: ${String(error)}`);
    }
  }

  async function handleSave() {
    try {
      const path = await save({
        defaultPath: "meshcraft-diagnostico.glb",
        filters: [GLTF_FILTER],
      });
      setSelectedPath(path);
      setStatus(path ? `Destino elegido: ${path}` : "Guardado cancelado.");
    } catch (error) {
      setStatus(`Error al guardar: ${String(error)}`);
    }
  }

  async function handleReveal() {
    if (!selectedPath) return;
    try {
      await revealItemInDir(selectedPath);
      setStatus(`Revelado en el explorador: ${selectedPath}`);
    } catch (error) {
      setStatus(`Error al revelar: ${String(error)}`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-950 px-6 text-center text-neutral-100">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          MeshCraft Studio
        </h1>
        <p className="max-w-md text-sm text-neutral-400">
          Inspección, auditoría y optimización local de assets 3D glTF.
        </p>
      </div>

      <section className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 text-left">
        <header>
          <h2 className="text-sm font-medium text-neutral-200">
            Diagnóstico de Tauri
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Task 1.2 · diálogos nativos, permisos y CSP
          </p>
        </header>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-100 transition hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Abrir archivo
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-100 transition hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Guardar como…
          </button>
          <button
            type="button"
            onClick={handleReveal}
            disabled={!selectedPath}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-100 transition hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Revelar en carpeta
          </button>
        </div>

        <p className="mt-4 break-all rounded-md bg-neutral-950/60 px-3 py-2 text-xs leading-relaxed text-neutral-400">
          {status}
        </p>
      </section>

      <span className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-500">
        Fase 1 · Task 1.2
      </span>
    </main>
  );
}
