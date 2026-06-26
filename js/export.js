/**
 * Export Module
 * Handles data export to JSON and CSV formats
 */

// ==================== Learning Record Export ====================

async function learningRecordToJSON() {
  const studentId = localStorage.getItem('studentId') || 'unknown';
  
  // Gather all data
  const progress = await DB.progress.getAll();
  const conversations = await DB.conversations.getAll?.() || [];
  const submissions = await DB.submissions.getAll() || [];
  const assessments = await DB.assessments.getAll() || [];
  const metrics = await DB.metrics.getAll() || {};
  const settings = await DB.settings.getAll() || {};
  
  // Load course content for structure
  let courseInfo = {};
  try {
    const response = await fetch('../data/course-content.json');
    const content = await response.json();
    courseInfo = {
      totalHours: content.stages.reduce((sum, s) => sum + (s.totalHours || s.totalLessons), 0),
      totalStages: content.stages.length
    };
  } catch (e) {
    courseInfo = { totalHours: 54, totalStages: 6 };
  }
  
  // Calculate progress
  const completedHours = progress.filter(p => p.status === 'completed').length;
  const allAssessments = await DB.assessments.getAll();
  let totalScore = 0;
  let scoreCount = 0;
  for (const a of allAssessments) {
    if (a.score !== undefined) {
      totalScore += a.score;
      scoreCount++;
    }
  }
  
  // Group progress by stage
  const stageMap = {};
  for (const p of progress) {
    if (!stageMap[p.stageId]) {
      stageMap[p.stageId] = [];
    }
    stageMap[p.stageId].push(p);
  }
  
  // Build stages array
  const stages = [];
  for (const [stageId, lessonProgress] of Object.entries(stageMap)) {
    const stageAssessments = assessments.filter(a => a.stageId === stageId);
    const testAssessment = stageAssessments.find(a => a.testId === `${stageId}-test`);
    
    // Get conversation count for this stage
    const stageConversations = conversations.filter(c => c.stageId === stageId);
    const helpRequests = stageConversations.filter(c => 
      c.role === 'student' && Agent?.isHelpRequest?.(c.content)
    ).length;
    
    stages.push({
      stageId,
      status: testAssessment?.passed ? 'test-passed' : 
              lessonProgress.every(p => p.status === 'completed') ? 'completed' :
              lessonProgress.length > 0 ? 'in-progress' : 'not-started',
      durationMinutes: lessonProgress.reduce((sum, p) => {
        if (p.completedAt && p.startedAt) {
          return sum + Math.round((p.completedAt - p.startedAt) / 60000);
        }
        return sum;
      }, 0),
      lessons: lessonProgress.map(p => ({
        lessonId: p.lessonId,
        completedAt: p.completedAt ? new Date(p.completedAt).toISOString() : null,
        durationMinutes: p.completedAt && p.startedAt ? 
          Math.round((p.completedAt - p.startedAt) / 60000) : 0
      })),
      testScore: testAssessment?.score,
      agentEvaluation: testAssessment?.passed ? '通过' : '未通过'
    });
  }
  
  // Calculate AI dependency index
  const totalQuestions = conversations.filter(c => c.role === 'student').length;
  const totalHelpRequests = conversations.filter(c => 
    c.role === 'student' && Agent?.isHelpRequest?.(c.content)
  ).length;
  
  const exportData = {
    exportVersion: '1.0',
    studentId,
    exportDate: new Date().toISOString(),
    courseInfo: {
      totalHours: courseInfo.totalHours,
      completedHours,
      overallScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : null
    },
    stages,
    learning_behaviors: {
      avgSessionMinutes: metrics.totalSessions ? 
        Math.round(metrics.totalLearningMinutes / metrics.totalSessions) : 0,
      ai_dependency_index: totalQuestions > 0 ? 
        Math.round((totalHelpRequests / totalQuestions) * 100) / 100 : 0,
      self_correction_rate: metrics.selfCorrectionRate || 0,
      retry_rate: 0, // Would need to track retry data
      totalSessions: metrics.totalSessions || 0,
      totalLearningMinutes: metrics.totalLearningMinutes || 0
    },
    conversations_summary: {
      total: conversations.length,
      by_stage: Object.fromEntries(
        Object.entries(groupBy(conversations, 'stageId')).map(([k, v]) => [k, v.length])
      )
    },
    submissions_summary: {
      total: submissions.length,
      by_lesson: Object.fromEntries(
        Object.entries(groupBy(submissions, 'lessonId')).map(([k, v]) => [k, v.length])
      )
    },
    assessments: assessments.map(a => ({
      testId: a.testId,
      stageId: a.stageId,
      score: a.score,
      totalScore: a.totalScore,
      passed: a.passed,
      timeUsedSeconds: a.timeUsed,
      submittedAt: a.submittedAt ? new Date(a.submittedAt).toISOString() : null
    }))
  };
  
  return exportData;
}

