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
  let next = LEVELS[1]
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) {
      current = LEVELS[i]
      next = LEVELS[i + 1] || null
    }
  }
  return { current, next }
}

export default function Home({ session, setPage }) {
  const [profile, setProfile] = useState(null)
  const [recentRecords, setRecentRecords] = useState([])
  const [teamFeed, setTeamFeed] = useState([])

  useEffect(() => {
    fetchProfile()
    fetchTeamFeed()
  }, [])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    setProfile(data)

    const { data: records } = await supabase
      .from('pitch_records')
      .select('*')
      .eq('user_id', session.user.id)
      .order('practiced_at', { ascending: false })
      .limit(5)
    setRecentRecords(records || [])
  }

  async function fetchTeamFeed() {
    const { data } = await supabase
      .from('pitch_records')
      .select('*, profiles(display_name)')
      .order('practiced_at', { ascending: false })
      .limit(10)
    setTeamFeed(data || [])
  }

  const xp = profile?.total_pitches || 0
  const { current, next } = getLevelInfo(xp)
  const progress = next ? ((xp - current.minXp) / (next.minXp - current.minXp)) * 100 : 100
  const displayName = profile?.display_name || session.user.email?.split('@')[0]

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-4 pt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">こんにちは、{displayName}！</h1>
          <p className="text-sm text-gray-500">今日も練習がんばろう⚾</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ログアウト
        </button>
      </div>

      {/* レベルカード */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-12 h-12 rounded-full ${current.color} flex items-center justify-center text-white font-bold text-lg`}>
            Lv{current.level}
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-800">{current.name}</div>
            <div className="text-xs text-gray-500">{xp} XP {next ? `/ 次のレベルまで ${next.minXp - xp} XP` : '最高レベル！'}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">{profile?.streak_days || 0}</div>
            <div className="text-xs text-gray-500">日連続</div>
          </div>
        </div>
        <div className="bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${current.color} transition-all`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* クイック記録ボタン */}
      <button
        onClick={() => setPage('record')}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl shadow-sm text-lg mb-4 transition-colors active:scale-95"
      >
        ⚾ 今日の練習を記録する
      </button>

      {/* 自分の最近の記録 */}
      {recentRecords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h2 className="font-bold text-gray-700 mb-3">最近の記録</h2>
          <div className="space-y-2">
            {recentRecords.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{new Date(r.practiced_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>
                <span className="font-bold text-green-600">{r.max_speed} km/h</span>
                <span className="text-gray-400">{r.total_pitches}球</span>
                <span className="text-gray-400">ストライク率 {r.total_pitches ? Math.round((r.strike_count / r.total_pitches) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* チームタイムライン */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-700 mb-3">チームの最新記録</h2>
        {teamFeed.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">まだ記録がありません</p>
        ) : (
          <div className="space-y-3">
            {teamFeed.map(r => (
              <div key={r.id} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-600 shrink-0">
                  {(r.profiles?.display_name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-800">{r.profiles?.display_name || '不明'}</span>
                    <span className="text-xs text-gray-400">{new Date(r.practiced_at).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    最速 <span className="font-bold text-green-600">{r.max_speed} km/h</span>
                    　{r.total_pitches}球投げました
                  </div>
                  {r.memo && <div className="text-xs text-gray-400 mt-0.5 truncate">{r.memo}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
