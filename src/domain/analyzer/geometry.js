export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function distance(a, b) {
  if (!a || !b) return null
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a, b) {
  if (!a || !b) return null
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function jointAngleDeg(a, b, c) {
  if (!a || !b || !c) return null
  const ux = a.x - b.x
  const uy = a.y - b.y
  const vx = c.x - b.x
  const vy = c.y - b.y
  const uLength = Math.hypot(ux, uy)
  const vLength = Math.hypot(vx, vy)
  if (uLength < 1e-8 || vLength < 1e-8) return null
  const cosine = clamp((ux * vx + uy * vy) / (uLength * vLength), -1, 1)
  return Math.acos(cosine) * 180 / Math.PI
}

export function lineAngleDeg(a, b) {
  if (!a || !b) return null
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
}

export function trunkLeanDeg(hipCenter, shoulderCenter) {
  if (!hipCenter || !shoulderCenter) return null
  const dx = shoulderCenter.x - hipCenter.x
  const upward = hipCenter.y - shoulderCenter.y
  if (Math.hypot(dx, upward) < 1e-8) return null
  return Math.atan2(dx, upward) * 180 / Math.PI
}

export function median(values) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!valid.length) return null
  const middle = Math.floor(valid.length / 2)
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2
}
