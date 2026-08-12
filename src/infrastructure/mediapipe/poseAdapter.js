import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM_BASE_URL = '/wasm'
const MODEL_URL = '/models/pose_landmarker_lite.task'

function waitForSeek(video, timeSeconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('解析をキャンセルしました。', 'AbortError'))
      return
    }

    const cleanup = () => {
      video.removeEventListener('seeked', handleSeeked)
      signal?.removeEventListener('abort', handleAbort)
    }
    const handleSeeked = () => {
      cleanup()
      resolve()
    }
    const handleAbort = () => {
      cleanup()
      reject(new DOMException('解析をキャンセルしました。', 'AbortError'))
    }

    video.addEventListener('seeked', handleSeeked, { once: true })
    signal?.addEventListener('abort', handleAbort, { once: true })
    video.currentTime = timeSeconds
  })
}

function normalizeLandmark(point) {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: point.visibility ?? 0,
    presence: point.presence ?? point.visibility ?? 0,
  }
}

export async function createPoseAdapter() {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: 'VIDEO',
    numPoses: 2,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  })

  return {
    async analyzeVideo({ video, startSeconds, endSeconds, fps = 30, signal, onProgress, onFrame }) {
      const frameInterval = 1 / fps
      const totalFrames = Math.max(1, Math.floor((endSeconds - startSeconds) * fps) + 1)
      const frames = []

      for (let index = 0; index < totalFrames; index += 1) {
        if (signal?.aborted) throw new DOMException('解析をキャンセルしました。', 'AbortError')

        const timeSeconds = Math.min(endSeconds, startSeconds + index * frameInterval)
        await waitForSeek(video, timeSeconds, signal)
        const result = landmarker.detectForVideo(video, Math.round(timeSeconds * 1000))
        const frame = {
          frameIndex: index,
          timeMs: Math.round(timeSeconds * 1000),
          landmarks: (result.landmarks || []).map(pose => pose.map(normalizeLandmark)),
          worldLandmarks: (result.worldLandmarks || []).map(pose => pose.map(normalizeLandmark)),
        }
        frames.push(frame)
        onFrame?.(frame)
        onProgress?.(Math.round(((index + 1) / totalFrames) * 100))

        if (index % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0))
      }

      return frames
    },
    close() {
      landmarker.close()
    },
  }
}
