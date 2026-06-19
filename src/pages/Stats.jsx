import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../supabase'

export default function Stats({ session }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('pitch_records')
      .select('*')
      .eq('user_id', session.user.id)
      .order('practiced_at', { ascending: true })
      .then(({ data }) => {
        setRecords(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-6 text-center text-gray-400 pt-20">読み込み中...</div>

  if (records.length === 0) {
    return (
      <div className="p-6 text-center pt-20">
        <div className="text-5xl mb-4">📊</div>
        <p className="text-gray-500">記録がまだありません。<br />練習を記録してみよう！</p>
      </div>
    )
  }

  const chartData = records.map(r => ({
    date: new Date(r.practiced_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
    最速: r.max_speed,
    平均: r.avg_speed,
    ストライク率: r.total_pitches ? Math.round((r.strike_count / r.total_pitches) * 100) : null,
  }))

  const maxSpeed = Math.max(...records.map(r => r.max_speed))
  const totalPitches = records.reduce((s, r) => s + r.total_pitches, 0)
  const avgStrikeRate = records.filter(r => r.total_pitches > 0).reduce((s, r) => s + r.strike_count / r.total_pitches, 0) / records.length

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-4 pt-2">あなたの統計</h1>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: '最速記録', value: `${maxSpeed}`, unit: 'km/h', color: 'text-green-600' },
          { label: '総投球数', value: totalPitches.toLocaleString(), unit: '球', color: 'text-blue-600' },
          { label: '平均ストライク率', value: `${Math.round(avgStrikeRate * 100)}`, unit: '%', color: 'text-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}<span className="text-sm">{s.unit}</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 球速グラフ */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h2 className="font-bold text-gray-700 mb-3">球速の推移</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="km" />
            <Tooltip formatter={(v, name) => [`${v} km/h`, name]} />
            <Line type="monotone" dataKey="最速" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            {records.some(r => r.avg_speed) && (
              <Line type="monotone" dataKey="平均" stroke="#86efac" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ストライク率グラフ */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h2 className="font-bold text-gray-700 mb-3">ストライク率の推移</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v) => [`${v}%`, 'ストライク率']} />
            <Line type="monotone" dataKey="ストライク率" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 記録一覧 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-700 mb-3">全記録</h2>
        <div className="space-y-2">
          {[...records].reverse().map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="text-sm text-gray-500">{new Date(r.practiced_at).toLocaleDateString('ja-JP')}</div>
              <div className="font-bold text-green-600">{r.max_speed} km/h</div>
              <div className="text-sm text-gray-400">{r.total_pitches}球</div>
              <div className="text-sm text-gray-400">
                {r.total_pitches ? `${Math.round((r.strike_count / r.total_pitches) * 100)}%` : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
