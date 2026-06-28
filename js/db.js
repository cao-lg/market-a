/**
 * IndexedDB Database Module
 * Native IndexedDB implementation with student data isolation
 */

let db = null;
let defaultStudentIdCache = null;

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function getCurrentStudentId() {
  let id = localStorage.getItem('current_student_id');
  if (id) return id;
  
  if (window.StudentManager && typeof window.StudentManager.getCurrentStudent === 'function') {
    try {
      const student = await window.StudentManager.getCurrentStudent();
      return student.id;
    } catch (e) {
      console.warn('Failed to get student from StudentManager:', e);
    }
  }
  
  return await getDefaultStudentId();
}

async function getDefaultStudentId() {
  if (defaultStudentIdCache) return defaultStudentIdCache;
  
  let id = localStorage.getItem('default_student_id');
  if (id) {
    defaultStudentIdCache = id;
    return id;
  }
  
  if (window.StudentManager && typeof window.StudentManager.ensureDefaultStudent === 'function') {
    try {
      const student = await window.StudentManager.ensureDefaultStudent();
      defaultStudentIdCache = student.id;
      return student.id;
    } catch (e) {
      console.warn('Failed to get default student from StudentManager:', e);
    }
  }
  
  id = generateUUID();
  localStorage.setItem('default_student_id', id);
  localStorage.setItem('current_student_id', id);
  defaultStudentIdCache = id;
  return id;
}

