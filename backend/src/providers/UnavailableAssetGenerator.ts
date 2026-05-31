import { HttpError } from "../errors.js";
import type {
  AssetGenerationTask,
  AssetGenerationTaskStatus,
  AssetGenerator,
  GeneratedAsset,
  TextAssetGenerationInput
} from "./AssetGenerator.js";

export class UnavailableAssetGenerator implements AssetGenerator {
  async generateFromText(_input: TextAssetGenerationInput): Promise<AssetGenerationTask> {
    throw new HttpError(
      503,
      "MeshyUnavailable",
      "MESHY_API_KEY is required for live Meshy asset generation"
    );
  }

  async getTask(_taskId: string): Promise<AssetGenerationTaskStatus> {
    throw new HttpError(
      503,
      "MeshyUnavailable",
      "MESHY_API_KEY is required to retrieve Meshy task status"
    );
  }

  async getModel(_taskId: string): Promise<GeneratedAsset> {
    throw new HttpError(
      503,
      "MeshyUnavailable",
      "MESHY_API_KEY is required to retrieve generated Meshy models"
    );
  }
}
