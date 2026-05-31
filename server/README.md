# QuackHacks Backend

Fastify/TypeScript backend for the Scene-to-3D Physics Sandbox.

## Setup

```bash
npm install
cp .env.example .env
```

Set `MESHY_API_KEY` in `.env` to enable live Meshy generation. Without a key, the server still starts and returns a clear `503` for live generation routes.

Set `GEMINI_API_KEY` to use Gemini for chat command parsing and object-property VLM estimation. Without a Gemini key, chat uses deterministic local parsing and `/api/estimate-object` falls back to local rules. `OPENAI_API_KEY` is still supported as a secondary object estimator when Gemini is not configured.

Put the Gemini key in `server/.env`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

Put deterministic fallback GLBs in `server/public/assets/fallback` or set `FALLBACK_ASSET_DIR`.
The required filenames are `rubber_ball.glb`, `wooden_crate.glb`, `glass_vase.glb`, `metal_barrel.glb`, and `duck.glb`.
When a fallback file is missing, the API returns `FallbackAssetFileMissing` instead of a dead asset URL.

## Scripts

```bash
npm run dev
npm test
npm run build
```

## Endpoints

- `GET /health`
- `POST /api/command`
- `POST /api/estimate-object`
- `POST /api/generate-asset`
- `GET /api/generated-assets/:id/status`
- `GET /api/generated-assets/:id/model`
- `GET /api/generated-assets/:id/model.glb`
- `POST /api/generated-assets/fallback`
- `GET /assets/fallback/:file`

Generated asset metadata and proxied Meshy GLBs are persisted under `GENERATED_ASSET_STORAGE_DIR`, which defaults to `storage/generated-assets`.
