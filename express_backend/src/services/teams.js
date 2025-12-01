'use strict';

const pool = require('../db/pool');

/**
 * Authorization helpers:
 * - isGlobalAdmin: req.user.role === 'admin' (from users.role at login)
 * - teamScopedRole: check team_members.role or role_assignments for user/team
 */

// PUBLIC_INTERFACE
async function isTeamManagerOrAdmin(userId, teamId) {
  /** Returns true if user is manager/admin for the given team (or global admin). */
  if (!userId || !teamId) return false;

  // Check team_members table for direct role
  const q1 = `
    SELECT role FROM team_members
    WHERE team_id = $1 AND user_id = $2 AND removed_at IS NULL
    LIMIT 1
  `;
  const r1 = await pool.query(q1, [teamId, userId]);
  if (r1.rows.length > 0) {
    const role = (r1.rows[0].role || '').toLowerCase();
    if (role === 'manager' || role === 'admin') return true;
  }

  // Check role_assignments for active assignment
  const q2 = `
    SELECT role_name FROM role_assignments
    WHERE team_id = $1 AND user_id = $2 AND revoked_at IS NULL
    LIMIT 1
  `;
  const r2 = await pool.query(q2, [teamId, userId]);
  if (r2.rows.length > 0) {
    const rn = (r2.rows[0].role_name || '').toLowerCase();
    if (rn === 'manager' || rn === 'admin') return true;
  }
  return false;
}

// PUBLIC_INTERFACE
async function listTeamsForUser(user) {
  /** List teams visible to a user. Members see their teams; admin see all. */
  if (!user) return [];

  const isAdmin = (user.role && typeof user.role === 'string' && user.role.toLowerCase() === 'admin');

  if (isAdmin) {
    const res = await pool.query(
      `SELECT id, name, description, created_at, updated_at, archived_at
       FROM teams
       WHERE archived_at IS NULL
       ORDER BY created_at DESC`
    );
    return res.rows;
  }

  const res = await pool.query(
    `SELECT t.id, t.name, t.description, t.created_at, t.updated_at, t.archived_at
     FROM teams t
     JOIN team_members m ON m.team_id = t.id
     WHERE m.user_id = $1 AND m.removed_at IS NULL AND t.archived_at IS NULL
     ORDER BY t.created_at DESC`,
    [user.sub]
  );
  return res.rows;
}

