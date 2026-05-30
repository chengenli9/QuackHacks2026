import { resolve } from "node:path";

export type ServerConfig = {
  host: string;
  port: number;
  meshyApiKey?: string;
  meshyBaseUrl: string;
  openAiApiKey?: string;
  openAiModel: string;
  openAiBaseUrl: string;
  publicBaseUrl: string;
  generatedAssetStorageDir: string;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => ({
  host: env.HOST ?? "127.0.0.1",
  port: Number(env.PORT ?? 8787),
  meshyApiKey: env.MESHY_API_KEY,
  meshyBaseUrl: env.MESHY_BASE_URL ?? "https://api.meshy.ai",
  openAiApiKey: env.OPENAI_API_KEY,
  openAiModel: env.OPENAI_MODEL ?? "gpt-4.1-mini",
  openAiBaseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  publicBaseUrl: env.SERVER_PUBLIC_URL ?? `http://localhost:${env.PORT ?? 8787}`,
  generatedAssetStorageDir: resolve(
    env.GENERATED_ASSET_STORAGE_DIR ?? "storage/generated-assets"
  )
});
