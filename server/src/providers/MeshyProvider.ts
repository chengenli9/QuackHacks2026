import { HttpError, errorMessage } from "../errors.js";
import {
  assetGenerationTaskSchema,
  assetGenerationTaskStatusSchema,
  generatedAssetSchema
} from "../schemas.js";
import type {
  AssetGenerationTask,
  AssetGenerationTaskStatus,
  AssetGenerator,
  GeneratedAsset,
  TextAssetGenerationInput
} from "./AssetGenerator.js";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type MeshyProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

type MeshyTask = {
  id: string;
  status?: string;
  progress?: number;
  prompt?: string;
  thumbnail_url?: string;
  model_urls?: {
    glb?: string;
  };
  task_error?: {
    message?: string;
  };
};

export class MeshyProvider implements AssetGenerator {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetch: FetchLike;

  constructor(options: MeshyProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("MeshyProvider requires a non-empty API key");
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.meshy.ai").replace(/\/+$/, "");
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async generateFromText(
    input: TextAssetGenerationInput
  ): Promise<AssetGenerationTask> {
    const response = await this.requestJson<{ result?: string }>("/openapi/v2/text-to-3d", {
      method: "POST",
      body: JSON.stringify(this.previewRequestBody(input))
    });

    if (!response.result) {
      throw new HttpError(502, "MeshyInvalidResponse", "Meshy did not return a task id");
    }

    return assetGenerationTaskSchema.parse({
      taskId: response.result,
      provider: "meshy",
      status: "queued"
    });
  }

  async getTask(taskId: string): Promise<AssetGenerationTaskStatus> {
    const task = await this.retrieveTask(taskId);

    return assetGenerationTaskStatusSchema.parse({
      taskId: task.id,
      status: this.normalizeStatus(task.status),
      progress: task.progress,
      modelUrl: task.model_urls?.glb,
      error: task.task_error?.message || undefined
    });
  }

  async getModel(taskId: string): Promise<GeneratedAsset> {
    const task = await this.retrieveTask(taskId);
    const glbUrl = task.model_urls?.glb;

    if (!glbUrl) {
      throw new HttpError(
        409,
        "GeneratedAssetNotReady",
        `Meshy task ${taskId} has no GLB URL yet`
      );
    }

    return generatedAssetSchema.parse({
      id: task.id,
      provider: "meshy",
      sourcePrompt: task.prompt ?? taskId,
      glbUrl,
      thumbnailUrl: task.thumbnail_url,
      metadata: {
        meshyStatus: task.status ?? "UNKNOWN"
      }
    });
  }

  private async retrieveTask(taskId: string): Promise<MeshyTask> {
    return this.requestJson<MeshyTask>(`/openapi/v2/text-to-3d/${encodeURIComponent(taskId)}`, {
      method: "GET"
    });
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });

    const body = await this.readBody(response);

    if (!response.ok) {
      const message =
        typeof body === "object" && body !== null && "message" in body
          ? String(body.message)
          : response.statusText;
      throw new HttpError(
        response.status,
        "MeshyRequestFailed",
        `Meshy request failed with status ${response.status}: ${message}`,
        body
      );
    }

    return body as T;
  }

  private async readBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new HttpError(
        502,
        "MeshyInvalidJson",
        `Meshy returned invalid JSON: ${errorMessage(error)}`
      );
    }
  }

  private promptForMeshy(input: TextAssetGenerationInput): string {
    const prompt = input.assetType === "environment_scene"
      ? `${input.prompt}, complete 3D environment scene, cohesive floor and room-scale props`
      : input.prompt;

    if (!input.style || input.style === "lowpoly") {
      return prompt;
    }

    return `${prompt}, ${input.style} style`;
  }

  private previewRequestBody(input: TextAssetGenerationInput) {
    return {
      mode: "preview",
      prompt: this.promptForMeshy(input),
      ...(input.style === "lowpoly" ? { model_type: "lowpoly" } : {}),
      target_formats: ["glb"]
    };
  }

  private normalizeStatus(status: string | undefined): AssetGenerationTaskStatus["status"] {
    switch (status) {
      case "PENDING":
        return "queued";
      case "IN_PROGRESS":
        return "running";
      case "SUCCEEDED":
        return "succeeded";
      case "FAILED":
      case "CANCELED":
        return "failed";
      default:
        return "running";
    }
  }
}
