import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('login')

  const handleAuth = async () => {
    setError(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>Road Trip</h1>
        <p style={s.sub}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</p>
        <input style={s.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={s.input} type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
        {error && <p style={s.error}>{error}</p>}
        <button style={s.btn} onClick={handleAuth}>{mode === 'login' ? 'Se connecter' : "S'inscrire"}</button>
        <button style={s.ghost} onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  )
}

const s = {
  wrap:  { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0D1117' },
  card:  { width:'100%', maxWidth:380, padding:'40px 32px', background:'#161B22', borderRadius:20, border:'1px solid rgba(255,255,255,0.08)' },
  title: { fontFamily:'Georgia,serif', fontSize:28, color:'white', marginBottom:4, textAlign:'center' },
  sub:   { fontSize:14, color:'rgba(255,255,255,0.4)', textAlign:'center', marginBottom:28 },
  input: { width:'100%', padding:'12px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'white', fontSize:15, outline:'none', marginBottom:12, boxSizing:'border-box', fontFamily:'inherit' },
  btn:   { width:'100%', padding:14, background:'white', color:'#0D1117', border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer', marginTop:4 },
  ghost: { width:'100%', padding:12, background:'none', color:'rgba(255,255,255,0.35)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, fontSize:13, cursor:'pointer', marginTop:8 },
  error: { fontSize:13, color:'#FF6B6B', marginBottom:8, textAlign:'center' },
}