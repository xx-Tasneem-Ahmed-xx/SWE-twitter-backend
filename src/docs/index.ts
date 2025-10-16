import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { registerTweetDocs } from "./tweets";
import { registerUserInteractionsDocs } from "./userInteractions";
import { registerChatDocs } from "./chats";
import { registerMediaDocs } from "./media";
import { registerUserDocs } from "@/docs/users";

const registry = new OpenAPIRegistry();
registerTweetDocs(registry);
registerUserInteractionsDocs(registry);
registerUserDocs(registry);

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "Enter your JWT token in the format: **Bearer &lt;your_token&gt;**",
});
registerChatDocs(registry);
registerMediaDocs(registry);

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
  security: [
    {
      bearerAuth: [],
    },
  ],
});
