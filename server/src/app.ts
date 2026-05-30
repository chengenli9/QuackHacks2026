import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { HttpError, validationErrorResponse } from "./errors.js";
import { loadConfig } from "./config.js";
import type { AssetGenerator } from "./providers/AssetGenerator.js";
import type { ObjectPropertyEstimator } from "./providers/ObjectPropertyEstimator.js";
import { LocalAssetProvider } from "./providers/LocalAssetProvider.js";
import { MeshyProvider } from "./providers/MeshyProvider.js";
import { OpenAIObjectPropertyEstimator } from "./providers/OpenAIObjectPropertyEstimator.js";
import { UnavailableAssetGenerator } from "./providers/UnavailableAssetGenerator.js";
import { registerCommandRoutes } from "./routes/command.js";
import { registerEstimateObjectRoutes } from "./routes/estimateObject.js";
import { registerFallbackAssetRoutes } from "./routes/fallbackAssets.js";
import { registerGenerateAssetRoutes } from "./routes/generateAsset.js";
import { registerGeneratedAssetModelRoutes } from "./routes/generatedAssetModel.js";
import { registerGeneratedAssetStatusRoutes } from "./routes/generatedAssetStatus.js";
import { AssetGenerationService } from "./services/assetGenerationService.js";
import { GeneratedAssetCache } from "./services/generatedAssetCache.js";
import { LocalObjectPropertyEstimator } from "./services/localObjectPropertyEstimator.js";
import { MeshyTaskStore } from "./services/meshyTaskStore.js";

export type AppOptions = {
  assetGenerator?: AssetGenerator;
  objectEstimator?: ObjectPropertyEstimator;
  publicBaseUrl?: string;
};

export const createApp = async (options: AppOptions = {}) => {
  const config = loadConfig();
  const app = Fastify({ logger: false });
  const assetGenerator = options.assetGenerator ?? createDefaultAssetGenerator();
  const objectEstimator = options.objectEstimator ?? createDefaultObjectEstimator();
  const localAssetProvider = new LocalAssetProvider(
    options.publicBaseUrl ?? config.publicBaseUrl
  );
  const assetGenerationService = new AssetGenerationService(
    assetGenerator,
    localAssetProvider,
    new MeshyTaskStore(),
    new GeneratedAssetCache(config.generatedAssetStorageDir)
  );

  await app.register(cors, {
    origin: true
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

  await app.register(registerFallbackAssetRoutes);
  await app.register(registerCommandRoutes);
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

  if (!config.openAiApiKey) {
    return new LocalObjectPropertyEstimator();
  }

  return new OpenAIObjectPropertyEstimator({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    baseUrl: config.openAiBaseUrl
  });
};