async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MarketDataAnalysisDB', 4);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = async (event) => {
      const database = event.target.result;
      const oldVersion = event.oldVersion;
      const transaction = event.target.transaction;
      
      if (oldVersion < 1) {
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }
        
        if (!database.objectStoreNames.contains('learning_progress')) {
          const progressStore = database.createObjectStore('learning_progress', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          progressStore.createIndex('stageId', 'stageId', { unique: false });
          progressStore.createIndex('lessonId', 'lessonId', { unique: false });
          progressStore.createIndex('status', 'status', { unique: false });
          progressStore.createIndex('studentId', 'studentId', { unique: false });
        }
        
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
          convStore.createIndex('studentId', 'studentId', { unique: false });
        }
        
        if (!database.objectStoreNames.contains('submissions')) {
          const subStore = database.createObjectStore('submissions', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          subStore.createIndex('stageId', 'stageId', { unique: false });
          subStore.createIndex('lessonId', 'lessonId', { unique: false });
          subStore.createIndex('timestamp', 'timestamp', { unique: false });
          subStore.createIndex('studentId', 'studentId', { unique: false });
        }
        
        if (!database.objectStoreNames.contains('assessments')) {
          const assStore = database.createObjectStore('assessments', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          assStore.createIndex('testId', 'testId', { unique: false });
          assStore.createIndex('stageId', 'stageId', { unique: false });
          assStore.createIndex('timestamp', 'timestamp', { unique: false });
          assStore.createIndex('studentId', 'studentId', { unique: false });
        }
        
        if (!database.objectStoreNames.contains('behavior_metrics')) {
          const metricsStore = database.createObjectStore('behavior_metrics', { keyPath: 'key' });
          metricsStore.createIndex('studentId', 'studentId', { unique: false });
        }
      }
      
      if (oldVersion < 2) {
        if (!database.objectStoreNames.contains('students')) {
          database.createObjectStore('students', { keyPath: 'id' });
        }
        
        const storesToUpgrade = ['learning_progress', 'ai_conversations', 'submissions', 'assessments', 'behavior_metrics'];
        
        for (const storeName of storesToUpgrade) {
          if (database.objectStoreNames.contains(storeName)) {
            const store = transaction.objectStore(storeName);
            if (!store.indexNames.contains('studentId')) {
              store.createIndex('studentId', 'studentId', { unique: false });
            }
          }
        }
      }
      
      if (oldVersion < 3) {
        if (!database.objectStoreNames.contains('student_profiles')) {
          const profilesStore = database.createObjectStore('student_profiles', { keyPath: 'id' });
          profilesStore.createIndex('studentId', 'studentId', { unique: false });
          profilesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        if (!database.objectStoreNames.contains('reading_behavior')) {
          const readingStore = database.createObjectStore('reading_behavior', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          readingStore.createIndex('studentId', 'studentId', { unique: false });
          readingStore.createIndex('lessonId', 'lessonId', { unique: false });
          readingStore.createIndex('sessionId', 'sessionId', { unique: false });
          readingStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        if (!database.objectStoreNames.contains('exam_behavior')) {
          const examStore = database.createObjectStore('exam_behavior', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          examStore.createIndex('studentId', 'studentId', { unique: false });
          examStore.createIndex('lessonId', 'lessonId', { unique: false });
          examStore.createIndex('sessionId', 'sessionId', { unique: false });
          examStore.createIndex('questionId', 'questionId', { unique: false });
          examStore.createIndex('topic', 'topic', { unique: false });
        }
        
        if (!database.objectStoreNames.contains('event_logs')) {
          const eventStore = database.createObjectStore('event_logs', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          eventStore.createIndex('studentId', 'studentId', { unique: false });
          eventStore.createIndex('eventType', 'eventType', { unique: false });
          eventStore.createIndex('eventName', 'eventName', { unique: false });
          eventStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (database.objectStoreNames.contains('ai_conversations')) {
          const convStore = transaction.objectStore('ai_conversations');
          const newFields = ['messageType', 'questionCategory', 'questionDepth', 'feedback', 'hasImage', 'imageCount', 'waitDuration', 'messageLength'];
          
          await new Promise((resolve, reject) => {
            const request = convStore.openCursor();
            request.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                const value = cursor.value;
                let needsUpdate = false;
                for (const field of newFields) {
                  if (!(field in value)) {
                    if (field === 'messageType') {
                      value[field] = value.role === 'user' ? 'question' : 'answer';
                    } else if (field === 'questionDepth') {
                      value[field] = 3;
                    } else if (field === 'hasImage') {
                      value[field] = false;
                    } else if (field === 'imageCount') {
                      value[field] = 0;
                    } else if (field === 'waitDuration') {
                      value[field] = 0;
                    } else if (field === 'messageLength') {
                      value[field] = value.content ? value.content.length : 0;
                    } else {
                      value[field] = null;
                    }
                    needsUpdate = true;
                  }
                }
                if (needsUpdate) {
                  cursor.update(value);
                }
                cursor.continue();
              } else {
                resolve();
              }
            };
            request.onerror = () => reject(request.error);
          });
        }
      }
      
      if (oldVersion < 4) {
        if (!database.objectStoreNames.contains('uploaded_files')) {
          const filesStore = database.createObjectStore('uploaded_files', {
            keyPath: 'id',
            autoIncrement: true
          });
          filesStore.createIndex('fileId', 'fileId', { unique: true });
          filesStore.createIndex('studentId', 'studentId', { unique: false });
          filesStore.createIndex('stageId', 'stageId', { unique: false });
          filesStore.createIndex('lessonId', 'lessonId', { unique: false });
          filesStore.createIndex('submissionId', 'submissionId', { unique: false });
          filesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        if (!database.objectStoreNames.contains('grading_results')) {
          const gradingStore = database.createObjectStore('grading_results', {
            keyPath: 'id',
            autoIncrement: true
          });
          gradingStore.createIndex('submissionId', 'submissionId', { unique: false });
          gradingStore.createIndex('fileId', 'fileId', { unique: false });
          gradingStore.createIndex('studentId', 'studentId', { unique: false });
          gradingStore.createIndex('gradingType', 'gradingType', { unique: false });
          gradingStore.createIndex('status', 'status', { unique: false });
          gradingStore.createIndex('gradedAt', 'gradedAt', { unique: false });
        }
        
        if (database.objectStoreNames.contains('submissions')) {
          const subStore = transaction.objectStore('submissions');
          const newSubFields = ['hasFiles', 'fileCount', 'gradingStatus', 'gradingResultId'];
          
          await new Promise((resolve, reject) => {
            const request = subStore.openCursor();
            request.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                const value = cursor.value;
                let needsUpdate = false;
                for (const field of newSubFields) {
                  if (!(field in value)) {
                    if (field === 'hasFiles') {
                      value[field] = false;
                    } else if (field === 'fileCount') {
                      value[field] = 0;
                    } else if (field === 'gradingStatus') {
                      value[field] = 'pending';
                    } else {
                      value[field] = null;
                    }
                    needsUpdate = true;
                  }
                }
                if (needsUpdate) {
                  cursor.update(value);
                }
                cursor.continue();
              } else {
                resolve();
              }
            };
            request.onerror = () => reject(request.error);
          });
        }
      }
    };
  });
}

