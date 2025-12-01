'use strict';
const express = require('express');
const authController = require('../controllers/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account using name, email, and password.
 *     tags: [Auth]
 *     requestBody:
 *       description: Provide name, email, and password to create an account.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             default:
 *               summary: Valid registration payload
 *               value:
 *                 name: Alice Example
 *                 email: alice@example.com
 *                 password: Password123!
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               created:
 *                 value:
 *                   user:
 *                     id: c0f5e3a4-8f2a-4d2a-92b0-9b2f44f082e2
 *                     name: Alice Example
 *                     email: alice@example.com
 *                     role: user
 *                     created_at: '2025-01-01T12:00:00.000Z'
 *                     updated_at: '2025-01-01T12:00:00.000Z'
 *                   token: TOKEN_PLACEHOLDER
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/register', authController.register.bind(authController));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     description: Authenticate an existing user and retrieve a token placeholder.
 *     tags: [Auth]
 *     requestBody:
 *       description: Provide email and password for login.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             default:
 *               summary: Valid login payload
 *               value:
 *                 email: alice@example.com
 *                 password: Password123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               ok:
 *                 value:
 *                   user:
 *                     id: c0f5e3a4-8f2a-4d2a-92b0-9b2f44f082e2
 *                     name: Alice Example
 *                     email: alice@example.com
 *                     role: user
 *                     created_at: '2025-01-01T12:00:00.000Z'
 *                     updated_at: '2025-01-01T12:00:00.000Z'
 *                   token: TOKEN_PLACEHOLDER
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/login', authController.login.bind(authController));

module.exports = router;
