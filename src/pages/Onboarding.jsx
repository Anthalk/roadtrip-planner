import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Onboarding({ session, onComplete }) {
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!prenom.trim() || !username.trim()) {
      setError('Le prénom et le nom d\'utilisateur sont obligatoires.')
      return
    }
    if (!/^[a-z0-9._]+$/.test(username)) {
      setError('Le nom d\'utilisateur ne peut contenir que des lettres minuscules, chiffres, points et underscores.')
      return
    }

    setLoading(true)
    setError(null)

    // Vérifier unicité du username
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .neq('id', session.user.id)
      .single()

    if (existing) {
      setError('Ce nom d\'utilisateur est déjà pris.')
      setLoading(false)
      return
    }

    const displayName = `${prenom.trim()}${nom.trim() ? ' ' + nom.trim() : ''}`
    const initials = (prenom[0] || '') + (nom[0] || prenom[1] || '')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        prenom: prenom.trim(),
        nom: nom.trim() || null,
        username: username.trim(),
        display_name: displayName,
        avatar_initials: initials.toUpperCase(),
      })
      .eq('id', session.user.id)

    if (updateError) {
      setError('Une erreur est survenue. Réessaie.')
      setLoading(false)
      return
    }

    onComplete()
  }

  return (
    <div style={s.app}>
      <div style={s.card}>
        <div style={s.logo}>✈</div>
        <div style={s.title}>Bienvenue sur EnRoute</div>
        <div style={s.sub}>Complète ton profil pour commencer</div>

        <div style={s.fg}>
          <label style={s.fl}>Ton prénom - (où celui d'un autre, mais on déconseille) <span style={s.required}>*</span></label>
          <input
            style={s.fi}
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            placeholder="Antoine"
            autoFocus
          />
        </div>

        <div style={s.fg}>
          <label style={s.fl}>Ton nom de famille - il n'y a que tes copains qui pourront le voir</label>
          <input
            style={s.fi}
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Dupont"
          />
        </div>

        <div style={s.fg}>
          <label style={s.fl}> Et un petit surnom ? <span style={s.required}>*</span></label>
          <div style={s.usernameWrap}>
            <span style={s.usernameAt}>@</span>
            <input
              style={s.usernameInput}
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
              placeholder="LeGOAT"
            />
          </div>
          <div style={s.hint}>Lettres minuscules, chiffres, points et underscores uniquement</div>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <button style={{ ...s.btnP, opacity: loading ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Enregistrement…' : 'Commencer'}
        </button>
      </div>
    </div>
  )
}

const s = {
  app:          { position: 'fixed', inset: 0, background: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card:         { width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '36px 28px 32px' },
  logo:         { fontSize: 32, textAlign: 'center', marginBottom: 16 },
  title:        { fontFamily: 'Georgia,serif', fontSize: 24, color: 'white', textAlign: 'center', marginBottom: 6 },
  sub:          { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 28 },
  fg:           { marginBottom: 16 },
  fl:           { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 6, display: 'block' },
  required:     { color: 'rgba(255,100,100,0.7)' },
  fi:           { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, color: 'white', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  usernameWrap: { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, overflow: 'hidden' },
  usernameAt:   { padding: '12px 0 12px 14px', color: 'rgba(255,255,255,0.3)', fontSize: 15, flexShrink: 0 },
  usernameInput:{ flex: 1, padding: '12px 14px 12px 6px', background: 'none', border: 'none', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit' },
  hint:         { fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 5 },
  error:        { background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'rgba(255,120,120,0.9)', marginBottom: 16 },
  btnP:         { width: '100%', padding: 14, background: 'white', color: '#0D1117', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
}
