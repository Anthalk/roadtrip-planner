import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)

  const handleAuth = async () => {
    setError(null)
    setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>EnRoute</h1>
        <p style={s.sub}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</p>

        {/* Google */}
        <button style={s.google} onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continuer avec Google
        </button>

        <div style={s.divider}>
          <div style={s.dividerLine}/><span style={s.dividerText}>ou</span><div style={s.dividerLine}/>
        </div>

        <input style={s.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={s.input} type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />

        {error && <p style={s.error}>{error}</p>}

        <button style={s.btn} onClick={handleAuth} disabled={loading}>
          {loading ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
        <button style={s.ghost} onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  )
}

const s = {
  wrap:        { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0D1117' },
  card:        { width:'100%', maxWidth:380, padding:'40px 32px', background:'#161B22', borderRadius:20, border:'1px solid rgba(255,255,255,0.08)' },
  title:       { fontFamily:'Georgia,serif', fontSize:28, color:'white', marginBottom:4, textAlign:'center' },
  sub:         { fontSize:14, color:'rgba(255,255,255,0.4)', textAlign:'center', marginBottom:24 },
  google:      { width:'100%', padding:'12px', background:'white', color:'#0D1117', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16, fontFamily:'inherit' },
  divider:     { display:'flex', alignItems:'center', gap:12, marginBottom:16 },
  dividerLine: { flex:1, height:1, background:'rgba(255,255,255,0.08)' },
  dividerText: { fontSize:12, color:'rgba(255,255,255,0.3)' },
  input:       { width:'100%', padding:'12px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'white', fontSize:15, fontFamily:'inherit', outline:'none', marginBottom:12, boxSizing:'border-box' },
  btn:         { width:'100%', padding:14, background:'white', color:'#0D1117', border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer', marginTop:4 },
  ghost:       { width:'100%', padding:12, background:'none', color:'rgba(255,255,255,0.35)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, fontSize:13, cursor:'pointer', marginTop:8 },
  error:       { fontSize:13, color:'#FF6B6B', marginBottom:8, textAlign:'center' },
}