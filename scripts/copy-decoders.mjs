import { createRequire } from "node:module";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(projectRoot, "public", "decoders");

/** Sube desde el entrypoint del paquete hasta encontrar su package.json. */
function resolvePackageRoot(packageName) {
  let dir = dirname(require.resolve(packageName));
  for (let depth = 0; depth < 10; depth += 1) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`No se pudo resolver la raíz del paquete "${packageName}".`);
}

const threeRoot = resolvePackageRoot("three");
const threeLibs = join(threeRoot, "examples", "jsm", "libs");

/** Origen, destino relativo y archivos obligatorios. */
const decoderGroups = [
  {
    source: join(threeLibs, "draco"),
    target: "draco",
    files: ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"],
  },
  {
    source: join(threeLibs, "basis"),
    target: "basis",
    files: ["basis_transcoder.js", "basis_transcoder.wasm"],
  },
  {
    source: threeLibs,
    target: "meshopt",
    files: ["meshopt_decoder.module.js"],
  },
];

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const group of decoderGroups) {
  const targetDir = join(outputRoot, group.target);
  mkdirSync(targetDir, { recursive: true });

  for (const file of group.files) {
    const sourceFile = join(group.source, file);
    if (!existsSync(sourceFile)) {
      throw new Error(
        `Falta el decoder "${file}" en ${group.source}. Ejecuta "pnpm install" primero.`,
      );
    }
    copyFileSync(sourceFile, join(targetDir, file));
  }
}

console.log(
  "Decoders copiados a public/decoders: draco, basis y meshopt (offline).",
);
