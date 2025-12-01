const swaggerJSDoc = require('swagger-jsdoc');

/**
 * Build the base OpenAPI definition with reusable components and tags.
 * The actual server URL is injected dynamically in app.js using the incoming request.
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'My Express API',
      version: '1.0.0',
      description: 'A simple Express API documented with Swagger',
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Health', description: 'Service health check' },
      { name: 'Teams', description: 'Team and membership management' },
      { name: 'Roles', description: 'Role listing and assignment' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Provide the JWT as: Bearer <token>',
        },
      },
      schemas: {
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', description: 'Full name', example: 'Alice Example' },
            email: { type: 'string', format: 'email', description: 'Unique email', example: 'alice@example.com' },
            password: {
              type: 'string',
              format: 'password',
              description: 'Password with minimum length of 8',
              example: 'Password123!',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', description: 'Account email', example: 'alice@example.com' },
            password: { type: 'string', format: 'password', description: 'Account password', example: 'Password123!' },
          },
        },
        AuthUser: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User id (uuid or serial)', example: 'c0f5e3a4-8f2a-4d2a-92b0-9b2f44f082e2' },
            name: { type: 'string', example: 'Alice Example' },
            email: { type: 'string', format: 'email', example: 'alice@example.com' },
            role: {
              oneOf: [
                { type: 'string', example: 'user' },
                { type: 'array', items: { type: 'string' }, example: ['user'] },
              ],
              description: 'User role or roles depending on schema',
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/AuthUser' },
            token: {
              type: 'string',
              description: 'JWT bearer token. Include as Authorization: Bearer <token>.',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Descriptive error message' },
          },
        },
      },
      responses: {
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                badEmail: { value: { error: 'A valid email is required.' } },
                shortPassword: { value: { error: 'Password must be at least 8 characters.' } },
              },
            },
          },
        },
        UnauthorizedError: {
          description: 'Invalid credentials',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { error: 'Invalid email or password.' },
            },
          },
        },
        ConflictError: {
          description: 'Resource conflict',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { error: 'Email already in use.' },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { error: 'Internal Server Error' },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Pull in route annotations
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
