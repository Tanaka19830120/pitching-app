const FEATURES = [
  { icon: '🦴', title: '骨格を重ねて確認', detail: '33点の骨格を動画上に表示します。' },
  { icon: '⏱️', title: '主要な瞬間を確認', detail: '腕トップ、前足接地、リリース推定点を確認します。' },
  { icon: '📊', title: '動きを数値化', detail: '体幹傾き、頭部のずれ、肘・膝角度を表示します。' },
]

export default function AnalyzerHome({ setPage }) {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <button onClick={() => setPage('home')} className="text-sm text-green-700 py-2 mb-2">
        ← ホームに戻る
      </button>

      <section className="rounded-3xl bg-gradient-to-br from-blue-700 to-slate-900 text-white p-6 shadow-lg mb-4">
        <div className="text-4xl mb-3">🎥</div>
        <p className="text-xs font-bold tracking-wider text-blue-200 mb-1">FORM ANALYZER β</p>
        <h1 className="text-2xl font-bold mb-2">ピッチングフォーム解析</h1>
        <p className="text-sm leading-6 text-blue-100">
          動画からウィンドミル投法の動きを確認します。解析はこの端末のブラウザ内で行います。
        </p>
      </section>

      <div className="space-y-3 mb-4">
        {FEATURES.map(feature => (
          <div key={feature.title} className="bg-white rounded-2xl p-4 shadow-sm flex gap-3">
            <span className="text-2xl" aria-hidden="true">{feature.icon}</span>
            <div>
              <h2 className="font-bold text-gray-800">{feature.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{feature.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setPage('analyzerSetup')} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-4 transition">
        動画を選んで解析
      </button>
      <p className="text-xs text-gray-500 leading-5 mt-3 px-1">
        表示する角度は単眼動画による2D投影値です。実際のボール離脱ではなく「リリース推定点」を扱います。
      </p>
    </div>
  )
}
