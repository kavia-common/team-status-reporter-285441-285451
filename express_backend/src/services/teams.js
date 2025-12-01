'use strict';

const pool = require('../db/pool');

/**
 * Authorization helpers and role checks aligned to canonical schema:
 * - Global admin: users.role === 'admin' (from JWT payload)
 * - Team roles: team_members.team_role enum ('employee'|'manager'|'admin') and is_manager boolean.
 * - Soft delete: teams.deleted_at, team_members.deleted_at
 */

// Helper to test admin from user payload
function isGlobalAdminFromUser(user) {
  return !!(user && typeof user.role === 'string' && user.role.toLowerCase() === 'admin');
}

// PUBLIC_INTERFACE
async function isTeamManagerOrAdmin(userId, teamId) {
  /** Returns true if user is manager/admin for the given team (team_members.team_role or is_manager). */
  if (!userId || !teamId) return false;

  const q = `
    SELECT team_role, COALESCE(is_manager, FALSE) AS is_manager
    FROM team_members
    WHERE team_id = $1 AND user_id = $2 AND deleted_at IS NULL
    LIMIT 1
  `;
  const r = await pool.query(q, [teamId, userId]);
  if (r.rows.length === 0) return false;

  const teamRole = (r.rows[0].team_role || '').toLowerCase();
  const managerFlag = !!r.rows[0].is_manager;

  return managerFlag || teamRole === 'manager' || teamRole === 'admin';
}

