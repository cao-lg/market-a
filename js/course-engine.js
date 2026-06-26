/**
 * Course Engine Module
 * Manages course progress, stage unlocking, and task scheduling
 */

// Course content cache
let courseContent = null;
let questionsContent = null;

// ==================== Course Content Loading ====================

async function loadCourseContent() {
  if (courseContent) return courseContent;
  
  try {
    const response = await fetch('../data/course-content.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    courseContent = await response.json();
    return courseContent;
  } catch (error) {
    console.error('Failed to load course content:', error);
    return null;
  }
}

async function loadQuestionsContent() {
  if (questionsContent) return questionsContent;
  
  try {
    const response = await fetch('../data/questions.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    questionsContent = await response.json();
    return questionsContent;
  } catch (error) {
    console.error('Failed to load questions:', error);
    return null;
  }
}

// ==================== Stage & Lesson Management ====================

/**
 * Get all stages
 */
async function getAllStages() {
  const content = await loadCourseContent();
  return content?.stages || [];
}

/**
 * Get stage by ID
 */
async function getStage(stageId) {
  const stages = await getAllStages();
  return stages.find(s => s.id === stageId);
}

/**
 * Get lesson by stage ID and lesson ID
 */
async function getLesson(stageId, lessonId) {
  const stage = await getStage(stageId);
  return stage?.lessons?.find(l => l.id === lessonId);
}

/**
 * Get lesson type
 */
async function getLessonType(stageId, lessonId) {
  const lesson = await getLesson(stageId, lessonId);
  return lesson?.type || 'content-reading';
}

/**
 * Get test questions for a stage
 */
async function getTestQuestions(stageId) {
  const questions = await loadQuestionsContent();
  const testId = `${stageId.replace('stage-', 'stage-')}-test`;
  return questions?.tests?.[testId] || questions?.tests?.[`stage-${stageId.replace('stage-', '')}-test`];
}

// ==================== Progress Management ====================

/**
 * Calculate overall progress
 */
async function calculateOverallProgress() {
  const stages = await getAllStages();
  const allProgress = await DB.progress.getAll();
  
  let totalLessons = 0;
  let completedLessons = 0;
  let totalHours = 0;
  let completedHours = 0;
  
  for (const stage of stages) {
    totalLessons += stage.totalLessons;
    totalHours += stage.totalHours || stage.totalLessons;
    
    const stageProgress = allProgress.filter(p => p.stageId === stage.id);
    const completedInStage = stageProgress.filter(p => p.status === 'completed').length;
    completedLessons += completedInStage;
    completedHours += completedInStage; // Assuming 1 hour per lesson for now
  }
  
  return {
    totalStages: stages.length,
    completedStages: 0, // Will be calculated below
    totalLessons,
    completedLessons,
    totalHours,
    completedHours,
    percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  };
}

/**
 * Get stage status (locked/in-progress/completed/test-passed)
 */
async function getStageStatus(stageId) {
  const stage = await getStage(stageId);
  const stageProgress = await DB.progress.getStage(stageId);
  
  // Calculate stage order
  const stages = await getAllStages();
  const stageIndex = stages.findIndex(s => s.id === stageId);
  
  // Check if previous stage is completed
  if (stageIndex > 0) {
    const prevStage = stages[stageIndex - 1];
    const prevProgress = await DB.progress.getStage(prevStage.id);
    const prevCompleted = prevProgress.filter(p => p.status === 'completed').length;
    if (prevCompleted < prevStage.totalLessons) {
      return { status: 'locked', reason: '前置阶段未完成' };
    }
  }
  
  // Check test status
  const testId = `${stageId}-test`;
  const testAssessment = await DB.assessments.get(testId);
  
  if (testAssessment?.passed) {
    return { status: 'test-passed', testScore: testAssessment.score };
  }
  
  // Check if all lessons completed
  const completedLessons = stageProgress.filter(p => p.status === 'completed').length;
  if (completedLessons >= stage.totalLessons) {
    return { status: 'completed', completedLessons };
  }
  
  // Check if any progress started
  if (stageProgress.length > 0) {
    return { status: 'in-progress', completedLessons };
  }
  
  return { status: 'not-started', completedLessons: 0 };
}

/**
 * Check if lesson is completed
 */
async function isLessonCompleted(stageId, lessonId) {
  const progress = await DB.progress.get(stageId, lessonId);
  return progress?.status === 'completed';
}

/**
 * Mark lesson as completed
 */
async function markLessonCompleted(stageId, lessonId, data = {}) {
  await DB.progress.save({
    stageId,
    lessonId,
    status: 'completed',
    completedAt: Date.now(),
    ...data
  });
  
  // Check if stage should be unlocked
  await checkStageCompletion(stageId);
}

/**
 * Check and update stage completion status
 */
async function checkStageCompletion(stageId) {
  const stage = await getStage(stageId);
  const stageProgress = await DB.progress.getStage(stageId);
  
  const completedLessons = stageProgress.filter(p => p.status === 'completed').length;
  
  // If all lessons completed, stage is ready for test
  if (completedLessons >= stage.totalLessons) {
    // Trigger any stage completion events
    const event = new CustomEvent('stageReadyForTest', { 
      detail: { stageId, completedLessons } 
    });
    document.dispatchEvent(event);
  }
}

/**
 * Get next lesson after completing current
 */
async function getNextLesson(stageId, currentLessonId) {
  const stage = await getStage(stageId);
  const lessons = stage?.lessons || [];
  const currentIndex = lessons.findIndex(l => l.id === currentLessonId);
  
  if (currentIndex === -1 || currentIndex >= lessons.length - 1) {
    return null; // No more lessons in this stage
  }
  
  return lessons[currentIndex + 1];
}

/**
 * Get lesson navigation info
 */
async function getLessonNavigation(stageId, lessonId) {
  const stage = await getStage(stageId);
  const lessons = stage?.lessons || [];
  const currentIndex = lessons.findIndex(l => l.id === lessonId);
  
  return {
    current: currentIndex + 1,
    total: lessons.length,
    hasPrev: currentIndex > 0,
    hasNext: currentIndex < lessons.length - 1,
    prevLesson: currentIndex > 0 ? lessons[currentIndex - 1] : null,
    nextLesson: currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null
  };
}

// ==================== Session Management ====================

/**
 * Start a learning session
 */
async function startSession() {
  const sessionId = generateSessionId();
  const studentId = localStorage.getItem('studentId');
  
  await DB.settings.set('currentSession', {
    sessionId,
    studentId,
    startTime: Date.now()
  });
  
  return sessionId;
}

/**
 * End current session
 */
async function endSession() {
  const session = await DB.settings.get('currentSession');
  if (!session) return null;
  
  const duration = Date.now() - session.startTime;
  
  // Update behavior metrics
  await updateSessionMetrics(duration);
  
  // Clear current session
  await DB.settings.set('currentSession', null);
  
  return { sessionId: session.sessionId, duration };
}

/**
 * Update session-related metrics
 */
async function updateSessionMetrics(durationMinutes) {
  const studentId = localStorage.getItem('studentId');
  
  // Get or initialize metrics
  let metrics = await DB.metrics.getAll();
  
  const totalSessions = (metrics.totalSessions || 0) + 1;
  const totalMinutes = (metrics.totalLearningMinutes || 0) + (durationMinutes || 0);
  
  await DB.metrics.set('totalSessions', totalSessions);
  await DB.metrics.set('totalLearningMinutes', totalMinutes);
  await DB.metrics.set('lastSessionAt', Date.now());
  await DB.metrics.set('studentId', studentId);
}

// ==================== Behavior Metrics ====================

/**
 * Calculate AI dependency index
 */
async function calculateAIDependencyIndex() {
  const conversations = await DB.conversations.getAll?.() || [];
  const submissions = await DB.submissions.getAll() || [];
  
  if (submissions.length === 0) return 0;
  
  // Count help requests vs total interactions
  let helpRequests = 0;
  let totalQuestions = 0;
  
  for (const conv of conversations) {
    if (conv.role === 'student') {
      totalQuestions++;
      if (Agent.isHelpRequest?.(conv.content)) {
        helpRequests++;
      }
    }
  }
  
  return totalQuestions > 0 ? helpRequests / totalQuestions : 0;
}

/**
 * Calculate self-correction rate
 */
async function calculateSelfCorrectionRate() {
  const submissions = await DB.submissions.getAll() || [];
  
  if (submissions.length < 2) return 0;
  
  let corrections = 0;
  for (let i = 1; i < submissions.length; i++) {
    // Check if student revised based on previous feedback
    if (submissions[i].revisedFrom) {
      corrections++;
    }
  }
  
  return corrections / submissions.length;
}

/**
 * Get behavior overview
 */
async function getBehaviorOverview() {
  const metrics = await DB.metrics.getAll();
  
  const aiDependencyIndex = await calculateAIDependencyIndex();
  const selfCorrectionRate = await calculateSelfCorrectionRate();
  
  return {
    aiDependencyIndex: Math.round(aiDependencyIndex * 100) / 100,
    selfCorrectionRate: Math.round(selfCorrectionRate * 100) / 100,
    totalSessions: metrics.totalSessions || 0,
    totalLearningMinutes: metrics.totalLearningMinutes || 0,
    avgSessionMinutes: metrics.totalSessions > 0 
      ? Math.round(metrics.totalLearningMinutes / metrics.totalSessions) 
      : 0
  };
}

// ==================== Utility Functions ====================

function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Format duration in minutes to readable string
 */
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

/**
 * Get reading time estimate for markdown content
 */
function estimateReadingTime(markdown) {
  if (!markdown) return 0;
  const words = markdown.split(/\s+/).length;
  return Math.ceil(words / 200); // Assume 200 words per minute
}

// ==================== Export ====================

window.CourseEngine = {
  // Content loading
  loadCourseContent,
  loadQuestionsContent,
  
  // Stage & lesson access
  getAllStages,
  getStage,
  getLesson,
  getLessonType,
  getTestQuestions,
  
  // Progress management
  calculateOverallProgress,
  getStageStatus,
  isLessonCompleted,
  markLessonCompleted,
  checkStageCompletion,
  getNextLesson,
  getLessonNavigation,
  
  // Session management
  startSession,
  endSession,
  
  // Behavior metrics
  calculateAIDependencyIndex,
  calculateSelfCorrectionRate,
  getBehaviorOverview,
  
  // Utilities
  formatDuration,
  estimateReadingTime
};
