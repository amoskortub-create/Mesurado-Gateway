import app from "./app";
import { logger } from "./lib/logger";
import { validateCoreUrl } from "./lib/core-url";

// Validate MESURADO_CORE_URL scheme before accepting traffic.
// Throws in production if the endpoint is not HTTPS (master token exposure).
validateCoreUrl();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
