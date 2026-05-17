import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconUserPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/>
    <line x1="23" y1="11" x2="17" y2="11"/>
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

export default function TabCopains({ session }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [copains, setCopains] = useState([])
  const [demandes, setDemandes] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const userId = session.user.id

  const fetchRelations = useCallback(async () => {
    setLoading(true)

    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error || !friendships) { setLoading(false); return }

    const otherIds = [...new Set(
      friendships.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id)
    )]

    let profilesMap = {}
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_initials, prenom, nom, username')
        .in('id', otherIds)
      if (profiles) profiles.forEach(p => { profilesMap[p.id] = p })
    }

    const accepted = friendships.filter(f => f.status === 'accepted')
    const pending  = friendships.filter(f => f.status === 'pending')

    setCopains(accepted.map(f => {
      const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id
      return { ...(profilesMap[otherId] || { id: otherId }), friendshipId: f.id }
    }))

    setDemandes(pending
      .filter(f => f.addressee_id === userId)
      .map(f => ({ ...(profilesMap[f.requester_id] || { id: f.requester_id }), friendshipId: f.id }))
    )

    setSent(pending
      .filter(f => f.requester_id === userId)
      .map(f => f.addressee_id)
    )

    setLoading(false)
  }, [userId])

  useEffect(() => { fetchRelations() }, [fetchRelations])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timeout = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_initials, prenom, nom, username')
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%,username.ilike.%${query}%,prenom.ilike.%${query}%`)
        .neq('id', userId)
        .limit(5)
      setResults(data || [])
      setSearching(false)
    }, 350)
    return () => clearTimeout(timeout)
  }, [query, userId])

  const showFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2500)
  }

  const envoyerDemande = async (targetId) => {
    setActionLoading(targetId)
    const { error } = await supabase.from('friendships').insert({
      requester_id: userId,
      addressee_id: targetId,
      status: 'pending',
    })
    if (!error) {
      setSent(s => [...s, targetId])
      showFeedback('Demande envoyée !')
    }
    setActionLoading(null)
  }

  const repondre = async (friendshipId, accept) => {
    setActionLoading(friendshipId)
    if (accept) {
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
      showFeedback('Copain ajouté !')
    } else {
      await supabase.from('friendships').delete().eq('id', friendshipId)
      showFeedback('Demande refusée')
    }
    await fetchRelations()
    setActionLoading(null)
  }

  const supprimerCopain = async (friendshipId) => {
    setActionLoading(friendshipId)
    await supabase.from('friendships').delete().eq('id', friendshipId)
    await fetchRelations()
    setActionLoading(null)
  }

  const getStatut = (targetId) => {
    if (copains.find(c => c.id === targetId)) return 'copain'
    if (sent.includes(targetId)) return 'envoyé'
    if (demandes.find(d => d.id === targetId)) return 'reçu'
    return 'aucun'
  }

  return (
    <div style={s.container}>
      {feedback && <div style={s.toast}>{feedback}</div>}

      <div style={s.searchWrap}>
        <div style={s.searchIcon}><IconSearch /></div>
        <input
          style={s.searchInput}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher par nom, pseudo ou email…"
        />
        {query && (
          <button style={s.clearBtn} onClick={() => { setQuery(''); setResults([]) }}>
            <IconX />
          </button>
        )}
      </div>

      {/* Résultats recherche */}
      {query.trim() && (
        <div style={s.section}>
          {searching ? (
            <div style={s.hint}>Recherche…</div>
          ) : results.length === 0 ? (
            <div style={s.hint}>Aucun utilisateur trouvé</div>
          ) : (
            results.map(u => {
              const statut = getStatut(u.id)
              return (
                <div key={u.id} style={s.row}>
                  <Avatar name={u.display_name} email={u.email} prenom={u.prenom} nom={u.nom} />
                  <div style={s.rowInfo}>
                    <div style={s.rowName}>{displayName(u)}</div>
                    {u.username && <div style={s.rowSub}>@{u.username}</div>}
                  </div>
                  {statut === 'aucun' && (
                    <button style={s.btnAdd} onClick={() => envoyerDemande(u.id)} disabled={actionLoading === u.id}>
                      <IconUserPlus />
                    </button>
                  )}
                  {statut === 'envoyé' && <span style={s.tag}>Envoyé</span>}
                  {statut === 'copain'  && <span style={s.tag}>Copain</span>}
                  {statut === 'reçu'   && <span style={s.tag}>Reçu</span>}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Demandes reçues */}
      {!query && demandes.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionLabel}>
            Demandes reçues <span style={s.badge}>{demandes.length}</span>
          </div>
          {demandes.map(d => (
            <div key={d.friendshipId} style={s.row}>
              <Avatar name={d.display_name} email={d.email} prenom={d.prenom} nom={d.nom} />
              <div style={s.rowInfo}>
                <div style={s.rowName}>{displayName(d)}</div>
                {d.username && <div style={s.rowSub}>@{d.username}</div>}
              </div>
              <div style={s.actions}>
                <button style={s.btnAccept} onClick={() => repondre(d.friendshipId, true)} disabled={actionLoading === d.friendshipId}>
                  <IconCheck />
                </button>
                <button style={s.btnRefuse} onClick={() => repondre(d.friendshipId, false)} disabled={actionLoading === d.friendshipId}>
                  <IconX />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste copains */}
      {!query && (
        <div style={s.section}>
          <div style={s.sectionLabel}>
            Mes copains {copains.length > 0 && <span style={s.badge}>{copains.length}</span>}
          </div>
          {loading ? (
            <div style={s.hint}>Chargement…</div>
          ) : copains.length === 0 ? (
            <div style={s.hint}>Recherche des amis pour les ajouter</div>
          ) : (
            copains.map(c => (
              <div key={c.friendshipId} style={s.row}>
                <Avatar name={c.display_name} email={c.email} prenom={c.prenom} nom={c.nom} />
                <div style={s.rowInfo}>
                  <div style={s.rowName}>{displayName(c)}</div>
                  {c.username && <div style={s.rowSub}>@{c.username}</div>}
                </div>
                <button style={s.btnRemove} onClick={() => supprimerCopain(c.friendshipId)} disabled={actionLoading === c.friendshipId}>
                  <IconX />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  container:    { padding: '10px 0 8px', maxHeight: '60vh', overflowY: 'auto' },
  toast:        { position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 20px', color: 'white', fontSize: 13, fontWeight: 500, zIndex: 300, whiteSpace: 'nowrap' },
  searchWrap:   { margin: '8px 16px 4px', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '0 12px', gap: 8 },
  searchIcon:   { display: 'flex', alignItems: 'center', flexShrink: 0 },
  searchInput:  { flex: 1, background: 'none', border: 'none', outline: 'none', color: 'white', fontSize: 14, padding: '11px 0', fontFamily: 'inherit' },
  clearBtn:     { background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 },
  section:      { padding: '8px 16px 0' },
  sectionLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 },
  badge:        { background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '1px 7px', fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  hint:         { fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '12px 0 8px' },
  row:          { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  rowInfo:      { flex: 1, minWidth: 0 },
  rowName:      { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowSub:       { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  actions:      { display: 'flex', gap: 6 },
  btnAdd:       { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' },
  btnAccept:    { background: 'rgba(74,173,138,0.15)', border: '1px solid rgba(74,173,138,0.3)', borderRadius: 8, color: '#4AAD8A', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' },
  btnRefuse:    { background: 'rgba(232,115,74,0.1)', border: '1px solid rgba(232,115,74,0.2)', borderRadius: 8, color: '#E8734A', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' },
  btnRemove:    { background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' },
  tag:          { fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' },
}
