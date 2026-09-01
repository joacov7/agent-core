# Publicación de paquetes

El monorepo publica **tres paquetes privados** (scoped `@agent-core/*`); las apps
(`apps/ejemplo`, `apps/juridico`) y la raíz quedan `private` y **no** se publican.

| Paquete | Rol |
|---|---|
| `@agent-core/contracts` | tipos canónicos + interfaces de providers + Manifest |
| `@agent-core/core` | engine + recommendations + policies + ai-gateway |
| `@agent-core/agents` | catálogo de agentes |

Todos son `0.1.0`, ESM (`"type": "module"`), publican solo `dist/` + `README.md`
(campo `files`) y llevan `publishConfig.access: "restricted"` (paquetes privados).
Las dependencias internas están fijadas con rango semver (`^0.1.0`), no `*`.

## Orden

`contracts` → `core` → `agents` (por sus dependencias). Los scripts de la raíz ya
respetan ese orden.

## Pasos

```bash
# 1. Validar todo antes de publicar (build + tests)
npm run release:check          # tsc --build && vitest run

# 2. Ensayo sin subir nada: muestra el contenido de cada tarball
npm run publish:dry            # npm publish --dry-run de los tres paquetes

# 3. Autenticarse en el registry destino (ver abajo) y publicar
npm run publish:all
```

`prepublishOnly` en cada paquete corre `tsc --build`, así que el `dist/` siempre
sale fresco aunque te saltees el paso 1.

## Registry destino

Por defecto se publica en **npmjs** como paquete privado (requiere plan de pago para
scopes privados). Autenticación: `npm login`.

### Alternativa: GitHub Packages

Para publicar en GitHub Packages en vez de npmjs, agregá a la raíz un `.npmrc`:

```
@agent-core:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

(o poné `publishConfig.registry` en cada `package.json`). El `GITHUB_TOKEN` necesita
scope `write:packages`. El scope del paquete (`@agent-core`) debe coincidir con la
org/usuario dueño del registry.

## Versionado

Subir versión antes de re-publicar (los tres a la par para mantenerlos alineados);
al subir `contracts` o `core`, actualizar también el rango `^x.y.z` de las deps
internas en `core`/`agents`.
