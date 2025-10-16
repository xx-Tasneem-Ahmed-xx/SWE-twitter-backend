import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SWE Twitter Backend API",
      version: "1.0.0",
      description: "Auto-generated API documentation using Swagger JSDoc.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development Server",
      },
    ],
  },
  apis: [path.join(__dirname, "../api/routes/**/*.ts")], // path to all route files
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
