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
  type?: string;
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
  private readonly refineTaskByPreviewTaskId = new Map<string, string>();
  private readonly sourcePromptByPreviewTaskId = new Map<string, string>();

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

    this.sourcePromptByPreviewTaskId.set(response.result, this.promptForMeshy(input));

    return assetGenerationTaskSchema.parse({
      taskId: response.result,
      provider: "meshy",
      status: "queued"
    });
  }

  async getTask(taskId: string): Promise<AssetGenerationTaskStatus> {
    const refineTaskId = this.refineTaskByPreviewTaskId.get(taskId);

    if (refineTaskId) {
      const refineTask = await this.retrieveTask(refineTaskId);
      const refineStatus = this.normalizeRefineStatus(refineTask);
      return assetGenerationTaskStatusSchema.parse({
        taskId,
        status: refineStatus,
        progress: this.refineProgress(refineTask.progress),
        modelUrl: refineStatus === "succeeded" ? refineTask.model_urls?.glb : undefined,
        error: refineTask.task_error?.message || undefined
      });
    }

    const task = await this.retrieveTask(taskId);
    const previewStatus = this.normalizeStatus(task.status);

    if (previewStatus !== "succeeded") {
      return assetGenerationTaskStatusSchema.parse({
        taskId: task.id,
        status: previewStatus,
        progress: this.previewProgress(task.progress),
        modelUrl: undefined,
        error: task.task_error?.message || undefined
      });
    }

    const createdRefineTaskId = await this.createRefineTask(taskId, task.prompt ?? taskId);
    this.refineTaskByPreviewTaskId.set(taskId, createdRefineTaskId);

    return assetGenerationTaskStatusSchema.parse({
      taskId,
      status: "running",
      progress: 50
    });
  }

  async getModel(taskId: string): Promise<GeneratedAsset> {
    const refineTaskId = this.refineTaskByPreviewTaskId.get(taskId);

    if (!refineTaskId) {
      throw new HttpError(
        409,
        "GeneratedAssetNotReady",
        `Meshy task ${taskId} has no textured refine task yet`
      );
    }

    const task = await this.retrieveTask(refineTaskId);
    const glbUrl = task.model_urls?.glb;

    if (!glbUrl) {
      throw new HttpError(
        409,
        "GeneratedAssetNotReady",
        `Meshy task ${taskId} has no GLB URL yet`
      );
    }

    return generatedAssetSchema.parse({
      id: taskId,
      provider: "meshy",
      sourcePrompt: this.sourcePromptByPreviewTaskId.get(taskId) ?? task.prompt ?? taskId,
      glbUrl,
      thumbnailUrl: task.thumbnail_url,
      metadata: {
        meshyStatus: task.status ?? "UNKNOWN",
        meshyStage: "refine",
        previewTaskId: taskId,
        refineTaskId,
        textured: true,
        pbr: false
      }
    });
  }

  private async retrieveTask(taskId: string): Promise<MeshyTask> {
    return this.requestJson<MeshyTask>(`/openapi/v2/text-to-3d/${encodeURIComponent(taskId)}`, {
      method: "GET"
    });
  }

  private async createRefineTask(previewTaskId: string, prompt: string): Promise<string> {
    const response = await this.requestJson<{ result?: string }>("/openapi/v2/text-to-3d", {
      method: "POST",
      body: JSON.stringify(this.refineRequestBody(previewTaskId, prompt))
    });

    if (!response.result) {
      throw new HttpError(502, "MeshyInvalidResponse", "Meshy did not return a refine task id");
    }

    return response.result;
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
      ai_model: "latest",
      prompt: this.promptForMeshy(input),
      ...(input.style === "lowpoly" ? { model_type: "lowpoly" } : {}),
      target_formats: ["glb"]
    };
  }

  private refineRequestBody(previewTaskId: string, prompt: string) {
    return {
      mode: "refine",
      ai_model: "latest",
      preview_task_id: previewTaskId,
      texture_prompt: prompt,
      enable_pbr: false,
      hd_texture: false,
      remove_lighting: true,
      target_formats: ["glb"],
      auto_size: true,
      origin_at: "bottom"
    };
  }

  private previewProgress(progress: number | undefined): number | undefined {
    return typeof progress === "number" ? Math.min(50, Math.round(progress * 0.5)) : undefined;
  }

  private refineProgress(progress: number | undefined): number | undefined {
    return typeof progress === "number" ? 50 + Math.round(progress * 0.5) : undefined;
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

  private normalizeRefineStatus(task: MeshyTask): AssetGenerationTaskStatus["status"] {
    const status = this.normalizeStatus(task.status);
    if (status === "succeeded" && !task.model_urls?.glb) {
      return "running";
    }
    return status;
  }
}
