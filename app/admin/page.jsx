import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAnyRole } from '../../lib/authHelpers'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import StaffManagerClient from './StaffManagerClient'
import LoadingOverlay from '../../components/LoadingOverlay'

export default async function AdminPage({ searchParams }){
  // server-side role check: only staff_manager or admin
  const cookieStore = await cookies()
  const reqLike = { cookies: { get: (name) => cookieStore.get(name) } }
  const maybe = await requireAnyRole(reqLike, ['staff_manager','admin'])
  if (!maybe || maybe instanceof Response) {
    // not authorized - redirect to home
    redirect('/')
  }

  // read pagination/search from searchParams (server-side)
  const sp = await searchParams
  const page = parseInt((sp?.get?.('page')) || '1', 10) || 1
  const pageSize = parseInt((sp?.get?.('pageSize')) || '12', 10) || 12
  const search = ((sp?.get?.('search')) || '').trim()

  // fetch initial page of users server-side for faster first render
  let users = []
  let total = 0
  try{
    const sb = supabaseAdmin.from('users').select('id,cedula,nombre,segundo_nombre,primer_apellido,segundo_apellido,posicion,categoria,instancia,must_change_password', { count: 'exact' }).is('deleted_at', null)
    if(search){
      // search across cedula, nombres, apellidos
      const esc = search.replace(/'/g, "\\'")
      sb.or(`cedula.ilike.%${esc}%,nombre.ilike.%${esc}%,primer_apellido.ilike.%${esc}%,segundo_apellido.ilike.%${esc}%`)
    }
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    const { data, count, error } = await sb.order('nombre', { ascending: true }).range(start, end)
    if(!error){
      users = data || []
      total = count || 0
    }
  }catch(err){
    // ignore server-side fetch errors here; client will surface them
    console.error('admin page users fetch error', err)
  }

  return (
    <StaffManagerClient initialUsers={users} initialTotal={total} initialPage={page} initialPageSize={pageSize} initialSearch={search} />
  )
}
