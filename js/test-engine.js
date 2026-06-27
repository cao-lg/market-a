/**
 * Test Engine Module
 * Handles test rendering, timing, and auto-grading
 */

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
    <div class="test-hero">
      <div class="test-eyebrow">Stage Assessment</div>
      <h2 class="test-title">${currentTest.title}</h2>
      <div class="test-meta-row">
        <div class="test-stats">
          <div class="test-stat">
            <span class="test-stat-label">题目数量</span>
            <span class="test-stat-value">${currentTest.questions.length} 道</span>
          </div>
          <div class="test-stat">
            <span class="test-stat-label">及格分数</span>
            <span class="test-stat-value">${currentTest.passingScore}分</span>
          </div>
          <div class="test-stat">
            <span class="test-stat-label">总分</span>
            <span class="test-stat-value">${calculateTotalScore()}分</span>
          </div>
        </div>
        <div class="timer-display" id="test-timer">
          <div class="timer-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <div class="timer-time" id="timer-display">${formatTime(currentTest.timeLimitMinutes * 60)}</div>
            <div class="timer-label">剩余时间</div>
          </div>
        </div>
      </div>
      <div class="progress-section">
        <div class="progress-labels">
          <span class="progress-label">答题进度</span>
          <span class="progress-label"><strong id="progress-text">0</strong> / ${currentTest.questions.length} 已完成</span>
        </div>
        <div class="progress">
          <div class="progress-bar" id="test-progress" style="width: 0%;"></div>
        </div>
      </div>
    </div>
    
    <div class="test-questions" id="test-questions">
  `;
  
  currentTest.questions.forEach((q, index) => {
    html += renderQuestion(q, index);
  });
  
  html += `
    </div>
    
    <div class="test-footer">
      <div class="footer-content">
        <div class="answered-count">
          <div class="answered-pill">
            <span>已答题</span>
            <strong id="answered-count">0</strong>
            <span>/ ${currentTest.questions.length}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-lg" id="submit-test-btn" onclick="submitTest()">
          提交测试
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
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
      optionsHtml = `<div class="question-options">` + question.options.map((opt, i) => `
        <div class="option-item" data-question="${question.id}" data-option="${i}" onclick="selectOption('${question.id}', ${i}, ${question.type === 'multi-choice'})">
          <div class="option-marker">${letters[i]}</div>
          <div class="option-content">${escapeHtml(opt)}</div>
        </div>
      `).join('') + `</div>`;
      break;
      
    case 'fill-blank':
      optionsHtml = `
        <div class="fill-blank-input-wrapper">
          <input type="text" class="form-input" id="fill-${question.id}" 
                 placeholder="请输入答案" onchange="saveFillAnswer('${question.id}', this.value)">
        </div>
      `;
      break;
      
    case 'hands-on':
      optionsHtml = `
        <div class="hands-on-box">
          <p class="hands-on-text">实操题需要在实际数据上完成操作，请点击下方按钮打开在线练习环境完成题目。</p>
          <button class="btn btn-secondary btn-sm" onclick="openHandsOnPractice('${question.dataSource || ''}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            打开在线练习
          </button>
        </div>
      `;
      break;
  }
  
  return `
    <div class="test-question-card" id="question-${question.id}">
      <div class="question-header">
        <div class="question-number-badge">
          <div class="question-number">${index + 1}</div>
          <div>
            <span class="question-type-badge">${typeLabel[question.type] || question.type}</span>
          </div>
        </div>
        <div class="question-score">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          ${question.score}分
        </div>
      </div>
      <div class="question-text">
        ${escapeHtml(question.question)}
      </div>
      ${optionsHtml}
    </div>
  `;
}

// ==================== Answer Handling ====================

function selectOption(questionId, optionIndex, isMulti) {
  const options = document.querySelectorAll(`[data-question="${questionId}"]`);
  
  if (isMulti) {
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
    options.forEach((opt, i) => {
      opt.classList.toggle('selected', i === optionIndex);
    });
    testAnswers[questionId] = optionIndex;
  }
  
  updateAnsweredCount();
  updateQuestionCardState(questionId, true);
}

function saveFillAnswer(questionId, value) {
  testAnswers[questionId] = value;
  updateAnsweredCount();
  updateQuestionCardState(questionId, value && value.trim().length > 0);
}

function updateQuestionCardState(questionId, answered) {
  const card = document.getElementById(`question-${questionId}`);
  if (card) {
    if (answered) {
      card.classList.add('answered');
    } else {
      card.classList.remove('answered');
    }
  }
}

