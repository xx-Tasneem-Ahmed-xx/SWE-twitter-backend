import path from "path";
import fs from "fs";
import swaggerJsdoc from "swagger-jsdoc";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

type OpenAPIObject = Record<string, any>;

import { registerTweetDocs } from "@/docs/tweets";
import { registerTimelineAndExploreDocs } from "@/docs/timelineAndExplore";
//import { registerTrendsDocs } from "./trends";
import { registerUserInteractionsDocs } from "@/docs/userInteractions";
import { registerHashtagAndTrendsDocs } from "./hashtags&trends";
import { registerChatDocs } from "@/docs/chats";
import { registerMediaDocs } from "@/docs/media";
import { registerUserDocs } from "@/docs/users";
import { registerNotificationDocs } from "@/docs/notification";

const registry = new OpenAPIRegistry();
registerTweetDocs(registry);
registerTimelineAndExploreDocs(registry);
registerUserInteractionsDocs(registry);
registerHashtagAndTrendsDocs(registry);
registerNotificationDocs(registry);
registerUserDocs(registry);
//registerTrendsDocs(registry);

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Enter your JWT token in the format: **Bearer <your_token>**",
});
registerChatDocs(registry);
registerMediaDocs(registry);

const generator = new OpenApiGeneratorV3(registry.definitions);

const zodDoc: OpenAPIObject = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "SWE Twitter Backend API",
    version: "1.0.0",
    description: "Combined documentation: Zod + Swagger JSDoc",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
  security: [{ bearerAuth: [] }],
});

const jsdocOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SWE Twitter Backend API",
      version: "1.0.0",
      description: "Docs generated from route annotations",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
  apis: [path.join(__dirname, "../api/routes/**/*.ts")],
};

const jsdocSpec = swaggerJsdoc(jsdocOptions) as OpenAPIObject;

const mergedDoc: OpenAPIObject = {
  ...zodDoc,
  paths: {
    ...(zodDoc.paths || {}),
    ...(jsdocSpec.paths || {}),
  },
  components: {
    ...(zodDoc.components || {}),
    ...(jsdocSpec.components || {}),
  },
};

fs.writeFileSync(
  path.join(__dirname, "swagger-merged.json"),
  JSON.stringify(mergedDoc, null, 2)
);

export default mergedDoc;
