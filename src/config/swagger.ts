import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TMJApp API V2",
      version: "2.0.0",
      description: "Documentação Swagger somente da API V2",
    },
    servers: [
      { url: "http://api.tmjapp.com.br/api/v2" },
      { url: "http://localhost:3000/api/v2" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/v2/routes/*.ts", "./src/v2/docs/*.yaml"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export { swaggerUi, swaggerSpec };
