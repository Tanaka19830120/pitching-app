import { useEffect, useMemo, useRef, useState } from 'react'
import { VIDEO_LIMITS, validateTrimRange, validateVideoFile } from '../domain/analyzer/videoValidation'
import { createPoseAdapter } from '../infrastructure/mediapipe/poseAdapter'
import PoseOverlay from '../components/analyzer/PoseOverlay'
import AnalysisResultPanel from '../components/analyzer/AnalysisResultPanel'
import { analyzePoseFrames } from '../domain/analyzer/poseAnalysis'
import { makeAnalysisId, saveAnalysis } from '../infrastructure/storage/analysisDb'

const STEPS = ['動画', '範囲', '被写体', '投球情報']
const DEFAULT_CONFIG = {
  throwingHand: 'right',
  cameraView: 'front',
  screenDirection: 'right',
  throwMode: 'actual',
  mirrored: false,
  note: '',
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(Math.floor(safe % 60)).padStart(2, '0')}.${String(Math.floor((safe % 1) * 10))}`
}

export default function AnalyzerSetup({ setPage, sourceVideo = null }) {
  const videoRef = useRef(null)
  const [step, setStep] = useState(sourceVideo ? 1 : 0)
  const [file, setFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [isObjectUrl, setIsObjectUrl] = useState(false)
  const [sourceLoading, setSourceLoading] = useState(Boolean(sourceVideo))
  const [metadata, setMetadata] = useState(null)
  const [trim, setTrim] = useState({ start: 0, end: 0 })
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 })
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [error, setError] = useState('')
  const [analysisState, setAnalysisState] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [poseFrames, setPoseFrames] = useState([])
  const [currentPose, setCurrentPose] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')
  const abortRef = useRef(null)

  useEffect(() => {
    if (!sourceVideo?.url) return undefined
    const controller = new AbortController()

    async function loadSavedVideo() {
      setSourceLoading(true)
      setError('')
      try {
        const response = await fetch(sourceVideo.url, { signal: controller.signal, mode: 'cors' })
        if (!response.ok) throw new Error(`動画の取得に失敗しました（${response.status}）`)
        const blob = await response.blob()
        if (!blob.type.startsWith('video/')) throw new Error('保存されているファイルを動画として読み込めませんでした。')
        const localUrl = URL.createObjectURL(blob)
        setVideoUrl(localUrl)
        setIsObjectUrl(true)
      } catch (caught) {
        if (caught?.name !== 'AbortError') {
          setError(`登録済み動画を読み込めませんでした: ${caught?.message || '不明なエラー'}`)
        }
      } finally {
        if (!controller.signal.aborted) setSourceLoading(false)
      }
    }

    loadSavedVideo()
    return () => controller.abort()
  }, [sourceVideo])

  useEffect(() => () => {
    if (videoUrl && isObjectUrl) URL.revokeObjectURL(videoUrl)
  }, [videoUrl, isObjectUrl])

  const frameSeconds = useMemo(() => 1 / (metadata?.estimatedFps || 30), [metadata])
  const trimValidation = validateTrimRange(trim.start, trim.end)

  function updateConfig(key, value) {
    setConfig(current => ({ ...current, [key]: value }))
  }

  function chooseFile(event) {
    const selected = event.target.files?.[0]
    const validation = validateVideoFile(selected)
    if (!validation.valid) {
      setError(validation.message)
      return
    }
    if (videoUrl && isObjectUrl) URL.revokeObjectURL(videoUrl)
    setError('')
    setMetadata(null)
    setFile(selected)
    setVideoUrl(URL.createObjectURL(selected))
    setIsObjectUrl(true)
  }

  function handleLoadedMetadata(event) {
    const video = event.currentTarget
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      setError('動画の長さを読み取れませんでした。別の動画をお試しください。')
      return
    }
    if (video.duration > VIDEO_LIMITS.maxDurationSeconds) {
      setError('動画は60秒以内にしてください。端末で短く切り出してから選択してください。')
      return
    }
    const end = Math.min(video.duration, 8)
    setMetadata({
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      estimatedFps: 30,
      size: file?.size ?? null,
    })
    setTrim({ start: 0, end })
  }

  function seek(delta) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.min(trim.end, Math.max(trim.start, video.currentTime + delta))
  }

  function setTrimStart(value) {
    const next = Math.min(Number(value), trim.end - VIDEO_LIMITS.minTrimSeconds)
    setTrim(current => ({ ...current, start: Math.max(0, next) }))
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, next)
  }

  function setTrimEnd(value) {
    const next = Math.max(Number(value), trim.start + VIDEO_LIMITS.minTrimSeconds)
    const limited = Math.min(metadata?.duration || next, next)
    setTrim(current => ({ ...current, end: limited }))
    if (videoRef.current) videoRef.current.currentTime = limited
  }

  function applyCurrentTime(edge) {
    const currentTime = videoRef.current?.currentTime ?? 0
    if (edge === 'start') setTrimStart(currentTime)
    else setTrimEnd(currentTime)
  }

  function next() {
    setError('')
    if (step === 0 && !metadata) {
      setError('再生できる動画を選択してください。')
      return
    }
    if (step === 1 && !trimValidation.valid) {
      setError(trimValidation.message)
      return
    }
    setStep(current => Math.min(STEPS.length - 1, current + 1))
  }

  function back() {
    if (step === 0) setPage(sourceVideo ? 'stats' : 'analyzer', sourceVideo?.ownerUserId || null)
    else if (step === 1 && sourceVideo) setPage('stats', sourceVideo.ownerUserId)
    else setStep(current => current - 1)
  }

  async function startAnalysis() {
    if (!videoRef.current || !trimValidation.valid) return
    setError('')
    setProgress(0)
    setPoseFrames([])
    setCurrentPose(null)
    setAnalysisResult(null)
    setAnalysisState('loadingModel')
    const controller = new AbortController()
    abortRef.current = controller
    let adapter

    try {
      adapter = await createPoseAdapter()
      if (controller.signal.aborted) return
      setAnalysisState('extracting')
      const frames = await adapter.analyzeVideo({
        video: videoRef.current,
        startSeconds: trim.start,
        endSeconds: trim.end,
        fps: metadata?.estimatedFps || 30,
        signal: controller.signal,
        onProgress: setProgress,
        onFrame: frame => {
          if (frame.frameIndex % 5 === 0 || frame.landmarks?.[0]) setCurrentPose(frame.landmarks?.[0] || null)
        },
      })
      setPoseFrames(frames)
      const result = analyzePoseFrames(frames, config)
      setAnalysisResult(result)
      if (sourceVideo?.recordId) {
        const id = makeAnalysisId(sourceVideo.recordId, sourceVideo.videoIndex, sourceVideo.url)
        try {
          await saveAnalysis({
            id,
            schemaVersion: '1.0.0',
            createdAt: new Date().toISOString(),
            recordId: sourceVideo.recordId,
            videoIndex: sourceVideo.videoIndex,
            videoUrl: sourceVideo.url,
            ownerUserId: sourceVideo.ownerUserId,
            practicedAt: sourceVideo.practicedAt,
            config,
            trim,
            crop,
            result,
          })
          setSaveMessage('解析結果をこの端末に保存しました。統計一覧からいつでも開けます。')
        } catch {
          setSaveMessage('解析は完了しましたが、端末への保存に失敗しました。この画面では結果を確認できます。')
        }
      }
      const lastDetected = [...frames].reverse().find(frame => frame.landmarks?.[0])
      setCurrentPose(lastDetected?.landmarks?.[0] || null)
      setAnalysisState('completed')
    } catch (caught) {
      if (caught?.name === 'AbortError') {
        setAnalysisState('cancelled')
      } else {
        setError(`骨格解析に失敗しました: ${caught?.message || '不明なエラー'}`)
        setAnalysisState('failed')
      }
    } finally {
      adapter?.close()
      abortRef.current = null
    }
  }

  function cancelAnalysis() {
    abortRef.current?.abort()
  }

  function jumpToEvent(event) {
    if (!event || !videoRef.current) return
    videoRef.current.currentTime = event.timeMs / 1000
    const frame = poseFrames.find(item => item.frameIndex === event.frameIndex)
    setCurrentPose(frame?.landmarks?.[0] || null)
  }

  function handleVideoTimeUpdate(event) {
    if (!poseFrames.length) return
    const timeMs = event.currentTarget.currentTime * 1000
    const nearest = poseFrames.reduce((best, frame) => Math.abs(frame.timeMs - timeMs) < Math.abs(best.timeMs - timeMs) ? frame : best, poseFrames[0])
    setCurrentPose(nearest.landmarks?.[0] || null)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <button onClick={back} className="text-sm text-green-700 py-2 mb-2">← 戻る</button>

      <div className="flex gap-1 mb-5" aria-label={`設定 ${step + 1}/${STEPS.length}`}>
        {STEPS.map((label, index) => (
          <div key={label} className="flex-1 text-center">
            <div className={`h-1.5 rounded-full mb-1 ${index <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <span className={`text-[11px] ${index === step ? 'font-bold text-blue-700' : 'text-gray-400'}`}>{label}</span>
          </div>
        ))}
      </div>

      {sourceVideo && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-4">
          <p className="text-sm font-bold text-blue-800">登録済み動画を解析</p>
          <p className="text-xs text-blue-600 mt-0.5">{sourceVideo.practicedAt}・動画{sourceVideo.videoIndex + 1}</p>
        </div>
      )}

      {sourceLoading && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 text-center">
          <div className="inline-block w-7 h-7 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-2" />
          <p className="text-sm font-bold text-blue-800">登録済み動画を端末へ読み込み中...</p>
          <p className="text-xs text-gray-500 mt-1">解析処理は読み込み後、この端末内で行います。</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        {step === 0 && (
          <section>
            <h1 className="text-xl font-bold text-gray-800 mb-1">動画を選択</h1>
            <p className="text-sm text-gray-500 mb-4">MP4・MOV・WebM、250MB・60秒以内</p>
            <label className="min-h-32 border-2 border-dashed border-blue-200 bg-blue-50 rounded-2xl flex flex-col items-center justify-center cursor-pointer px-4 text-center">
              <span className="text-3xl mb-2">🎬</span>
              <span className="font-bold text-blue-700">端末から動画を選ぶ</span>
              <input type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={chooseFile} className="hidden" />
            </label>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="text-xl font-bold text-gray-800 mb-1">解析範囲を選択</h1>
            <p className="text-sm text-gray-500 mb-4">動画を再生しながら、青い範囲に投球1回が入るよう調整してください。</p>

            <div className="rounded-2xl bg-slate-50 p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500">開始</p>
                  <p className="font-bold text-blue-700 text-lg">{formatTime(trim.start)}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${trimValidation.valid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {(trim.end - trim.start).toFixed(1)}秒
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">終了</p>
                  <p className="font-bold text-blue-700 text-lg">{formatTime(trim.end)}</p>
                </div>
              </div>

              <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden mb-5">
                <div className="absolute h-full bg-blue-500 rounded-full"
                  style={{
                    left: `${metadata?.duration ? (trim.start / metadata.duration) * 100 : 0}%`,
                    width: `${metadata?.duration ? ((trim.end - trim.start) / metadata.duration) * 100 : 0}%`,
                  }} />
              </div>

              <label className="block text-sm font-bold text-gray-700 mb-4">
                <span className="flex justify-between mb-1"><span>① 開始位置</span><span>{trim.start.toFixed(2)}秒</span></span>
                <input type="range" min="0" max={Math.max(0, (trim.end || 1) - 1)} step="0.033" value={trim.start}
                  onChange={event => setTrimStart(event.target.value)} className="w-full h-3 accent-blue-600" />
              </label>

              <label className="block text-sm font-bold text-gray-700">
                <span className="flex justify-between mb-1"><span>② 終了位置</span><span>{trim.end.toFixed(2)}秒</span></span>
                <input type="range" min={Math.min(metadata?.duration || 1, trim.start + 1)} max={metadata?.duration || 1} step="0.033" value={trim.end}
                  onChange={event => setTrimEnd(event.target.value)} className="w-full h-3 accent-blue-600" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button type="button" onClick={() => applyCurrentTime('start')} className="min-h-12 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-bold">現在位置を開始にする</button>
              <button type="button" onClick={() => applyCurrentTime('end')} className="min-h-12 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-bold">現在位置を終了にする</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[3, 5, 8].map(seconds => (
                <button key={seconds} type="button" onClick={() => setTrimEnd(Math.min(metadata?.duration || seconds, trim.start + seconds))}
                  className="shrink-0 min-h-11 px-3 rounded-xl bg-gray-100 text-gray-600 text-sm">
                  開始から{seconds}秒
                </button>
              ))}
            </div>
            {!trimValidation.valid && <p className="text-sm mt-3 text-amber-600">{trimValidation.message}</p>}
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-xl font-bold text-gray-800 mb-1">被写体の範囲</h1>
            <p className="text-sm text-gray-500 mb-4">最初は全画面で解析できます。必要な場合だけ調整してください。</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(crop).map(([key, value]) => (
                <label key={key} className="text-sm text-gray-600">{{ x: '左', y: '上', width: '幅', height: '高さ' }[key]}（%）
                  <input type="range" min="0" max="100" value={value}
                    onChange={event => setCrop(current => ({ ...current, [key]: Number(event.target.value) }))}
                    className="w-full accent-blue-600" />
                  <span className="text-xs text-gray-400">{value}%</span>
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setCrop({ x: 0, y: 0, width: 100, height: 100 })}
              className="mt-3 text-sm text-blue-600">全画面に戻す</button>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-xl font-bold text-gray-800 mb-4">投球情報</h1>
            <div className="space-y-4">
              <SelectButtons label="投球腕" value={config.throwingHand} onChange={value => updateConfig('throwingHand', value)} options={[['right', '右投げ'], ['left', '左投げ']]} />
              <SelectButtons label="撮影方向" value={config.cameraView} onChange={value => updateConfig('cameraView', value)} options={[['front', '正面'], ['back', '背面'], ['armSide', '投球腕側'], ['gloveSide', 'グラブ側'], ['unknown', '不明']]} />
              {(config.cameraView === 'armSide' || config.cameraView === 'gloveSide') && (
                <SelectButtons label="画面上の投球方向" value={config.screenDirection} onChange={value => updateConfig('screenDirection', value)} options={[['left', '左方向'], ['right', '右方向']]} />
              )}
              <SelectButtons label="動画種別" value={config.throwMode} onChange={value => updateConfig('throwMode', value)} options={[['shadow', 'ボールなし'], ['ballShadow', 'ボールありシャドー'], ['actual', '実投球']]} />
              <label className="flex items-center justify-between text-sm text-gray-700 border border-gray-100 rounded-xl p-3">
                鏡像の動画
                <input type="checkbox" checked={config.mirrored} onChange={event => updateConfig('mirrored', event.target.checked)} className="w-5 h-5 accent-blue-600" />
              </label>
              <label className="block text-sm text-gray-600">メモ
                <textarea value={config.note} onChange={event => updateConfig('note', event.target.value)} rows="2"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 resize-none" />
              </label>
            </div>
          </section>
        )}
      </div>

      {videoUrl && (
        <div className="bg-white rounded-2xl shadow-sm p-3 mb-4">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} src={videoUrl} crossOrigin="anonymous" onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleVideoTimeUpdate} controls playsInline className="w-full max-h-64 block" />
            <PoseOverlay landmarks={currentPose} />
          </div>
          {metadata && (
            <div className="mt-2">
              <div className="flex justify-center gap-2 mb-2">
                <button type="button" onClick={() => seek(-frameSeconds)} className="min-h-11 px-4 rounded-xl bg-gray-100 text-gray-700">−1コマ</button>
                <button type="button" onClick={() => seek(frameSeconds)} className="min-h-11 px-4 rounded-xl bg-gray-100 text-gray-700">＋1コマ</button>
              </div>
              <p className="text-xs text-gray-500 text-center">
                {formatTime(metadata.duration)}・{metadata.width}×{metadata.height}・推定30fps
                {metadata.size != null ? `・${(metadata.size / 1024 / 1024).toFixed(1)}MB` : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 mb-3">{error}</p>}

      {step < STEPS.length - 1 ? (
        <button onClick={next} className="w-full min-h-12 rounded-2xl bg-blue-600 text-white font-bold">次へ</button>
      ) : (
        <>
          {(analysisState === 'loadingModel' || analysisState === 'extracting') ? (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-bold text-blue-700">{analysisState === 'loadingModel' ? 'モデルを準備中' : '骨格を抽出中'}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <button type="button" onClick={cancelAnalysis} className="w-full min-h-11 rounded-xl border border-gray-300 text-gray-600 font-bold">キャンセル</button>
            </div>
          ) : (
            <button onClick={startAnalysis} className="w-full min-h-12 rounded-2xl bg-blue-600 text-white font-bold">
              {analysisState === 'completed' ? 'もう一度解析する' : '解析開始'}
            </button>
          )}
          {analysisState === 'completed' && (
            <div className="mt-3 bg-green-50 border border-green-100 rounded-2xl p-4">
              <p className="font-bold text-green-800">骨格解析が完了しました</p>
              <p className="text-sm text-green-700 mt-1">
                {poseFrames.length}フレーム中、{poseFrames.filter(frame => frame.landmarks.length > 0).length}フレームで人物を検出しました。
              </p>
              <p className="text-xs text-green-700 mt-2">主要イベント、角度、確認ポイントを下に表示しています。</p>
              {sourceVideo?.ownerUserId && (
                <button type="button" onClick={() => setPage('stats', sourceVideo.ownerUserId)}
                  className="w-full min-h-12 mt-3 rounded-xl bg-green-600 text-white font-bold">
                  統計一覧へ戻る
                </button>
              )}
            </div>
          )}
          {analysisState === 'cancelled' && <p className="mt-3 text-sm text-gray-600 bg-gray-100 rounded-xl p-3">解析をキャンセルしました。設定を変えて再実行できます。</p>}
          {analysisResult && <AnalysisResultPanel result={analysisResult} onJumpToEvent={jumpToEvent} />}
          {saveMessage && <p className="mt-3 text-sm text-blue-700 bg-blue-50 rounded-xl p-3">{saveMessage}</p>}
        </>
      )}

      <p className="text-xs text-gray-500 leading-5 mt-4">
        動画は解析のために外部サービスへ送信されません。表示値は単眼動画の2D投影値です。
      </p>
    </div>
  )
}

function SelectButtons({ label, value, onChange, options }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700 mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([id, text]) => (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`min-h-11 px-3 rounded-xl text-sm border ${value === id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
