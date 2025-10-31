import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: 1,
  detectOpenHandles: true,
  automock: false,
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^src/docs/(.*)$': '<rootDir>/__mocks__/src/docs/$1', // 👈 add this line
},

};

export default config;
