import { useEffect, useState } from 'react'
import AnalysisResultPanel from '../components/analyzer/AnalysisResultPanel'
import { getAnalysis } from '../infrastructure/storage/analysisDb'

export default function AnalyzerSavedResult({ analysisId, setPage }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAnalysis(analysisId)
      .then(data => {
        if (!data) setError('解析結果がこの端末に見つかりませんでした。')
        else setAnalysis(data)
      })
      .catch(() => setError('解析結果を読み込めませんでした。'))
      .finally(() => setLoading(false))
  }, [analysisId])

  return (
    <div className="p-4 max-w-lg mx-auto">
      <button onClick={() => setPage('stats', analysis?.ownerUserId || null)} className="text-sm text-green-700 py-2 mb-2">← 統計に戻る</button>
      <div className="mb-4">
        <p className="text-xs font-bold text-blue-600">FORM ANALYZER β</p>
        <h1 className="text-xl font-bold text-gray-800">保存済み解析結果</h1>
        {analysis && <p className="text-sm text-gray-500 mt-1">練習日 {analysis.practicedAt}・解析日 {new Date(analysis.createdAt).toLocaleString('ja-JP')}</p>}
      </div>
      {loading && <div className="bg-white rounded-2xl p-8 text-center text-gray-500">読み込み中...</div>}
      {error && <div className="bg-red-50 rounded-2xl p-4 text-red-600 text-sm">{error}</div>}
      {analysis && (
        <>
          <a href={analysis.videoUrl} target="_blank" rel="noreferrer" className="block w-full text-center bg-blue-600 text-white font-bold rounded-xl py-3 mb-2">元の動画を開く</a>
          <p className="text-xs text-gray-500 mb-3">骨格座標を含む解析データはこの端末内に保存されています。</p>
          <AnalysisResultPanel result={analysis.result} />
        </>
      )}
    </div>
  )
}
