import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { HttpError } from "../errors.js";

const projectSnapshotSchema = z.object({
  version: z.number().int().positive(),
  savedAt: z.string().min(1),
  project: z.record(z.string(), z.unknown())
});

export const registerProjectRoutes = (
  app: FastifyInstance,
  projectStorageDir: string
) => {
  const projectPath = join(projectStorageDir, "last-project.json");

  app.get("/api/projects/last", async () => {
    try {
      const contents = await readFile(projectPath, "utf8");
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
    await mkdir(projectStorageDir, { recursive: true });
    await writeFile(projectPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    return { ok: true, savedAt: snapshot.savedAt };
  });
};

function isMissingFileError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
  );
}
