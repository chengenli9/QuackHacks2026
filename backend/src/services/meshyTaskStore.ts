import type {
  AssetGenerationTask,
  AssetGenerationTaskStatus,
  GeneratedAsset,
  TextAssetGenerationInput
} from "../schemas.js";

export type MeshyTaskRecord = {
  taskId: string;
  provider: "meshy";
  sourcePrompt: string;
  request: TextAssetGenerationInput;
  status: AssetGenerationTaskStatus["status"];
  progress?: number;
  modelUrl?: string;
  error?: string;
  generatedAsset?: GeneratedAsset;
  createdAt: string;
  updatedAt: string;
};

export class MeshyTaskStore {
  private readonly records = new Map<string, MeshyTaskRecord>();

  create(request: TextAssetGenerationInput, task: AssetGenerationTask): MeshyTaskRecord {
    const timestamp = new Date().toISOString();
    const record: MeshyTaskRecord = {
      taskId: task.taskId,
      provider: task.provider,
      sourcePrompt: request.prompt,
      request,
      status: task.status,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.records.set(record.taskId, record);
    return record;
  }

  updateStatus(status: AssetGenerationTaskStatus): MeshyTaskRecord | undefined {
    const existing = this.records.get(status.taskId);

    if (!existing) {
      return undefined;
    }

    const updated: MeshyTaskRecord = {
      ...existing,
      status: status.status,
      progress: status.progress,
      modelUrl: status.modelUrl,
      error: status.error,
      updatedAt: new Date().toISOString()
    };

    this.records.set(status.taskId, updated);
    return updated;
  }

  updateGeneratedAsset(asset: GeneratedAsset): MeshyTaskRecord | undefined {
    const existing = this.records.get(asset.id);

    if (!existing) {
      return undefined;
    }

    const updated: MeshyTaskRecord = {
      ...existing,
      generatedAsset: asset,
      modelUrl: asset.glbUrl,
      updatedAt: new Date().toISOString()
    };

    this.records.set(asset.id, updated);
    return updated;
  }

  get(taskId: string): MeshyTaskRecord | undefined {
    return this.records.get(taskId);
  }
}
