import { HttpError } from "../errors.js";
import type { BackgroundImageRequest, BackgroundImageResponse } from "../schemas.js";
import type { BackgroundImageGenerator } from "./BackgroundImageGenerator.js";

export class UnavailableBackgroundImageGenerator implements BackgroundImageGenerator {
  async generate(_input: BackgroundImageRequest): Promise<BackgroundImageResponse> {
    throw new HttpError(
      503,
      "BackgroundImageProviderUnavailable",
      "Gemini background image generation requires GEMINI_API_KEY."
    );
  }
}
