# QuackHacks Backend

Fastify/TypeScript backend for the Scene-to-3D Physics Sandbox.

## Setup

```bash
npm install
cp .env.example .env
```

Set `MESHY_API_KEY` in `.env` to enable live Meshy generation. Without a key, the server still starts and returns a clear `503` for live generation routes.

Set `OPENAI_API_KEY` to use the OpenAI object-property estimator. Without a key, `/api/estimate-object` uses deterministic local rules.

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
- `POST /api/generated-assets/fallback`

Generated asset metadata is persisted under `GENERATED_ASSET_STORAGE_DIR`, which defaults to `storage/generated-assets`.
