// import {
//   OpenAPIRegistry,
//   OpenApiGeneratorV3,
// } from "@asteasolutions/zod-to-openapi";
// import { registerTweetDocs } from "@/docs/tweets";
// import { registerUserInteractionsDocs } from "@/docs/userInteractions";
// import { registerUserDocs } from "@/docs/users";

// const registry = new OpenAPIRegistry();
// registerTweetDocs(registry);
// registerUserInteractionsDocs(registry);
// registerUserDocs(registry);

// registry.registerComponent("securitySchemes", "bearerAuth", {
//   type: "http",
//   scheme: "bearer",
//   bearerFormat: "JWT",
//   description:
//     "Enter your JWT token in the format: **Bearer &lt;your_token&gt;**",
// });

// export const generator = new OpenApiGeneratorV3(registry.definitions);

// export const swaggerDoc = generator.generateDocument({
//   openapi: "3.0.0",
//   info: {
//     title: "SWE Twitter Backend API",
//     version: "1.0.0",
//     description: "API documentation for the SWE Twitter backend project.",
//   },
//   servers: [
//     {
//       url: "http://localhost:3000",
//       description: "Local development server",
//     },
//   ],
//   security: [
//     {
//       bearerAuth: [],
//     },
//   ],
// });
import path from "path";
import fs from "fs";
import swaggerJsdoc from "swagger-jsdoc";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

// ✅ no need to import OpenAPIObject from openapi-types (it causes the error)
type OpenAPIObject = Record<string, any>;

// 🧱 Step 1: Import your Zod-based docs
import { registerTweetDocs } from "@/docs/tweets";
import { registerUserInteractionsDocs } from "@/docs/userInteractions";
import { registerUserDocs } from "@/docs/users";

// ✅ Step 2: Build Zod-based OpenAPI doc
const registry = new OpenAPIRegistry();
registerTweetDocs(registry);
registerUserInteractionsDocs(registry);
registerUserDocs(registry);

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Enter your JWT token in the format: **Bearer <your_token>**",
});

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

// ✅ Step 3: JSDoc-based documentation (from comments)
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
  // ✅ ensure correct path to routes
  apis: [path.join(__dirname, "../api/routes/**/*.ts")],
};

const jsdocSpec = swaggerJsdoc(jsdocOptions) as OpenAPIObject;

// ✅ Step 4: Merge both safely
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

// ✅ Step 5: (Optional) Save to file
fs.writeFileSync(
  path.join(__dirname, "swagger-merged.json"),
  JSON.stringify(mergedDoc, null, 2)
);

export default mergedDoc;
