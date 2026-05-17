import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

function Avatar({ name, email, prenom, nom, size = 36 }) {
  const initials = prenom
    ? (prenom[0] + (nom?.[0] || prenom[1] || '')).toUpperCase()
    : (name || email || '?').slice(0, 2).toUpperCase()
  const hue = ((prenom || name || email || '').charCodeAt(0) * 37) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue}, 35%, 28%)`,
      border: '1px solid rgba(255,255,255,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia,serif', fontSize: size * 0.36, color: 'rgba(255,255,255,0.85)',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function displayName(u) {
  return u.prenom ? `${u.prenom}${u.nom ? ' ' + u.nom : ''}` : u.display_name || u.email
}

export default function EquipageModal({ voyageId, session, onClose }) {
  const [membres, setMembres] = useState([])
  const [copains, setCopains] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const userId = session.user.id

  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Membres actuels du voyage
    const { data: vm } = await supabase
      .from('voyage_membres')
      .select('id, user_id, role')
      .eq('voyage_id', voyageId)

    // 2. Copains de l'utilisateur
    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted')

    const membreIds = (vm || []).map(m => m.user_id)
    const otherIds = (friendships || []).map(f =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    )

    // 3. Profils des membres
    let membresAvecProfil = []
    if (membreIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_initials, prenom, nom, username')
        .in('id', membreIds)
      const map = {}
      if (profiles) profiles.forEach(p => { map[p.id] = p })
      membresAvecProfil = (vm || []).map(m => ({
        ...m,
        ...(map[m.user_id] || { id: m.user_id }),
      }))
    }

    // 4. Profils des copains non encore membres
    let copainsDisponibles = []
    const copainsNonMembres = otherIds.filter(id => !membreIds.includes(id))
    if (copainsNonMembres.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_initials, prenom, nom, username')
        .in('id', copainsNonMembres)
      copainsDisponibles = profiles || []
    }

    setMembres(membresAvecProfil)
    setCopains(copainsDisponibles)
    setLoading(false)
  }, [voyageId, userId])

  useEffect(() => { fetchData() }, [fetchData])

  const ajouterMembre = async (profileId) => {
    setActionLoading(profileId)
    await supabase.from('voyage_membres').insert({
      voyage_id: voyageId,
      user_id: profileId,
      role: 'membre',
    })
    await fetchData()
    setActionLoading(null)
  }

  const retirerMembre = async (vmId) => {
    setActionLoading(vmId)
    await supabase.from('voyage_membres').delete().eq('id', vmId)
    await fetchData()
    setActionLoading(null)
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.mhandle} />
        <div style={s.header}>
          <div style={s.mtitle}>Équipage</div>
          <button style={s.closeBtn} onClick={onClose}><IconX /></button>
        </div>

        {loading ? (
          <div style={s.hint}>Chargement…</div>
        ) : (
          <>
            {/* Membres actuels */}
            <div style={s.sectionLabel}>
              À bord {membres.length > 0 && <span style={s.badge}>{membres.length}</span>}
            </div>

            {membres.length === 0 ? (
              <div style={s.hint}>Aucun membre pour l'instant</div>
            ) : (
              membres.map(m => (
                <div key={m.id} style={s.row}>
                  <Avatar name={m.display_name} email={m.email} prenom={m.prenom} nom={m.nom} />
                  <div style={s.rowInfo}>
                    <div style={s.rowName}>{displayName(m)}</div>
                    <div style={s.rowSub}>
                      {m.username && <span>@{m.username} · </span>}
                      {m.role === 'owner' ? 'Organisateur' : 'Membre'}
                    </div>
                  </div>
                  {m.role !== 'owner' && (
                    <button style={s.btnRemove} onClick={() => retirerMembre(m.id)} disabled={actionLoading === m.id}>
                      <IconX />
                    </button>
                  )}
                </div>
              ))
            )}

            {/* Copains à ajouter */}
            {copains.length > 0 && (
              <>
                <div style={{ ...s.sectionLabel, marginTop: 20 }}>
                  Ajouter un copain
                </div>
                {copains.map(c => (
                  <div key={c.id} style={s.row}>
                    <Avatar name={c.display_name} email={c.email} prenom={c.prenom} nom={c.nom} />
                    <div style={s.rowInfo}>
                      <div style={s.rowName}>{displayName(c)}</div>
                      {c.username && <div style={s.rowSub}>@{c.username}</div>}
                    </div>
                    <button style={s.btnAdd} onClick={() => ajouterMembre(c.id)} disabled={actionLoading === c.id}>
                      <IconPlus />
                    </button>
                  </div>
                ))}
              </>
            )}

            {copains.length === 0 && membres.length > 0 && (
              <div style={{ ...s.hint, marginTop: 20 }}>
                Tous tes copains sont déjà à bord
              </div>
            )}

            {copains.length === 0 && membres.length === 0 && (
              <div style={s.hint}>
                Ajoute des copains depuis l'onglet Copains pour les inviter
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay:      { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end' },
  modal:        { background: '#12171F', borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '0 20px 44px', width: '100%', maxHeight: '80vh', overflowY: 'auto' },
  mhandle:      { width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '14px auto 18px' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  mtitle:       { fontFamily: 'Georgia,serif', fontSize: 21, color: 'white' },
  closeBtn:     { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },
  badge:        { background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '1px 7px', fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  hint:         { fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '12px 0' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName:      { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowSub:       { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  btnAdd:       { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' },
  btnRemove:    { background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' },
}
