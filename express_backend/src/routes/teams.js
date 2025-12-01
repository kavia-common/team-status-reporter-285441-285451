'use strict';
const express = require('express');
const { authenticate } = require('../middleware');
const teamsController = require('../controllers/teams');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Teams
 *     description: Team and membership management
 */

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: List teams accessible to the authenticated user
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of teams
 *   post:
 *     summary: Create a new team
 *     description: Requires global admin role. Creator becomes a manager of the team.
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Team payload
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Team created
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         description: Forbidden
 */
router.get('/', authenticate, teamsController.list.bind(teamsController));
router.post('/', authenticate, teamsController.create.bind(teamsController));

/**
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Get a team by id
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Team detail
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update a team
 *     description: Manager of team or admin required.
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Archive (soft delete) a team
 *     description: Manager of team or admin required.
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Archived
 *       404:
 *         description: Not found
 */
router.get('/:id', authenticate, teamsController.getById.bind(teamsController));
router.patch('/:id', authenticate, teamsController.update.bind(teamsController));
router.delete('/:id', authenticate, teamsController.archive.bind(teamsController));

/**
 * @swagger
 * /api/teams/{teamId}/members:
 *   get:
 *     summary: List team members
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of members
 *   post:
 *     summary: Add a member to a team
 *     description: Manager of team or admin required.
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string }
 *               role: { type: string, enum: [member, manager, admin] }
 *     responses:
 *       201:
 *         description: Member added
 */
router.get('/:teamId/members', authenticate, teamsController.listMembers.bind(teamsController));
router.post('/:teamId/members', authenticate, teamsController.addMember.bind(teamsController));

/**
 * @swagger
 * /api/teams/{teamId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a team
 *     description: Manager of team or admin required.
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member removed (soft)
 *   patch:
 *     summary: Change a member's role in a team
 *     description: Manager of team or admin required.
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [member, manager, admin] }
 *     responses:
 *       200:
 *         description: Role changed
 */
router.delete('/:teamId/members/:userId', authenticate, teamsController.removeMember.bind(teamsController));
router.patch('/:teamId/members/:userId', authenticate, teamsController.changeMemberRole.bind(teamsController));

module.exports = router;