// PUBLIC_INTERFACE
async function listTeamsForUser(user) {
  /** List teams visible to a user. Members see their teams; global admin see all. */
  if (!user) return [];

  if (isGlobalAdminFromUser(user)) {
    const res = await pool.query(
      `SELECT id, name, description, created_at, updated_at, deleted_at
       FROM teams
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );
    return res.rows;
  }

  const res = await pool.query(
    `SELECT t.id, t.name, t.description, t.created_at, t.updated_at, t.deleted_at
     FROM teams t
     JOIN team_members m ON m.team_id = t.id
     WHERE m.user_id = $1 AND m.deleted_at IS NULL AND t.deleted_at IS NULL
     ORDER BY t.created_at DESC`,
    [user.sub]
  );
  return res.rows;
}

// PUBLIC_INTERFACE
async function createTeam({ name, description }, user) {
  /** Create a team; only global admins can create. Creator becomes manager for the team. */
  if (!user) {
    const e = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
  if (!isGlobalAdminFromUser(user)) {
    const e = new Error('Forbidden: only admins can create teams.');
    e.status = 403;
    throw e;
  }
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    const e = new Error('Team name must be at least 2 characters.');
    e.status = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ins = await client.query(
      `INSERT INTO teams (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at, updated_at, deleted_at`,
      [name.trim(), description || null]
    );
    const team = ins.rows[0];

    // Creator becomes manager (team_role='manager', is_manager=true)
    await client.query(
      `INSERT INTO team_members (id, team_id, user_id, team_role, is_manager)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       ON CONFLICT (team_id, user_id)
       DO UPDATE SET deleted_at = NULL, team_role = EXCLUDED.team_role, is_manager = EXCLUDED.is_manager, updated_at = NOW()`,
      [team.id, user.sub, 'manager', true]
    );

    await client.query('COMMIT');
    return team;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// PUBLIC_INTERFACE
async function getTeamById(teamId, user) {
  /** Get team by id if user has access (member or admin). */
  if (!teamId) {
    const e = new Error('Team id is required.');
    e.status = 400;
    throw e;
  }

  const r = await pool.query(
    `SELECT id, name, description, created_at, updated_at, deleted_at
     FROM teams WHERE id = $1 AND deleted_at IS NULL`,
    [teamId]
  );
  if (r.rows.length === 0) {
    const e = new Error('Team not found.');
    e.status = 404;
    throw e;
  }
  const team = r.rows[0];

  if (isGlobalAdminFromUser(user)) return team;

  const m = await pool.query(
    'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1',
    [teamId, user?.sub]
  );
  if (m.rows.length === 0) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
  return team;
}

// PUBLIC_INTERFACE
async function updateTeam(teamId, { name, description }, user) {
  /** Update team name/description; team manager or global admin only. */
  if (!teamId) {
    const e = new Error('Team id is required.');
    e.status = 400;
    throw e;
  }
  const canManage = isGlobalAdminFromUser(user) || (await isTeamManagerOrAdmin(user?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (typeof name === 'string' && name.trim().length >= 2) {
    fields.push(`name = $${idx++}`);
    values.push(name.trim());
  }
  if (typeof description === 'string') {
    fields.push(`description = $${idx++}`);
    values.push(description);
  }
  if (fields.length === 0) {
    const e = new Error('No valid fields to update.');
    e.status = 400;
    throw e;
  }
  values.push(teamId);

  const q = `UPDATE teams SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL
             RETURNING id, name, description, created_at, updated_at, deleted_at`;
  const r = await pool.query(q, values);
  if (r.rows.length === 0) {
    const e = new Error('Team not found or deleted.');
    e.status = 404;
    throw e;
  }
  return r.rows[0];
}

// PUBLIC_INTERFACE
async function archiveTeam(teamId, user) {
  /** Soft-delete a team; team manager or global admin. */
  if (!teamId) {
    const e = new Error('Team id is required.');
    e.status = 400;
    throw e;
  }
  const canManage = isGlobalAdminFromUser(user) || (await isTeamManagerOrAdmin(user?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    `UPDATE teams SET deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, name, description, created_at, updated_at, deleted_at`,
    [teamId]
  );
  if (r.rows.length === 0) {
    const e = new Error('Team not found or already deleted.');
    e.status = 404;
    throw e;
  }
  return r.rows[0];
}

// MEMBERS

// PUBLIC_INTERFACE
async function listMembers(teamId, user) {
  /** List members for a team; visible to members and admins. */
  if (!teamId) {
    const e = new Error('Team id is required.');
    e.status = 400;
    throw e;
  }

  if (!isGlobalAdminFromUser(user)) {
    const m = await pool.query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1',
      [teamId, user?.sub]
    );
    if (m.rows.length === 0) {
      const e = new Error('Forbidden');
      e.status = 403;
      throw e;
    }
  }

  const r = await pool.query(
    `SELECT m.user_id, u.name, u.email, m.team_role, COALESCE(m.is_manager, FALSE) AS is_manager, m.created_at, m.updated_at
     FROM team_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.team_id = $1 AND m.deleted_at IS NULL
     ORDER BY m.created_at ASC`,
    [teamId]
  );
  return r.rows;
}

// PUBLIC_INTERFACE
async function addMember(teamId, userId, role, actor) {
  /** Add a member to a team with a role; manager or admin required. */
  if (!teamId || !userId) {
    const e = new Error('teamId and userId are required.');
    e.status = 400;
    throw e;
  }
  const requestedRole = (role || 'employee').toLowerCase();
  if (!['employee', 'manager', 'admin'].includes(requestedRole)) {
    const e = new Error('Invalid role. Allowed: employee, manager, admin.');
    e.status = 400;
    throw e;
  }
  const canManage = isGlobalAdminFromUser(actor) || (await isTeamManagerOrAdmin(actor?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    'INSERT INTO team_members (id, team_id, user_id, team_role, is_manager) ' +
    'VALUES (gen_random_uuid(), $1, $2, $3, $4) ' +
    'ON CONFLICT (team_id, user_id) ' +
    'DO UPDATE SET deleted_at = NULL, team_role = EXCLUDED.team_role, is_manager = EXCLUDED.is_manager, updated_at = NOW() ' +
    'RETURNING team_id, user_id, team_role, is_manager, created_at, updated_at',
    [teamId, userId, requestedRole, requestedRole === 'manager' || requestedRole === 'admin']
  );
  return r.rows[0];
}

// PUBLIC_INTERFACE
async function removeMember(teamId, userId, actor) {
  /** Soft-remove a member from a team; manager or admin required. */
  if (!teamId || !userId) {
    const e = new Error('teamId and userId are required.');
    e.status = 400;
    throw e;
  }
  const canManage = isGlobalAdminFromUser(actor) || (await isTeamManagerOrAdmin(actor?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    'UPDATE team_members ' +
    'SET deleted_at = NOW(), updated_at = NOW() ' +
    'WHERE team_id = $1 AND user_id = $2 AND deleted_at IS NULL ' +
    'RETURNING team_id, user_id, team_role, is_manager, created_at, updated_at, deleted_at',
    [teamId, userId]
  );
  if (r.rows.length === 0) {
    const e = new Error('Membership not found or already removed.');
    e.status = 404;
    throw e;
  }
  return r.rows[0];
}

// PUBLIC_INTERFACE
async function changeMemberRole(teamId, userId, role, actor) {
  /** Change a member's role; manager or admin required. */
  if (!teamId || !userId || !role) {
    const e = new Error('teamId, userId and role are required.');
    e.status = 400;
    throw e;
  }
  const requestedRole = role.toLowerCase();
  if (!['employee', 'manager', 'admin'].includes(requestedRole)) {
    const e = new Error('Invalid role. Allowed: employee, manager, admin.');
    e.status = 400;
    throw e;
  }
  const canManage = isGlobalAdminFromUser(actor) || (await isTeamManagerOrAdmin(actor?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    'UPDATE team_members ' +
    'SET team_role = $3, is_manager = $4, updated_at = NOW() ' +
    'WHERE team_id = $1 AND user_id = $2 AND deleted_at IS NULL ' +
    'RETURNING team_id, user_id, team_role, is_manager, created_at, updated_at',
    [teamId, userId, requestedRole, requestedRole === 'manager' || requestedRole === 'admin']
  );
  if (r.rows.length === 0) {
    // If not a member yet, insert
    const ins = await pool.query(
      'INSERT INTO team_members (id, team_id, user_id, team_role, is_manager) ' +
      'VALUES (gen_random_uuid(), $1, $2, $3, $4) ' +
      'RETURNING team_id, user_id, team_role, is_manager, created_at, updated_at',
      [teamId, userId, requestedRole, requestedRole === 'manager' || requestedRole === 'admin']
    );
    return ins.rows[0];
  }
  return r.rows[0];
}

// ROLES (catalog remains for reference)

// PUBLIC_INTERFACE
async function listRoles() {
  /** List available roles from roles table (enum-compatible: admin, manager, employee). */
  const r = await pool.query('SELECT id, name, description, created_at FROM roles ORDER BY name ASC');
  return r.rows;
}

module.exports = {
  listTeamsForUser,
  createTeam,
  getTeamById,
  updateTeam,
  archiveTeam,
  listMembers,
  addMember,
  removeMember,
  changeMemberRole,
  listRoles,
  isTeamManagerOrAdmin,
};
