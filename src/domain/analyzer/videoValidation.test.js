import { describe, expect, it } from 'vitest'
import { VIDEO_LIMITS, validateTrimRange, validateVideoFile } from './videoValidation'

describe('validateVideoFile', () => {
  it('動画ファイルを受け付ける', () => {
    expect(validateVideoFile({ type: 'video/mp4', size: 1024 }).valid).toBe(true)
  })

  it('250MBを超える動画を拒否する', () => {
    expect(validateVideoFile({ type: 'video/mp4', size: VIDEO_LIMITS.maxBytes + 1 }).valid).toBe(false)
  })
})

describe('validateTrimRange', () => {
  it('1〜12秒を受け付ける', () => {
    expect(validateTrimRange(2, 10).valid).toBe(true)
  })

  it('12秒を超える範囲を拒否する', () => {
    expect(validateTrimRange(0, 13).valid).toBe(false)
  })
})
