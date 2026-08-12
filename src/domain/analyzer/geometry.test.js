import { describe, expect, it } from 'vitest'
import { jointAngleDeg, trunkLeanDeg } from './geometry'

describe('jointAngleDeg', () => {
  it('直線を180度として計算する', () => {
    expect(jointAngleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180)
  })

  it('直角を90度として計算する', () => {
    expect(jointAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90)
  })

  it('点が重なる場合はnullを返す', () => {
    expect(jointAngleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull()
  })
})

describe('trunkLeanDeg', () => {
  it('鉛直なら0度を返す', () => {
    expect(trunkLeanDeg({ x: 0.5, y: 0.8 }, { x: 0.5, y: 0.3 })).toBeCloseTo(0)
  })
})
