import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Home from './pages/Home'
import Voyage from './pages/Voyage'
import Etape from './pages/Etape'
import Onboarding from './pages/Onboarding'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [route, setRoute] = useState({ page: 'home', voyageId: null, etapeId: null })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  const navigate = (page, params = {}) => setRoute({ page, ...params })

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0D1117' }}>
      <div style={{ width:28, height:28, border:'2px solid rgba(255,255,255,0.1)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!session) return <Auth />

  // Profil incomplet → onboarding
  if (!profile?.prenom) return (
    <Onboarding
      session={session}
      onComplete={() => fetchProfile(session.user.id)}
    />
  )

  if (route.page === 'voyage') return (
    <Voyage
      voyageId={route.voyageId}
      onSelectEtape={etapeId => navigate('etape', { voyageId: route.voyageId, etapeId })}
      onBack={() => navigate('home')}
      session={session}
    />
  )

  if (route.page === 'etape') return (
    <Etape
      etapeId={route.etapeId}
      voyageId={route.voyageId}
      onBack={() => navigate('voyage', { voyageId: route.voyageId })}
      session={session}
    />
  )

  return (
    <Home
      session={session}
      profile={profile}
      onSelectVoyage={voyageId => navigate('voyage', { voyageId })}
      onProfileUpdate={() => fetchProfile(session.user.id)}
    />
  )
}
