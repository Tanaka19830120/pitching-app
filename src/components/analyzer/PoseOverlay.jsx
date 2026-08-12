const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [27, 29], [29, 31], [24, 26], [26, 28], [28, 30], [30, 32],
]

export default function PoseOverlay({ landmarks }) {
  if (!landmarks?.length) return null

  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-label="検出した骨格">
      {CONNECTIONS.map(([from, to]) => {
        const a = landmarks[from]
        const b = landmarks[to]
        if (!a || !b || a.visibility < 0.35 || b.visibility < 0.35) return null
        return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#38bdf8" strokeWidth="0.008" />
      })}
      {landmarks.map((point, index) => point.visibility >= 0.35 && (
        <circle key={index} cx={point.x} cy={point.y} r="0.011" fill="#f8fafc" stroke="#1d4ed8" strokeWidth="0.004" />
      ))}
    </svg>
  )
}
