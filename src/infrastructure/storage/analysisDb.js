const DB_NAME = 'pitching-form-analyzer'
const DB_VERSION = 1
const STORE_NAME = 'analyses'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('recordId', 'recordId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runTransaction(mode, action) {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = action(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => reject(transaction.error)
  }))
}

export function makeAnalysisId(recordId, videoIndex, videoUrl) {
  let hash = 2166136261
  for (let index = 0; index < videoUrl.length; index += 1) {
    hash ^= videoUrl.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${recordId}:${videoIndex}:${(hash >>> 0).toString(16)}`
}

export function saveAnalysis(analysis) {
  return runTransaction('readwrite', store => store.put(analysis))
}

export function getAnalysis(id) {
  return runTransaction('readonly', store => store.get(id))
}

export async function getAnalysisSummaries(videoEntries) {
  const results = await Promise.all(videoEntries.map(async entry => {
    const id = makeAnalysisId(entry.recordId, entry.videoIndex, entry.videoUrl)
    const analysis = await getAnalysis(id)
    return analysis ? [id, {
      id,
      createdAt: analysis.createdAt,
      quality: analysis.result.quality,
      summary: analysis.result.summary,
      feedback: analysis.result.feedback,
    }] : null
  }))
  return Object.fromEntries(results.filter(Boolean))
}
