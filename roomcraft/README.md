# PRISM Frontend

PRISM: Physics-aware Room Import, Segmentation, and Manipulation is the browser editor for the Scene-to-3D Physics Sandbox. It imports GLB scenes, registers editable objects, renders the scene with React Three Fiber, simulates physics with Rapier, and applies validated chat/tool operations to the local Zustand project store.

## Stack

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

The frontend is not currently TypeScript and does not use immer or frontend Zod. Backend APIs validate data with Zod; the frontend uses store actions and normalization helpers for editor state.

## Scripts

```bash
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

For the shared local demo port:

```bash
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

## Environment

Set `VITE_API_BASE_URL` when the backend is not running at the default:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
```

## Current Capabilities

- GLB import with optional manifest metadata.
- Object registration, outliner selection, viewport selection, and transform controls.
- Material, solid, and wireframe view modes.
- Editable transforms, appearance fields, and physics properties.
- Gravity, collisions, floor, object label, and physics x-ray toggles.
- Meshy/generated asset status UI and fallback asset insertion.
- Gemini/local chat command flow with visible thoughts and ordered tool calls.
- Gemini background generation and environment-scene helper flow.
- Named project save/open with local mirror recovery.
- Export of `scene.glb` and `scene.physics.json`.
