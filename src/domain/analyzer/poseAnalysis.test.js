import { describe, expect, it } from 'vitest'
import { analyzePoseFrames } from './poseAnalysis'

function point(x, y) {
  return { x, y, z: 0, visibility: 0.99, presence: 0.99 }
}

function makePose(frameIndex) {
  const pose = Array.from({ length: 33 }, () => point(0.5, 0.5))
  const phase = frameIndex / 39
  pose[0] = point(0.5, 0.15)
  pose[11] = point(0.43, 0.3)
  pose[12] = point(0.57, 0.3)
  pose[13] = point(0.4, 0.43)
  pose[14] = point(0.62, 0.36)
  pose[15] = point(0.38, 0.55)
  pose[16] = point(0.58 + Math.sin(phase * Math.PI * 2) * 0.18, 0.48 - Math.sin(phase * Math.PI) * 0.35)
  pose[23] = point(0.46, 0.55)
  pose[24] = point(0.54, 0.55)
  pose[25] = point(0.42, 0.72)
  pose[26] = point(0.57, 0.72)
  pose[27] = point(0.35 + phase * 0.16, 0.9)
  pose[28] = point(0.58, 0.9)
  return pose
}

describe('analyzePoseFrames', () => {
  it('主要イベントを正しい順序で返す', () => {
    const frames = Array.from({ length: 40 }, (_, frameIndex) => ({
      frameIndex,
      timeMs: frameIndex * 33,
      landmarks: [makePose(frameIndex)],
      worldLandmarks: [],
    }))
    const result = analyzePoseFrames(frames, { throwingHand: 'right', cameraView: 'front' })

    expect(result.events.motionStart.frameIndex).toBeLessThan(result.events.armTop.frameIndex)
    expect(result.events.armTop.frameIndex).toBeLessThan(result.events.releaseProxy.frameIndex)
    expect(result.events.releaseProxy.frameIndex).toBeLessThanOrEqual(result.events.followThrough.frameIndex)
    expect(result.quality.score).toBeGreaterThan(0)
    expect(result.series).toHaveLength(40)
  })
})
