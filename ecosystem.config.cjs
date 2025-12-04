// ecosystem.config.cjs
const path = require("path");
const dotenv = require("dotenv");

module.exports = {
  apps: [
    {
      name: "server",
      script: "src/index.ts",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      interpreter: "node",
      node_args: "-r ts-node/register -r tsconfig-paths/register",
      env: {
        NODE_ENV: "development",
        ...dotenv.config({ path: path.resolve(__dirname, ".env") }).parsed,
      },
      env_production: {
        NODE_ENV: "production",
        ...dotenv.config({ path: path.resolve(__dirname, ".env.production") })
          .parsed,
      },
    },
    ...[
      { name: "worker-hashtags", file: "hashtags.ts" },
      { name: "worker-trends", file: "trends.ts" },
      { name: "worker-notifications", file: "notifications.ts" },
      { name: "worker-emails", file: "Email.ts" },
    ].map((worker) => ({
      name: worker.name,
      script: path.join("src", "background", "workers", worker.file),
      instances: 1,
      exec_mode: "fork",
      watch: false,
      interpreter: "node",
      node_args: "-r ts-node/register -r tsconfig-paths/register",
      env: {
        NODE_ENV: "development",
        ...dotenv.config({ path: path.resolve(__dirname, ".env") }).parsed,
      },
      env_production: {
        NODE_ENV: "production",
        ...dotenv.config({ path: path.resolve(__dirname, ".env.production") })
          .parsed,
      },
    })),
  ],
};
