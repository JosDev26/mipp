"use client"

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const [cedula, setCedula] = React.useState('');
  React.useEffect(() => {
    try {
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const c = sp.get('cedula');
      if (c) setCedula(c);
    } catch (e) {}
  }, []);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type:'info'|'success'|'error', text }
  const [errorsList, setErrorsList] = useState([]);
  const summaryRef = useRef(null);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorsList(['La contraseña debe tener al menos 8 caracteres']);
      setStatus({ type: 'error', text: 'Corrige los campos marcados.' });
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      return;
    }
    setErrorsList([]);
    setStatus({ type: 'info', text: 'Guardando…' });
    setLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ cedula, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error desconocido');
      setStatus({ type: 'success', text: 'Contraseña cambiada. Redirigiendo…' });
      setTimeout(() => router.push('/login'), 700);
    } catch (err) {
      setStatus({ type: 'error', text: 'Error cambiando contraseña: ' + (err.message || String(err)) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth:400, margin:'2rem auto', display:'grid', gap:12 }}>
      <div role="status" aria-live="polite" style={{ minHeight:24 }}>
        {status?.text && (
          <div style={{
            padding:'10px 12px', borderRadius:10, fontWeight:700,
            background: status?.type==='error' ? '#fef2f2' : status?.type==='success' ? '#ecfdf5' : '#eff6ff',
            color: status?.type==='error' ? '#991b1b' : status?.type==='success' ? '#065f46' : '#1e40af',
            border: '1px solid',
            borderColor: status?.type==='error' ? '#fecaca' : status?.type==='success' ? '#a7f3d0' : '#bfdbfe'
          }}>{status.text}</div>
        )}
      </div>
      {errorsList.length > 0 && (
        <div ref={summaryRef} role="alert" aria-live="assertive" style={{ border:'1px solid #e5e7eb', borderLeft:'4px solid #dc2626', background:'#fffafa', borderRadius:10, padding:'10px 12px' }}>
          <strong>Revisa estos puntos:</strong>
          <ul style={{ margin:'8px 0 0 18px' }}>{errorsList.map((m,i)=>(<li key={i}>{m}</li>))}</ul>
        </div>
      )}
      <h2 style={{ margin:0 }}>Cambiar contraseña</h2>
      <p>Usuario: <strong>{cedula}</strong></p>
      <label style={{ display:'grid', gap:6 }}>
        Nueva contraseña:
        <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8 }} />
      </label>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button disabled={loading} type="submit" style={{ border:'none', borderRadius:999, padding:'10px 16px', fontWeight:800, background:'#7a1f26', color:'#fff' }}>
          {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </div>
    </form>
  );
}
