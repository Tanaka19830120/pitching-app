import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const EVENT_LABELS = {
  motionStart: 'モーション開始',
  armTop: '腕トップ',
  strideFootContact: '前足接地',
  releaseProxy: 'リリース推定点',
  followThrough: 'フォロースルー',
}

function display(value, unit, digits = 1) {
  return Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : 'データ不足'
}

export default function AnalysisResultPanel({ result, onJumpToEvent = null }) {
  const chartData = result.series.map(item => ({
    time: (item.timeMs / 1000).toFixed(2),
    体幹傾き: Number.isFinite(item.trunkLean) ? Number(item.trunkLean.toFixed(1)) : null,
    投球肘: Number.isFinite(item.throwingElbow) ? Number(item.throwingElbow.toFixed(1)) : null,
    前脚膝: Number.isFinite(item.strideKnee) ? Number(item.strideKnee.toFixed(1)) : null,
  }))

  const cards = [
    ['リリース時の体幹傾き', display(result.summary.trunkLeanAtRelease, '°')],
    ['体幹傾きの変化', display(result.summary.trunkLeanChange, '°')],
    ['投球肘角度', display(result.summary.throwingElbowAtRelease, '°')],
    ['前脚膝角度', display(result.summary.strideKneeAtContact, '°')],
    ['腕トップ→リリース', display(result.summary.armTopToReleaseMs, 'ms', 0)],
    ['接地→リリース', display(result.summary.contactToReleaseMs, 'ms', 0)],
  ]

  return (
    <div className="mt-4 space-y-4">
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">解析品質</p>
            <h2 className="text-lg font-bold text-gray-800">{result.quality.label}</h2>
          </div>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl ${result.quality.score >= 80 ? 'bg-green-100 text-green-700' : result.quality.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
            {result.quality.score}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">必須関節の検出率 {Math.round(result.quality.requiredLandmarkCoverage * 100)}%</p>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-800 mb-3">主要な瞬間</h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(EVENT_LABELS).map(([id, label]) => {
            const event = result.events[id]
            return (
              <button key={id} type="button" disabled={!event || !onJumpToEvent} onClick={() => onJumpToEvent?.(event)}
                className="min-h-14 text-left rounded-xl bg-blue-50 disabled:bg-gray-50 px-3 py-2">
                <span className="block text-sm font-bold text-blue-800">{label}</span>
                <span className="text-xs text-gray-500">{event ? `${(event.timeMs / 1000).toFixed(2)}秒・信頼度${Math.round(event.confidence * 100)}%` : '検出できませんでした'}</span>
              </button>
            )
          })}
        </div>
      </section>

      {result.feedback.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold text-gray-800 px-1">確認ポイント</h2>
          {result.feedback.map(item => (
            <div key={item.title} className={`rounded-2xl p-4 border ${item.severity === 'high' ? 'bg-red-50 border-red-100' : item.severity === 'notice' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
              <h3 className="font-bold text-gray-800">{item.title}</h3>
              <p className="text-sm text-gray-700 mt-1">{item.observation}</p>
              <p className="text-xs text-gray-500 mt-2">次に確認：{item.checkNext}</p>
            </div>
          ))}
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-800 mb-3">主要指標</h2>
        <div className="grid grid-cols-2 gap-2">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="font-bold text-gray-800 mt-1">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-800 mb-1">角度の推移</h2>
        <p className="text-xs text-gray-500 mb-3">画面平面上の2D投影角です。</p>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} unit="秒" />
            <YAxis tick={{ fontSize: 10 }} unit="°" />
            <Tooltip />
            <Line type="monotone" dataKey="体幹傾き" stroke="#2563eb" dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="投球肘" stroke="#f97316" dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="前脚膝" stroke="#16a34a" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 justify-center">
          <span>● 青：体幹</span><span>● オレンジ：投球肘</span><span>● 緑：前脚膝</span>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-800 text-slate-100 p-4 text-xs leading-5">
        この解析は単眼動画の2D投影値です。実際のボール離脱ではなく「リリース推定点」を扱い、フォームの良否や医療上の判断を断定しません。
      </section>
    </div>
  )
}
