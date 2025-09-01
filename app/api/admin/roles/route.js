import { requireAnyRole } from '../../../../lib/authHelpers';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(req) {
  const maybe = await requireAnyRole(req, ['admin', 'dev', 'staff_manager']);
  if (maybe instanceof Response) return maybe;

  const { data, error } = await supabaseAdmin.from('roles').select('id,slug,name,description');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), { status: 200 });
}

export async function POST(req) {
  // assign role to user by cedula { cedula, role_slug }
  const maybe = await requireAnyRole(req, ['admin', 'dev', 'staff_manager']);
  if (maybe instanceof Response) return maybe;
  try {
    const body = await req.json();
    const { cedula, role_slug } = body;
    if (!cedula || !role_slug) return new Response(JSON.stringify({ error: 'cedula and role_slug required' }), { status: 400 });

    const { data: user } = await supabaseAdmin.from('users').select('id').eq('cedula', cedula).maybeSingle();
    if (!user) return new Response(JSON.stringify({ error: 'user not found' }), { status: 404 });

    const { data: role } = await supabaseAdmin.from('roles').select('id').eq('slug', role_slug).maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: 'role not found' }), { status: 404 });

    const { error } = await supabaseAdmin.from('user_roles').insert([{ user_id: user.id, role_id: role.id }]).select();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}

export async function DELETE(req) {
  // remove role from user by cedula { cedula, role_slug }
  const maybe = await requireAnyRole(req, ['admin', 'dev', 'staff_manager']);
  if (maybe instanceof Response) return maybe;
  try {
    const body = await req.json();
    const { cedula, role_slug } = body;
    if (!cedula || !role_slug) return new Response(JSON.stringify({ error: 'cedula and role_slug required' }), { status: 400 });

    const { data: user } = await supabaseAdmin.from('users').select('id').eq('cedula', cedula).maybeSingle();
    if (!user) return new Response(JSON.stringify({ error: 'user not found' }), { status: 404 });

    const { data: role } = await supabaseAdmin.from('roles').select('id').eq('slug', role_slug).maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: 'role not found' }), { status: 404 });

    const { error } = await supabaseAdmin.from('user_roles').delete().match({ user_id: user.id, role_id: role.id });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}
