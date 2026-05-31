import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export type ServerConfig = {
  host: string;
  port: number;
  meshyApiKey?: string;
  meshyBaseUrl: string;
  geminiApiKey?: string;
  geminiModel: string;
  geminiImageModel: string;
  geminiBaseUrl: string;
  openAiApiKey?: string;
  openAiModel: string;
  openAiBaseUrl: string;
  publicBaseUrl: string;
  generatedAssetStorageDir: string;
  fallbackAssetDir: string;
  projectStorageDir: string;
};

export const loadEnvFile = (
  filePath = resolve(process.cwd(), ".env"),
  targetEnv: NodeJS.ProcessEnv = process.env
): boolean => {
  if (!existsSync(filePath)) return false;

  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = stripQuotes(line.slice(equalsIndex + 1).trim());

    if (targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }

  return true;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => ({
  host: env.HOST ?? "127.0.0.1",
  port: Number(env.PORT ?? 8787),
  meshyApiKey: env.MESHY_API_KEY,
  meshyBaseUrl: env.MESHY_BASE_URL ?? "https://api.meshy.ai",
  geminiApiKey: env.GEMINI_API_KEY,
  geminiModel: env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
  geminiImageModel: env.GEMINI_IMAGE_MODEL ?? DEFAULT_GEMINI_IMAGE_MODEL,
  geminiBaseUrl: env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta",
  openAiApiKey: env.OPENAI_API_KEY,
  openAiModel: env.OPENAI_MODEL ?? "gpt-4.1-mini",
  openAiBaseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  publicBaseUrl: env.SERVER_PUBLIC_URL ?? `http://localhost:${env.PORT ?? 8787}`,
  generatedAssetStorageDir: resolve(
    env.GENERATED_ASSET_STORAGE_DIR ?? "storage/generated-assets"
  ),
  fallbackAssetDir: resolve(
    env.FALLBACK_ASSET_DIR ?? "public/assets/fallback"
  ),
  projectStorageDir: resolve(
    env.PROJECT_STORAGE_DIR ?? "storage/projects"
  )
});

const stripQuotes = (value: string) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};
