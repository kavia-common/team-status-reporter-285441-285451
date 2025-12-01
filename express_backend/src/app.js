const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

// Initialize express app
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.set('trust proxy', true);

// Helper to inject runtime server URL so Try It Out targets correct host
function buildDynamicSpec(req) {
  const host = req.get('host'); // may or may not include port
  let protocol = req.protocol;  // http or https
  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');

  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
     (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  return {
    ...swaggerSpec,
    servers: [{ url: `${protocol}://${fullHost}` }],
  };
}

// Expose OpenAPI JSON explicitly (used by CI, other services, and Swagger UI)
app.get('/openapi.json', (req, res) => {
  res.json(buildDynamicSpec(req));
});

// Mount Swagger UI at /docs
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const dynamicSpec = buildDynamicSpec(req);
  swaggerUi.setup(dynamicSpec, {
    explorer: true,
  })(req, res, next);
});

// Parse JSON request body
app.use(express.json());

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
  });
});

module.exports = app;
