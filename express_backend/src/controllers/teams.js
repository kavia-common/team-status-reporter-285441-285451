'use strict';

const teamsService = require('../services/teams');

class TeamsController {
  // PUBLIC_INTERFACE
  /**
   * Create a team. Body: { name, description }
   * Authorization: global admin only.
   */
  async create(req, res) {
    try {
      const team = await teamsService.createTeam(req.body || {}, req.user);
      return res.status(201).json(team);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * List teams visible to requester.
   */
  async list(req, res) {
    try {
      const teams = await teamsService.listTeamsForUser(req.user);
      return res.status(200).json({ items: teams });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Get a team by id if user has access.
   */
  async getById(req, res) {
    try {
      const team = await teamsService.getTeamById(req.params.id, req.user);
      return res.status(200).json(team);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Update a team (name/description). Manager/admin required.
   */
  async update(req, res) {
    try {
      const team = await teamsService.updateTeam(req.params.id, req.body || {}, req.user);
      return res.status(200).json(team);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Archive (soft delete) a team. Manager/admin required.
   */
  async archive(req, res) {
    try {
      const team = await teamsService.archiveTeam(req.params.id, req.user);
      return res.status(200).json(team);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // MEMBERS

  // PUBLIC_INTERFACE
  /**
   * List members of a team.
   */
  async listMembers(req, res) {
    try {
      const members = await teamsService.listMembers(req.params.teamId, req.user);
      return res.status(200).json({ items: members });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Add a member to a team.
   * Body: { userId, role? }
   */
  async addMember(req, res) {
    try {
      const { userId, role } = req.body || {};
      const member = await teamsService.addMember(req.params.teamId, userId, role, req.user);
      return res.status(201).json(member);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Remove a member from a team.
   */
  async removeMember(req, res) {
    try {
      const removed = await teamsService.removeMember(req.params.teamId, req.params.userId, req.user);
      return res.status(200).json(removed);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Change a member's role.
   * Body: { role }
   */
  async changeMemberRole(req, res) {
    try {
      const { role } = req.body || {};
      const updated = await teamsService.changeMemberRole(req.params.teamId, req.params.userId, role, req.user);
      return res.status(200).json(updated);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
  }
}

module.exports = new TeamsController();
