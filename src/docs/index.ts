import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { registerTweetDocs } from "./tweets";

const registry = new OpenAPIRegistry();
registerTweetDocs(registry);

export const generator = new OpenApiGeneratorV3(registry.definitions);

export const swaggerDoc = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "SWE Twitter Backend API",
    version: "1.0.0",
    description: "API documentation for the SWE Twitter backend project.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
});
