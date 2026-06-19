import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const LEVELS = [
  { level: 1, name: 'ルーキー', minXp: 0, color: 'bg-gray-400' },
  { level: 2, name: 'セミプロ', minXp: 100, color: 'bg-blue-400' },
  { level: 3, name: 'エース', minXp: 300, color: 'bg-green-500' },
  { level: 4, name: 'エリート', minXp: 700, color: 'bg-yellow-500' },
  { level: 5, name: 'レジェンド', minXp: 1500, color: 'bg-purple-500' },
]

function getLevelInfo(xp) {
  let current = LEVELS[0]
  for (const l of LEVELS) {
    if (xp >= l.minXp) current = l
  }
  return current
}

export default function Team({ session }) {
  const [tab, setTab] = useState('speed')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRanking()
  }, [])

  async function fetchRanking() {
    const { data: profiles } = await supabase.from('profiles').select('*')
    if (!profiles) { setLoading(false); return }

    const enriched = await Promise.all(profiles.map(async p => {
      const { data: records } = await supabase
        .from('pitch_records')
        .select('max_speed, total_pitches, strike_count, practiced_at')
        .eq('user_id', p.id)

      const maxSpeed = records?.length ? Math.max(...records.map(r => r.max_speed)) : 0
      const totalPitches = records?.reduce((s, r) => s + r.total_pitches, 0) || 0
      const avgStrike = records?.length
        ? Math.round(records.filter(r => r.total_pitches > 0).reduce((s, r) => s + r.strike_count / r.total_pitches, 0) / records.length * 100)
        : 0

      return { ...p, maxSpeed, totalPitches, avgStrike, recordCount: records?.length || 0 }
    }))

    setMembers(enriched)
    setLoading(false)
  }

  const sorted = [...members].sort((a, b) => {
    if (tab === 'speed') return b.maxSpeed - a.maxSpeed
    if (tab === 'pitches') return b.totalPitches - a.totalPitches
    if (tab === 'strike') return b.avgStrike - a.avgStrike
    return b.streak_days - a.streak_days
  })

  const tabs = [
    { id: 'speed', label: '最速', icon: '⚡' },
    { id: 'pitches', label: '総投球', icon: '⚾' },
    { id: 'strike', label: 'ストライク率', icon: '🎯' },
    { id: 'streak', label: '連続日数', icon: '🔥' },
  ]

  const getValue = (m) => {
    if (tab === 'speed') return `${m.maxSpeed} km/h`
    if (tab === 'pitches') return `${m.totalPitches.toLocaleString()} 球`
    if (tab === 'strike') return `${m.avgStrike}%`
    return `${m.streak_days || 0} 日`
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-4 pt-2">チームランキング</h1>

      {/* タブ */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-0 flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span>{t.icon}</span>
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {sorted.map((m, i) => {
            const levelInfo = getLevelInfo(m.total_pitches || 0)
            const isMe = m.id === session.user.id
            return (
              <div
                key={m.id}
                className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 ${isMe ? 'ring-2 ring-green-400' : ''}`}
              >
                <div className={`text-xl font-bold w-8 text-center ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </div>
                <div className={`w-10 h-10 rounded-full ${levelInfo.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                  {(m.display_name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 flex items-center gap-1">
                    {m.display_name || '名無し'}
                    {isMe && <span className="text-xs text-green-500 font-medium">（あなた）</span>}
                  </div>
                  <div className="text-xs text-gray-400">{levelInfo.name} • {m.recordCount}回記録</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 text-lg">{getValue(m)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
