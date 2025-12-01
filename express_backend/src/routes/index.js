const express = require('express');
const healthController = require('../controllers/health');
const authRoutes = require('./auth');
const teamsRoutes = require('./teams');
const rolesRoutes = require('./roles');
const bootstrapRoutes = require('./bootstrap');

const router = express.Router();
// Health endpoint

/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: Service health check
 *   - name: Bootstrap
 *     description: One-time setup utilities guarded by environment flags. Do not enable in production.
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

// Mount route groups
router.use('/api/auth', authRoutes);
router.use('/api/teams', teamsRoutes);
router.use('/api/roles', rolesRoutes);
router.use('/api/bootstrap', bootstrapRoutes);

module.exports = router;
