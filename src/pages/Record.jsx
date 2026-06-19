import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PITCH_TYPES = ['ストレート', 'チェンジアップ', 'ライズボール', 'ドロップ', 'カーブ', 'スクリュー']
const VIDEO_DAILY_LIMIT = 3

export default function Record({ session, setPage }) {
  const [form, setForm] = useState({
    practiced_at: new Date().toISOString().split('T')[0],
    max_speed: '',
    avg_speed: '',
    total_pitches: '',
    strike_count: '',
    pitch_types: [],
    memo: '',
  })
  const [videoFiles, setVideoFiles] = useState([]) // [{blob, name, type, preview}]
  const [videoError, setVideoError] = useState('')
  const [videoReading, setVideoReading] = useState(false)
  const [todayVideoCount, setTodayVideoCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('pitch_records')
      .select('video_urls')
      .eq('user_id', session.user.id)
      .eq('practiced_at', today)
      .then(({ data }) => {
        const total = (data || []).reduce((sum, r) => sum + (r.video_urls?.length || 0), 0)
        setTodayVideoCount(total)
      })
  }, [])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const togglePitchType = (type) => {
    set('pitch_types', form.pitch_types.includes(type)
      ? form.pitch_types.filter(t => t !== type)
      : [...form.pitch_types, type]
    )
  }

  const handleVideoChange = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setVideoError('')
    const remaining = VIDEO_DAILY_LIMIT - todayVideoCount - videoFiles.length
    const toAdd = files.slice(0, Math.max(0, remaining))
    if (toAdd.length < files.length) {
      setVideoError(`上限のため${toAdd.length}件のみ追加します（本日残り${remaining}件）`)
    }
    const oversized = toAdd.filter(f => f.size > 50 * 1024 * 1024)
    if (oversized.length) {
      setVideoError(`${oversized.map(f => f.name).join(', ')} が50MBを超えています。`)
      return
    }
    setVideoReading(true)
    try {
      const loaded = await Promise.all(toAdd.map(async file => {
        const buffer = await file.arrayBuffer()
        const blob = new Blob([buffer], { type: file.type || 'video/mp4' })
        return { blob, name: file.name, type: file.type || 'video/mp4', preview: URL.createObjectURL(file) }
      }))
      setVideoFiles(prev => [...prev, ...loaded])
    } catch {
      setVideoError('動画の読み込みに失敗しました。もう一度お試しください。')
    } finally {
      setVideoReading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.total_pitches) return
    setLoading(true)

    const uploadedUrls = []
    for (const vf of videoFiles) {
      const ext = vf.name.split('.').pop() || 'mp4'
      const path = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('pitch-videos')
        .upload(path, vf.blob, { contentType: vf.type })
      if (uploadError) {
        setVideoError(`動画のアップロードに失敗しました: ${uploadError.message}`)
        setLoading(false)
        return
      }
      const { data } = supabase.storage.from('pitch-videos').getPublicUrl(path)
      uploadedUrls.push(data.publicUrl)
    }

    const strikeRate = form.total_pitches ? (form.strike_count / form.total_pitches) : 0
    const xpGained = Math.floor(Number(form.total_pitches) * (1 + strikeRate))

    const { error } = await supabase.from('pitch_records').insert({
      user_id: session.user.id,
      practiced_at: form.practiced_at,
      max_speed: form.max_speed ? Number(form.max_speed) : null,
      avg_speed: form.avg_speed ? Number(form.avg_speed) : null,
      total_pitches: Number(form.total_pitches),
      strike_count: form.strike_count ? Number(form.strike_count) : 0,
      pitch_types: form.pitch_types,
      memo: form.memo || null,
      xp_gained: xpGained,
      video_urls: uploadedUrls,
    })

    if (!error) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_pitches, streak_days, last_practiced_at')
        .eq('id', session.user.id)
        .single()

      const today = form.practiced_at
      const lastDate = profile?.last_practiced_at
      const isConsecutive = lastDate && (() => {
        const diff = (new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24)
        return diff === 1
      })()

      await supabase.from('profiles').update({
        total_pitches: (profile?.total_pitches || 0) + Number(form.total_pitches),
        streak_days: isConsecutive ? (profile?.streak_days || 0) + 1 : 1,
        last_practiced_at: today,
      }).eq('id', session.user.id)

      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="p-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-screen">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">記録完了！</h2>
        <p className="text-gray-500 mb-6">ナイスピッチング！</p>
        <button onClick={() => setPage('home')} className="bg-green-500 text-white font-bold py-3 px-8 rounded-full">
          ホームに戻る
        </button>
      </div>
    )
  }

  const strikeRate = form.total_pitches && form.strike_count
    ? Math.round((form.strike_count / form.total_pitches) * 100)
    : null

  const remaining = VIDEO_DAILY_LIMIT - todayVideoCount - videoFiles.length
  const canAdd = remaining > 0

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-4 pt-2">練習記録を入力</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">練習日</label>
            <input type="date" value={form.practiced_at} onChange={e => set('practiced_at', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最速 (km/h)</label>
              <input type="number" value={form.max_speed} onChange={e => set('max_speed', e.target.value)}
                placeholder="例: 85" min="1" max="200"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">平均球速 (km/h)</label>
              <input type="number" value={form.avg_speed} onChange={e => set('avg_speed', e.target.value)}
                placeholder="例: 78" min="1" max="200"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">投球数 <span className="text-red-400">*</span></label>
              <input type="number" value={form.total_pitches} onChange={e => set('total_pitches', e.target.value)}
                required placeholder="例: 50" min="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ストライク数
                {strikeRate !== null && <span className="text-green-500 ml-1">({strikeRate}%)</span>}
              </label>
              <input type="number" value={form.strike_count} onChange={e => set('strike_count', e.target.value)}
                placeholder="例: 35" min="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">練習した球種</label>
          <div className="flex flex-wrap gap-2">
            {PITCH_TYPES.map(type => (
              <button key={type} type="button" onClick={() => togglePitchType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  form.pitch_types.includes(type) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">メモ（任意）</label>
          <textarea value={form.memo} onChange={e => set('memo', e.target.value)}
            placeholder="今日の気づきや調子など..." rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
        </div>

        {/* 動画アップロード */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">フォーム動画（任意）</label>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${!canAdd ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
              本日 {todayVideoCount + videoFiles.length}/{VIDEO_DAILY_LIMIT}
            </span>
          </div>

          {/* 選択済みの動画プレビュー */}
          {videoFiles.map((vf, i) => (
            <div key={vf.preview} className="mb-3 space-y-1">
              <video src={vf.preview} controls className="w-full rounded-lg max-h-48 bg-black" />
              <button type="button" onClick={() => setVideoFiles(prev => prev.filter((_, idx) => idx !== i))}
                className="text-sm text-red-400 hover:text-red-600">
                動画{videoFiles.length > 1 ? i + 1 : ''}を削除
              </button>
            </div>
          ))}

          {/* 追加ボタン */}
          {canAdd ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-5 cursor-pointer hover:border-green-400 transition-colors">
              <span className="text-3xl mb-1">🎥</span>
              <span className="text-sm text-gray-500">タップして動画を選択</span>
              <span className="text-xs text-gray-400 mt-1">複数選択可・各50MB以内（あと{remaining}件）</span>
              <input type="file" accept="video/*" multiple onChange={handleVideoChange} className="hidden" />
            </label>
          ) : (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-5">
              <span className="text-3xl mb-1">🚫</span>
              <span className="text-sm text-gray-400">本日の上限（{VIDEO_DAILY_LIMIT}件）に達しました</span>
            </div>
          )}

          {videoReading && (
            <p className="text-sm text-blue-500 bg-blue-50 rounded-lg px-3 py-2 mt-2">動画を読み込み中... しばらくお待ちください</p>
          )}
          {videoError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-2">{videoError}</p>
          )}
        </div>

        <button type="submit" disabled={loading || videoReading}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-lg transition-colors disabled:opacity-50">
          {videoReading ? '動画準備中...' : loading ? (videoFiles.length ? '動画アップロード中...' : '保存中...') : '記録を保存する ⚾'}
        </button>
      </form>
    </div>
  )
}
