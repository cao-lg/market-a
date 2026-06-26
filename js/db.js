/**
 * IndexedDB Database Module
 * Uses Dexie.js for simplified IndexedDB operations
 */

// Database instance
let db = null;

// Initialize database
async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MarketDataAnalysisDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Settings store - key-value pairs
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
      
      // Learning progress store
      if (!database.objectStoreNames.contains('learning_progress')) {
        const progressStore = database.createObjectStore('learning_progress', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        progressStore.createIndex('stageId', 'stageId', { unique: false });
        progressStore.createIndex('lessonId', 'lessonId', { unique: false });
        progressStore.createIndex('status', 'status', { unique: false });
      }
      
      // AI conversations store
      if (!database.objectStoreNames.contains('ai_conversations')) {
        const convStore = database.createObjectStore('ai_conversations', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        convStore.createIndex('sessionId', 'sessionId', { unique: false });
        convStore.createIndex('stageId', 'stageId', { unique: false });
        convStore.createIndex('lessonId', 'lessonId', { unique: false });
        convStore.createIndex('role', 'role', { unique: false });
        convStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Submissions store
      if (!database.objectStoreNames.contains('submissions')) {
        const subStore = database.createObjectStore('submissions', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        subStore.createIndex('stageId', 'stageId', { unique: false });
        subStore.createIndex('lessonId', 'lessonId', { unique: false });
        subStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Assessments store
      if (!database.objectStoreNames.contains('assessments')) {
        const assStore = database.createObjectStore('assessments', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        assStore.createIndex('testId', 'testId', { unique: false });
        assStore.createIndex('stageId', 'stageId', { unique: false });
        assStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Behavior metrics store
      if (!database.objectStoreNames.contains('behavior_metrics')) {
        database.createObjectStore('behavior_metrics', { keyPath: 'key' });
      }
    };
  });
}

// ==================== Settings Operations ====================

async function getSetting(key) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

async function setSetting(key, value) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put({ key, value });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllSettings() {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.getAll();
    request.onsuccess = () => {
      const settings = {};
      request.result.forEach(item => settings[item.key] = item.value);
      resolve(settings);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Learning Progress Operations ====================

// Extended progress data structure for detailed tracking
async function getProgress(stageId, lessonId) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readonly');
    const store = tx.objectStore('learning_progress');
    const index = store.index('lessonId');
    const request = index.get(lessonId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStageProgress(stageId) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readonly');
    const store = tx.objectStore('learning_progress');
    const index = store.index('stageId');
    const request = index.getAll(stageId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveProgress(data) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readwrite');
    const store = tx.objectStore('learning_progress');
    
    // Check if progress exists for this lesson
    const index = store.index('lessonId');
    const getRequest = index.get(data.lessonId);
    
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (existing) {
        data.id = existing.id;
        // Merge behavior metrics
        if (existing.behaviorMetrics && data.behaviorMetrics) {
          data.behaviorMetrics = {
            ...existing.behaviorMetrics,
            ...data.behaviorMetrics
          };
        }
      }
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
}

// Save detailed learning session data
async function saveLearningSession(sessionData) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readwrite');
    const store = tx.objectStore('learning_progress');
    
    const data = {
      lessonId: sessionData.lessonId,
      stageId: sessionData.stageId,
      sessionId: sessionData.sessionId,
      startTime: sessionData.startTime,
      endTime: Date.now(),
      duration: sessionData.duration || 0,
      interactionCount: sessionData.interactionCount || 0,
      helpRequests: sessionData.helpRequests || 0,
      ownWorkConfirmed: sessionData.ownWorkConfirmed || false,
      status: sessionData.status || 'in-progress',
      completedAt: sessionData.completedAt || null
    };
    
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Update behavior metrics for a lesson
async function updateBehaviorMetrics(stageId, lessonId, metrics) {
  const existing = await getProgress(stageId, lessonId);
  if (existing) {
    existing.behaviorMetrics = {
      ...existing.behaviorMetrics,
      ...metrics,
      lastUpdated: Date.now()
    };
    await saveProgress(existing);
  }
}

async function getAllProgress() {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readonly');
    const store = tx.objectStore('learning_progress');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== AI Conversations Operations ====================

async function saveConversation(message) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readwrite');
    const store = tx.objectStore('ai_conversations');
    const request = store.add({
      ...message,
      timestamp: message.timestamp || Date.now()
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getConversations(sessionId, limit = 20) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readonly');
    const store = tx.objectStore('ai_conversations');
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);
    request.onsuccess = () => {
      const conversations = request.result || [];
      // Sort by timestamp and limit
      conversations.sort((a, b) => a.timestamp - b.timestamp);
      resolve(conversations.slice(-limit));
    };
    request.onerror = () => reject(request.error);
  });
}

async function getConversationCount(sessionId) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readonly');
    const store = tx.objectStore('ai_conversations');
    const index = store.index('sessionId');
    const request = index.count(sessionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearConversations(sessionId) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readwrite');
    const store = tx.objectStore('ai_conversations');
    const index = store.index('sessionId');
    const request = index.getAllKeys(sessionId);
    request.onsuccess = () => {
      const keys = request.result;
      keys.forEach(key => store.delete(key));
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Submissions Operations ====================

async function saveSubmission(data) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readwrite');
    const store = tx.objectStore('submissions');
    const request = store.add({
      ...data,
      timestamp: Date.now()
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSubmissions(stageId, lessonId) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readonly');
    const store = tx.objectStore('submissions');
    const index = store.index('lessonId');
    const request = index.getAll(lessonId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllSubmissions() {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readonly');
    const store = tx.objectStore('submissions');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Assessments Operations ====================

async function saveAssessment(data) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assessments', 'readwrite');
    const store = tx.objectStore('assessments');
    const request = store.add({
      ...data,
      timestamp: Date.now()
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAssessment(testId) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assessments', 'readonly');
    const store = tx.objectStore('assessments');
    const index = store.index('testId');
    const request = index.get(testId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllAssessments() {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assessments', 'readonly');
    const store = tx.objectStore('assessments');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Behavior Metrics Operations ====================

async function getBehaviorMetric(key) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('behavior_metrics', 'readonly');
    const store = tx.objectStore('behavior_metrics');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

async function setBehaviorMetric(key, value) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('behavior_metrics', 'readwrite');
    const store = tx.objectStore('behavior_metrics');
    const request = store.put({ key, value });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllBehaviorMetrics() {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('behavior_metrics', 'readonly');
    const store = tx.objectStore('behavior_metrics');
    const request = store.getAll();
    request.onsuccess = () => {
      const metrics = {};
      request.result.forEach(item => metrics[item.key] = item.value);
      resolve(metrics);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Utility Functions ====================

async function clearAllData() {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([
      'settings',
      'learning_progress',
      'ai_conversations',
      'submissions',
      'assessments',
      'behavior_metrics'
    ], 'readwrite');
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    
    tx.objectStore('settings').clear();
    tx.objectStore('learning_progress').clear();
    tx.objectStore('ai_conversations').clear();
    tx.objectStore('submissions').clear();
    tx.objectStore('assessments').clear();
    tx.objectStore('behavior_metrics').clear();
  });
}

async function getStorageUsage() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return { used: 0, quota: 0 };
}

// Export all functions
window.DB = {
  init: initDB,
  settings: {
    get: getSetting,
    set: setSetting,
    getAll: getAllSettings
  },
  progress: {
    get: getProgress,
    getStage: getStageProgress,
    save: saveProgress,
    saveSession: saveLearningSession,
    updateMetrics: updateBehaviorMetrics,
    getAll: getAllProgress
  },
  conversations: {
    save: saveConversation,
    get: getConversations,
    count: getConversationCount,
    clear: clearConversations
  },
  submissions: {
    save: saveSubmission,
    get: getSubmissions,
    getAll: getAllSubmissions
  },
  assessments: {
    save: saveAssessment,
    get: getAssessment,
    getAll: getAllAssessments
  },
  metrics: {
    get: getBehaviorMetric,
    set: setBehaviorMetric,
    getAll: getAllBehaviorMetrics
  },
  clearAll: clearAllData,
  getStorageUsage
};
