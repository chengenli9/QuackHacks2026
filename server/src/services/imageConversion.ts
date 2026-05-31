import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { HttpError } from "../errors.js";

export type ImageConversionInput = {
  bytes: Buffer;
  fileName?: string;
  mimeType?: string;
};

export type ImageConverter = (input: ImageConversionInput) => Promise<Buffer>;

export const convertImageToJpeg: ImageConverter = async ({ bytes, fileName, mimeType }) => {
  const tempDir = await mkdtemp(join(tmpdir(), "roomcraft-image-"));
  const inputPath = join(tempDir, `input${inputExtension(fileName, mimeType)}`);
  const outputPath = join(tempDir, "output.jpg");

  try {
    await writeFile(inputPath, bytes);
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outputPath
    ]);
    return await readFile(outputPath);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      "ImageConversionFailed",
      error instanceof Error ? error.message : "Could not convert image to JPEG."
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      reject(new HttpError(500, "FfmpegUnavailable", error.message));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new HttpError(
        400,
        "ImageConversionFailed",
        stderr.trim() || `ffmpeg exited with code ${code}`
      ));
    });
  });
}

function inputExtension(fileName?: string, mimeType?: string) {
  const ext = safeExtension(fileName);
  if (ext) return ext;

  switch (mimeType?.toLowerCase()) {
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    case "image/tiff":
      return ".tiff";
    case "image/bmp":
      return ".bmp";
    case "image/avif":
      return ".avif";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/jpeg":
      return ".jpg";
    default:
      return ".img";
  }
}

function safeExtension(fileName?: string) {
  const name = basename(fileName ?? "");
  const ext = extname(name).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(ext) ? ext : "";
}
