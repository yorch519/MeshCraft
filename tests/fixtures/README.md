# Fixtures de prueba

Modelos y datos usados para probar MeshCraft Studio.

## `vendor/` — assets de terceros (no versionados)

Estos archivos se descargan en local y **no se suben al repositorio**, para no
redistribuir assets de terceros. Se recrean con los comandos de abajo.

| Archivo | Origen | Licencia |
| :--- | :--- | :--- |
| `Box.glb` | [Khronos glTF-Sample-Assets — Box](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) © 2017 Cesium |
| `Duck.glb` | [Khronos glTF-Sample-Assets — Duck](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Duck) | [SCEA Shared Source License 1.0](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/LICENSES/SCEA.txt) © 2006 Sony |

```bash
mkdir -p tests/fixtures/vendor

curl -fL -o tests/fixtures/vendor/Box.glb \
  https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Box/glTF-Binary/Box.glb

curl -fL -o tests/fixtures/vendor/Duck.glb \
  https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb
```

### Para qué sirve cada uno

- **Box.glb** (1.6 KB): malla mínima sin texturas. Ideal para las primeras pruebas.
- **Duck.glb** (118 KB): malla con textura. Útil para validar materiales y VRAM.

> Si en el futuro necesitas redistribuir estos modelos, revisa y cumple sus
> licencias. Para el uso local de desarrollo no hay problema.

## Próximos fixtures

En la Task 2.3 se añadirán aquí modelos con **Draco**, **KTX2** y **Meshopt**,
también dentro de `vendor/` y con su fuente y licencia documentadas.
