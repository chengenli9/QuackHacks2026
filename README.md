# PRISM

PRISM: Physics-aware Room Import, Segmentation, and Manipulation is a browser-based Scene-to-3D Physics Sandbox. The app imports completed GLB scenes, registers object-level editor handles, lets users inspect and edit physics/material metadata, runs Rapier physics, and uses chat-driven tools for scene changes, asset generation, backgrounds, project saves, and export.

SceneGen remains an external preprocessing step. The runtime app focuses on completed GLBs, optional manifests, editor-authoritative transforms, validated AI/tool operations, Meshy-generated GLB insertion, Gemini-backed semantic/background workflows, local fallbacks, and project persistence.

## Core Demo

1. Load a curated or user-provided SceneGen GLB.
2. Register separate editable scene objects from GLB nodes.
3. Select objects from the viewport or outliner.
4. Edit transforms, material appearance, and physics properties.
5. Toggle gravity, collisions, floor, object labels, and physics x-ray overlays.
6. Chat: `add a rubber duck on the coffee table`.
7. Start Meshy preview/refine generation and show task state.
8. Import the textured GLB returned through the backend cache/proxy.
9. Chat: `make the duck bouncier` or multi-edit commands such as `make the duck red and bouncy, make the table metallic and fixed`.
10. Save/open named projects and export `scene.glb` plus `scene.physics.json`.

## Documentation

- [Product Brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Backend API](docs/api.md)
- [Implementation Roadmap](docs/roadmap.md)
- [Updated Build Plan](docs/plans/scene-to-3d-physics-sandbox.md)

## Current Stack

Frontend (`roomcraft`):

- React 19
- Vite 8
- JavaScript/JSX
- Three.js
- React Three Fiber
- `@react-three/drei`
- `@react-three/rapier`
- Zustand
- Lucide React
- React Dropzone
- ESLint

Backend (`server`):

- Node.js
- Fastify
- TypeScript
- Zod
- Vitest
- Meshy API adapter
- Gemini chat/object/background providers
- OpenAI object-estimator fallback provider
- Local deterministic fallback providers
- Local filesystem storage for generated assets and saved projects

The frontend does not currently use TypeScript, immer, or frontend Zod. Frontend state is managed with JavaScript/Zustand helpers and targeted runtime normalization. Backend request bodies, model outputs, and provider responses are validated with Zod.

## Local Development

Install dependencies separately:

```bash
cd server
npm install

cd ../roomcraft
npm install
```

Run the backend:

```bash
cd server
npm run dev
```

Run the frontend:

```bash
cd roomcraft
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Common checks:

```bash
cd server
npm test
npm run build

cd ../roomcraft
npm test
npm run lint
npm run build
```

## Environment

Backend `.env` keys live in `server/.env`.

- `MESHY_API_KEY`: enables live Meshy text-to-3D generation.
- `GEMINI_API_KEY`: enables Gemini command parsing, object-property VLM estimation, and background generation.
- `GEMINI_MODEL`: defaults to `gemini-3.5-flash`.
- `GEMINI_IMAGE_MODEL`: defaults to `gemini-2.5-flash-image`.
- `OPENAI_API_KEY`: optional secondary object-estimator provider when Gemini is not configured.
- `GENERATED_ASSET_STORAGE_DIR`: generated asset metadata/GLB cache, default `storage/generated-assets`.
- `FALLBACK_ASSET_DIR`: deterministic fallback GLBs, default `public/assets/fallback`.
- `PROJECT_STORAGE_DIR`: saved project folders, default `storage/projects`.
- `REQUEST_BODY_LIMIT_BYTES`: Fastify JSON body limit, default `104857600`.
- `SERVER_PUBLIC_URL`: public URL used when returning cached asset/background URLs.

Frontend environment:

- `VITE_API_BASE_URL`: backend API base URL, default `http://127.0.0.1:8787`.

## Critical Architecture Rule

AI providers never mutate scene state directly. AI and local parsers return validated structured JSON. The frontend dispatches accepted operations into the Zustand scene store, and Three/Rapier react to store updates.

## Demo Priority

Live Meshy generation is the primary wow path. Local GLB assets are deterministic fallbacks when Meshy is unavailable, slow, rate-limited, or missing a usable model. Gemini-powered VLM labels, background images, and multi-step chat tools support the demo but remain behind server-side API keys with deterministic local fallbacks where possible.
