/**
 * Exam Behavior Tracker Module
 * 答题行为追踪器 - 记录答题过程中的各种行为数据
 */

const ExamTracker = (function() {
  let currentQuestion = null;
  let modificationCount = 0;
  let checkedCount = 0;
  let lastAnswer = null;

  const TOPIC_KEYWORDS = {
    '电商运营': ['转化率', 'ROI', 'GMV', 'UV', 'PV', '客单价', '复购率', '漏斗', 'A/B测试', '流量', '销量', '订单', '店铺', '商品', 'sku', '详情页', '主图', '标题', '权重', '排名', '搜索', '推荐', '直播', '短视频', '达人', '种草', '私域', '公域', '拉新', '留存', '促活', '转化', '裂变'],
    '数据分析': ['环比', '同比', '趋势', '对比', '细分', '维度', '指标', '归因', '分析', '数据', '统计', '报表', '图表', '折线图', '柱状图', '饼图', '散点图', '漏斗图', '帕累托', '二八定律', '相关性', '回归', '预测', '模型', '聚类', '分类'],
    '数据处理': ['Excel', '函数', '透视表', 'VLOOKUP', '数据清洗', '去重', '筛选', '排序', '公式', 'SUM', 'COUNT', 'AVERAGE', 'IF', 'INDEX', 'MATCH', '条件格式', '数据验证', '分列', '合并', '分组', '汇总', 'SQL', '数据库', '查询'],
    '用户行为': ['停留时长', '跳出率', '访问深度', '页面浏览', '点击', '转化路径', '用户画像', '人群', '分层', 'RFM', '活跃度', '留存率', '流失率', '召回'],
    '营销推广': ['直通车', '钻展', '超级推荐', '信息流', 'SEM', 'SEO', '自然流量', '付费流量', 'ROI', '投产比', '点击率', 'CTR', 'CPC', 'CPM', 'CPA', 'CPS', '拉新成本', '获客成本', 'CAC', 'LTV'],
    '产品运营': ['竞品分析', '市场调研', '用户需求', '产品迭代', 'MVP', '用户体验', 'UX', 'UI', '交互设计', 'AB测试', '灰度测试', '用户反馈']
  };

  function generateSessionId() {
    return 'exam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function detectQuestionType(text) {
    if (!text) return 'choice';
    
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('判断') || lowerText.includes('是否') || lowerText.includes('对错') || lowerText.includes('正确') || lowerText.includes('错误')) {
      if (lowerText.length < 50) return 'truefalse';
    }
    
    if (lowerText.includes('填空') || lowerText.includes('请填写') || lowerText.includes('请输入') || text.includes('____') || text.includes('（ ）') || text.includes('()')) {
      return 'shortanswer';
    }
    
    if (lowerText.includes('案例') || lowerText.includes('分析') || lowerText.includes('请回答') || lowerText.includes('简述') || lowerText.includes('论述') || lowerText.includes('怎么办') || lowerText.includes('如何')) {
      if (lowerText.length > 30) return 'case';
    }
    
    if (lowerText.includes('多选') || lowerText.includes('至少') || lowerText.includes('两个以上') || lowerText.includes('哪些')) {
      return 'choice';
    }
    
    if (lowerText.includes('单选') || lowerText.includes('以下哪项') || lowerText.includes('哪个是') || lowerText.includes('哪一个')) {
      return 'choice';
    }
    
    return 'choice';
  }

  function extractTopic(text, stageId) {
    if (!text) return '其他';
    
    let matchedTopics = [];
    
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword) || text.toLowerCase().includes(keyword.toLowerCase())) {
          matchedTopics.push(topic);
          break;
        }
      }
    }
    
    if (matchedTopics.length > 0) {
      return matchedTopics[0];
    }
    
    if (stageId) {
      const stageTopicMap = {
        'stage-1': '电商运营',
        'stage-2': '数据分析',
        'stage-3': '数据处理',
        'stage-4': '用户行为',
        'stage-5': '营销推广'
      };
      if (stageTopicMap[stageId]) {
        return stageTopicMap[stageId];
      }
    }
    
    return '其他';
  }

  async function logEvent(eventType, eventName, properties = {}) {
    try {
      if (window.DB && DB.eventLogs) {
        await DB.eventLogs.add({
          eventType,
          eventName,
          sessionId: currentQuestion?.sessionId || '',
          stageId: currentQuestion?.stageId || '',
          lessonId: currentQuestion?.lessonId || '',
          questionId: currentQuestion?.questionId || '',
          properties,
          timestamp: Date.now()
        });
      }
    } catch (e) {
      console.warn('Failed to log exam event:', e);
    }
  }

  async function startQuestion(questionData) {
    if (!questionData) return null;
    
    modificationCount = 0;
    checkedCount = 0;
    lastAnswer = null;
    
    currentQuestion = {
      questionId: questionData.questionId || ('q_' + Date.now()),
      questionText: questionData.questionText || '',
      questionType: questionData.questionType || detectQuestionType(questionData.questionText),
      topic: questionData.topic || extractTopic(questionData.questionText, questionData.stageId),
      stageId: questionData.stageId || '',
      lessonId: questionData.lessonId || '',
      sessionId: questionData.sessionId || generateSessionId(),
      source: questionData.source || 'practice',
      startTime: Date.now()
    };
    
    const eventName = currentQuestion.source === 'examiner' ? '考官出题' : 
                      currentQuestion.source === 'test' ? '开始答题' : '练习开始';
    const eventType = currentQuestion.source === 'examiner' ? 'examiner_question' : 'exam_start';
    
    await logEvent(eventType, eventName, {
      questionType: currentQuestion.questionType,
      topic: currentQuestion.topic
    });
    
    return currentQuestion;
  }

  async function recordAnswer(answerData) {
    if (!currentQuestion) return null;
    
    const answer = typeof answerData === 'object' ? answerData.answer : answerData;
    
    if (lastAnswer !== null && lastAnswer !== answer) {
      modificationCount++;
    }
    
    lastAnswer = answer;
    
    await logEvent('exam_answer', '提交答案', {
      answer: String(answer).substring(0, 200),
      modificationCount
    });
    
    return {
      answer,
      modificationCount
    };
  }

  function recordModification() {
    modificationCount++;
    return modificationCount;
  }

  function recordCheck() {
    checkedCount++;
    return checkedCount;
  }

  async function skipQuestion() {
    if (!currentQuestion) return null;
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - currentQuestion.startTime) / 1000);
    
    const record = {
      studentId: null,
      stageId: currentQuestion.stageId,
      lessonId: currentQuestion.lessonId,
      sessionId: currentQuestion.sessionId,
      questionId: currentQuestion.questionId,
      questionType: currentQuestion.questionType,
      topic: currentQuestion.topic,
      startTime: currentQuestion.startTime,
      endTime,
      duration,
      isCorrect: false,
      userAnswer: '',
      correctAnswer: '',
      modificationCount,
      skipped: true,
      checkedCount,
      score: 0,
      createdAt: Date.now()
    };
    
    try {
      if (window.DB && DB.examBehavior) {
        await DB.examBehavior.add(record);
      }
    } catch (e) {
      console.warn('Failed to save skipped exam behavior:', e);
    }
    
    const eventType = currentQuestion.source === 'examiner' ? 'examiner_answer' : 'exam_skip';
    const eventName = currentQuestion.source === 'examiner' ? '学生跳过' : '跳过题目';
    
    await logEvent(eventType, eventName, {
      duration,
      skipped: true
    });
    
    const result = { ...record };
    currentQuestion = null;
    modificationCount = 0;
    checkedCount = 0;
    lastAnswer = null;
    
    return result;
  }

  async function finishQuestion(isCorrect, score, correctAnswer) {
    if (!currentQuestion) return null;
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - currentQuestion.startTime) / 1000);
    
    const record = {
      studentId: null,
      stageId: currentQuestion.stageId,
      lessonId: currentQuestion.lessonId,
      sessionId: currentQuestion.sessionId,
      questionId: currentQuestion.questionId,
      questionType: currentQuestion.questionType,
      topic: currentQuestion.topic,
      startTime: currentQuestion.startTime,
      endTime,
      duration,
      isCorrect: !!isCorrect,
      userAnswer: lastAnswer !== null ? String(lastAnswer) : '',
      correctAnswer: correctAnswer ? String(correctAnswer) : '',
      modificationCount,
      skipped: false,
      checkedCount,
      score: score || 0,
      createdAt: Date.now()
    };
    
    try {
      if (window.DB && DB.examBehavior) {
        await DB.examBehavior.add(record);
      }
    } catch (e) {
      console.warn('Failed to save exam behavior:', e);
    }
    
    const eventType = currentQuestion.source === 'examiner' ? 'examiner_feedback' : 'exam_answer';
    const eventName = currentQuestion.source === 'examiner' ? 
                      (isCorrect ? '回答正确' : '回答错误') : 
                      (isCorrect ? '答对' : '答错');
    
    await logEvent(eventType, eventName, {
      isCorrect: !!isCorrect,
      score: score || 0,
      duration,
      modificationCount,
      topic: currentQuestion.topic
    });
    
    const result = { ...record };
    currentQuestion = null;
    modificationCount = 0;
    checkedCount = 0;
    lastAnswer = null;
    
    return result;
  }

  async function getStats(studentId, options = {}) {
    try {
      if (window.DB && DB.examBehavior) {
        return await DB.examBehavior.getStats(studentId, options);
      }
    } catch (e) {
      console.warn('Failed to get exam stats:', e);
    }
    
    return {
      totalQuestions: 0,
      correctCount: 0,
      incorrectCount: 0,
      skippedCount: 0,
      totalDuration: 0,
      avgDuration: 0,
      totalScore: 0,
      avgScore: 0,
      totalModifications: 0,
      topicStats: {},
      accuracy: 0
    };
  }

  function getCurrentQuestion() {
    return currentQuestion ? { ...currentQuestion } : null;
  }

  function getModificationCount() {
    return modificationCount;
  }

  function getCheckedCount() {
    return checkedCount;
  }

  async function logExamComplete(sessionId, totalScore, totalQuestions, correctCount) {
    await logEvent('exam_complete', '测试完成', {
      sessionId,
      totalScore,
      totalQuestions,
      correctCount,
      accuracy: totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0
    });
  }

  async function logExamSubmit(sessionId, answeredCount, totalQuestions) {
    await logEvent('exam_submit', '提交试卷', {
      sessionId,
      answeredCount,
      totalQuestions
    });
  }

  async function logPracticeAnswer(questionId, isCorrect, topic) {
    await logEvent('practice_answer', '练习题作答', {
      questionId,
      isCorrect,
      topic
    });
  }

  return {
    startQuestion,
    recordAnswer,
    recordModification,
    recordCheck,
    skipQuestion,
    finishQuestion,
    getStats,
    detectQuestionType,
    extractTopic,
    getCurrentQuestion,
    getModificationCount,
    getCheckedCount,
    logExamComplete,
    logExamSubmit,
    logPracticeAnswer
  };
})();

window.ExamTracker = ExamTracker;
