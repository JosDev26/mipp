import { NextResponse } from 'next/server'
import { requireAnyRole } from '../../../../../lib/authHelpers'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import bcrypt from 'bcryptjs'

export async function GET(req, ctx){
  const maybe = await requireAnyRole(req, ['staff_manager','admin'])
  if (maybe instanceof Response) return maybe

  const { params } = ctx || {}
  const { id } = (params && (await params)) || {}
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id,cedula,nombre,primer_apellido,segundo_apellido')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if(error) return NextResponse.json({ error: error.message }, { status: 500 })
  if(!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ user: data })
}

export async function PUT(req, ctx){
  // allow staff_manager and admin to update via this endpoint
  const maybe = await requireAnyRole(req, ['staff_manager','admin'])
  if (maybe instanceof Response) return maybe

  try{
  const { params } = ctx || {}
  const { id } = (params && (await params)) || {}
    const body = await req.json()
  const { nombre, segundo_nombre, primer_apellido, segundo_apellido, posicion, categoria, instancia, must_change_password } = body
  if(!nombre && !segundo_nombre && !primer_apellido && !segundo_apellido && !posicion && !categoria && !instancia && typeof must_change_password === 'undefined') {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }
    // sanitize and validate like POST for textual fields
    const collapseSpaces = (s) => (s ?? '').toString().replace(/\s+/g, ' ').trim()
    const lettersAndSpaces = /^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/

    const payload = {}
  if(typeof nombre !== 'undefined') {
      const val = collapseSpaces(nombre)
      if(!val || !lettersAndSpaces.test(val)) return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 })
      payload.nombre = val
    }
  if(typeof segundo_nombre !== 'undefined') {
      const valRaw = segundo_nombre == null ? null : collapseSpaces(segundo_nombre)
      const val = (valRaw === '') ? null : valRaw
      if(val != null && !lettersAndSpaces.test(val)) return NextResponse.json({ error: 'Segundo nombre inválido' }, { status: 400 })
      payload.segundo_nombre = val
    }
  if(typeof primer_apellido !== 'undefined') {
      const val = collapseSpaces(primer_apellido)
      if(!val || !lettersAndSpaces.test(val)) return NextResponse.json({ error: 'Primer apellido inválido' }, { status: 400 })
      payload.primer_apellido = val
    }
  if(typeof segundo_apellido !== 'undefined') {
      const val = collapseSpaces(segundo_apellido)
      if(!val || !lettersAndSpaces.test(val)) return NextResponse.json({ error: 'Segundo apellido inválido' }, { status: 400 })
      payload.segundo_apellido = val
    }
  if(typeof posicion !== 'undefined') {
      const val = collapseSpaces(posicion)
      if(!val || !lettersAndSpaces.test(val)) return NextResponse.json({ error: 'Posición inválida' }, { status: 400 })
      payload.posicion = val
    }
  if(typeof categoria !== 'undefined') payload.categoria = collapseSpaces(categoria)
  if(typeof instancia !== 'undefined') payload.instancia = collapseSpaces(instancia)
  // If enabling must_change_password, reset password to default and revoke sessions
  if (typeof must_change_password !== 'undefined') {
    const mcp = !!must_change_password
    payload.must_change_password = mcp
    if (mcp) {
      // reset password to default 'admin123'
      const hash = await bcrypt.hash('admin123', 10)
      payload.password_hash = hash
    }
  }

    const { data, error } = await supabaseAdmin.from('users').update(payload).eq('id', id).select('id').single()
    if(error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If must_change_password enabled, revoke all active sessions for this user
    if (typeof must_change_password !== 'undefined' && !!must_change_password) {
      await supabaseAdmin
        .from('sessions')
        .update({ revoked: true, expires_at: new Date().toISOString() })
        .eq('user_id', id)
        .eq('revoked', false)
    }
    return NextResponse.json({ ok: true })
  }catch(err){
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req, ctx){
  // allow staff_manager and admin to delete
  const maybe = await requireAnyRole(req, ['staff_manager','admin'])
  if (maybe instanceof Response) return maybe
  const { params } = ctx || {}
  const { id } = (params && (await params)) || {}
  const { error } = await supabaseAdmin.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if(error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
