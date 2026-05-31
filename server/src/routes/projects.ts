import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { z } from "zod";
import { HttpError } from "../errors.js";

const projectSnapshotSchema = z.object({
  version: z.number().int().positive(),
  savedAt: z.string().min(1),
  project: z.record(z.string(), z.unknown())
});

const projectIdParamsSchema = z.object({
  projectId: z.string().trim().min(1)
});

export const registerProjectRoutes = (
  app: FastifyInstance,
  projectStorageDir: string,
  publicBaseUrl = "http://localhost:8787"
) => {
  const legacyProjectPath = join(projectStorageDir, "last-project.json");

  app.get("/api/projects", async () => {
    await mkdir(projectStorageDir, { recursive: true });
    const entries = await readdir(projectStorageDir, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = safeProjectId(entry.name);
      const projectPath = pathForProject(id).projectPath;
      try {
        const snapshot = projectSnapshotSchema.parse(JSON.parse(await readFile(projectPath, "utf8")));
        const project = snapshot.project as Record<string, unknown>;
        const stats = await stat(projectPath);
        projects.push({
          id,
          name: typeof project.projectName === "string" ? project.projectName : readableProjectName(id),
          savedAt: snapshot.savedAt,
          updatedAt: stats.mtime.toISOString(),
          importedGlbFileName: project.importedGlbFileName ?? null,
          objectCount: Array.isArray(project.sceneObjects) ? project.sceneObjects.length : 0
        });
      } catch (error) {
        if (!isMissingFileError(error)) throw error;
      }
    }

    return { projects: projects.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) };
  });

  app.get("/api/projects/last", async () => {
    return loadProject("last-project", legacyProjectPath);
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId", async (request) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);
    return loadProject(projectId);
  });

  app.put("/api/projects/last", async (request) => {
    return saveProject("last-project", request.body);
  });

  app.put<{ Params: { projectId: string } }>("/api/projects/:projectId", async (request) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);
    return saveProject(projectId, request.body);
  });

  app.get<{ Params: { projectId: string; file: string } }>(
    "/api/projects/:projectId/assets/:file",
    async (request, reply) => {
      const { projectId } = projectIdParamsSchema.parse(request.params);
      const file = safeStoredFileName(request.params.file, ".glb");
      const path = join(pathForProject(projectId).assetDir, file);
      if (!existsSync(path)) {
        throw new HttpError(404, "ProjectAssetNotFound", "Saved project asset was not found.");
      }
      return reply.type("model/gltf-binary").send(createReadStream(path));
    }
  );

  app.get<{ Params: { projectId: string; file: string } }>(
    "/api/projects/:projectId/backgrounds/:file",
    async (request, reply) => {
      const { projectId } = projectIdParamsSchema.parse(request.params);
      const file = safeStoredFileName(request.params.file);
      const path = join(pathForProject(projectId).backgroundDir, file);
      if (!existsSync(path)) {
        throw new HttpError(404, "ProjectAssetNotFound", "Saved project background was not found.");
      }
      return reply.type(imageMimeTypeFor(file)).send(createReadStream(path));
    }
  );

  function pathForProject(rawProjectId: string) {
    const projectId = safeProjectId(rawProjectId);
    const projectDir = join(projectStorageDir, projectId);
    return {
      projectId,
      projectDir,
      projectPath: join(projectDir, "project.json"),
      assetDir: join(projectDir, "assets"),
      backgroundDir: join(projectDir, "backgrounds")
    };
  }

  async function loadProject(rawProjectId: string, fallbackPath?: string) {
    const paths = pathForProject(rawProjectId);
    try {
      const contents = fallbackPath
        ? await readFileProject(paths.projectPath, fallbackPath)
        : await readFile(paths.projectPath, "utf8");
      return projectSnapshotSchema.parse(JSON.parse(contents));
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new HttpError(404, "ProjectNotFound", "No saved project was found.");
      }
      throw error;
    }
  }

  async function saveProject(rawProjectId: string, body: unknown) {
    const paths = pathForProject(rawProjectId);
    const snapshot = projectSnapshotSchema.parse(body);
    const bundled = await bundleProjectSnapshot(snapshot, {
      projectId: paths.projectId,
      projectDir: paths.projectDir,
      assetDir: paths.assetDir,
      backgroundDir: paths.backgroundDir,
      publicBaseUrl
    });
    await mkdir(paths.projectDir, { recursive: true });
    await writeFile(paths.projectPath, `${JSON.stringify(bundled, null, 2)}\n`, "utf8");
    return { ok: true, projectId: paths.projectId, savedAt: bundled.savedAt };
  }
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
    projectId: string;
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
  options: { projectId: string; assetDir: string; publicBaseUrl: string }
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
        url: `${trimBaseUrl(options.publicBaseUrl)}/api/projects/${options.projectId}/assets/${fileName}`
      };
    })
  );
}

async function bundleBackgroundGallery(
  backgroundGallery: unknown,
  options: { projectId: string; backgroundDir: string; publicBaseUrl: string }
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
  options: { projectId: string; backgroundDir: string; publicBaseUrl: string }
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
    imageDataUrl: `${trimBaseUrl(options.publicBaseUrl)}/api/projects/${options.projectId}/backgrounds/${fileName}`
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

function safeProjectId(value: string) {
  return safeBaseName(value) || "project";
}

function readableProjectName(projectId: string) {
  if (projectId === "last-project") return "Last Project";
  return projectId
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
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
