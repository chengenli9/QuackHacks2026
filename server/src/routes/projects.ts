import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { z } from "zod";
import { HttpError } from "../errors.js";

const projectSnapshotSchema = z.object({
  version: z.number().int().positive(),
  savedAt: z.string().min(1),
  project: z.record(z.string(), z.unknown())
});

export const registerProjectRoutes = (
  app: FastifyInstance,
  projectStorageDir: string,
  publicBaseUrl = "http://localhost:8787"
) => {
  const projectDir = join(projectStorageDir, "last-project");
  const projectPath = join(projectDir, "project.json");
  const legacyProjectPath = join(projectStorageDir, "last-project.json");
  const assetDir = join(projectDir, "assets");
  const backgroundDir = join(projectDir, "backgrounds");

  app.get("/api/projects/last", async () => {
    try {
      const contents = await readFileProject(projectPath, legacyProjectPath);
      return projectSnapshotSchema.parse(JSON.parse(contents));
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new HttpError(404, "ProjectNotFound", "No saved project was found.");
      }
      throw error;
    }
  });

  app.put("/api/projects/last", async (request) => {
    const snapshot = projectSnapshotSchema.parse(request.body);
    const bundled = await bundleProjectSnapshot(snapshot, {
      projectDir,
      assetDir,
      backgroundDir,
      publicBaseUrl
    });
    await mkdir(projectDir, { recursive: true });
    await writeFile(projectPath, `${JSON.stringify(bundled, null, 2)}\n`, "utf8");
    return { ok: true, savedAt: bundled.savedAt };
  });

  app.get<{ Params: { file: string } }>("/api/projects/last/assets/:file", async (request, reply) => {
    const file = safeStoredFileName(request.params.file, ".glb");
    const path = join(assetDir, file);
    if (!existsSync(path)) {
      throw new HttpError(404, "ProjectAssetNotFound", "Saved project asset was not found.");
    }
    return reply.type("model/gltf-binary").send(createReadStream(path));
  });

  app.get<{ Params: { file: string } }>("/api/projects/last/backgrounds/:file", async (request, reply) => {
    const file = safeStoredFileName(request.params.file);
    const path = join(backgroundDir, file);
    if (!existsSync(path)) {
      throw new HttpError(404, "ProjectAssetNotFound", "Saved project background was not found.");
    }
    return reply.type(imageMimeTypeFor(file)).send(createReadStream(path));
  });
};

async function readFileProject(projectPath: string, legacyProjectPath: string) {
  try {
    return await readFile(projectPath, "utf8");
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
    return readFile(legacyProjectPath, "utf8");
  }
}

async function bundleProjectSnapshot(
  snapshot: z.infer<typeof projectSnapshotSchema>,
  options: {
    projectDir: string;
    assetDir: string;
    backgroundDir: string;
    publicBaseUrl: string;
  }
) {
  const project = { ...(snapshot.project as Record<string, unknown>) };
  project.assetSources = await bundleAssetSources(project.assetSources, options);
  project.sceneBackground = await bundleBackground(project.sceneBackground, "scene_background", options);
  project.backgroundGallery = await bundleBackgroundGallery(project.backgroundGallery, options);

  return {
    ...snapshot,
    project
  };
}

async function bundleAssetSources(
  assetSources: unknown,
  options: { assetDir: string; publicBaseUrl: string }
) {
  if (!Array.isArray(assetSources)) return assetSources;

  await mkdir(options.assetDir, { recursive: true });

  return Promise.all(
    assetSources.map(async (asset) => {
      if (!isRecord(asset) || asset.type !== "data-url" || typeof asset.dataUrl !== "string") {
        return asset;
      }

      const fileName = `${safeBaseName(String(asset.id ?? "asset"))}.glb`;
      const parsed = parseDataUrl(asset.dataUrl);
      await writeFile(join(options.assetDir, fileName), parsed.bytes);

      const next = { ...asset };
      delete next.dataUrl;
      return {
        ...next,
        type: "url",
        url: `${trimBaseUrl(options.publicBaseUrl)}/api/projects/last/assets/${fileName}`
      };
    })
  );
}

async function bundleBackgroundGallery(
  backgroundGallery: unknown,
  options: { backgroundDir: string; publicBaseUrl: string }
) {
  if (!Array.isArray(backgroundGallery)) return backgroundGallery;

  const bundled = [];
  for (let index = 0; index < backgroundGallery.length; index += 1) {
    bundled.push(await bundleBackground(backgroundGallery[index], `background_${index + 1}`, options));
  }
  return bundled;
}

async function bundleBackground(
  background: unknown,
  fallbackId: string,
  options: { backgroundDir: string; publicBaseUrl: string }
) {
  if (!isRecord(background) || typeof background.imageDataUrl !== "string") {
    return background;
  }

  if (!background.imageDataUrl.startsWith("data:image/")) {
    return background;
  }

  await mkdir(options.backgroundDir, { recursive: true });
  const parsed = parseDataUrl(background.imageDataUrl);
  const extension = imageExtensionForMime(parsed.mimeType);
  const fileName = `${safeBaseName(String(background.id ?? fallbackId))}.${extension}`;
  await writeFile(join(options.backgroundDir, fileName), parsed.bytes);

  return {
    ...background,
    imageDataUrl: `${trimBaseUrl(options.publicBaseUrl)}/api/projects/last/backgrounds/${fileName}`
  };
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/);
  if (!match) {
    throw new HttpError(400, "InvalidDataUrl", "Saved project contains an invalid data URL.");
  }

  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64")
  };
}

function safeStoredFileName(file: string, requiredExtension?: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(file)) {
    throw new HttpError(404, "ProjectAssetNotFound", "Unknown project asset.");
  }

  if (requiredExtension && extname(file).toLowerCase() !== requiredExtension) {
    throw new HttpError(404, "ProjectAssetNotFound", "Unknown project asset.");
  }

  return file;
}

function safeBaseName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "asset";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function imageExtensionForMime(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function imageMimeTypeFor(file: string) {
  const extension = extname(file).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

function trimBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function isMissingFileError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
  );
}
