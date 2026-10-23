const { env } = require("./config/env");
const { createApp } = require("./app");
const { logger } = require("./lib/logger");

const app = createApp();

// Bind to 0.0.0.0 (not 127.0.0.1) so CapRover's nginx can reach the app
// from outside the container.
app.listen(env.port, env.host, () => {
  logger.info(
    { port: env.port, host: env.host },
    `Lattente corriendo en http://localhost:${env.port}`
  );
});
