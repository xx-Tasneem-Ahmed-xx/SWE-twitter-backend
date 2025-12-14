import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/tests/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/tests/**",
    "!**/prisma/**",
    "!src/api/**",
    "!src/background/**",
    "!src/types/**",
    "!src/__mocks__/**",
    "!src/docs/**",
    "!src/config/**",
    "!src/index.ts",
    "!src/database.ts",
    "!src/application/services/secrets.ts",
    "!src/application/services/aiSummary.ts",
  ],

  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/prisma/",
    ".test.ts",
    "/tests/",
    "/api/",
    "/application/services/secrets.ts",
    "/application/services/aiSummary.ts",
    "/background/",
    "/docs/",
    "/config/",
    "/types/",
    "/__mocks__/",
    "/index.ts",
    "/database.ts",
  ],

  verbose: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: 1,
  detectOpenHandles: true,
  automock: false,

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^src/docs/(.*)$": "<rootDir>/__mocks__/src/docs/$1",
    "^firebase-admin$": "<rootDir>/src/__mocks__/firebase-admin.ts",
  },
};

export default config;
