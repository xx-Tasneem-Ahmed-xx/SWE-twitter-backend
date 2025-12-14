const path = require("node:path");
const dotenv = require("dotenv");

module.exports = {
  apps: [
    {
      name: "server",
      script: path.join("dist", "index.js"),
      instances: 1,
      exec_mode: "fork",
      watch: false,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "development",
        ...dotenv.config({ path: path.resolve(__dirname, ".env") }).parsed,
      },
      env_production: {
        NODE_ENV: "production",
        ...dotenv.config({ path: path.resolve(__dirname, ".env.production") }).parsed,
      },
    },
    ...[
      { name: "worker-hashtags", file: "hashtags.js" },
      { name: "worker-trends", file: "trends.js" },
      { name: "worker-notifications", file: "notifications.js" },
      { name: "worker-emails", file: "Email.js" },
      { name: "worker-search-indexer", file: "searchIndexer.js" },
      { name: "worker-search-chat", file: "chatSearchWorker.js" },
      // add more workers here
    ].map((worker) => ({
      name: worker.name,
      script: path.join("dist", "background", "workers", worker.file),
      instances: 1,
      exec_mode: "fork",
      watch: false,
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