// ==================== Grades Export ====================

async function gradesToCSV() {
  const assessments = await DB.assessments.getAll() || [];
  
  // CSV headers
  const headers = ['阶段', '测试ID', '得分', '总分', '百分比', '是否通过', '用时(秒)', '提交时间'];
  
  // Build rows
  const rows = assessments.map(a => {
    const percentage = a.totalScore > 0 ? Math.round((a.score / a.totalScore) * 100) : 0;
    return [
      a.stageId || '',
      a.testId || '',
      a.score ?? '',
      a.totalScore ?? '',
      percentage + '%',
      a.passed ? '是' : '否',
      a.timeUsed || '',
      a.submittedAt ? new Date(a.submittedAt).toLocaleString('zh-CN') : ''
    ];
  });
  
  // Add summary row
  rows.push([]); // Empty row
  rows.push(['汇总']);
  const passCount = assessments.filter(a => a.passed).length;
  const avgScore = assessments.length > 0 ?
    Math.round(assessments.reduce((sum, a) => sum + (a.score / a.totalScore * 100), 0) / assessments.length) : 0;
  rows.push(['通过数', passCount]);
  rows.push(['平均分', avgScore + '%']);
  
  // Convert to CSV
  return [
    '\ufeff' + headers.join(','), // BOM for Excel
    ...rows.map(row => row.map(cell => 
      typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
    ).join(','))
  ].join('\n');
}

// ==================== Submissions Export ====================

async function submissionsToJSON() {
  const submissions = await DB.submissions.getAll() || [];
  
  return submissions.map(s => ({
    lessonId: s.lessonId,
    stageId: s.stageId,
    content: s.content,
    ownWork: s.ownWork,
    timestamp: s.timestamp ? new Date(s.timestamp).toISOString() : null,
    agentFeedback: s.agentFeedback
  }));
}

// ==================== Conversations Export ====================

async function conversationsToJSON(stageId = null) {
  // This would need a method to get all conversations
  const allConversations = await DB.conversations.getAll?.() || [];
  
  let filtered = allConversations;
  if (stageId) {
    filtered = allConversations.filter(c => c.stageId === stageId);
  }
  
  return {
    exportDate: new Date().toISOString(),
    totalMessages: filtered.length,
    conversations: filtered.map(c => ({
      sessionId: c.sessionId,
      stageId: c.stageId,
      lessonId: c.lessonId,
      role: c.role,
      content: c.content,
      mode: c.mode,
      timestamp: c.timestamp ? new Date(c.timestamp).toISOString() : null
    }))
  };
}

// ==================== Utility Functions ====================

function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const value = item[key];
    groups[value] = groups[value] || [];
    groups[value].push(item);
    return groups;
  }, {});
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== Export to File ====================

async function exportFullRecord() {
  const data = await learningRecordToJSON();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `学习记录_${new Date().toISOString().split('T')[0]}.json`);
}

async function exportGrades() {
  const csv = await gradesToCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `成绩汇总_${new Date().toISOString().split('T')[0]}.csv`);
}

// ==================== Import Functions (for Teacher) ====================

function parseImportedJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    
    // Validate required fields
    if (!data.exportVersion || !data.studentId) {
      throw new Error('无效的学习记录格式');
    }
    
    return {
      valid: true,
      data
    };
  } catch (e) {
    return {
      valid: false,
      error: e.message
    };
  }
}

// ==================== Export ====================

window.Export = {
  learningRecordToJSON,
  gradesToCSV,
  submissionsToJSON,
  conversationsToJSON,
  exportFullRecord,
  exportGrades,
  parseImportedJSON
};
