const path = require("path");
const dotenv = require("dotenv");

module.exports = {
  apps: [
    // -------------------------
    // MAIN SERVER
    // -------------------------
    {
      name: "server",
      script: "dist/index.js", // COMPILED SERVER
      instances: 1,
      exec_mode: "fork",
      watch: false,
      interpreter: "node",
      env: {
        NODE_ENV: "development",
        ...dotenv.config({ path: path.resolve(__dirname, ".env") }).parsed,
      },
      env_production: {
        NODE_ENV: "production",
        ...dotenv.config({ path: path.resolve(__dirname, ".env.production") }).parsed,
      },
    },

    // -------------------------
    // BACKGROUND WORKERS
    // -------------------------
    ...[
      { name: "worker-hashtags", file: "hashtags.js" },
      { name: "worker-trends", file: "trends.js" },
      { name: "worker-notifications", file: "notifications.js" },
      { name: "worker-emails", file: "Email.js" },
    ].map((worker) => ({
      name: worker.name,
      script: path.join("dist", "background", "workers", worker.file), // COMPILED WORKERS
      instances: 1,
      exec_mode: "fork",
      watch: false,
      interpreter: "node",
      env: {
        NODE_ENV: "development",
        ...dotenv.config({ path: path.resolve(__dirname, ".env") }).parsed,
      },
      env_production: {
        NODE_ENV: "production",
        ...dotenv.config({ path: path.resolve(__dirname, ".env.production") }).parsed,
      },
    })),
  ],
};
