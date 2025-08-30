"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import LoadingOverlay from '../../components/LoadingOverlay'
import styles from './page.module.css'

export default function StaffManagerClient({ initialUsers = [], initialTotal = 0, initialPage = 1, initialPageSize = 12, initialSearch = '' }){
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [search, setSearch] = useState(initialSearch)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState("")
  const [creating, setCreating] = useState(false)
  const [mainTab, setMainTab] = useState(() => {
    if (typeof window === 'undefined') return 'users'
    const sp = new URLSearchParams(window.location.search)
    return sp.get('tab') || 'users'
  })
  const [selectedUserId, setSelectedUserId] = useState(null)
  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId) || null, [users, selectedUserId])
  const [roleFilter, setRoleFilter] = useState('') // '' all, else slug
  const [rolesCatalog, setRolesCatalog] = useState([])
  const [sessions, setSessions] = useState([])
  const [newUser, setNewUser] = useState({
    cedula: '',
    nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    posicion: '',
    categoria: 'Titulo I',
    instancia: 'Propietario',
  })
  const searchRef = useRef(null)
  const newCedulaRef = useRef(null)

  // Create User Wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizard, setWizard] = useState({
    cedula: '', nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '',
    posicion: '', categoria: 'Titulo I', instancia: 'Propietario', roleTemplate: ''
  })

  async function fetchPage(p = page, s = search){
    setLoading(true)
    setError(null)
    try{
      const qp = new URLSearchParams({ page: String(p), pageSize: String(pageSize), search: s })
      const res = await fetch('/api/admin/staff?' + qp.toString())
      if(!res.ok) throw new Error((await res.json()).detail || 'Error fetching')
      const data = await res.json()
  setUsers(data.users || [])
      setTotal(data.total || 0)
      setPage(p)
      // update URL params for back/refresh
  const sp = new URLSearchParams(qp)
  sp.set('tab', mainTab)
  router.replace(`/admin?${sp.toString()}`)
  setStatus(data.users?.length ? `Mostrando ${data.users.length} de ${data.total ?? data.users.length} resultados` : 'Sin resultados para la búsqueda')
    }catch(err){
      setError(err.message || String(err))
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => {
    // Always fetch on mount to ensure roles are up-to-date
    fetchPage(1, search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Select first user when list updates (users tab)
  useEffect(() => {
    if (mainTab !== 'users') return
    if (!selectedUserId && users.length) {
      setSelectedUserId(users[0].id)
    }
  }, [users, selectedUserId, mainTab])

  // Sync tab to URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('tab', mainTab)
    window.history.replaceState({}, '', url.toString())
  }, [mainTab])

  // Load roles catalog and sessions for tabs as needed
  useEffect(() => {
    let ignore = false
    if (mainTab === 'roles') {
      ;(async () => {
        try {
          const res = await fetch('/api/admin/roles')
          if (!res.ok) return
          const j = await res.json()
          if (!ignore) setRolesCatalog(j.data || [])
        } catch {}
      })()
    }
    return () => { ignore = true }
  }, [mainTab])

  // Keyboard shortcuts: Ctrl+K focus search, N focus create cedula, Enter triggers search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (!e.ctrlKey && !e.metaKey && (e.key === 'n' || e.key === 'N')) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          newCedulaRef.current?.focus();
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleCreate(e){
    e.preventDefault()
    setCreating(true)
    setError(null)
    try{
      // client-side validation
      const collapseSpaces = (s) => (s ?? '').toString().replace(/\s+/g, ' ').trim()
      const onlyDigits = /^\d+$/
      const lettersAndSpaces = /^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/
  const bodyPayload = {
        cedula: collapseSpaces(newUser.cedula),
        nombre: collapseSpaces(newUser.nombre),
        segundo_nombre: newUser.segundo_nombre ? collapseSpaces(newUser.segundo_nombre) : null,
        primer_apellido: collapseSpaces(newUser.primer_apellido),
        segundo_apellido: collapseSpaces(newUser.segundo_apellido),
        posicion: collapseSpaces(newUser.posicion),
        categoria: collapseSpaces(newUser.categoria),
        instancia: collapseSpaces(newUser.instancia),
      }
  if(!onlyDigits.test(bodyPayload.cedula)) throw new Error('La cédula debe contener solo dígitos')
      const check = (label, v, { allowNull=false }={}) => {
        if(allowNull && (v == null)) return
        if(!v) throw new Error(`${label} es obligatorio`)
        if(!lettersAndSpaces.test(v)) throw new Error(`${label} solo permite letras y espacios`)
      }
  check('Nombre', bodyPayload.nombre)
  check('Primer apellido', bodyPayload.primer_apellido)
  check('Segundo apellido', bodyPayload.segundo_apellido)
  check('Posición', bodyPayload.posicion)
  check('Segundo nombre', bodyPayload.segundo_nombre, { allowNull: true })

  const res = await fetch('/api/admin/staff', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(bodyPayload) })
  const resp = await res.json()
  if(!res.ok) throw new Error(resp.error || resp.detail || 'Create failed')
  // reload first page
  setNewUser({
    cedula: '',
    nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    posicion: '',
    categoria: 'Titulo I',
    instancia: 'Propietario',
  })
      setStatus('Usuario creado correctamente')
      fetchPage(1)
    }catch(err){
      setError(err.message || String(err))
    }finally{
      setCreating(false)
    }
  }

  async function handleDelete(id){
    const u = users.find(x => x.id === id)
    if(!confirm(`Eliminar usuario ${u?.nombre ?? ''} ${u?.primer_apellido ?? ''} (${u?.cedula ?? ''})?`)) return
    setError(null)
    try{
      const res = await fetch('/api/admin/staff/' + id, { method: 'DELETE' })
      if(!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      setStatus('Usuario eliminado')
      fetchPage(1)
    }catch(err){
      setError(err.message || String(err))
    }
  }

  async function handleUpdate(id, patch){
    setError(null)
    try{
      const res = await fetch('/api/admin/staff/' + id, { method: 'PUT', headers: { 'content-type':'application/json' }, body: JSON.stringify(patch) })
      if(!res.ok) throw new Error((await res.json()).error || 'Update failed')
  setStatus('Cambios guardados')
  fetchPage(page, search)
    }catch(err){
      setError(err.message || String(err))
    }
  }

  async function handleAssignRole(cedula, role_slug){
    setError(null)
    try{
      const res = await fetch('/api/admin/roles', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ cedula, role_slug }) })
      const payload = await res.json()
      if(!res.ok) throw new Error(payload.error || payload.detail || 'Assign role failed')
  // refresh current page to reflect new roles
  setStatus(`Rol “${role_slug}” asignado`)
  await fetchPage(page, search)
    }catch(err){
      setError(err.message || String(err))
    }
  }

  async function handleRemoveRole(cedula, role_slug){
    setError(null)
    try{
      const res = await fetch('/api/admin/roles', { method: 'DELETE', headers: { 'content-type':'application/json' }, body: JSON.stringify({ cedula, role_slug }) })
      const payload = await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(payload.error || payload.detail || 'Remove role failed')
  setStatus(`Rol “${role_slug}” removido`)
  await fetchPage(page, search)
    }catch(err){
      setError(err.message || String(err))
    }
  }

  const totalPages = Math.max(1, Math.ceil((total || users.length) / pageSize))
  const filteredUsers = useMemo(() => {
    if (!roleFilter) return users
    return users.filter(u => (u.roles || []).includes(roleFilter))
  }, [users, roleFilter])

  return (
    <div className={`${styles.page} ${styles.enter}`}>
  <LoadingOverlay show={loading || creating} text={creating ? 'Creando usuario...' : 'Cargando datos...'} />

      {/* Sticky header */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Administración</h1>
          <span className={styles.counter}>Usuarios: {total}</span>
          <div className={styles.spacer} />
          <input ref={searchRef} placeholder="Buscar por cédula o nombre" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ fetchPage(1, search) } }} aria-label="Buscar usuarios" className={styles.search} />
          <button onClick={()=>fetchPage(1, search)} title="Buscar (Enter)" className={`${styles.btn}`}>Buscar</button>
          {search && <button onClick={()=>{ setSearch(''); fetchPage(1, ''); }} title="Limpiar búsqueda" className={`${styles.btn} ${styles.btnSecondary}`}>Limpiar</button>}
          <button onClick={()=>{ setWizardOpen(true); setWizardStep(1); }} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnCta}`}>Crear usuario</button>
        </div>
        {(status || error) && (
          <div role="status" aria-live="polite" className={`${styles.status} ${error ? styles.statusErr : styles.statusOk}`}>
            {error ? `Error: ${error}` : status}
          </div>
        )}
        <div className={styles.tabs}>
          {['users','roles','settings'].map(t => (
            <button key={t} onClick={()=>setMainTab(t)} className={`${styles.tab} ${mainTab===t ? styles.tabActive : ''}`}>
              {t==='users'?'Usuarios':t==='roles'?'Roles y permisos':'Ajustes'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {mainTab === 'users' && (
        <div className={`${styles.layout}`}>
          {/* Left list + filters */}
          <div>
            <div className={`${styles.filters}`}>
              <label className={styles.fieldLabel}>Rol:</label>
              <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} className={styles.select}>
                <option value="">Todos</option>
                <option value="admin">admin</option>
                <option value="dev">dev</option>
                <option value="staff_manager">staff_manager</option>
                <option value="infra_manager">infra_manager</option>
                <option value="normal_user">normal_user</option>
              </select>
              {roleFilter && (
                <span className={styles.chip}>Filtro: {roleFilter} <button onClick={()=>setRoleFilter('')} title="Quitar filtro" className={styles.chipBtn}>&times;</button></span>
              )}
            </div>
            <div className={`${styles.list} ${styles.listAnimate}`} role="listbox" aria-label="Usuarios" aria-activedescendant={selectedUserId ? `user-${selectedUserId}` : undefined}>
              {loading && <div style={{ padding: 12, color:'var(--muted)' }}>Cargando...</div>}
              {!loading && filteredUsers.length === 0 && <div style={{ padding: 12, color:'var(--muted)' }}>Sin resultados</div>}
              {!loading && filteredUsers.map(u => (
                <button
                  key={u.id}
                  id={`user-${u.id}`}
                  onClick={()=>setSelectedUserId(u.id)}
                  className={`${styles.listItem} ${selectedUserId===u.id ? styles.listItemActive : ''}`}
                  role="option"
                  aria-selected={selectedUserId===u.id}
                >
                  <div className={styles.listItemTitle}>{u.nombre} {u.segundo_nombre} {u.primer_apellido} {u.segundo_apellido}</div>
                  <div className={styles.listItemSub}>Cédula {u.cedula}</div>
                  <div className={styles.listItemRoles}>
                    {(u.roles || ['normal_user']).map(r => (
                      <span key={r} className={styles.rolePill}>{r}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <div className={styles.pagination}>
              <button onClick={() => fetchPage(Math.max(1, page-1), search)} disabled={page<=1} className={styles.btn}>Anterior</button>
              <span>Página {page} de {totalPages}</span>
              <button onClick={() => fetchPage(Math.min(totalPages, page+1), search)} disabled={page>=totalPages} className={styles.btn}>Siguiente</button>
            </div>
          </div>

          {/* Right detail panel */}
          <div className={`${styles.detail} ${styles.enter}`}>
            {!selectedUser && <div style={{ color:'var(--muted)' }}>Selecciona un usuario de la lista para ver sus detalles.</div>}
            {selectedUser && (
              <UserDetail
                user={selectedUser}
                onUpdate={patch => handleUpdate(selectedUser.id, patch)}
                onDelete={() => handleDelete(selectedUser.id)}
                onAssignRole={(r)=>handleAssignRole(selectedUser.cedula, r)}
                onRemoveRole={(r)=>handleRemoveRole(selectedUser.cedula, r)}
              />
            )}
          </div>
        </div>
      )}

      {mainTab === 'roles' && (
        <div className={`${styles.enter}`} style={{ display:'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {(rolesCatalog || []).map(r => (
            <div key={r.id} className={styles.detail}>
              <div style={{ fontWeight: 800 }}>{r.name || r.slug}</div>
              <div style={{ color:'#6b7280', fontSize: 13 }}>{r.slug}</div>
              <div style={{ marginTop: 6, fontSize: 14 }}>{r.description || 'Sin descripción'}</div>
            </div>
          ))}
          {!rolesCatalog.length && <div style={{ color:'#6b7280' }}>No hay roles o no autorizado.</div>}
        </div>
      )}

      {mainTab === 'history' && (
        <div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: 8 }}>ID</th>
                <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: 8 }}>Usuario</th>
                <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: 8 }}>Creada</th>
                <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: 8 }}>Expira</th>
                <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding: 8 }}>Revocada</th>
              </tr>
            </thead>
            <tbody>
              {(sessions || []).map(s => (
                <tr key={s.id}>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{s.id}</td>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{s.user_id}</td>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{s.created_at}</td>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{s.expires_at}</td>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{s.revoked ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sessions.length && <div style={{ color:'#6b7280', marginTop: 8 }}>No hay actividad o no autorizado.</div>}
        </div>
      )}

      {mainTab === 'settings' && (
        <div style={{ color:'#6b7280' }}>Próximamente: Plantillas, importación CSV, y preferencias.</div>
      )}

      {/* Create User Wizard */}
      {wizardOpen && (
        <div role="dialog" aria-modal="true" className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <strong>Crear usuario</strong>
              <button onClick={()=>setWizardOpen(false)} aria-label="Cerrar" className={`${styles.btn}`}>Cerrar</button>
            </div>
            <div className={styles.progressBar}><div className={styles.progressInner} style={{ width: `${wizardStep*33.33}%` }} /></div>
    {wizardStep === 1 && (
              <div className={styles.enter}>
                <div style={{ marginBottom: 8, color:'#374151' }}>Paso 1: Identificación</div>
                <div className={styles.fields}>
      <input ref={newCedulaRef} className={styles.input} placeholder="Cédula" value={wizard.cedula} onChange={e=>setWizard(w=>({...w, cedula: e.target.value.replace(/[^0-9]/g,'')}))} />
                  <input className={styles.input} placeholder="Nombre" value={wizard.nombre} onChange={e=>setWizard(w=>({...w, nombre: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
                  <input className={styles.input} placeholder="Segundo nombre (opcional)" value={wizard.segundo_nombre} onChange={e=>setWizard(w=>({...w, segundo_nombre: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
                  <input className={styles.input} placeholder="Primer apellido" value={wizard.primer_apellido} onChange={e=>setWizard(w=>({...w, primer_apellido: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
                  <input className={styles.input} placeholder="Segundo apellido" value={wizard.segundo_apellido} onChange={e=>setWizard(w=>({...w, segundo_apellido: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
                </div>
                <div style={{ marginTop: 12, display:'flex', gap: 8, justifyContent:'flex-end' }}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={async ()=>{
                    // basic validation
                    if(!wizard.cedula || !wizard.nombre || !wizard.primer_apellido || !wizard.segundo_apellido){ setError('Complete los campos obligatorios'); return }
                    // duplicate check
                    try{
                      const res = await fetch('/api/admin/staff?search=' + encodeURIComponent(wizard.cedula))
                      if (res.ok){
                        const j = await res.json()
                        if ((j.users||[]).some(u => u.cedula === wizard.cedula)) { setError('Cédula ya registrada'); return }
                      }
                    }catch{}
                    setError(null); setWizardStep(2)
                  }}>Siguiente</button>
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div className={styles.enter}>
                <div style={{ marginBottom: 8, color:'#374151' }}>Paso 2: Puesto y rol</div>
                <div className={styles.fields}>
                  <input className={styles.input} placeholder="Posición" value={wizard.posicion} onChange={e=>setWizard(w=>({...w, posicion: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
                  <select className={styles.select} value={wizard.categoria} onChange={e=>setWizard(w=>({...w, categoria: e.target.value}))}>
                    <option value="Titulo I">Titulo I</option>
                    <option value="Titulo II">Titulo II</option>
                  </select>
                  <select className={styles.select} value={wizard.instancia} onChange={e=>setWizard(w=>({...w, instancia: e.target.value}))}>
                    <option value="Propietario">Propietario</option>
                    <option value="Interino">Interino</option>
                  </select>
                  <select className={styles.select} value={wizard.roleTemplate} onChange={e=>setWizard(w=>({...w, roleTemplate: e.target.value}))}>
                    <option value="">Rol por defecto (normal_user)</option>
                    <option value="admin">Administrador</option>
                    <option value="staff_manager">Gestor de personal</option>
                    <option value="infra_manager">Gestor de infraestructura</option>
                  </select>
                </div>
                <div style={{ marginTop: 12, display:'flex', gap: 8, justifyContent:'space-between' }}>
                  <button className={`${styles.btn}`} onClick={()=>setWizardStep(1)}>Atrás</button>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={()=>{
                    if(!wizard.posicion){ setError('Ingrese la posición'); return }
                    setError(null); setWizardStep(3)
                  }}>Siguiente</button>
                </div>
              </div>
            )}
            {wizardStep === 3 && (
              <div className={styles.enter}>
                <div style={{ marginBottom: 8, color:'#374151' }}>Paso 3: Revisión</div>
                <ul style={{ lineHeight: 1.6 }}>
                  <li>Cédula: <b>{wizard.cedula}</b></li>
                  <li>Nombre: <b>{wizard.nombre} {wizard.segundo_nombre} {wizard.primer_apellido} {wizard.segundo_apellido}</b></li>
                  <li>Posición: <b>{wizard.posicion}</b></li>
                  <li>Categoría/Instancia: <b>{wizard.categoria}</b> / <b>{wizard.instancia}</b></li>
                  <li>Rol inicial: <b>{wizard.roleTemplate || 'normal_user'}</b></li>
                </ul>
                <div style={{ marginTop: 12, display:'flex', gap: 8, justifyContent:'space-between' }}>
                  <button className={`${styles.btn}`} onClick={()=>setWizardStep(2)}>Atrás</button>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={async ()=>{
                    setCreating(true)
                    setError(null)
                    try{
                      const payload = {
                        cedula: wizard.cedula,
                        nombre: wizard.nombre,
                        segundo_nombre: wizard.segundo_nombre || null,
                        primer_apellido: wizard.primer_apellido,
                        segundo_apellido: wizard.segundo_apellido,
                        posicion: wizard.posicion,
                        categoria: wizard.categoria,
                        instancia: wizard.instancia,
                      }
                      const res = await fetch('/api/admin/staff', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(payload) })
                      const j = await res.json()
                      if(!res.ok) throw new Error(j.error || 'No se pudo crear')
                      if (wizard.roleTemplate) {
                        await fetch('/api/admin/roles', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ cedula: wizard.cedula, role_slug: wizard.roleTemplate }) })
                      }
                      setStatus('Usuario creado correctamente')
                      setWizardOpen(false)
                      setWizardStep(1)
                      setWizard({ cedula:'', nombre:'', segundo_nombre:'', primer_apellido:'', segundo_apellido:'', posicion:'', categoria:'Titulo I', instancia:'Propietario', roleTemplate:'' })
                      await fetchPage(1)
                    }catch(err){ setError(err.message || String(err)) }
                    finally { setCreating(false) }
                  }}>Guardar y salir</button>
                </div>
              </div>
            )}
            {error && <div style={{ marginTop: 10, color:'#b91c1c' }}>Error: {error}</div>}
          </div>
        </div>
      )}

      {/* Floating Create User action for higher prominence */}
      {mainTab === 'users' && (
        <button
          className={styles.fab}
          title="Crear usuario (N)"
          aria-label="Crear usuario"
          onClick={()=>{ setWizardOpen(true); setWizardStep(1); setTimeout(()=>newCedulaRef.current?.focus(), 50); }}
        >
          +
        </button>
      )}
    </div>
  )
}

// Removed per-field inline editors; we'll use a single modal to edit.

function RoleAssigner({ cedula, onAssign }){
  const [role, setRole] = React.useState('')
  const [options, setOptions] = React.useState([
    // Fallback list; will be replaced by API if available
    'admin', 'staff_manager', 'dev', 'normal_user', 'infra_manager'
  ])

  React.useEffect(() => {
    let ignore = false
    ;(async () => {
      try{
        const res = await fetch('/api/admin/roles')
        if(!res.ok) return // keep fallback on 401/403 or error
        const j = await res.json()
        const slugs = Array.isArray(j.data) ? j.data.map(r => r.slug).filter(Boolean) : []
        if(!ignore && slugs.length) setOptions(slugs)
      }catch{ /* ignore and keep fallback */ }
    })()
    return () => { ignore = true }
  }, [])

  return (
    <span>
      <select value={role} onChange={e=>setRole(e.target.value)}>
        <option value="">Asignar rol</option>
        {options.map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
      <button onClick={()=>{ if(role) onAssign(role); setRole('') }} style={{ marginLeft: 6 }}>Asignar</button>
    </span>
  )
}

function UserDetail({ user, onUpdate, onDelete, onAssignRole, onRemoveRole }){
  const [tab, setTab] = React.useState('personal')
  const [editOpen, setEditOpen] = React.useState(false)
  const [form, setForm] = React.useState({})

  React.useEffect(() => {
    setForm({
      nombre: user.nombre || '',
      segundo_nombre: user.segundo_nombre || '',
      primer_apellido: user.primer_apellido || '',
      segundo_apellido: user.segundo_apellido || '',
      posicion: user.posicion || '',
      categoria: user.categoria || 'Titulo I',
      instancia: user.instancia || 'Propietario',
      must_change_password: !!user.must_change_password,
    })
  }, [user])

  const saveForm = async () => {
    const payload = {
      nombre: form.nombre.trim(),
      segundo_nombre: form.segundo_nombre.trim() || null,
      primer_apellido: form.primer_apellido.trim(),
      segundo_apellido: form.segundo_apellido.trim(),
      posicion: form.posicion.trim(),
      categoria: form.categoria,
      instancia: form.instancia,
      must_change_password: !!form.must_change_password,
    }
    await onUpdate(payload)
    setEditOpen(false)
  }

  return (
    <div>
      <div className={styles.detailHeader}>
        <div>
          <div className={styles.detailTitle}>{user.nombre} {user.segundo_nombre} {user.primer_apellido} {user.segundo_apellido}</div>
          <div className={styles.detailMeta}>Cédula {user.cedula}</div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <button className={`${styles.btn}`} onClick={()=>setEditOpen(true)}>Editar</button>
          <button onClick={onDelete} className={`${styles.btn} ${styles.btnDanger}`} title="Eliminar">Eliminar</button>
        </div>
      </div>

      <div className={styles.subtabs} role="tablist" aria-label="Secciones de usuario">
        <button role="tab" aria-selected={tab==='personal'} className={`${styles.subtab} ${tab==='personal'?styles.subtabActive:''}`} onClick={()=>setTab('personal')}>Datos personales</button>
        <button role="tab" aria-selected={tab==='account'} className={`${styles.subtab} ${tab==='account'?styles.subtabActive:''}`} onClick={()=>setTab('account')}>Cuenta</button>
        <button role="tab" aria-selected={tab==='roles'} className={`${styles.subtab} ${tab==='roles'?styles.subtabActive:''}`} onClick={()=>setTab('roles')}>Roles y permisos</button>
      </div>

      {tab === 'personal' && (
        <div className={`${styles.kvGrid} ${styles.tabPanel}`} role="tabpanel">
          <div className={styles.kvItem}><div className={styles.kvKey}>Nombre</div><div className={styles.kvVal}>{user.nombre}</div></div>
          <div className={styles.kvItem}><div className={styles.kvKey}>Segundo nombre</div><div className={styles.kvVal}>{user.segundo_nombre || '—'}</div></div>
          <div className={styles.kvItem}><div className={styles.kvKey}>Primer apellido</div><div className={styles.kvVal}>{user.primer_apellido}</div></div>
          <div className={styles.kvItem}><div className={styles.kvKey}>Segundo apellido</div><div className={styles.kvVal}>{user.segundo_apellido}</div></div>
          <div className={styles.kvItem}><div className={styles.kvKey}>Posición</div><div className={styles.kvVal}>{user.posicion}</div></div>
          <div className={styles.kvItem}><div className={styles.kvKey}>Categoría</div><div className={styles.kvVal}>{user.categoria}</div></div>
          <div className={styles.kvItem}><div className={styles.kvKey}>Instancia</div><div className={styles.kvVal}>{user.instancia}</div></div>
        </div>
      )}

      {tab === 'account' && (
        <div className={`${styles.tabPanel}`} role="tabpanel">
          <div className={styles.kvItem}><div className={styles.kvKey}>Debe cambiar contraseña</div><div className={styles.kvVal}>{user.must_change_password ? 'Sí' : 'No'}</div></div>
          <div style={{ marginTop: 8 }}>
            <button className={styles.btn} onClick={()=>navigator.clipboard?.writeText(user.cedula)} title="Copiar cédula">Copiar cédula</button>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className={`${styles.tabPanel}`} role="tabpanel">
          <div style={{ display:'flex', flexWrap:'wrap', gap: 6, marginBottom: 8 }}>
            {(user.roles || ['normal_user']).map(r => (
              <span key={r} className={styles.rolePill} style={{ display:'inline-flex', alignItems:'center', gap: 6 }}>
                <span>{r}</span>
                {r !== 'normal_user' && (
                  <button onClick={()=>onRemoveRole(r)} title="Quitar rol" style={{ border:'none', background:'transparent', color:'#ef4444', cursor:'pointer' }}>&times;</button>
                )}
              </span>
            ))}
          </div>
          <RoleAssigner cedula={user.cedula} onAssign={onAssignRole} />
        </div>
      )}

      {editOpen && (
        <div role="dialog" aria-modal="true" className={styles.modalOverlay}>
          <div className={styles.modal} style={{ width: 'min(720px, 94vw)' }}>
            <div className={styles.modalHeader}>
              <strong>Editar usuario</strong>
              <button className={styles.btn} onClick={()=>setEditOpen(false)} aria-label="Cerrar">Cerrar</button>
            </div>
            <div className={styles.fields}>
              <input className={styles.input} placeholder="Nombre" value={form.nombre} onChange={e=>setForm(f=>({...f, nombre: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
              <input className={styles.input} placeholder="Segundo nombre (opcional)" value={form.segundo_nombre} onChange={e=>setForm(f=>({...f, segundo_nombre: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
              <input className={styles.input} placeholder="Primer apellido" value={form.primer_apellido} onChange={e=>setForm(f=>({...f, primer_apellido: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
              <input className={styles.input} placeholder="Segundo apellido" value={form.segundo_apellido} onChange={e=>setForm(f=>({...f, segundo_apellido: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
              <input className={styles.input} placeholder="Posición" value={form.posicion} onChange={e=>setForm(f=>({...f, posicion: e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,'')}))} />
              <select className={styles.select} value={form.categoria} onChange={e=>setForm(f=>({...f, categoria: e.target.value}))}>
                <option value="Titulo I">Titulo I</option>
                <option value="Titulo II">Titulo II</option>
              </select>
              <select className={styles.select} value={form.instancia} onChange={e=>setForm(f=>({...f, instancia: e.target.value}))}>
                <option value="Propietario">Propietario</option>
                <option value="Interino">Interino</option>
              </select>
              <label className={styles.inlineWrap} style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" checked={!!form.must_change_password} onChange={e=>setForm(f=>({...f, must_change_password: e.target.checked}))} />
                <span>Debe cambiar contraseña</span>
              </label>
            </div>
            <div style={{ display:'flex', gap: 8, justifyContent:'flex-end', marginTop: 12 }}>
              <button className={styles.btn} onClick={()=>setEditOpen(false)}>Cancelar</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveForm}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
