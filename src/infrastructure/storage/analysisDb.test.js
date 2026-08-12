import { describe, expect, it } from 'vitest'
import { makeAnalysisId } from './analysisDb'

describe('makeAnalysisId', () => {
  it('同じ記録と動画から同じIDを生成する', () => {
    expect(makeAnalysisId('record-1', 0, 'https://example.com/a.mp4'))
      .toBe(makeAnalysisId('record-1', 0, 'https://example.com/a.mp4'))
  })

  it('動画URLが変わると別のIDを生成する', () => {
    expect(makeAnalysisId('record-1', 0, 'https://example.com/a.mp4'))
      .not.toBe(makeAnalysisId('record-1', 0, 'https://example.com/b.mp4'))
  })
})
