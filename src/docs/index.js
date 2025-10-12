"use strict";
exports.__esModule = true;
exports.swaggerDoc = exports.generator = void 0;
var zod_to_openapi_1 = require("@asteasolutions/zod-to-openapi");
var tweets_1 = require("@/docs/tweets");
var userInteractions_1 = require("@/docs/userInteractions");
var users_1 = require("@/docs/users");
var registry = new zod_to_openapi_1.OpenAPIRegistry();
(0, tweets_1.registerTweetDocs)(registry);
(0, userInteractions_1.registerUserInteractionsDocs)(registry);
(0, users_1.registerUserDocs)(registry);
registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Enter your JWT token in the format: **Bearer &lt;your_token&gt;**"
});
exports.generator = new zod_to_openapi_1.OpenApiGeneratorV3(registry.definitions);
exports.swaggerDoc = exports.generator.generateDocument({
    openapi: "3.0.0",
    info: {
        title: "SWE Twitter Backend API",
        version: "1.0.0",
        description: "API documentation for the SWE Twitter backend project."
    },
    servers: [
        {
            url: "http://localhost:3000",
            description: "Local development server"
        },
    ],
    security: [
        {
            bearerAuth: []
        },
    ]
});
