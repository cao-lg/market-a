/**
 * Test Engine Module
 * Handles test rendering, timing, and auto-grading
 */

// Current test state
let currentTest = null;
let currentTestId = null;
let testStartTime = null;
let testTimer = null;
let testAnswers = {};

// ==================== Test Loading ====================

async function loadTest(stageId) {
  const questions = await CourseEngine.getTestQuestions(stageId);
  
  if (!questions) {
    console.error('Test not found for stage:', stageId);
    return null;
  }
  
  currentTest = questions;
  currentTestId = `${stageId}-test`;
  currentTest.questions = shuffleArray(questions.questions);
  testAnswers = {};
  
  return currentTest;
}

async function getCurrentTest() {
  return currentTest;
}

// ==================== Test Rendering ====================

function renderTest(containerId) {
  const container = document.getElementById(containerId);
  if (!container || !currentTest) return;
  
  let html = `
    <div class="test-header mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">${currentTest.title}</h2>
        <div class="timer" id="test-timer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span id="timer-display">${formatTime(currentTest.timeLimitMinutes * 60)}</span>
        </div>
      </div>
      <div class="progress">
        <div class="progress-bar" id="test-progress" style="width: 0%;"></div>
      </div>
      <div class="flex justify-between items-center mt-2">
        <span class="text-sm" style="color: var(--text-tertiary);">及格线: ${currentTest.passingScore}分</span>
        <span class="text-sm" style="color: var(--text-tertiary);">总分: ${calculateTotalScore()}</span>
      </div>
    </div>
    
    <div class="test-questions" id="test-questions">
  `;
  
  currentTest.questions.forEach((q, index) => {
    html += renderQuestion(q, index);
  });
  
  html += `
    </div>
    
    <div class="test-footer mt-6 p-4" style="background: var(--bg-tertiary); border-radius: 8px;">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm" style="color: var(--text-secondary);">已答题: </span>
          <span class="text-sm font-medium" id="answered-count">0</span>
          <span class="text-sm" style="color: var(--text-tertiary);"> / ${currentTest.questions.length}</span>
        </div>
        <button class="btn btn-primary" id="submit-test-btn" onclick="submitTest()">
          提交测试
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Start timer
  startTimer(currentTest.timeLimitMinutes * 60);
}

function renderQuestion(question, index) {
  const typeLabel = {
    'single-choice': '单选题',
    'multi-choice': '多选题',
    'fill-blank': '填空题',
    'hands-on': '实操题'
  };
  
  let optionsHtml = '';
  
  switch (question.type) {
    case 'single-choice':
    case 'multi-choice':
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      optionsHtml = question.options.map((opt, i) => `
        <div class="quiz-option" data-question="${question.id}" data-option="${i}" onclick="selectOption('${question.id}', ${i}, ${question.type === 'multi-choice'})">
          <div class="quiz-option-marker">${letters[i]}</div>
          <div class="flex-1">${escapeHtml(opt)}</div>
        </div>
      `).join('');
      break;
      
    case 'fill-blank':
      optionsHtml = `
        <div class="form-group mb-0">
          <input type="text" class="form-input" id="fill-${question.id}" 
                 placeholder="请输入答案" onchange="saveFillAnswer('${question.id}', this.value)">
        </div>
      `;
      break;
      
    case 'hands-on':
      optionsHtml = `
        <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
          <p style="color: var(--text-secondary); font-size: 0.875rem;">实操题需要在实际数据上完成操作</p>
          <button class="btn btn-secondary btn-sm mt-2" onclick="openHandsOnPractice('${question.dataSource || ''}')">
            打开在线练习
          </button>
        </div>
      `;
      break;
  }
  
  return `
    <div class="quiz-question" id="question-${question.id}">
      <div class="quiz-question-header">
        <div class="quiz-question-text">
          <span class="mr-2" style="color: var(--text-tertiary);">${index + 1}.</span>
          ${escapeHtml(question.question)}
        </div>
        <span class="quiz-question-score">${question.score}分</span>
      </div>
      <div class="quiz-question-type mb-3">
        <span class="badge badge-primary">${typeLabel[question.type] || question.type}</span>
      </div>
      <div class="quiz-options">
        ${optionsHtml}
      </div>
    </div>
  `;
}

// ==================== Answer Handling ====================

function selectOption(questionId, optionIndex, isMulti) {
  const options = document.querySelectorAll(`[data-question="${questionId}"]`);
  
  if (isMulti) {
    // Toggle selection for multi-choice
    const isSelected = options[optionIndex].classList.contains('selected');
    options[optionIndex].classList.toggle('selected');
    
    if (!testAnswers[questionId]) {
      testAnswers[questionId] = [];
    }
    
    if (isSelected) {
      testAnswers[questionId] = testAnswers[questionId].filter(i => i !== optionIndex);
    } else {
      testAnswers[questionId].push(optionIndex);
    }
  } else {
    // Single choice - clear others and select this
    options.forEach((opt, i) => {
      opt.classList.toggle('selected', i === optionIndex);
    });
    testAnswers[questionId] = optionIndex;
  }
  
  updateAnsweredCount();
}

function saveFillAnswer(questionId, value) {
  testAnswers[questionId] = value;
  updateAnsweredCount();
}

function updateAnsweredCount() {
  const answered = Object.keys(testAnswers).length;
  const total = currentTest?.questions.length || 0;
  
  const countEl = document.getElementById('answered-count');
  if (countEl) {
    countEl.textContent = answered;
  }
  
  // Update progress bar
  const progressBar = document.getElementById('test-progress');
  if (progressBar) {
    progressBar.style.width = `${(answered / total) * 100}%`;
  }
}

// ==================== Timer ====================

function startTimer(seconds) {
  testStartTime = Date.now();
  let remaining = seconds;
  
  const timerDisplay = document.getElementById('timer-display');
  const timerContainer = document.getElementById('test-timer');
  
  updateTimerDisplay(remaining);
  
  testTimer = setInterval(() => {
    remaining--;
    updateTimerDisplay(remaining);
    
    if (remaining <= 60) {
      timerContainer.classList.add('warning');
    }
    
    if (remaining <= 0) {
      clearInterval(testTimer);
      showToast('warning', '时间到', '测试时间已结束，将自动提交');
      submitTest();
    }
  }, 1000);
  
  function updateTimerDisplay(seconds) {
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(seconds);
    }
  }
}

function stopTimer() {
  if (testTimer) {
    clearInterval(testTimer);
    testTimer = null;
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getTimeUsed() {
  if (!testStartTime) return 0;
  return Math.floor((Date.now() - testStartTime) / 1000);
}

// ==================== Test Submission ====================

async function submitTest() {
  // Stop timer
  stopTimer();
  
  // Calculate score
  const result = calculateScore();
  
  // Disable all inputs
  const inputs = document.querySelectorAll('input, .quiz-option');
  inputs.forEach(el => {
    el.style.pointerEvents = 'none';
    el.style.opacity = '0.7';
  });
  
  // Show results
  showTestResults(result);
  
  // Save assessment
  await DB.assessments.save({
    testId: currentTestId,
    stageId: currentTestId.replace('-test', ''),
    score: result.score,
    totalScore: result.totalScore,
    passed: result.passed,
    timeUsed: getTimeUsed(),
    answers: testAnswers,
    submittedAt: Date.now()
  });
  
  // Update progress
  if (result.passed) {
    await CourseEngine.markLessonCompleted(
      currentTestId.replace('-test', ''),
      `${currentTestId.replace('-test', '')}-test`,
      { testScore: result.score }
    );
  }
  
  return result;
}

function calculateScore() {
  let score = 0;
  let totalScore = 0;
  const details = [];
  
  for (const question of currentTest.questions) {
    totalScore += question.score;
    const userAnswer = testAnswers[question.id];
    let isCorrect = false;
    
    switch (question.type) {
      case 'single-choice':
        isCorrect = userAnswer === question.answer;
        break;
        
      case 'multi-choice':
        if (Array.isArray(userAnswer) && Array.isArray(question.answer)) {
          const sortedUser = [...userAnswer].sort();
          const sortedCorrect = [...question.answer].sort();
          isCorrect = JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect);
        }
        break;
        
      case 'fill-blank':
        // Simple exact match (case insensitive)
        isCorrect = userAnswer?.toLowerCase().trim() === question.answer?.toLowerCase().trim();
        break;
        
      case 'hands-on':
        // Hands-on grading would be done separately
        isCorrect = userAnswer === true;
        score += question.score * 0.8; // Partial credit
        details.push({
          questionId: question.id,
          correct: isCorrect,
          score: isCorrect ? question.score : 0
        });
        continue;
    }
    
    if (isCorrect) {
      score += question.score;
    }
    
    details.push({
      questionId: question.id,
      correct: isCorrect,
      score: isCorrect ? question.score : 0
    });
  }
  
  const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
  
  return {
    score,
    totalScore,
    percentage,
    passed: percentage >= currentTest.passingScore,
    passingScore: currentTest.passingScore,
    details
  };
}

function showTestResults(result) {
  const container = document.getElementById('test-questions');
  
  // Add result indicators to each question
  currentTest.questions.forEach(q => {
    const qEl = document.getElementById(`question-${q.id}`);
    if (!qEl) return;
    
    const detail = result.details.find(d => d.questionId === q.id);
    if (!detail) return;
    
    const header = qEl.querySelector('.quiz-question-header');
    
    if (detail.correct) {
      header.innerHTML += '<span class="badge badge-success ml-2">正确</span>';
      qEl.style.borderColor = 'var(--accent-green)';
    } else {
      header.innerHTML += '<span class="badge badge-danger ml-2">错误</span>';
      qEl.style.borderColor = 'var(--accent-red)';
      
      // Show correct answer for choice questions
      if (q.type === 'single-choice' || q.type === 'multi-choice') {
        const options = qEl.querySelectorAll('.quiz-option');
        const correctAnswers = Array.isArray(q.answer) ? q.answer : [q.answer];
        correctAnswers.forEach(i => {
          if (options[i]) {
            options[i].classList.add('correct');
          }
        });
      }
    }
  });
  
  // Disable submit button
  const submitBtn = document.getElementById('submit-test-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '已提交';
  }
  
  // Show summary modal
  showResultModal(result);
}

function showResultModal(result) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">测试结果</h3>
      </div>
      <div class="modal-body text-center">
        <div class="text-6xl font-bold mb-4" style="color: ${result.passed ? 'var(--accent-green)' : 'var(--accent-red)'};">
          ${result.percentage}%
        </div>
        <div class="text-lg mb-4">
          ${result.passed ? '🎉 恭喜通过测试！' : '😔 未达到及格线'}
        </div>
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
            <div class="text-2xl font-bold" style="color: var(--text-primary);">${result.score}</div>
            <div class="text-xs" style="color: var(--text-tertiary);">得分</div>
          </div>
          <div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
            <div class="text-2xl font-bold" style="color: var(--text-primary);">${result.totalScore}</div>
            <div class="text-xs" style="color: var(--text-tertiary);">满分</div>
          </div>
          <div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
            <div class="text-2xl font-bold" style="color: var(--text-primary);">${currentTest.passingScore}</div>
            <div class="text-xs" style="color: var(--text-tertiary);">及格线</div>
          </div>
        </div>
        <div class="text-sm" style="color: var(--text-secondary);">
          用时: ${formatTime(getTimeUsed())}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="reviewAnswers()">回顾答案</button>
        <button class="btn btn-primary" onclick="returnToDashboard()">返回仪表盘</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

function reviewAnswers() {
  document.querySelector('.modal-overlay')?.remove();
  // Scroll to first wrong answer
  const firstWrong = document.querySelector('.quiz-question[style*="border-color: var(--accent-red)"]');
  if (firstWrong) {
    firstWrong.scrollIntoView({ behavior: 'smooth' });
  }
}

function returnToDashboard() {
  window.location.href = 'dashboard.html';
}

function openHandsOnPractice(dataSource) {
  window.open(`practice.html?data=${encodeURIComponent(dataSource)}`, '_blank');
}

// ==================== Utilities ====================

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateTotalScore() {
  if (!currentTest?.questions) return 0;
  return currentTest.questions.reduce((sum, q) => sum + q.score, 0);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== Export ====================

window.TestEngine = {
  loadTest,
  getCurrentTest,
  renderTest,
  submitTest,
  calculateScore
};
