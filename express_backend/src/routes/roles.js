'use strict';
const express = require('express');
const { authenticate } = require('../middleware');
const rolesController = require('../controllers/roles');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Roles
 *     description: Role catalog (enum-compatible). Team roles are managed via team_members.
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
 *     summary: (Deprecated) Role assignment via separate table is not used in canonical schema
 *     description: This project uses team_members.team_role and is_manager for team roles and users.role for global admin. Use team member endpoints instead.
 *     tags: [Roles]
 *     deprecated: true
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       410:
 *         description: Gone - use team member role change endpoints instead
 */
router.post('/assign', authenticate, (req, res) =>
  res.status(410).json({ error: 'Deprecated. Use /api/teams/{teamId}/members or PATCH member role.' })
);

/**
 * @swagger
 * /api/roles/assign/{id}:
 *   delete:
 *     summary: (Deprecated) Role revocation via separate table is not used
 *     tags: [Roles]
 *     deprecated: true
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       410:
 *         description: Gone
 */
router.delete('/assign/:id', authenticate, (req, res) =>
  res.status(410).json({ error: 'Deprecated. Use team_members updates instead.' })
);

module.exports = router;
