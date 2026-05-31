import { createApp } from "./app.js";
import { loadConfig, loadEnvFile } from "./config.js";

loadEnvFile();
const config = loadConfig();
const app = await createApp();

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`Backend listening on http://${config.host}:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
