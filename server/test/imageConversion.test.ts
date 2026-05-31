import { describe, expect, it, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";

describe("image conversion API", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it("converts uploaded image bytes to jpeg through the configured converter", async () => {
    let captured:
      | { bytes: Buffer; fileName?: string; mimeType?: string }
      | undefined;
    app = await createApp({
      imageConverter: async (input) => {
        captured = input;
        return Buffer.from("jpeg-bytes");
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/convert-image/jpeg",
      headers: {
        "content-type": "image/heic",
        "x-file-name": encodeURIComponent("Living Room.HEIC")
      },
      payload: Buffer.from("heic-bytes")
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/jpeg");
    expect(response.body).toBe("jpeg-bytes");
    expect(captured).toEqual({
      bytes: Buffer.from("heic-bytes"),
      fileName: "Living Room.HEIC",
      mimeType: "image/heic"
    });
  });

  it("returns a typed 400 for empty conversion uploads", async () => {
    app = await createApp({
      imageConverter: async () => Buffer.from("should-not-run")
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/convert-image/jpeg",
      headers: { "content-type": "image/heic" },
      payload: Buffer.alloc(0)
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "ImageConversionInputMissing" });
  });
});
