import type {
  AssetGenerationTask,
  AssetGenerationTaskStatus,
  GeneratedAsset,
  TextAssetGenerationInput
} from "../schemas.js";

export type {
  AssetGenerationTask,
  AssetGenerationTaskStatus,
  GeneratedAsset,
  TextAssetGenerationInput
};

export interface AssetGenerator {
  generateFromText(input: TextAssetGenerationInput): Promise<AssetGenerationTask>;
  getTask(taskId: string): Promise<AssetGenerationTaskStatus>;
  getModel(taskId: string): Promise<GeneratedAsset>;
}
