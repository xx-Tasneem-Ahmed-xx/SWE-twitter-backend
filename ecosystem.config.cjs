const path = require("node:path");
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
      { name: "worker-hashtags", file: "hashtags.js" },
      { name: "worker-trends", file: "trends.js" },
      { name: "worker-explore", file: "explore.js" },
      { name: "worker-notifications", file: "notifications.js" },
      { name: "worker-emails", file: "Email.js" },
      { name: "worker-search-indexer", file: "searchIndexer.js" },
       { name: "worker-search-chat", file: "chatSearchWorker.js" },
      // add more workers here
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