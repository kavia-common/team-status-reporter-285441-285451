'use strict';

const authService = require('../services/auth');

class AuthController {
  // PUBLIC_INTERFACE
  /**
   * Handle user registration.
   * Body: { name: string, email: string, password: string }
   * Returns: { user, token }
   */
  async register(req, res) {
    try {
      const { name, email, password } = req.body || {};
      const result = await authService.registerUser({ name, email, password });
      return res.status(201).json(result);
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Handle user login.
   * Body: { email: string, password: string }
   * Returns: { user, token }
   */
  async login(req, res) {
    try {
      const { email, password } = req.body || {};
      const result = await authService.loginUser({ email, password });
      return res.status(200).json(result);
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ error: err.message || 'Internal Server Error' });
    }
  }
}

module.exports = new AuthController();
