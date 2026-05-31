import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.js";
import { convertImageToJpeg } from "../services/imageConversion.js";
import type { ImageConverter } from "../services/imageConversion.js";

export const registerImageConversionRoutes = (
  app: FastifyInstance,
  imageConverter: ImageConverter = convertImageToJpeg
) => {
  app.addContentTypeParser(/^image\/[\w.+-]+$/i, { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  app.post("/api/convert-image/jpeg", async (request, reply) => {
    const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.from([]);
    if (bytes.length === 0) {
      throw new HttpError(
        400,
        "ImageConversionInputMissing",
        "Upload an image file to convert it to JPEG."
      );
    }

    const converted = await imageConverter({
      bytes,
      fileName: headerValue(request.headers["x-file-name"], { decode: true }),
      mimeType: headerValue(request.headers["content-type"])
    });

    return reply.type("image/jpeg").send(converted);
  });
};

function headerValue(value: string | string[] | undefined, options: { decode?: boolean } = {}) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  if (!options.decode) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
