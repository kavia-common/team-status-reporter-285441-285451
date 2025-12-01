'use strict';

const teamsService = require('../services/teams');

class RolesController {
  // PUBLIC_INTERFACE
  /**
   * List available roles.
   */
  async list(req, res) {
    try {
      const roles = await teamsService.listRoles();
      return res.status(200).json({ items: roles });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }
}

module.exports = new RolesController();
