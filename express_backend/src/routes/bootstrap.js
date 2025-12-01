'use strict';
const express = require('express');
const bootstrapController = require('../controllers/bootstrap');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Bootstrap
 *     description: One-time setup utilities guarded by environment flags. Do not enable in production.
 */

/**
 * @swagger
 * /api/bootstrap/grant-admin:
 *   post:
 *     summary: Grant global admin to a user (guarded by ALLOW_BOOTSTRAP_ADMIN=true)
 *     description: |
 *       Temporarily enable this endpoint by setting ALLOW_BOOTSTRAP_ADMIN=true in the environment.
 *       Use it once to promote a bootstrap user to global admin, then disable the flag.
 *     tags: [Bootstrap]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User id (uuid)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *             oneOf:
 *               - required: [userId]
 *               - required: [email]
 *     responses:
 *       200:
 *         description: Admin granted
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden if ALLOW_BOOTSTRAP_ADMIN is not true
 *       404:
 *         description: User not found
 */
router.post('/grant-admin', bootstrapController.grantAdmin.bind(bootstrapController));

module.exports = router;
