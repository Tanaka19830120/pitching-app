import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Record from './pages/Record'
import Stats from './pages/Stats'
import Team from './pages/Team'
import Nav from './components/Nav'

export default function App() {
  const [session, setSession] = useState(null)
  const [page, setPage] = useState('home')
  const [viewingUserId, setViewingUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const navigateTo = (newPage, userId = null) => {
    setViewingUserId(userId)
    setPage(newPage)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-green-100">
        <div className="text-green-600 text-xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  const targetUserId = viewingUserId || session.user.id

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 pb-20">
      {page === 'home' && <Home session={session} setPage={navigateTo} />}
      {page === 'record' && <Record session={session} setPage={navigateTo} />}
      {page === 'stats' && (
        <Stats
          session={session}
          targetUserId={targetUserId}
          isOwn={targetUserId === session.user.id}
          setPage={navigateTo}
        />
      )}
      {page === 'team' && <Team session={session} setPage={navigateTo} />}
      <Nav page={page} setPage={navigateTo} />
    </div>
  )
}
