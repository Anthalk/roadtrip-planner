import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Map from '../components/Map'

// --- Icônes SVG inline ---
const IconMap = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/>
    <line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
)
const IconUsers = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconUser = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

// --- Onglet Voyages ---
function TabVoyages({ session, onSelectVoyage }) {
  const [voyages, setVoyages] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [nom, setNom] = useState('')
  const [dates, setDates] = useState('')

  useEffect(() => { fetchVoyages() }, [])

  const fetchVoyages = async () => {
    const { data, error } = await supabase
      .from('voyages')
      .select('*, etapes(count)')
      .order('created_at', { ascending: false })
    if (!error) setVoyages(data || [])
    setLoading(false)
  }

  const addVoyage = async () => {
    if (!nom) return
    const { error } = await supabase.from('voyages').insert({ nom, dates, owner_id: session.user.id })
    if (!error) { setNom(''); setDates(''); setModal(false); fetchVoyages() }
  }

  const deleteVoyage = async (id, e) => {
    e.stopPropagation()
    await supabase.from('voyages').delete().eq('id', id)
    fetchVoyages()
  }

  return (
    <>
      <div style={s.sheetHeader}>
        <span style={s.sheetTitle}>Mes voyages</span>
        <span style={s.sheetCount}>{voyages.length} voyage{voyages.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div style={s.empty}>Chargement…</div>
      ) : voyages.length === 0 ? (
        <div style={s.empty}>Crée ton premier voyage</div>
      ) : (
        <div style={s.hscroll}>
          {voyages.map(v => (
            <div key={v.id} style={s.vcard} onClick={() => onSelectVoyage(v.id)}>
              <button style={s.delBtn} onClick={e => deleteVoyage(v.id, e)}>✕</button>
              <div style={s.vcardName}>{v.nom}</div>
              {v.dates && <div style={s.vcardDates}>{v.dates}</div>}
              <div style={s.vcardStats}>
                <div style={s.vstat}>
                  <strong>{v.etapes?.[0]?.count || 0}</strong>
                  <span>étapes</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button style={s.fab} onClick={() => setModal(true)}>+</button>

      {/* Modal nouveau voyage */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhandle} />
            <div style={s.mtitle}>Nouveau voyage</div>
            <div style={s.fg}>
              <label style={s.fl}>Nom</label>
              <input style={s.fi} value={nom} onChange={e => setNom(e.target.value)} placeholder="Road Trip Japon 2027" autoFocus />
            </div>
            <div style={s.fg}>
              <label style={s.fl}>Dates</label>
              <input style={s.fi} value={dates} onChange={e => setDates(e.target.value)} placeholder="Mars 2027" />
            </div>
            <button style={s.btnP} onClick={addVoyage}>Créer</button>
            <button style={s.btnG} onClick={() => setModal(false)}>Annuler</button>
          </div>
        </div>
      )}
    </>
  )
}

// --- Onglet Copains (placeholder) ---
function TabCopains({ session }) {
  return (
    <>
      <div style={s.sheetHeader}>
        <span style={s.sheetTitle}>Copains</span>
      </div>
      <div style={s.empty}>Bientôt disponible</div>
    </>
  )
}

// --- Onglet Profil ---
function TabProfil({ session }) {
  const logout = () => supabase.auth.signOut()
  const initials = session.user.user_metadata?.display_name
    ? session.user.user_metadata.display_name.slice(0, 2).toUpperCase()
    : session.user.email.slice(0, 2).toUpperCase()

  return (
    <>
      <div style={s.sheetHeader}>
        <span style={s.sheetTitle}>Profil</span>
      </div>
      <div style={s.profilContent}>
        <div style={s.avatar}>{initials}</div>
        <div style={s.profilName}>{session.user.user_metadata?.display_name || session.user.email}</div>
        <div style={s.profilEmail}>{session.user.email}</div>
        <button style={{ ...s.btnG, marginTop: 24, width: '100%' }} onClick={logout}>
          Déconnexion
        </button>
      </div>
    </>
  )
}

// --- Composant principal ---
export default function Home({ session, onSelectVoyage }) {
  const [tab, setTab] = useState('voyages')

  const tabs = [
    { id: 'voyages', label: 'Voyages', Icon: IconMap },
    { id: 'copains', label: 'Copains', Icon: IconUsers },
    { id: 'profil',  label: 'Profil',  Icon: IconUser },
  ]

  return (
    <div style={s.app}>
      {/* Carte en fond */}
      <div style={s.mapBg}>
        <Map etapes={[]} />
      </div>

      {/* Bottom sheet */}
      <div style={s.sheet}>
        <div style={s.handle} />

        {/* Contenu selon onglet */}
        {tab === 'voyages' && <TabVoyages session={session} onSelectVoyage={onSelectVoyage} />}
        {tab === 'copains' && <TabCopains session={session} />}
        {tab === 'profil'  && <TabProfil  session={session} />}

        {/* Bottom nav */}
        <div style={s.nav}>
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} style={s.navBtn} onClick={() => setTab(id)}>
              <Icon active={tab === id} />
              <span style={{ ...s.navLabel, color: tab === id ? 'white' : 'rgba(255,255,255,0.35)' }}>
                {label}
              </span>
              {tab === id && <div style={s.navDot} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  app:          { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0D1117' },
  mapBg:        { position: 'absolute', inset: 0, zIndex: 0 },

  // Sheet
  sheet:        { position: 'relative', zIndex: 10, marginTop: 'auto', background: 'rgba(10,14,20,0.92)', backdropFilter: 'blur(24px)', borderRadius: '22px 22px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)' },
  handle:       { width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '12px auto 0' },
  sheetHeader:  { padding: '10px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle:   { fontFamily: 'Georgia,serif', fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  sheetCount:   { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  hscroll:      { overflowX: 'auto', display: 'flex', gap: 10, padding: '14px 20px 8px', scrollbarWidth: 'none' },
  empty:        { textAlign: 'center', padding: '28px 20px 8px', color: 'rgba(255,255,255,0.3)', fontSize: 14 },

  // Cards
  vcard:        { background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, padding: 16, minWidth: 200, cursor: 'pointer', flexShrink: 0, position: 'relative' },
  vcardName:    { fontFamily: 'Georgia,serif', fontSize: 17, color: 'white', marginBottom: 3 },
  vcardDates:   { fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 12 },
  vcardStats:   { display: 'flex', gap: 14 },
  vstat:        { display: 'flex', flexDirection: 'column', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  delBtn:       { position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 13 },

  // FAB
  fab:          { position: 'fixed', zIndex: 20, bottom: 90, right: 20, width: 50, height: 50, borderRadius: '50%', background: 'white', color: '#0D1117', border: 'none', cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.45)' },

  // Bottom nav
  nav:          { display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8, paddingBottom: 'env(safe-area-inset-bottom, 8px)' },
  navBtn:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0 8px', background: 'none', border: 'none', cursor: 'pointer', position: 'relative' },
  navLabel:     { fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'color 0.2s' },
  navDot:       { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: '50%', background: 'white' },

  // Profil
  profilContent:{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 8px' },
  avatar:       { width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', fontSize: 22, color: 'white', marginBottom: 12 },
  profilName:   { fontFamily: 'Georgia,serif', fontSize: 18, color: 'white', marginBottom: 4 },
  profilEmail:  { fontSize: 12, color: 'rgba(255,255,255,0.35)' },

  // Modal
  overlay:      { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end' },
  modal:        { background: '#12171F', borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '0 20px 44px', width: '100%' },
  mhandle:      { width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '14px auto 22px' },
  mtitle:       { fontFamily: 'Georgia,serif', fontSize: 21, color: 'white', marginBottom: 20 },
  fg:           { marginBottom: 15 },
  fl:           { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 6, display: 'block' },
  fi:           { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, color: 'white', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  btnP:         { width: '100%', padding: 14, background: 'white', color: '#0D1117', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  btnG:         { width: '100%', padding: 12, background: 'none', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, fontSize: 14, cursor: 'pointer', marginTop: 8, boxSizing: 'border-box' },
}