async function migrateOldData(storeName, transaction) {
  const store = transaction.objectStore(storeName);
  const studentId = await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const value = cursor.value;
        if (!value.studentId) {
          value.studentId = studentId;
          cursor.update(value);
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Settings Operations ====================
// Settings are global, not per-student

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

async function getProgress(stageId, lessonId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readonly');
    const store = tx.objectStore('learning_progress');
    const index = store.index('lessonId');
    const request = index.getAll(lessonId);
    
    request.onsuccess = () => {
      const results = request.result || [];
      const filtered = results.filter(item => item.studentId === studentId);
      resolve(filtered[0] || null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getStageProgress(stageId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readonly');
    const store = tx.objectStore('learning_progress');
    const index = store.index('stageId');
    const request = index.getAll(stageId);
    
    request.onsuccess = () => {
      const results = request.result || [];
      const filtered = results.filter(item => item.studentId === studentId);
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

async function saveProgress(data) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readwrite');
    const store = tx.objectStore('learning_progress');
    
    const index = store.index('lessonId');
    const getRequest = index.getAll(data.lessonId);
    
    getRequest.onsuccess = () => {
      const results = getRequest.result || [];
      const existing = results.find(item => item.studentId === studentId);
      
      let saveData = { ...data, studentId };
      
      if (existing) {
        saveData.id = existing.id;
        if (existing.behaviorMetrics && data.behaviorMetrics) {
          saveData.behaviorMetrics = {
            ...existing.behaviorMetrics,
            ...data.behaviorMetrics
          };
        }
      }
      
      const request = store.put(saveData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
}

async function saveLearningSession(sessionData) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
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
      completedAt: sessionData.completedAt || null,
      studentId
    };
    
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

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
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('learning_progress', 'readonly');
    const store = tx.objectStore('learning_progress');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result || [];
      const filtered = results.filter(item => item.studentId === studentId);
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== AI Conversations Operations ====================

async function saveConversation(message) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readwrite');
    const store = tx.objectStore('ai_conversations');
    const request = store.add({
      ...message,
      timestamp: message.timestamp || Date.now(),
      studentId
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getConversations(sessionId, limit = 20) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readonly');
    const store = tx.objectStore('ai_conversations');
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);
    
    request.onsuccess = () => {
      const conversations = (request.result || []).filter(item => item.studentId === studentId);
      conversations.sort((a, b) => a.timestamp - b.timestamp);
      resolve(conversations.slice(-limit));
    };
    request.onerror = () => reject(request.error);
  });
}

async function getConversationCount(sessionId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readonly');
    const store = tx.objectStore('ai_conversations');
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);
    
    request.onsuccess = () => {
      const results = (request.result || []).filter(item => item.studentId === studentId);
      resolve(results.length);
    };
    request.onerror = () => reject(request.error);
  });
}

async function clearConversations(sessionId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readwrite');
    const store = tx.objectStore('ai_conversations');
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);
    
    request.onsuccess = () => {
      const items = request.result || [];
      items.forEach(item => {
        if (item.studentId === studentId) {
          store.delete(item.id);
        }
      });
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function updateConversation(id, updates) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readwrite');
    const store = tx.objectStore('ai_conversations');
    const request = store.get(id);
    
    request.onsuccess = () => {
      const existing = request.result;
      if (!existing) {
        resolve(null);
        return;
      }
      
      if (existing.studentId && existing.studentId !== studentId) {
        reject(new Error('Permission denied'));
        return;
      }
      
      const updated = { ...existing, ...updates, id: existing.id };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(updated);
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getAllConversations() {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ai_conversations', 'readonly');
    const store = tx.objectStore('ai_conversations');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result || [];
      const filtered = results.filter(item => item.studentId === studentId);
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Submissions Operations ====================

async function saveSubmission(data) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readwrite');
    const store = tx.objectStore('submissions');
    const request = store.add({
      hasFiles: false,
      fileCount: 0,
      gradingStatus: 'pending',
      gradingResultId: null,
      ...data,
      timestamp: Date.now(),
      studentId
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSubmissions(stageId, lessonId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readonly');
    const store = tx.objectStore('submissions');
    const index = store.index('lessonId');
    const request = index.getAll(lessonId);
    
    request.onsuccess = () => {
      const results = request.result || [];
      const filtered = results.filter(item => item.studentId === studentId);
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getAllSubmissions() {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readonly');
    const store = tx.objectStore('submissions');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result || [];
      const filtered = results.filter(item => item.studentId === studentId);
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Uploaded Files Operations ====================
// 上传文件表 - 存储上传的文件元数据和内容

async function saveFile(data) {
  await initDB();
  const studentId = data.studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('uploaded_files', 'readwrite');
    const store = tx.objectStore('uploaded_files');
    const fileData = {
      fileId: data.fileId || generateUUID(),
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      fileContent: data.fileContent,
      studentId,
      stageId: data.stageId || null,
      lessonId: data.lessonId || null,
      submissionId: data.submissionId || null,
      createdAt: data.createdAt || Date.now()
    };
    const request = store.add(fileData);
    request.onsuccess = () => resolve({ ...fileData, id: request.result });
    request.onerror = () => reject(request.error);
  });
}

async function getFile(id) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('uploaded_files', 'readonly');
    const store = tx.objectStore('uploaded_files');
    const request = store.get(id);
    
    request.onsuccess = () => {
      const result = request.result;
      if (result && result.studentId && result.studentId !== studentId) {
        resolve(null);
      } else {
        resolve(result || null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function getFilesBySubmission(submissionId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('uploaded_files', 'readonly');
    const store = tx.objectStore('uploaded_files');
    const index = store.index('submissionId');
    const request = index.getAll(submissionId);
    
    request.onsuccess = () => {
      const results = (request.result || []).filter(item => item.studentId === studentId);
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getFilesByLesson(lessonId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('uploaded_files', 'readonly');
    const store = tx.objectStore('uploaded_files');
    const index = store.index('lessonId');
    const request = index.getAll(lessonId);
    
    request.onsuccess = () => {
      const results = (request.result || []).filter(item => item.studentId === studentId);
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteFile(id) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('uploaded_files', 'readwrite');
    const store = tx.objectStore('uploaded_files');
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const file = getRequest.result;
      if (!file) {
        resolve();
        return;
      }
      if (file.studentId && file.studentId !== studentId) {
        reject(new Error('Permission denied'));
        return;
      }
      const deleteRequest = store.delete(id);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// ==================== Grading Results Operations ====================
// AI评阅结果表 - 存储AI评阅结果

async function saveGradingResult(data) {
  await initDB();
  const studentId = data.studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('grading_results', 'readwrite');
    const store = tx.objectStore('grading_results');
    const gradingData = {
      submissionId: data.submissionId || null,
      fileId: data.fileId || null,
      studentId,
      gradingType: data.gradingType || 'data',
      overallScore: data.overallScore || null,
      overallGrade: data.overallGrade || null,
      dimensionScores: data.dimensionScores || null,
      highlights: data.highlights || null,
      issues: data.issues || null,
      suggestions: data.suggestions || null,
      gradingEngine: data.gradingEngine || null,
      gradedAt: data.gradedAt || Date.now(),
      status: data.status || 'completed'
    };
    const request = store.add(gradingData);
    request.onsuccess = () => resolve({ ...gradingData, id: request.result });
    request.onerror = () => reject(request.error);
  });
}

async function getGradingResult(id) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('grading_results', 'readonly');
    const store = tx.objectStore('grading_results');
    const request = store.get(id);
    
    request.onsuccess = () => {
      const result = request.result;
      if (result && result.studentId && result.studentId !== studentId) {
        resolve(null);
      } else {
        resolve(result || null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function getGradingBySubmission(submissionId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('grading_results', 'readonly');
    const store = tx.objectStore('grading_results');
    const index = store.index('submissionId');
    const request = index.getAll(submissionId);
    
    request.onsuccess = () => {
      const results = (request.result || []).filter(item => item.studentId === studentId);
      results.sort((a, b) => a.gradedAt - b.gradedAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getGradingByLesson(lessonId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise(async (resolve, reject) => {
    try {
      const submissions = await getSubmissions(null, lessonId);
      const submissionIds = submissions.map(s => s.id);
      
      const tx = db.transaction('grading_results', 'readonly');
      const store = tx.objectStore('grading_results');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = (request.result || []).filter(item => 
          item.studentId === studentId && submissionIds.includes(item.submissionId)
        );
        results.sort((a, b) => a.gradedAt - b.gradedAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function updateGradingResult(id, updates) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('grading_results', 'readwrite');
    const store = tx.objectStore('grading_results');
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (!existing) {
        resolve(null);
        return;
      }
      
      if (existing.studentId && existing.studentId !== studentId) {
        reject(new Error('Permission denied'));
        return;
      }
      
      const updated = { ...existing, ...updates, id: existing.id };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(updated);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// ==================== Assessments Operations ====================

async function saveAssessment(data) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assessments', 'readwrite');
    const store = tx.objectStore('assessments');
    const request = store.add({
      ...data,
      timestamp: Date.now(),
      studentId
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAssessment(testId) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assessments', 'readonly');
    const store = tx.objectStore('assessments');
    const index = store.index('testId');
    const request = index.getAll(testId);
    
    request.onsuccess = () => {
      const results = request.result || [];
      const filtered = results.filter(item => item.studentId === studentId);
      resolve(filtered[0] || null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getAllAssessments() {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assessments', 'readonly');
    const store = tx.objectStore('assessments');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result || [];
      const filtered = results.filter(item => item.studentId === studentId);
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Behavior Metrics Operations ====================

async function getBehaviorMetric(key) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  const compositeKey = `${studentId}:${key}`;
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('behavior_metrics', 'readonly');
    const store = tx.objectStore('behavior_metrics');
    const request = store.get(compositeKey);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

async function setBehaviorMetric(key, value) {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  const compositeKey = `${studentId}:${key}`;
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('behavior_metrics', 'readwrite');
    const store = tx.objectStore('behavior_metrics');
    const request = store.put({ key: compositeKey, value, studentId });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllBehaviorMetrics() {
  await initDB();
  const studentId = await getCurrentStudentId() || await getDefaultStudentId();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('behavior_metrics', 'readonly');
    const store = tx.objectStore('behavior_metrics');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const metrics = {};
      const results = request.result || [];
      results
        .filter(item => item.studentId === studentId)
        .forEach(item => {
          const key = item.key.replace(`${studentId}:`, '');
          metrics[key] = item.value;
        });
      resolve(metrics);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Student Profiles Operations ====================
// 学生画像表 - 存储画像计算结果，包含基础属性、学习行为、知识掌握、能力模型、学习风格、AI交互特征、自动标签

async function getProfile(studentId) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('student_profiles', 'readonly');
    const store = tx.objectStore('student_profiles');
    const request = store.get(sid);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveProfile(profile) {
  await initDB();
  const studentId = profile.studentId || profile.id || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('student_profiles', 'readwrite');
    const store = tx.objectStore('student_profiles');
    
    const saveData = {
      ...profile,
      id: studentId,
      studentId,
      updatedAt: Date.now()
    };
    
    const request = store.put(saveData);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function updateProfile(studentId, updates) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('student_profiles', 'readwrite');
    const store = tx.objectStore('student_profiles');
    const getRequest = store.get(sid);
    
    getRequest.onsuccess = () => {
      const existing = getRequest.result || { id: sid, studentId: sid };
      const updated = {
        ...existing,
        ...updates,
        id: sid,
        studentId: sid,
        updatedAt: Date.now()
      };
      
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

async function getAllProfiles() {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('student_profiles', 'readonly');
    const store = tx.objectStore('student_profiles');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Reading Behavior Operations ====================
// 课程阅读行为明细表 - 记录每次阅读会话的详细行为

async function addReadingBehavior(data) {
  await initDB();
  const studentId = data.studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reading_behavior', 'readwrite');
    const store = tx.objectStore('reading_behavior');
    const request = store.add({
      ...data,
      studentId,
      createdAt: data.createdAt || Date.now()
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getReadingBehaviorByLesson(studentId, lessonId) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reading_behavior', 'readonly');
    const store = tx.objectStore('reading_behavior');
    const index = store.index('lessonId');
    const request = index.getAll(lessonId);
    
    request.onsuccess = () => {
      const results = (request.result || []).filter(item => item.studentId === sid);
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getReadingBehaviorBySession(sessionId) {
  await initDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reading_behavior', 'readonly');
    const store = tx.objectStore('reading_behavior');
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);
    
    request.onsuccess = () => {
      const results = request.result || [];
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getReadingBehaviorStats(studentId, options = {}) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reading_behavior', 'readonly');
    const store = tx.objectStore('reading_behavior');
    const index = store.index('studentId');
    const request = index.getAll(sid);
    
    request.onsuccess = () => {
      const records = request.result || [];
      const stats = {
        totalSessions: records.length,
        totalDuration: 0,
        totalActiveDuration: 0,
        avgScrollDepth: 0,
        avgReadingSpeed: 0,
        totalCopyCount: 0,
        totalSearchCount: 0
      };
      
      if (records.length > 0) {
        records.forEach(r => {
          stats.totalDuration += r.totalDuration || 0;
          stats.totalActiveDuration += r.activeDuration || 0;
          stats.avgScrollDepth += r.maxScrollDepth || 0;
          stats.avgReadingSpeed += r.avgReadingSpeed || 0;
          stats.totalCopyCount += r.copyCount || 0;
          stats.totalSearchCount += r.searchCount || 0;
        });
        stats.avgScrollDepth /= records.length;
        stats.avgReadingSpeed /= records.length;
      }
      
      resolve(stats);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Exam Behavior Operations ====================
// 答题行为明细表 - 记录每次答题的详细行为

async function addExamBehavior(data) {
  await initDB();
  const studentId = data.studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exam_behavior', 'readwrite');
    const store = tx.objectStore('exam_behavior');
    const request = store.add({
      ...data,
      studentId,
      createdAt: data.createdAt || Date.now()
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getExamBehaviorByLesson(studentId, lessonId) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exam_behavior', 'readonly');
    const store = tx.objectStore('exam_behavior');
    const index = store.index('lessonId');
    const request = index.getAll(lessonId);
    
    request.onsuccess = () => {
      const results = (request.result || []).filter(item => item.studentId === sid);
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getExamBehaviorByTopic(studentId, topic) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exam_behavior', 'readonly');
    const store = tx.objectStore('exam_behavior');
    const index = store.index('topic');
    const request = index.getAll(topic);
    
    request.onsuccess = () => {
      const results = (request.result || []).filter(item => item.studentId === sid);
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getExamBehaviorStats(studentId, options = {}) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exam_behavior', 'readonly');
    const store = tx.objectStore('exam_behavior');
    const index = store.index('studentId');
    const request = index.getAll(sid);
    
    request.onsuccess = () => {
      const records = request.result || [];
      const stats = {
        totalQuestions: records.length,
        correctCount: 0,
        incorrectCount: 0,
        skippedCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        totalScore: 0,
        avgScore: 0,
        totalModifications: 0,
        topicStats: {}
      };
      
      if (records.length > 0) {
        records.forEach(r => {
          stats.totalDuration += r.duration || 0;
          stats.totalScore += r.score || 0;
          stats.totalModifications += r.modificationCount || 0;
          
          if (r.isCorrect) {
            stats.correctCount++;
          } else if (r.skipped) {
            stats.skippedCount++;
          } else {
            stats.incorrectCount++;
          }
          
          if (r.topic) {
            if (!stats.topicStats[r.topic]) {
              stats.topicStats[r.topic] = {
                total: 0,
                correct: 0,
                totalDuration: 0
              };
            }
            stats.topicStats[r.topic].total++;
            if (r.isCorrect) stats.topicStats[r.topic].correct++;
            stats.topicStats[r.topic].totalDuration += r.duration || 0;
          }
        });
        
        stats.avgDuration = stats.totalDuration / records.length;
        stats.avgScore = stats.totalScore / records.length;
        stats.accuracy = records.length > 0 ? (stats.correctCount / records.length) * 100 : 0;
      }
      
      resolve(stats);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Event Logs Operations ====================
// 通用事件埋点表 - 记录所有行为事件

async function addEventLog(event) {
  await initDB();
  const studentId = event.studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('event_logs', 'readwrite');
    const store = tx.objectStore('event_logs');
    const request = store.add({
      ...event,
      studentId,
      timestamp: event.timestamp || Date.now()
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function batchAddEventLogs(events) {
  await initDB();
  const studentId = (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('event_logs', 'readwrite');
    const store = tx.objectStore('event_logs');
    const results = [];
    let completed = 0;
    let hasError = false;
    
    events.forEach((event, index) => {
      const data = {
        ...event,
        studentId: event.studentId || studentId,
        timestamp: event.timestamp || Date.now()
      };
      
      const request = store.add(data);
      request.onsuccess = () => {
        results[index] = request.result;
        completed++;
        if (completed === events.length && !hasError) {
          resolve(results);
        }
      };
      request.onerror = () => {
        hasError = true;
        reject(request.error);
      };
    });
    
    tx.oncomplete = () => resolve(results);
    tx.onerror = () => reject(tx.error);
  });
}

async function queryEventLogs(studentId, filters = {}) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('event_logs', 'readonly');
    const store = tx.objectStore('event_logs');
    const index = store.index('studentId');
    const request = index.getAll(sid);
    
    request.onsuccess = () => {
      let results = request.result || [];
      
      if (filters.eventType) {
        results = results.filter(r => r.eventType === filters.eventType);
      }
      
      if (filters.eventName) {
        results = results.filter(r => r.eventName === filters.eventName);
      }
      
      if (filters.startTime) {
        results = results.filter(r => r.timestamp >= filters.startTime);
      }
      
      if (filters.endTime) {
        results = results.filter(r => r.timestamp <= filters.endTime);
      }
      
      if (filters.page) {
        results = results.filter(r => r.page === filters.page);
      }
      
      if (filters.stageId) {
        results = results.filter(r => r.stageId === filters.stageId);
      }
      
      if (filters.lessonId) {
        results = results.filter(r => r.lessonId === filters.lessonId);
      }
      
      results.sort((a, b) => a.timestamp - b.timestamp);
      
      if (filters.limit) {
        results = results.slice(-filters.limit);
      }
      
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getEventLogStats(studentId, eventType, timeRange = {}) {
  await initDB();
  const sid = studentId || (await getCurrentStudentId()) || (await getDefaultStudentId());
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('event_logs', 'readonly');
    const store = tx.objectStore('event_logs');
    const index = store.index('studentId');
    const request = index.getAll(sid);
    
    request.onsuccess = () => {
      let records = request.result || [];
      
      if (eventType) {
        records = records.filter(r => r.eventType === eventType);
      }
      
      if (timeRange.startTime) {
        records = records.filter(r => r.timestamp >= timeRange.startTime);
      }
      
      if (timeRange.endTime) {
        records = records.filter(r => r.timestamp <= timeRange.endTime);
      }
      
      const stats = {
        total: records.length,
        byName: {},
        byPage: {},
        firstTime: records.length > 0 ? records[0].timestamp : null,
        lastTime: records.length > 0 ? records[records.length - 1].timestamp : null
      };
      
      records.forEach(r => {
        if (r.eventName) {
          stats.byName[r.eventName] = (stats.byName[r.eventName] || 0) + 1;
        }
        if (r.page) {
          stats.byPage[r.page] = (stats.byPage[r.page] || 0) + 1;
        }
      });
      
      resolve(stats);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== Student Data Management ====================

async function getAllStudents() {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('students', 'readonly');
    const store = tx.objectStore('students');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function getStudentById(studentId) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('students', 'readonly');
    const store = tx.objectStore('students');
    const request = store.get(studentId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveStudent(student) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('students', 'readwrite');
    const store = tx.objectStore('students');
    const request = store.put(student);
    request.onsuccess = () => resolve(student);
    request.onerror = () => reject(request.error);
  });
}

async function deleteStudentFromDB(studentId) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('students', 'readwrite');
    const store = tx.objectStore('students');
    const request = store.delete(studentId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearStudentData(studentId) {
  await initDB();
  
  const stores = ['learning_progress', 'ai_conversations', 'submissions', 'assessments', 'behavior_metrics', 'student_profiles', 'reading_behavior', 'exam_behavior', 'event_logs', 'uploaded_files', 'grading_results'];
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    let completed = 0;
    let hasError = false;
    
    stores.forEach(storeName => {
      const store = tx.objectStore(storeName);
      const index = store.index('studentId');
      const request = index.getAllKeys(studentId);
      
      request.onsuccess = () => {
        const keys = request.result || [];
        keys.forEach(key => store.delete(key));
        completed++;
        if (completed === stores.length && !hasError) {
          resolve();
        }
      };
      
      request.onerror = () => {
        hasError = true;
        reject(request.error);
      };
    });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
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
      'behavior_metrics',
      'students',
      'student_profiles',
      'reading_behavior',
      'exam_behavior',
      'event_logs',
      'uploaded_files',
      'grading_results'
    ], 'readwrite');
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    
    tx.objectStore('settings').clear();
    tx.objectStore('learning_progress').clear();
    tx.objectStore('ai_conversations').clear();
    tx.objectStore('submissions').clear();
    tx.objectStore('assessments').clear();
    tx.objectStore('behavior_metrics').clear();
    tx.objectStore('students').clear();
    tx.objectStore('student_profiles').clear();
    tx.objectStore('reading_behavior').clear();
    tx.objectStore('exam_behavior').clear();
    tx.objectStore('event_logs').clear();
    tx.objectStore('uploaded_files').clear();
    tx.objectStore('grading_results').clear();
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
    getAll: getAllConversations,
    count: getConversationCount,
    clear: clearConversations,
    update: updateConversation
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
  students: {
    getAll: getAllStudents,
    getById: getStudentById,
    save: saveStudent,
    delete: deleteStudentFromDB
  },
  profiles: {
    get: getProfile,
    save: saveProfile,
    update: updateProfile,
    getAll: getAllProfiles
  },
  readingBehavior: {
    add: addReadingBehavior,
    getByLesson: getReadingBehaviorByLesson,
    getBySession: getReadingBehaviorBySession,
    getStats: getReadingBehaviorStats
  },
  examBehavior: {
    add: addExamBehavior,
    getByLesson: getExamBehaviorByLesson,
    getByTopic: getExamBehaviorByTopic,
    getStats: getExamBehaviorStats
  },
  eventLogs: {
    add: addEventLog,
    batchAdd: batchAddEventLogs,
    query: queryEventLogs,
    getStats: getEventLogStats
  },
  files: {
    save: saveFile,
    get: getFile,
    getBySubmission: getFilesBySubmission,
    getByLesson: getFilesByLesson,
    delete: deleteFile
  },
  grading: {
    save: saveGradingResult,
    get: getGradingResult,
    getBySubmission: getGradingBySubmission,
    getByLesson: getGradingByLesson,
    update: updateGradingResult
  },
  clearAll: clearAllData,
  clearStudentData,
  getStorageUsage
};
