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
 *     tags: [Auth]
 *     requestBody:
 *       description: Provide name, email, and password to create an account.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Unique email
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Password with minimum length of 8
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 *       500:
 *         description: Internal server error
 *
 * Postman example:
 * POST {{BASE_URL}}/api/auth/register
 * Body (JSON):
 * {
 *   "name": "Alice Example",
 *   "email": "alice@example.com",
 *   "password": "Password123!"
 * }
 */
router.post('/register', authController.register.bind(authController));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       description: Provide email and password for login.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 *
 * Postman example:
 * POST {{BASE_URL}}/api/auth/login
 * Body (JSON):
 * {
 *   "email": "alice@example.com",
 *   "password": "Password123!"
 * }
 */
router.post('/login', authController.login.bind(authController));

module.exports = router;
