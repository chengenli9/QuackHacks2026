# PRISM Backend

Fastify/TypeScript backend for PRISM: Physics-aware Room Import, Segmentation, and Manipulation. The server owns external side effects, validates API/model data with Zod, talks to Meshy/Gemini/OpenAI providers, caches generated GLBs, serves fallback assets, and stores saved projects on disk.

## Setup

```bash
npm install
cp .env.example .env
```

## Environment

Set keys in `server/.env`:

```bash
MESHY_API_KEY=your_meshy_key
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

Supported variables:

- `HOST`: bind host, default `127.0.0.1`.
- `PORT`: bind port, default `8787`.
- `SERVER_PUBLIC_URL`: public base URL for cached asset/background links.
- `MESHY_API_KEY`: enables live Meshy generation.
- `MESHY_BASE_URL`: defaults to `https://api.meshy.ai`.
- `GEMINI_API_KEY`: enables Gemini command parsing, object VLM estimation, and background generation.
- `GEMINI_MODEL`: defaults to `gemini-3.5-flash`.
- `GEMINI_IMAGE_MODEL`: defaults to `gemini-2.5-flash-image`.
- `GEMINI_BASE_URL`: defaults to `https://generativelanguage.googleapis.com/v1beta`.
- `OPENAI_API_KEY`: optional secondary object estimator when Gemini is not configured.
- `OPENAI_MODEL`: defaults to `gpt-4.1-mini`.
- `OPENAI_BASE_URL`: defaults to `https://api.openai.com/v1`.
- `GENERATED_ASSET_STORAGE_DIR`: default `storage/generated-assets`.
- `FALLBACK_ASSET_DIR`: default `public/assets/fallback`.
- `PROJECT_STORAGE_DIR`: default `storage/projects`.
- `REQUEST_BODY_LIMIT_BYTES`: default `104857600`.

Without `MESHY_API_KEY`, live generation routes return clear unavailable errors. Without `GEMINI_API_KEY`, chat uses deterministic local parsing, object estimation uses local rules unless OpenAI is configured, and background generation returns a clear unavailable error.

Put deterministic fallback GLBs in `server/public/assets/fallback` or set `FALLBACK_ASSET_DIR`. Required filenames are `rubber_ball.glb`, `wooden_crate.glb`, `glass_vase.glb`, `metal_barrel.glb`, and `duck.glb`. Missing fallback files return `FallbackAssetFileMissing`.

## Scripts

```bash
npm run dev
npm test
npm run build
npm start
```

## Endpoints

- `GET /health`
- `POST /api/command`
- `POST /api/background-image`
- `POST /api/estimate-object`
- `POST /api/generate-asset`
- `GET /api/generated-assets/:id/status`
- `GET /api/generated-assets/:id/model`
- `GET /api/generated-assets/:id/model.glb`
- `POST /api/generated-assets/fallback`
- `GET /assets/fallback/:file`
- `GET /api/projects`
- `GET /api/projects/last`
- `GET /api/projects/:projectId`
- `PUT /api/projects/last`
- `PUT /api/projects/:projectId`
- `GET /api/projects/:projectId/assets/:file`
- `GET /api/projects/:projectId/backgrounds/:file`

Generated asset metadata and proxied Meshy GLBs are persisted under `GENERATED_ASSET_STORAGE_DIR`. Saved projects are persisted under `PROJECT_STORAGE_DIR`, with project assets and generated backgrounds bundled into each project folder.
