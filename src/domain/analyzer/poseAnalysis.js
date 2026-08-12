import { clamp, distance, jointAngleDeg, lineAngleDeg, median, midpoint, trunkLeanDeg } from './geometry'

const L = Object.freeze({
  nose: 0,
  leftShoulder: 11, rightShoulder: 12,
  leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28,
})

const REQUIRED = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

function confidence(point) {
  return point ? Math.min(point.visibility ?? 0, point.presence ?? point.visibility ?? 0) : 0
}

function validPoint(pose, index) {
  const point = pose?.[index]
  return confidence(point) >= 0.5 ? point : null
}

function deriveFrame(frame, hand) {
  const pose = frame.landmarks?.[0]
  if (!pose) return { ...frame, pose: null }
  const throwingRight = hand === 'right'
  const shoulder = validPoint(pose, throwingRight ? L.rightShoulder : L.leftShoulder)
  const elbow = validPoint(pose, throwingRight ? L.rightElbow : L.leftElbow)
  const wrist = validPoint(pose, throwingRight ? L.rightWrist : L.leftWrist)
  const gloveShoulder = validPoint(pose, throwingRight ? L.leftShoulder : L.rightShoulder)
  const gloveElbow = validPoint(pose, throwingRight ? L.leftElbow : L.rightElbow)
  const gloveWrist = validPoint(pose, throwingRight ? L.leftWrist : L.rightWrist)
  const strideHip = validPoint(pose, throwingRight ? L.leftHip : L.rightHip)
  const strideKnee = validPoint(pose, throwingRight ? L.leftKnee : L.rightKnee)
  const strideAnkle = validPoint(pose, throwingRight ? L.leftAnkle : L.rightAnkle)
  const driveHip = validPoint(pose, throwingRight ? L.rightHip : L.leftHip)
  const driveKnee = validPoint(pose, throwingRight ? L.rightKnee : L.leftKnee)
  const driveAnkle = validPoint(pose, throwingRight ? L.rightAnkle : L.leftAnkle)
  const leftShoulder = validPoint(pose, L.leftShoulder)
  const rightShoulder = validPoint(pose, L.rightShoulder)
  const leftHip = validPoint(pose, L.leftHip)
  const rightHip = validPoint(pose, L.rightHip)
  const shoulderCenter = midpoint(leftShoulder, rightShoulder)
  const hipCenter = midpoint(leftHip, rightHip)
  const shoulderWidth = distance(leftShoulder, rightShoulder)
  const legLength = [
    (distance(validPoint(pose, L.leftHip), validPoint(pose, L.leftKnee)) || 0) + (distance(validPoint(pose, L.leftKnee), validPoint(pose, L.leftAnkle)) || 0),
    (distance(validPoint(pose, L.rightHip), validPoint(pose, L.rightKnee)) || 0) + (distance(validPoint(pose, L.rightKnee), validPoint(pose, L.rightAnkle)) || 0),
  ].filter(value => value > 0)

  return {
    ...frame,
    pose,
    points: { shoulder, elbow, wrist, gloveShoulder, gloveElbow, gloveWrist, strideHip, strideKnee, strideAnkle, driveHip, driveKnee, driveAnkle, hipCenter, shoulderCenter },
    shoulderWidth,
    torsoLength: distance(shoulderCenter, hipCenter),
    legLength: legLength.length ? legLength.reduce((sum, value) => sum + value, 0) / legLength.length : null,
  }
}

function speed(current, previous, currentTime, previousTime, scale) {
  const d = distance(current, previous)
  const seconds = (currentTime - previousTime) / 1000
  return d != null && seconds > 0 && scale > 0 ? d / seconds / scale : null
}

function event(frame, confidenceValue, reasonCodes) {
  return frame ? { frameIndex: frame.frameIndex, timeMs: frame.timeMs, confidence: clamp(confidenceValue, 0, 1), source: 'auto', reasonCodes } : null
}

