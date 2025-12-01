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

  // PUBLIC_INTERFACE
  /**
   * Assign a role to a user in a team (teamId optional for global, admin-only).
   * Body: { userId, teamId?, roleName }
   */
  async assign(req, res) {
    try {
      const { userId, teamId, roleName } = req.body || {};
      const assignment = await teamsService.assignRole(teamId, userId, roleName, req.user);
      return res.status(201).json(assignment);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Revoke a role assignment by id.
   */
  async revoke(req, res) {
    try {
      const { id } = req.params;
      const revoked = await teamsService.revokeRole(id, req.user);
      return res.status(200).json(revoked);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }
}

module.exports = new RolesController();
