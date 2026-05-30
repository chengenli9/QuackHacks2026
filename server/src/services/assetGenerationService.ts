import type { AssetGenerator } from "../providers/AssetGenerator.js";
import type { LocalAssetProvider } from "../providers/LocalAssetProvider.js";
import {
  assetGenerationTaskSchema,
  assetGenerationTaskStatusSchema,
  fallbackAssetRequestSchema,
  generatedAssetSchema,
  textAssetGenerationInputSchema
} from "../schemas.js";
import type {
  AssetGenerationTask,
  AssetGenerationTaskStatus,
  FallbackAssetRequest,
  GeneratedAsset,
  TextAssetGenerationInput
} from "../schemas.js";
import type { GeneratedAssetCache } from "./generatedAssetCache.js";
import type { MeshyTaskStore } from "./meshyTaskStore.js";

export class AssetGenerationService {
  constructor(
    private readonly assetGenerator: AssetGenerator,
    private readonly localAssetProvider: LocalAssetProvider,
    private readonly taskStore: MeshyTaskStore,
    private readonly generatedAssetCache: GeneratedAssetCache
  ) {}

  async generateFromText(input: TextAssetGenerationInput): Promise<AssetGenerationTask> {
    const request = textAssetGenerationInputSchema.parse(input);
    const task = assetGenerationTaskSchema.parse(
      await this.assetGenerator.generateFromText(request)
    );

    this.taskStore.create(request, task);
    return task;
  }

  async getTask(taskId: string): Promise<AssetGenerationTaskStatus> {
    const status = assetGenerationTaskStatusSchema.parse(
      await this.assetGenerator.getTask(taskId)
    );

    this.taskStore.updateStatus(status);
    return status;
  }

  async getModel(taskId: string): Promise<GeneratedAsset> {
    const cached = this.generatedAssetCache.get(taskId);

    if (cached) {
      return cached;
    }

    const asset = generatedAssetSchema.parse(await this.assetGenerator.getModel(taskId));
    this.generatedAssetCache.save(asset);
    this.taskStore.updateGeneratedAsset(asset);
    return asset;
  }

  getFallbackAsset(request: FallbackAssetRequest): GeneratedAsset {
    const input = fallbackAssetRequestSchema.parse(request);
    return this.generatedAssetCache.save(this.localAssetProvider.getFallbackAsset(input));
  }
}
