const express = require('express');
const healthController = require('../controllers/health');
const authRoutes = require('./auth');

const router = express.Router();
// Health endpoint

/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: Service health check
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

// Mount auth routes
router.use('/api/auth', authRoutes);

module.exports = router;