// PUBLIC_INTERFACE
async function createTeam({ name, description }, user) {
  /** Create a team; only admins/managers (global admin) can create. Creator becomes manager. */
  if (!user) {
    const e = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
  const isAdmin = (user.role && typeof user.role === 'string' && user.role.toLowerCase() === 'admin');
  if (!isAdmin) {
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
       RETURNING id, name, description, created_at, updated_at, archived_at`,
      [name.trim(), description || null]
    );
    const team = ins.rows[0];

    // Creator becomes manager
    await client.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id)
       DO UPDATE SET removed_at = NULL, role = EXCLUDED.role`,
      [team.id, user.sub, 'manager']
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
  const isAdmin = user && user.role && typeof user.role === 'string' && user.role.toLowerCase() === 'admin';

  const r = await pool.query(
    `SELECT id, name, description, created_at, updated_at, archived_at
     FROM teams WHERE id = $1 AND archived_at IS NULL`,
    [teamId]
  );
  if (r.rows.length === 0) {
    const e = new Error('Team not found.');
    e.status = 404;
    throw e;
  }
  const team = r.rows[0];

  if (isAdmin) return team;

  const m = await pool.query(
    'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND removed_at IS NULL LIMIT 1',
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
  /** Update team name/description; manager or admin only. */
  if (!teamId) {
    const e = new Error('Team id is required.');
    e.status = 400;
    throw e;
  }
  const isAdmin = user && user.role && typeof user.role === 'string' && user.role.toLowerCase() === 'admin';
  const canManage = isAdmin || (await isTeamManagerOrAdmin(user?.sub, teamId));
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

  const q = `UPDATE teams SET ${fields.join(', ')} WHERE id = $${idx} AND archived_at IS NULL
             RETURNING id, name, description, created_at, updated_at, archived_at`;
  const r = await pool.query(q, values);
  if (r.rows.length === 0) {
    const e = new Error('Team not found or archived.');
    e.status = 404;
    throw e;
  }
  return r.rows[0];
}

// PUBLIC_INTERFACE
async function archiveTeam(teamId, user) {
  /** Soft-delete (archive) a team; admin or manager. */
  if (!teamId) {
    const e = new Error('Team id is required.');
    e.status = 400;
    throw e;
  }
  const isAdmin = user && user.role && typeof user.role === 'string' && user.role.toLowerCase() === 'admin';
  const canManage = isAdmin || (await isTeamManagerOrAdmin(user?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    `UPDATE teams SET archived_at = NOW()
     WHERE id = $1 AND archived_at IS NULL
     RETURNING id, name, description, created_at, updated_at, archived_at`,
    [teamId]
  );
  if (r.rows.length === 0) {
    const e = new Error('Team not found or already archived.');
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

  // Ensure user has at least membership
  const isAdmin = user && user.role && typeof user.role === 'string' && user.role.toLowerCase() === 'admin';
  if (!isAdmin) {
    const m = await pool.query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND removed_at IS NULL LIMIT 1',
      [teamId, user?.sub]
    );
    if (m.rows.length === 0) {
      const e = new Error('Forbidden');
      e.status = 403;
      throw e;
    }
  }

  const r = await pool.query(
    `SELECT m.user_id, u.name, u.email, m.role, m.created_at, m.updated_at
     FROM team_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.team_id = $1 AND m.removed_at IS NULL
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
  const requestedRole = (role || 'member').toLowerCase();
  if (!['member', 'manager', 'admin'].includes(requestedRole)) {
    const e = new Error('Invalid role. Allowed: member, manager, admin.');
    e.status = 400;
    throw e;
  }
  const isAdmin = actor && actor.role && actor.role.toLowerCase() === 'admin';
  const canManage = isAdmin || (await isTeamManagerOrAdmin(actor?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    'INSERT INTO team_members (team_id, user_id, role) ' +
    'VALUES ($1, $2, $3) ' +
    'ON CONFLICT (team_id, user_id) ' +
    'DO UPDATE SET removed_at = NULL, role = EXCLUDED.role, updated_at = NOW() ' +
    'RETURNING team_id, user_id, role, created_at, updated_at',
    [teamId, userId, requestedRole]
  );
  return r.rows[0];
}

// PUBLIC_INTERFACE
async function removeMember(teamId, userId, actor) {
  /** Remove (soft) a member from a team; manager or admin required. */
  if (!teamId || !userId) {
    const e = new Error('teamId and userId are required.');
    e.status = 400;
    throw e;
  }
  const isAdmin = actor && actor.role && actor.role.toLowerCase() === 'admin';
  const canManage = isAdmin || (await isTeamManagerOrAdmin(actor?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    'UPDATE team_members ' +
    'SET removed_at = NOW(), updated_at = NOW() ' +
    'WHERE team_id = $1 AND user_id = $2 AND removed_at IS NULL ' +
    'RETURNING team_id, user_id, role, created_at, updated_at, removed_at',
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
  if (!['member', 'manager', 'admin'].includes(requestedRole)) {
    const e = new Error('Invalid role. Allowed: member, manager, admin.');
    e.status = 400;
    throw e;
  }
  const isAdmin = actor && actor.role && actor.role.toLowerCase() === 'admin';
  const canManage = isAdmin || (await isTeamManagerOrAdmin(actor?.sub, teamId));
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    'UPDATE team_members ' +
    'SET role = $3, updated_at = NOW() ' +
    'WHERE team_id = $1 AND user_id = $2 AND removed_at IS NULL ' +
    'RETURNING team_id, user_id, role, created_at, updated_at',
    [teamId, userId, requestedRole]
  );
  if (r.rows.length === 0) {
    // If not a member yet, optionally add
    const ins = await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) ' +
      'VALUES ($1, $2, $3) ' +
      'RETURNING team_id, user_id, role, created_at, updated_at',
      [teamId, userId, requestedRole]
    );
    return ins.rows[0];
  }
  return r.rows[0];
}

// ROLES

// PUBLIC_INTERFACE
async function listRoles() {
  /** List available roles from roles table. */
  const r = await pool.query(`SELECT id, name, description, created_at FROM roles ORDER BY name ASC`);
  return r.rows;
}

// PUBLIC_INTERFACE
async function assignRole(teamId, userId, roleName, actor) {
  /** Assign a role to a user for a team; manager/admin required. */
  if (!userId || !roleName) {
    const e = new Error('userId and roleName are required.');
    e.status = 400;
    throw e;
  }
  const role = roleName.toLowerCase();
  if (!['member', 'manager', 'admin'].includes(role)) {
    const e = new Error('Invalid role. Allowed: member, manager, admin.');
    e.status = 400;
    throw e;
  }
  let canManage = false;
  if (teamId) {
    const isAdmin = actor && actor.role && actor.role.toLowerCase() === 'admin';
    canManage = isAdmin || (await isTeamManagerOrAdmin(actor?.sub, teamId));
  } else {
    // Global role assignment restricted to global admin
    canManage = actor && actor.role && actor.role.toLowerCase() === 'admin';
  }
  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  // Ensure role exists
  await pool.query(`INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [role]);

  const r = await pool.query(
    `INSERT INTO role_assignments (user_id, team_id, role_name)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, team_id, role_name, created_at, revoked_at`,
    [userId, teamId || null, role]
  );
  return r.rows[0];
}

// PUBLIC_INTERFACE
async function revokeRole(assignmentId, actor) {
  /** Revoke a role assignment by id; admin or relevant team manager. */
  if (!assignmentId) {
    const e = new Error('assignmentId is required.');
    e.status = 400;
    throw e;
  }

  // Need to load the assignment to know scope
  const cur = await pool.query(
    `SELECT id, user_id, team_id, role_name, revoked_at FROM role_assignments WHERE id = $1`,
    [assignmentId]
  );
  if (cur.rows.length === 0) {
    const e = new Error('Role assignment not found.');
    e.status = 404;
    throw e;
  }
  const ra = cur.rows[0];
  if (ra.revoked_at) {
    const e = new Error('Role assignment already revoked.');
    e.status = 400;
    throw e;
  }

  let canManage = false;
  if (ra.team_id) {
    const isAdmin = actor && actor.role && actor.role.toLowerCase() === 'admin';
    canManage = isAdmin || (await isTeamManagerOrAdmin(actor?.sub, ra.team_id));
  } else {
    canManage = actor && actor.role && actor.role.toLowerCase() === 'admin';
  }

  if (!canManage) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const r = await pool.query(
    'UPDATE role_assignments SET revoked_at = NOW() WHERE id = $1 ' +
    'RETURNING id, user_id, team_id, role_name, created_at, revoked_at',
    [assignmentId]
  );
  return r.rows[0];
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
  assignRole,
  revokeRole,
  isTeamManagerOrAdmin,
};
