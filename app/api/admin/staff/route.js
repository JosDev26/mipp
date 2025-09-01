import { NextResponse } from 'next/server'
import { requireAnyRole } from '../../../../lib/authHelpers'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function GET(req){
  // require role (staff_manager or admin)
  const maybe = await requireAnyRole(req, ['staff_manager','admin'])
  if (maybe instanceof Response) return maybe

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1', 10) || 1
  const pageSize = parseInt(url.searchParams.get('pageSize') || '12', 10) || 12
  const search = (url.searchParams.get('search') || '').trim()

  try{
    // 1) fetch users page
    const sb = supabaseAdmin
      .from('users')
      .select('id,cedula,nombre,segundo_nombre,primer_apellido,segundo_apellido,posicion,categoria,instancia,must_change_password', { count: 'exact' })
      .is('deleted_at', null)
    if(search){
      sb.or(`cedula.ilike.%${search}%,nombre.ilike.%${search}%,primer_apellido.ilike.%${search}%,segundo_apellido.ilike.%${search}%`)
    }
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    const { data: usersData, count, error: usersErr } = await sb.order('nombre', { ascending: true }).range(start, end)
    if(usersErr) return NextResponse.json({ detail: 'Error querying users', hint: usersErr.message }, { status: 500 })

    const users = (usersData || []).map(u => ({
      id: u.id,
      cedula: u.cedula,
      nombre: u.nombre,
      segundo_nombre: u.segundo_nombre,
      primer_apellido: u.primer_apellido,
      segundo_apellido: u.segundo_apellido,
      posicion: u.posicion,
      categoria: u.categoria,
      instancia: u.instancia,
      must_change_password: !!u.must_change_password,
    }))

    // 2) fetch roles for these users in one query and merge
    const ids = users.map(u => u.id)
    let roleMap = new Map()
    if(ids.length){
      // fetch user_roles pairs
      const { data: ur, error: urErr } = await supabaseAdmin
        .from('user_roles')
        .select('user_id,role_id')
        .in('user_id', ids)
      if(!urErr && Array.isArray(ur) && ur.length){
        const roleIds = Array.from(new Set(ur.map(r=>r.role_id)))
        const { data: rolesRows, error: rolesErr } = await supabaseAdmin
          .from('roles')
          .select('id,slug')
          .in('id', roleIds)
        const slugById = new Map((rolesRows||[]).map(r=>[r.id, r.slug]))
        for(const row of ur){
          const slug = slugById.get(row.role_id)
          if(!slug) continue
          const arr = roleMap.get(row.user_id) || []
          arr.push(slug)
          roleMap.set(row.user_id, arr)
        }
      }
    }

    // Fallback: for any users without roles so far, try nested join fetch
    const missingIds = users.filter(u => !roleMap.get(u.id)).map(u => u.id)
    if(missingIds.length){
      const { data: ur2 } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, roles(slug)')
        .in('user_id', missingIds)
      if(Array.isArray(ur2)){
        for(const row of ur2){
          const slug = row?.roles?.slug
          if(!slug) continue
          const arr = roleMap.get(row.user_id) || []
          arr.push(slug)
          roleMap.set(row.user_id, arr)
        }
      }
    }

    const withRoles = users.map(u => {
      const roles = roleMap.get(u.id) || []
      return { ...u, roles: roles.length ? roles : ['normal_user'] }
    })

    return NextResponse.json({ users: withRoles, total: count || 0 })
  }catch(err){
    return NextResponse.json({ detail: 'Unexpected error', hint: String(err) }, { status: 500 })
  }
}

export async function POST(req){
  // allow staff_manager and admin to create users via this endpoint
  const maybe = await requireAnyRole(req, ['staff_manager','admin'])
  if (maybe instanceof Response) return maybe

  try{
    const body = await req.json()
    const {
      cedula,
      nombre,
      segundo_nombre = null,
      primer_apellido,
      segundo_apellido,
      posicion,
      categoria,
      instancia,
    } = body || {}

    // Validación similar a /api/register
    const required = ['cedula','nombre','primer_apellido','segundo_apellido','posicion','categoria','instancia']
    for(const f of required){
      if(!body?.[f]) return NextResponse.json({ error: `${f} es obligatorio` }, { status: 400 })
    }

    // Sanitización y validación de formato
    const collapseSpaces = (s) => (s ?? '').toString().replace(/\s+/g, ' ').trim()
    const onlyDigits = /^\d+$/
    // Letras (incluye acentos) y espacios
    const lettersAndSpaces = /^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/

    const cedulaSan = collapseSpaces(cedula)
    const nombreSan = collapseSpaces(nombre)
    const segNombreSanRaw = segundo_nombre == null ? null : collapseSpaces(segundo_nombre)
    const segNombreSan = segNombreSanRaw === '' ? null : segNombreSanRaw
    const primerApeSan = collapseSpaces(primer_apellido)
    const segundoApeSan = collapseSpaces(segundo_apellido)
    const posicionSan = collapseSpaces(posicion)
    const categoriaSan = collapseSpaces(categoria)
    const instanciaSan = collapseSpaces(instancia)

    if(!onlyDigits.test(cedulaSan)){
      return NextResponse.json({ error: 'La cédula debe contener solo dígitos' }, { status: 400 })
    }
    const checkName = (label, val, { allowNull=false }={}) => {
      if(allowNull && (val == null)) return null
      if(!val) return `${label} es obligatorio`
      if(!lettersAndSpaces.test(val)) return `${label} solo permite letras y espacios`
      return null
    }
    const errs = [
      checkName('Nombre', nombreSan),
      checkName('Primer apellido', primerApeSan),
      checkName('Segundo apellido', segundoApeSan),
      checkName('Posición', posicionSan),
      checkName('Segundo nombre', segNombreSan, { allowNull: true }),
    ].filter(Boolean)
    if(errs.length){
      return NextResponse.json({ error: errs[0] }, { status: 400 })
    }

    // Unicidad de cédula
    const { data: exists, error: selErr } = await supabaseAdmin
      .from('users').select('id').eq('cedula', cedulaSan).limit(1)
    if(selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
    if(exists && exists.length) return NextResponse.json({ error: 'Cédula ya registrada' }, { status: 409 })

    const defaultPassword = 'admin123'
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash(defaultPassword, 10)

    const insertPayload = {
      cedula: cedulaSan,
      nombre: nombreSan,
      segundo_nombre: segNombreSan,
      primer_apellido: primerApeSan,
      segundo_apellido: segundoApeSan,
      posicion: posicionSan,
      categoria: categoriaSan,
      instancia: instanciaSan,
      password_hash: hash,
      must_change_password: true,
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([insertPayload])
      .select('id')
      .single()
    if(error) return NextResponse.json({ error: error.message }, { status: 500 })

    // assign default role normal_user (if role exists)
    const { data: role } = await supabaseAdmin.from('roles').select('id').eq('slug','normal_user').maybeSingle()
    if(role?.id){
      await supabaseAdmin.from('user_roles').insert([{ user_id: data.id, role_id: role.id }])
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  }catch(err){
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
