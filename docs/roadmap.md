# Implementation Roadmap

Updated: 2026-05-31

## Current Architecture Baseline

The app is split into:

- `roomcraft`: React/Vite JavaScript frontend with Three.js, React Three Fiber, Drei, Rapier, Zustand, Lucide, React Dropzone, and ESLint.
- `server`: Fastify/TypeScript backend with Zod validation, Vitest tests, Meshy/Gemini/OpenAI/local providers, generated asset cache, fallback asset serving, and project persistence.

The frontend is not currently TypeScript and does not use immer or frontend Zod. Backend API/model validation is Zod-based.

## Completed Foundation

- GLB import through GLTFLoader.
- Optional `manifest.json` metadata import.
- Stable app-level object IDs and object registry.
- Outliner/viewport selection.
- Transform controls and property-panel transform edits.
- Material, wireframe, and solid view modes.
- Editable appearance and physics properties.
- Zustand project/scene store.
- Rapier gravity/collisions/floor runtime.
- Editor-authoritative dragging, including gravity-on release behavior.
- Export of `scene.glb` and `scene.physics.json`.

## AI And Chat Editing

- `/api/command` returns validated `operation`, `operations[]`, or conversational `message`.
- Gemini is the primary configured chat parser when `GEMINI_API_KEY` exists.
- Missing `GEMINI_API_KEY` returns a clear no-op unavailable message; deterministic rule parsing is retained only for legacy/unit coverage and explicit test injection.
- Chat supports visible plan/thought lines and ordered tool-call status bubbles.
- Supported operations include generated/local object insertion, transforms, physics edits, appearance edits, gravity/collision toggles, export, relabel, background generation, and environment-scene generation.

## Meshy And Generated Assets

- `/api/generate-asset` starts Meshy text-to-3D generation.
- Meshy provider uses preview then refine flow with PBR/HD texture options.
- `/api/generated-assets/:id/status` normalizes preview/refine status and progress.
- `/api/generated-assets/:id/model` returns generated metadata after GLB caching.
- `/api/generated-assets/:id/model.glb` streams cached generated GLBs.
- Frontend shows placeholders/task state, imports generated GLBs, registers objects, and selects/highlights inserted objects.

## Fallbacks, VLM, Backgrounds, And Projects

- Local fallback assets are served explicitly through `/assets/fallback/:file` and `/api/generated-assets/fallback`.
- Object semantic/physics/appearance estimation uses Gemini when configured, local rules without keys, and OpenAI as secondary object-estimator fallback.
- Gemini background generation is exposed through `/api/background-image`.
- Photo to Scene uploads can target a configured external SceneGen service, and the backend exposes `/api/convert-image/jpeg` so HEIC/unsupported image uploads are converted before submission.
- Named project save/open persists project JSON, bundled GLB assets, generated backgrounds, chat context, and editor settings under `PROJECT_STORAGE_DIR`.
- Browser local storage/IndexedDB mirror protects against backend save/load failures.

## Remaining Hardening Priorities

1. Curate and document a stable demo GLB plus matching source image.
2. Add more manual QA coverage for large saved projects and repeated open/import cycles.
3. Improve generated asset progress UX if Meshy exposes richer status.
4. Add docs/examples for manifest authoring and SceneGen export naming.
5. Consider frontend TypeScript migration only after demo-critical behavior is stable.

## Milestone Definition

The MVP is demo-ready when a user can import a curated `scene.glb`, select and drag an existing object, ask chat to add a rubber duck to the coffee table, watch Meshy generation progress, see the textured GLB placed in the scene, edit the duck and other objects through multi-step chat commands, generate a background, save/reopen the project, and export both visual and physics artifacts.
