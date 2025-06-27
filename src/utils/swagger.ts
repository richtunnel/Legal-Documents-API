import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Legal Documents API",
      version: "1.0.0",
      description: "API for fetching legal documents",
    },
    servers: [{ url: "/api/v1" }],
  },
  apis: ["./src/routes/*.ts"],
});