function updateAnsweredCount() {
  const answered = Object.keys(testAnswers).filter(k => {
    const v = testAnswers[k];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }).length;
  const total = currentTest?.questions.length || 0;
  
  const countEl = document.getElementById('answered-count');
  if (countEl) {
    countEl.textContent = answered;
  }
  
  const progressText = document.getElementById('progress-text');
  if (progressText) {
    progressText.textContent = answered;
  }
  
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
  
  window.testTimer = testTimer;
  
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
    window.testTimer = null;
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
  stopTimer();
  
  const result = calculateScore();
  
  const inputs = document.querySelectorAll('input, .option-item');
  inputs.forEach(el => {
    el.style.pointerEvents = 'none';
  });
  
  showTestResults(result);
  
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
        isCorrect = userAnswer?.toLowerCase().trim() === question.answer?.toLowerCase().trim();
        break;
        
      case 'hands-on':
        isCorrect = userAnswer === true;
        score += question.score * 0.8;
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
  
  currentTest.questions.forEach(q => {
    const qEl = document.getElementById(`question-${q.id}`);
    if (!qEl) return;
    
    const detail = result.details.find(d => d.questionId === q.id);
    if (!detail) return;
    
    const header = qEl.querySelector('.question-header .question-number-badge');
    
    if (detail.correct) {
      qEl.classList.add('correct');
      if (header) {
        header.insertAdjacentHTML('beforeend', '<span class="badge badge-success" style="margin-left: 8px;">正确</span>');
      }
    } else {
      qEl.classList.add('incorrect');
      if (header) {
        header.insertAdjacentHTML('beforeend', '<span class="badge badge-danger" style="margin-left: 8px;">错误</span>');
      }
      
      if (q.type === 'single-choice' || q.type === 'multi-choice') {
        const options = qEl.querySelectorAll('.option-item');
        const correctAnswers = Array.isArray(q.answer) ? q.answer : [q.answer];
        correctAnswers.forEach(i => {
          if (options[i]) {
            options[i].classList.add('correct');
          }
        });
        
        const userAnswer = testAnswers[q.id];
        if (q.type === 'single-choice' && userAnswer !== undefined && userAnswer !== q.answer) {
          if (options[userAnswer]) {
            options[userAnswer].classList.add('incorrect');
          }
        } else if (q.type === 'multi-choice' && Array.isArray(userAnswer)) {
          userAnswer.forEach(i => {
            if (!correctAnswers.includes(i) && options[i]) {
              options[i].classList.add('incorrect');
            }
          });
        }
      }
    }
  });
  
  const submitBtn = document.getElementById('submit-test-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '已提交';
  }
  
  showResultModal(result);
}

function showResultModal(result) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal result-modal">
      <div class="modal-header">
        <h3 class="modal-title">测试结果</h3>
        <button class="modal-close" onclick="closeResultModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="result-hero">
          <div class="result-score-circle ${result.passed ? 'passed' : 'failed'}">
            <div class="result-percentage">${result.percentage}%</div>
            <div class="result-label">得分率</div>
          </div>
          <div class="result-status">
            ${result.passed ? '🎉 恭喜通过测试！' : '📚 继续努力，未达及格线'}
          </div>
          <div class="result-subtitle">
            ${result.passed ? '你已经掌握了本阶段的核心知识点' : '别灰心，回顾错题后再试一次'}
          </div>
        </div>
        
        <div class="result-stats-grid">
          <div class="result-stat-item">
            <div class="result-stat-value">${result.score}</div>
            <div class="result-stat-label">得分</div>
          </div>
          <div class="result-stat-item">
            <div class="result-stat-value">${result.totalScore}</div>
            <div class="result-stat-label">满分</div>
          </div>
          <div class="result-stat-item">
            <div class="result-stat-value">${currentTest.passingScore}</div>
            <div class="result-stat-label">及格线</div>
          </div>
        </div>
        
        <div class="result-time">
          用时: <strong>${formatTime(getTimeUsed())}</strong>
        </div>
        
        <div class="result-notice">
          <div class="result-notice-header">
            <span class="result-notice-icon">💡</span>
            <span class="result-notice-title">AI答疑已解锁</span>
          </div>
          <div class="result-notice-text">
            点击"AI答疑"可以向李主管请教错题，他会帮你分析解题思路，深入理解知识点。
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="result-actions">
          <button class="btn btn-secondary" onclick="reviewAnswers()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            回顾答案
          </button>
          <button class="btn btn-outline" onclick="openAIQa()">
            <span style="margin-right: 4px;">🤔</span> AI答疑
          </button>
          <button class="btn btn-primary" onclick="returnToDashboard()">
            返回仪表盘
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  window.resultModalOverlay = overlay;
}

function closeResultModal() {
  if (window.resultModalOverlay) {
    window.resultModalOverlay.remove();
    window.resultModalOverlay = null;
  }
}

function openAIQa() {
  closeResultModal();
  
  const wrongAnswersInfo = prepareWrongAnswersInfo();
  
  const stageId = currentTestId.replace('-test', '');
  const params = new URLSearchParams({
    stage: stageId,
    mode: 'examiner',
    examinerState: 'reviewing',
    wrongAnswers: encodeURIComponent(JSON.stringify(wrongAnswersInfo))
  });
  
  window.location.href = `learn.html?${params.toString()}`;
}

function prepareWrongAnswersInfo() {
  const wrongAnswers = [];
  
  for (const q of currentTest.questions) {
    const userAnswer = testAnswers[q.id];
    let isCorrect = false;
    
    switch (q.type) {
      case 'single-choice':
        isCorrect = userAnswer === q.answer;
        break;
      case 'multi-choice':
        if (Array.isArray(userAnswer) && Array.isArray(q.answer)) {
          const sortedUser = [...userAnswer].sort();
          const sortedCorrect = [...q.answer].sort();
          isCorrect = JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect);
        }
        break;
      case 'fill-blank':
        isCorrect = userAnswer?.toLowerCase().trim() === q.answer?.toLowerCase().trim();
        break;
    }
    
    if (!isCorrect) {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      let correctAnswerStr = '';
      
      if (q.type === 'single-choice') {
        correctAnswerStr = letters[q.answer];
      } else if (q.type === 'multi-choice') {
        correctAnswerStr = q.answer.map(i => letters[i]).join('、');
      } else {
        correctAnswerStr = q.answer;
      }
      
      wrongAnswers.push({
        questionId: q.id,
        question: q.question,
        type: q.type,
        yourAnswer: userAnswer,
        correctAnswer: correctAnswerStr,
        explanation: q.explanation || '暂无解析'
      });
    }
  }
  
  return wrongAnswers;
}

function reviewAnswers() {
  closeResultModal();
  const firstWrong = document.querySelector('.test-question-card.incorrect');
  if (firstWrong) {
    firstWrong.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
