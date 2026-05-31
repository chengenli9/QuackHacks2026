import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  loadConfig,
  loadEnvFile
} from "../src/config.js";

describe("server config", () => {
  it("defaults Gemini to 3.5 Flash", () => {
    expect(loadConfig({}).geminiModel).toBe(DEFAULT_GEMINI_MODEL);
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash");
  });

  it("loads server .env values without overwriting existing process env", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "quackhacks-env-"));
    const envPath = join(tempDir, ".env");
    const env: NodeJS.ProcessEnv = {
      GEMINI_API_KEY: "existing-key"
    };

    try {
      writeFileSync(
        envPath,
        [
          "GEMINI_API_KEY=file-key",
          "GEMINI_MODEL=gemini-3.5-flash",
          "MESHY_API_KEY='meshy-key'"
        ].join("\n")
      );

      expect(loadEnvFile(envPath, env)).toBe(true);
      expect(env.GEMINI_API_KEY).toBe("existing-key");
      expect(env.GEMINI_MODEL).toBe("gemini-3.5-flash");
      expect(env.MESHY_API_KEY).toBe("meshy-key");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
