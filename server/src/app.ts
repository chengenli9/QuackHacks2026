import cors from "@fastify/cors";
import Fastify from "fastify";
import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { ZodError } from "zod";
import { HttpError, validationErrorResponse } from "./errors.js";
import { loadConfig } from "./config.js";
import type { AssetGenerator } from "./providers/AssetGenerator.js";
import type { BackgroundImageGenerator } from "./providers/BackgroundImageGenerator.js";
import type { CommandParser } from "./providers/CommandParser.js";
import { GeminiBackgroundImageGenerator } from "./providers/GeminiBackgroundImageGenerator.js";
import type { ObjectPropertyEstimator } from "./providers/ObjectPropertyEstimator.js";
import { GeminiCommandParser } from "./providers/GeminiCommandParser.js";
import { GeminiObjectPropertyEstimator } from "./providers/GeminiObjectPropertyEstimator.js";
import { LocalAssetProvider } from "./providers/LocalAssetProvider.js";
import { MeshyProvider } from "./providers/MeshyProvider.js";
import { OpenAIObjectPropertyEstimator } from "./providers/OpenAIObjectPropertyEstimator.js";
import { UnavailableAssetGenerator } from "./providers/UnavailableAssetGenerator.js";
import { UnavailableBackgroundImageGenerator } from "./providers/UnavailableBackgroundImageGenerator.js";
import { registerBackgroundImageRoutes } from "./routes/backgroundImage.js";
import { registerCommandRoutes } from "./routes/command.js";
import { registerEstimateObjectRoutes } from "./routes/estimateObject.js";
import { registerGenerateAssetRoutes } from "./routes/generateAsset.js";
import { registerGeneratedAssetModelRoutes } from "./routes/generatedAssetModel.js";
import { registerGeneratedAssetStatusRoutes } from "./routes/generatedAssetStatus.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { fallbackAssetKeySchema } from "./schemas.js";
import { AssetGenerationService } from "./services/assetGenerationService.js";
import { GeneratedAssetCache } from "./services/generatedAssetCache.js";
import { LocalObjectPropertyEstimator } from "./services/localObjectPropertyEstimator.js";
import { MeshyTaskStore } from "./services/meshyTaskStore.js";
import { RuleCommandParser } from "./services/commandParser.js";
import { FallbackCommandParser } from "./services/fallbackCommandParser.js";
import { FallbackObjectPropertyEstimator } from "./services/fallbackObjectPropertyEstimator.js";

export type AppOptions = {
  assetGenerator?: AssetGenerator;
  objectEstimator?: ObjectPropertyEstimator;
  commandParser?: CommandParser;
  backgroundImageGenerator?: BackgroundImageGenerator;
  publicBaseUrl?: string;
  fallbackAssetDir?: string;
  generatedAssetStorageDir?: string;
  projectStorageDir?: string;
  fetch?: typeof fetch;
};

export const createApp = async (options: AppOptions = {}) => {
  const config = loadConfig();
  const app = Fastify({ logger: false });
  const assetGenerator = options.assetGenerator ?? createDefaultAssetGenerator();
  const objectEstimator = options.objectEstimator ?? createDefaultObjectEstimator();
  const commandParser = options.commandParser ?? createDefaultCommandParser();
  const backgroundImageGenerator = options.backgroundImageGenerator ?? createDefaultBackgroundImageGenerator();
  const publicBaseUrl = options.publicBaseUrl ?? config.publicBaseUrl;
  const fallbackAssetDir = options.fallbackAssetDir ?? config.fallbackAssetDir;
  const localAssetProvider = new LocalAssetProvider(
    publicBaseUrl,
    fallbackAssetDir
  );
  const assetGenerationService = new AssetGenerationService(
    assetGenerator,
    localAssetProvider,
    new MeshyTaskStore(),
    new GeneratedAssetCache(
      options.generatedAssetStorageDir ?? config.generatedAssetStorageDir,
      publicBaseUrl,
      options.fetch ?? globalThis.fetch
    )
  );

  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PUT", "OPTIONS"]
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send(validationErrorResponse(error));
    }

    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details
      });
    }

    return reply.code(500).send({
      error: "InternalServerError",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "quackhacks-backend"
  }));

  app.get<{ Params: { file: string } }>("/assets/fallback/:file", async (request, reply) => {
    const file = request.params.file;
    const key = file.endsWith(".glb") ? file.slice(0, -4) : file;
    const parsed = fallbackAssetKeySchema.safeParse(key);

    if (!parsed.success || file !== `${parsed.data}.glb`) {
      throw new HttpError(404, "FallbackAssetNotFound", `Unknown fallback asset: ${file}`);
    }

    const path = join(fallbackAssetDir, `${parsed.data}.glb`);
    if (!existsSync(path)) {
      throw new HttpError(
        404,
        "FallbackAssetFileMissing",
        `Fallback asset file missing: ${parsed.data}.glb`
      );
    }

    return reply.type("model/gltf-binary").send(createReadStream(path));
  });

  await app.register(async (instance) =>
    registerCommandRoutes(instance, commandParser)
  );
  await app.register(async (instance) =>
    registerBackgroundImageRoutes(instance, backgroundImageGenerator)
  );
  await app.register(async (instance) =>
    registerEstimateObjectRoutes(instance, objectEstimator)
  );
  await app.register(async (instance) =>
    registerGenerateAssetRoutes(instance, assetGenerationService)
  );
  await app.register(async (instance) =>
    registerGeneratedAssetStatusRoutes(instance, assetGenerationService)
  );
  await app.register(async (instance) =>
    registerGeneratedAssetModelRoutes(instance, assetGenerationService)
  );
  await app.register(async (instance) =>
    registerProjectRoutes(instance, options.projectStorageDir ?? config.projectStorageDir, publicBaseUrl)
  );

  return app;
};

const createDefaultAssetGenerator = (): AssetGenerator => {
  const config = loadConfig();

  if (!config.meshyApiKey) {
    return new UnavailableAssetGenerator();
  }

  return new MeshyProvider({
    apiKey: config.meshyApiKey,
    baseUrl: config.meshyBaseUrl
  });
};

const createDefaultObjectEstimator = (): ObjectPropertyEstimator => {
  const config = loadConfig();

  if (config.geminiApiKey) {
    return new FallbackObjectPropertyEstimator(
      new GeminiObjectPropertyEstimator({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        baseUrl: config.geminiBaseUrl
      }),
      new LocalObjectPropertyEstimator()
    );
  }

  if (!config.openAiApiKey) {
    return new LocalObjectPropertyEstimator();
  }

  return new OpenAIObjectPropertyEstimator({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    baseUrl: config.openAiBaseUrl
  });
};

const createDefaultCommandParser = (): CommandParser => {
  const config = loadConfig();

  if (!config.geminiApiKey) {
    return new RuleCommandParser();
  }

  return new FallbackCommandParser(
    new GeminiCommandParser({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      baseUrl: config.geminiBaseUrl
    }),
    new RuleCommandParser()
  );
};

const createDefaultBackgroundImageGenerator = (): BackgroundImageGenerator => {
  const config = loadConfig();

  if (!config.geminiApiKey) {
    return new UnavailableBackgroundImageGenerator();
  }

  return new GeminiBackgroundImageGenerator({
    apiKey: config.geminiApiKey,
    model: config.geminiImageModel,
    baseUrl: config.geminiBaseUrl
  });
};
