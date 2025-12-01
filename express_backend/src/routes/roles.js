'use strict';
const express = require('express');
const { authenticate } = require('../middleware');
const rolesController = require('../controllers/roles');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Roles
 *     description: Role listing and assignment
 */

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: List available roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 */
router.get('/', authenticate, rolesController.list.bind(rolesController));

/**
 * @swagger
 * /api/roles/assign:
 *   post:
 *     summary: Assign a role to a user in a team (teamId optional for global; admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, roleName]
 *             properties:
 *               userId: { type: string }
 *               teamId: { type: string, nullable: true }
 *               roleName: { type: string, enum: [member, manager, admin] }
 *     responses:
 *       201:
 *         description: Role assignment created
 *       403:
 *         description: Forbidden
 */
router.post('/assign', authenticate, rolesController.assign.bind(rolesController));

/**
 * @swagger
 * /api/roles/assign/{id}:
 *   delete:
 *     summary: Revoke a role assignment
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Revoked
 */
router.delete('/assign/:id', authenticate, rolesController.revoke.bind(rolesController));

module.exports = router;
