import type { BackgroundImageRequest, BackgroundImageResponse } from "../schemas.js";

export interface BackgroundImageGenerator {
  generate(input: BackgroundImageRequest): Promise<BackgroundImageResponse>;
}
