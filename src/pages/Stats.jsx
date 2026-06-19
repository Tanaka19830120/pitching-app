import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../supabase'

const PITCH_TYPES = ['ストレート', 'チェンジアップ', 'ライズボール', 'ドロップ', 'カーブ', 'スクリュー']

function EditModal({ record, session, onClose, onSave }) {
  const [form, setForm] = useState({
    practiced_at: record.practiced_at,
    max_speed: record.max_speed || '',
    avg_speed: record.avg_speed || '',
    total_pitches: record.total_pitches,
    strike_count: record.strike_count || 0,
    pitch_types: record.pitch_types || [],
    memo: record.memo || '',
  })
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(record.video_url || null)
  const [saving, setSaving] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const togglePitchType = (type) => {
    set('pitch_types', form.pitch_types.includes(type)
      ? form.pitch_types.filter(t => t !== type)
      : [...form.pitch_types, type]
    )
  }

  const handleVideoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)

    let videoUrl = record.video_url
    if (videoFile) {
      const ext = videoFile.name.split('.').pop()
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('pitch-videos')
        .upload(path, videoFile, { contentType: videoFile.type })
      if (!uploadError) {
        const { data } = supabase.storage.from('pitch-videos').getPublicUrl(path)
        videoUrl = data.publicUrl
      }
    } else if (!videoPreview) {
      videoUrl = null
    }

    const { error } = await supabase
      .from('pitch_records')
      .update({
        practiced_at: form.practiced_at,
        max_speed: form.max_speed ? Number(form.max_speed) : null,
        avg_speed: form.avg_speed ? Number(form.avg_speed) : null,
        total_pitches: Number(form.total_pitches),
        strike_count: Number(form.strike_count),
        pitch_types: form.pitch_types,
        memo: form.memo || null,
        video_url: videoUrl,
      })
      .eq('id', record.id)
    setSaving(false)
    if (!error) onSave()
  }

  const strikeRate = form.total_pitches && form.strike_count
    ? Math.round((form.strike_count / form.total_pitches) * 100)
    : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">記録を編集</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">&times;</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">練習日</label>
            <input type="date" value={form.practiced_at} onChange={e => set('practiced_at', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最速 (km/h)</label>
              <input type="number" value={form.max_speed} onChange={e => set('max_speed', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">平均球速 (km/h)</label>
              <input type="number" value={form.avg_speed} onChange={e => set('avg_speed', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">投球数</label>
              <input type="number" value={form.total_pitches} onChange={e => set('total_pitches', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ストライク数{strikeRate !== null && <span className="text-green-500 ml-1">({strikeRate}%)</span>}
              </label>
              <input type="number" value={form.strike_count} onChange={e => set('strike_count', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">球種</label>
            <div className="flex flex-wrap gap-2">
              {PITCH_TYPES.map(type => (
                <button key={type} type="button" onClick={() => togglePitchType(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    form.pitch_types.includes(type) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
            <textarea value={form.memo} onChange={e => set('memo', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">フォーム動画</label>
            {videoPreview ? (
              <div className="space-y-2">
                <video src={videoPreview} controls className="w-full rounded-lg max-h-40 bg-black" />
                <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(null) }}
                  className="text-sm text-red-400 hover:text-red-600">動画を削除</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-4 cursor-pointer hover:border-green-400 transition-colors">
                <span className="text-2xl mb-1">🎥</span>
                <span className="text-sm text-gray-500">タップして動画を選択</span>
                <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
              </label>
            )}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}

export default function Stats({ session, targetUserId, isOwn, setPage }) {
  const [records, setRecords] = useState([])
  const [profileName, setProfileName] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingRecord, setEditingRecord] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { fetchRecords() }, [targetUserId])

  async function fetchRecords() {
    setLoading(true)
    const [{ data }, { data: profile }] = await Promise.all([
      supabase.from('pitch_records').select('*').eq('user_id', targetUserId).order('practiced_at', { ascending: true }),
      supabase.from('profiles').select('display_name').eq('id', targetUserId).single(),
    ])
    setRecords(data || [])
    setProfileName(profile?.display_name || '')
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('この記録を削除しますか？')) return
    setDeletingId(id)
    await supabase.from('pitch_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
    setDeletingId(null)
  }

  if (loading) return <div className="p-6 text-center text-gray-400 pt-20">読み込み中...</div>

  if (records.length === 0) {
    return (
      <div className="p-6 text-center pt-20">
        {!isOwn && (
          <button onClick={() => setPage('team')} className="text-green-600 text-sm mb-6 block mx-auto">← チームに戻る</button>
        )}
        <div className="text-5xl mb-4">📊</div>
        <p className="text-gray-500">{isOwn ? '記録がまだありません。' : `${profileName}さんの記録はまだありません。`}</p>
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
      {!isOwn && (
        <button onClick={() => setPage('team')} className="text-green-600 text-sm mb-2 flex items-center gap-1">
          ← チームに戻る
        </button>
      )}
      <h1 className="text-xl font-bold text-gray-800 mb-4 pt-1">
        {isOwn ? 'あなたの統計' : `${profileName}さんの統計`}
      </h1>

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
        <div className="space-y-3">
          {[...records].reverse().map(r => (
            <div key={r.id} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-500 w-16 shrink-0">
                  {new Date(r.practiced_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                </div>
                <div className="font-bold text-green-600 w-20 shrink-0">{r.max_speed} km/h</div>
                <div className="text-sm text-gray-400 flex-1">
                  {r.total_pitches}球 / {r.total_pitches ? `${Math.round((r.strike_count / r.total_pitches) * 100)}%` : '-'}
                </div>
                {isOwn && (
                  <>
                    <button onClick={() => setEditingRecord(r)}
                      className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 shrink-0">
                      編集
                    </button>
                    <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 shrink-0 disabled:opacity-40">
                      削除
                    </button>
                  </>
                )}
              </div>
              {r.pitch_types?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 ml-16">
                  {r.pitch_types.map(t => (
                    <span key={t} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}
              {r.memo && (
                <div className="mt-1.5 ml-16 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                  {r.memo}
                </div>
              )}
              {r.video_url && (
                <div className="mt-2 ml-16">
                  <video src={r.video_url} controls playsInline className="w-full rounded-xl max-h-52 bg-black">
                    <source src={r.video_url} />
                  </video>
                  <a href={r.video_url} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-1 block">
                    動画を開く / ダウンロード
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {editingRecord && (
        <EditModal
          record={editingRecord}
          session={session}
          onClose={() => setEditingRecord(null)}
          onSave={() => { setEditingRecord(null); fetchRecords() }}
        />
      )}
    </div>
  )
}
