const path = require("path");
const dotenv = require("dotenv");

module.exports = {
  apps: [
    {
      name: "server",
      script: path.join("src", "index.ts"),
      interpreter: "node",
      interpreter_args: "-r ts-node/register -r tsconfig-paths/register",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "development",
        TS_NODE_PROJECT: path.resolve(__dirname, "tsconfig.json"),
        ...dotenv.config({ path: path.resolve(__dirname, ".env") }).parsed,
      },
      env_production: {
        NODE_ENV: "production",
        TS_NODE_PROJECT: path.resolve(__dirname, "tsconfig.json"),
        ...dotenv.config({ path: path.resolve(__dirname, ".env.production") })
          .parsed,
      },
    },
    ...[
      { name: "worker-hashtags", file: "hashtags.ts" },
      { name: "worker-trends", file: "trends.ts" },
      { name: "worker-notifications", file: "notifications.ts" },
      { name: "worker-emails", file: "Email.ts" },
      { name: "worker-search-indexer", file: "searchIndexer.ts" },
       { name: "worker-search-chat", file: "chatSearchWorker.ts" },
    ].map((worker) => ({
      name: worker.name,
      script: path.join("src", "background", "workers", worker.file),
      interpreter: "node",
      interpreter_args: "-r ts-node/register -r tsconfig-paths/register",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "development",
        TS_NODE_PROJECT: path.resolve(__dirname, "tsconfig.json"),
        ...dotenv.config({ path: path.resolve(__dirname, ".env") }).parsed,
      },
      env_production: {
        NODE_ENV: "production",
        TS_NODE_PROJECT: path.resolve(__dirname, "tsconfig.json"),
        ...dotenv.config({ path: path.resolve(__dirname, ".env.production") })
          .parsed,
      },
    })),
  ],
};