export const VIDEO_LIMITS = Object.freeze({
  maxBytes: 250 * 1024 * 1024,
  maxDurationSeconds: 60,
  minTrimSeconds: 1,
  maxTrimSeconds: 12,
})

export function validateVideoFile(file) {
  if (!file) return { valid: false, message: '動画を選択してください。' }
  if (!file.type?.startsWith('video/')) {
    return { valid: false, message: '動画ファイルを選択してください。' }
  }
  if (file.size > VIDEO_LIMITS.maxBytes) {
    return { valid: false, message: '動画は250MB以内にしてください。' }
  }
  return { valid: true, message: '' }
}

export function validateTrimRange(startSeconds, endSeconds) {
  const duration = endSeconds - startSeconds
  if (startSeconds < 0 || endSeconds <= startSeconds) {
    return { valid: false, message: '開始位置より後に終了位置を設定してください。' }
  }
  if (duration < VIDEO_LIMITS.minTrimSeconds || duration > VIDEO_LIMITS.maxTrimSeconds) {
    return { valid: false, message: '解析範囲は1〜12秒にしてください。' }
  }
  return { valid: true, message: '' }
}