export function analyzePoseFrames(poseFrames, config = {}) {
  const derived = poseFrames.map(frame => deriveFrame(frame, config.throwingHand || 'right'))
  const referenceCount = Math.max(3, Math.floor(derived.length * 0.15))
  const referenceFrames = derived.slice(0, referenceCount)
  const shoulderWidthRef = median(referenceFrames.map(frame => frame.shoulderWidth)) || median(derived.map(frame => frame.shoulderWidth)) || 1
  const torsoLengthRef = median(referenceFrames.map(frame => frame.torsoLength)) || median(derived.map(frame => frame.torsoLength)) || 1
  const legLengthRef = median(referenceFrames.map(frame => frame.legLength)) || median(derived.map(frame => frame.legLength)) || 1
  const bodyScaleRef = torsoLengthRef + legLengthRef

  const series = derived.map((frame, index) => {
    const previous = derived[index - 1]
    const p = frame.points || {}
    return {
      frameIndex: frame.frameIndex,
      timeMs: frame.timeMs,
      trunkLean: trunkLeanDeg(p.hipCenter, p.shoulderCenter),
      headOffset: p.pose && p.hipCenter ? (p.pose[L.nose].x - p.hipCenter.x) / shoulderWidthRef : null,
      shoulderTilt: lineAngleDeg(validPoint(frame.pose, L.leftShoulder), validPoint(frame.pose, L.rightShoulder)),
      pelvisTilt: lineAngleDeg(validPoint(frame.pose, L.leftHip), validPoint(frame.pose, L.rightHip)),
      throwingElbow: jointAngleDeg(p.shoulder, p.elbow, p.wrist),
      gloveElbow: jointAngleDeg(p.gloveShoulder, p.gloveElbow, p.gloveWrist),
      strideKnee: jointAngleDeg(p.strideHip, p.strideKnee, p.strideAnkle),
      driveKnee: jointAngleDeg(p.driveHip, p.driveKnee, p.driveAnkle),
      wristSpeed: previous ? speed(p.wrist, previous.points?.wrist, frame.timeMs, previous.timeMs, bodyScaleRef) : null,
      hipSpeed: previous ? speed(p.hipCenter, previous.points?.hipCenter, frame.timeMs, previous.timeMs, bodyScaleRef) : null,
      strideAnkleSpeed: previous ? speed(p.strideAnkle, previous.points?.strideAnkle, frame.timeMs, previous.timeMs, bodyScaleRef) : null,
      pose: frame.pose,
      points: p,
    }
  })

  const baselineCount = Math.max(2, series.findIndex(item => item.timeMs - series[0].timeMs >= 300))
  const wristBaseline = median(series.slice(0, baselineCount).map(item => item.wristSpeed)) || 0
  const motionIndex = Math.max(0, series.findIndex((item, index) => index > 1 && ((item.wristSpeed || 0) > Math.max(0.35, wristBaseline * 2.5) || (item.hipSpeed || 0) > 0.15)))
  const motionStart = derived[motionIndex]

  const afterMotion = series.slice(motionIndex + 1)
  const armTopItem = afterMotion.filter(item => item.points?.wrist && item.points?.shoulder && item.points.wrist.y < item.points.shoulder.y)
    .sort((a, b) => a.points.wrist.y - b.points.wrist.y)[0]
  const armTopIndex = armTopItem?.frameIndex ?? Math.min(derived.length - 1, motionIndex + Math.floor(derived.length * 0.25))

  const releaseCandidates = series.filter(item => item.frameIndex > armTopIndex && item.points?.wrist && item.points?.driveHip)
    .map(item => ({ item, proximity: distance(item.points.wrist, item.points.driveHip) }))
    .filter(candidate => candidate.proximity != null)
    .sort((a, b) => {
      const scoreA = (a.item.wristSpeed || 0) - a.proximity * 3
      const scoreB = (b.item.wristSpeed || 0) - b.proximity * 3
      return scoreB - scoreA
    })
  const releaseIndex = releaseCandidates[0]?.item.frameIndex ?? Math.min(derived.length - 1, armTopIndex + Math.floor(derived.length * 0.3))

  const contactCandidates = series.filter(item => item.frameIndex > motionIndex && item.frameIndex <= releaseIndex + 3 && Number.isFinite(item.strideAnkleSpeed))
  const contactItem = contactCandidates.length ? contactCandidates.reduce((best, item) => item.strideAnkleSpeed < best.strideAnkleSpeed ? item : best) : null
  const contactIndex = contactItem?.frameIndex ?? null

  const releasePeak = Math.max(...series.slice(Math.max(0, releaseIndex - 3), releaseIndex + 4).map(item => item.wristSpeed || 0), 0.01)
  const followItem = series.slice(releaseIndex + 1).find(item => (item.wristSpeed || 0) < releasePeak * 0.2)
  const followIndex = followItem?.frameIndex ?? derived.length - 1

  const coverageObservations = derived.length * REQUIRED.length
  const covered = derived.reduce((sum, frame) => sum + REQUIRED.filter(index => confidence(frame.pose?.[index]) >= 0.5).length, 0)
  const requiredLandmarkCoverage = coverageObservations ? covered / coverageObservations : 0
  const subjectHeights = derived.map(frame => {
    if (!frame.pose) return null
    const ys = frame.pose.filter(point => confidence(point) >= 0.5).map(point => point.y)
    return ys.length ? Math.max(...ys) - Math.min(...ys) : null
  })
  const subjectHeightRatio = median(subjectHeights) || 0
  const eventConfidence = clamp(requiredLandmarkCoverage, 0, 1)
  const qualityScore = Math.round(100 * (0.45 * requiredLandmarkCoverage + 0.25 * clamp(subjectHeightRatio / 0.55, 0, 1) + 0.30 * eventConfidence))

  const events = {
    motionStart: event(motionStart, eventConfidence * 0.8, ['SPEED_RISE']),
    armTop: event(derived[armTopIndex], eventConfidence * 0.85, ['WRIST_HIGHEST']),
    strideFootContact: contactIndex != null ? event(derived[contactIndex], Math.min(0.9, eventConfidence * 0.7), ['ANKLE_SPEED_LOW']) : null,
    releaseProxy: event(derived[releaseIndex], eventConfidence * 0.75, ['WRIST_SPEED_HIP_PROXIMITY']),
    followThrough: event(derived[followIndex], followItem ? eventConfidence * 0.7 : 0.4, ['WRIST_SPEED_DROP']),
  }

  const releaseMetrics = series[releaseIndex] || {}
  const motionMetrics = series[motionIndex] || {}
  const headValues = series.map(item => item.headOffset).filter(Number.isFinite)
  const feedback = []
  if (Math.abs(releaseMetrics.trunkLean || 0) >= 12) {
    feedback.push({
      title: 'リリース推定点の体幹傾き',
      observation: `体幹の投影傾斜は${Math.abs(releaseMetrics.trunkLean).toFixed(1)}度です。`,
      checkNext: '腕トップからリリース推定点までを低速再生し、頭部と骨盤中心の位置関係を確認してください。',
      severity: Math.abs(releaseMetrics.trunkLean) >= 18 ? 'high' : 'notice',
    })
  }
  if (headValues.length && Math.max(...headValues) - Math.min(...headValues) >= 0.4) {
    feedback.push({ title: '頭部の横移動', observation: `頭部は${(Math.max(...headValues) - Math.min(...headValues)).toFixed(2)}肩幅分移動しています。`, checkNext: '頭と骨盤中心の移動をコマ送りで確認してください。', severity: 'notice' })
  }
  if (qualityScore < 60) feedback.unshift({ title: '撮影・検出品質を確認', observation: `解析品質は${qualityScore}点です。`, checkNext: '全身が画面内に入る距離と明るい環境で撮影してください。', severity: 'info' })

  return {
    analysisDefinitionVersion: '0.1.0',
    events,
    series,
    references: { shoulderWidthRef, torsoLengthRef, legLengthRef, bodyScaleRef },
    quality: { score: qualityScore, label: qualityScore >= 80 ? '高' : qualityScore >= 60 ? '中' : '低', requiredLandmarkCoverage, subjectHeightRatio },
    summary: {
      trunkLeanAtRelease: releaseMetrics.trunkLean,
      trunkLeanChange: Number.isFinite(releaseMetrics.trunkLean) && Number.isFinite(motionMetrics.trunkLean) ? releaseMetrics.trunkLean - motionMetrics.trunkLean : null,
      throwingElbowAtRelease: releaseMetrics.throwingElbow,
      strideKneeAtContact: contactIndex != null ? series[contactIndex]?.strideKnee : null,
      armTopToReleaseMs: derived[releaseIndex].timeMs - derived[armTopIndex].timeMs,
      contactToReleaseMs: contactIndex != null ? derived[releaseIndex].timeMs - derived[contactIndex].timeMs : null,
    },
    feedback: feedback.slice(0, 3),
  }
}
