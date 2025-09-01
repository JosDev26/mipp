import { supabaseAdmin } from './supabaseAdmin';
import { verifyToken } from './session';

async function getUserAndRolesByUserId(userId) {
  const { data: user, error: uErr } = await supabaseAdmin
    .from('users')
    .select('id,cedula,nombre,primer_apellido,segundo_apellido,posicion')
    .eq('id', userId)
    .maybeSingle();
  if (uErr || !user) return null;
  const { data: urs, error: urErr } = await supabaseAdmin
    .from('user_roles')
    .select('roles(slug)')
    .eq('user_id', user.id);
  const roles = (urs || []).map(r => r.roles.slug);
  return { user, roles };
}

export async function getUserAndRolesFromRequest(req) {
  try {
    const cookie = req.cookies.get('session_token');
    if (!cookie) return null;
    const token = cookie.value || cookie;
    const payload = verifyToken(token);
    if (!payload || !payload.user_id || !payload.session_id) return null;
    // validar sesión en DB
    const { data: sess, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select('id, user_id, revoked, expires_at')
      .eq('id', payload.session_id)
      .maybeSingle();
    if (sessErr || !sess) return null;
    if (sess.revoked) return null;
    if (sess.expires_at && new Date(sess.expires_at) < new Date()) return null;
    if (String(sess.user_id) !== String(payload.user_id)) return null;
    return await getUserAndRolesByUserId(payload.user_id);
  } catch (err) {
    console.error('getUserAndRolesFromRequest error', err);
    return null;
  }
}

export async function requireRole(req, roleSlug) {
  const info = await getUserAndRolesFromRequest(req);
  if (!info) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  if (!info.roles || !info.roles.includes(roleSlug)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }
  return info.user;
}

export async function requireAnyRole(req, roleSlugs = []) {
  const info = await getUserAndRolesFromRequest(req);
  if (!info) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const ok = (info.roles || []).some(r => roleSlugs.includes(r));
  if (!ok) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  return info.user;
}

// Usage examples (server route):
// const maybeUser = await requireAnyRole(req, ['admin','dev']);
// if (maybeUser instanceof Response) return maybeUser; // early return 401/403
// const user = maybeUser; // allowed
