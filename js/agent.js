/**
 * Agent Module
 * Manages the "李主管" AI Agent with 6 interaction modes
 */

// System prompt for the manager character
const MANAGER_SYSTEM_PROMPT = `你叫李主管，是杭州悦享家居用品有限公司电商运营部的主管，管理一个6人的电商团队。
公司主营家居收纳类产品（天猫+抖音），22个SKU，客单价80-150元。

现在有一个新入职的试用期数据分析助理（学生），你正在带他/她完成9月月度数据分析项目。
项目背景：9月GMV环比下滑12%，转化率连续3个月低于类目均值，99大促ROI未达预期。

你的沟通风格：
- 直接务实，偶尔严厉但关心下属成长
- 用电商业务真实语言交流，不用空洞的套话
- 不会直接给答案，通过提问引导学生自己思考
- 审核成果时会具体指出"哪里对、哪里错、为什么错、怎么改"
- 记住学生是新手，专业术语会简单解释`;

// Mode-specific system prompt overrides
const MODE_PROMPTS = {
  // 情景导入模式 - Onboarding
  onboard: `你现在正在进行一个新阶段的开始环节。
以入职谈话/项目启动的方式向学生布置任务。
要求学生用自己的话复述对任务的理解，确保他真正理解了要做什么。

开场时先营造情境，然后通过提问确认学生的理解。
不要直接给答案，通过提问引导学生思考。

当前情境：`,

  // 知识讲解模式 - Knowledge Teaching
  knowledge: `学生正在阅读预制课程内容。
你仅在学生主动提问时才回复，不要主动打扰学生的学习过程。
如果学生没有问题，可以给予简短的鼓励如"有问题随时问我"。

回复要简洁专业，直接回答学生的问题。`,

  // 苏格拉底模式 - Socratic
  socratic: `学生正在做练习任务。
你扮演苏格拉底式的导师，通过提问引导而不是直接给答案。

重要规则：
- 不要直接给答案
- 通过提问引导学生自己思考
- 学生连续请求帮助3次或以上时，可以给出具体的步骤提示，但仍要引导学生思考为什么

用提问的方式帮助学生发现自己答案中的问题。`,

  // 主管审稿模式 - Review
  reviewer: `学生刚提交了学习成果，需要你审核。
按评分规则审核，指出具体问题并给出修改建议。

评分维度：
- 理解准确度
- 逻辑清晰度  
- 完整性
- 业务实用性

审核格式：
1. 肯定做得好的地方
2. 指出具体问题和改进建议
3. 给出评分（百分制）
4. 提供参考答案（简要）

记住：你是严厉但关心下属成长的主管，要具体指出问题所在。`,

  // 考核官模式 - Examiner
  examiner: `这是阶段测试环节。
AI对话窗口已锁定，此模式不参与学生与AI的对话。
如果学生尝试与AI对话，礼貌地提醒他们专注于测试。`,

  // 数据助手模式 - Data Assistant
  assistant: `学生请求你执行数据处理操作。
你可以使用SheetJS等工具在内存中执行数据操作，并返回结果。

执行的操作要简洁解释：
- 做了什么
- 结果是什么
- 有什么需要注意的

你可以执行的操作包括但不限于：
- 数据去重
- 缺失值检查
- 统计计算（求和、平均、计数等）
- 数据筛选
- 格式转换

回复要简洁专业，聚焦于数据操作本身。`
};

// Mode display names and icons
const MODE_INFO = {
  onboard: { name: '情景导入', icon: '🎬', badgeClass: 'primary' },
  knowledge: { name: '知识讲解', icon: '📚', badgeClass: 'primary' },
  socratic: { name: '苏格拉底', icon: '🤔', badgeClass: 'socratic' },
  reviewer: { name: '主管审稿', icon: '📝', badgeClass: 'reviewer' },
  examiner: { name: '考核官', icon: '⏱️', badgeClass: 'examiner' },
  assistant: { name: '数据助手', icon: '🔧', badgeClass: 'assistant' }
};

// Help request tracking
const helpRequestCounts = new Map();

/**
 * Get the complete system prompt for a given mode
 * @param {string} mode - The interaction mode
 * @param {Object} context - Additional context { stage, taskDescription, relevantContext }
 */
function getSystemPrompt(mode, context = {}) {
  const basePrompt = MANAGER_SYSTEM_PROMPT;
  const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.knowledge;
  
  let fullPrompt = basePrompt + '\n\n' + modePrompt;
  
  // Add context if provided
  if (context.stage) {
    fullPrompt += `\n\n当前学习阶段：${context.stage}`;
  }
  
  if (context.taskDescription) {
    fullPrompt += `\n当前任务内容：${context.taskDescription}`;
  }
  
  if (context.relevantContext) {
    fullPrompt += `\n学生已有上下文：${context.relevantContext}`;
  }
  
  // Add help count warning for socratic mode
  if (mode === 'socratic' && context.sessionId) {
    const helpCount = helpRequestCounts.get(context.sessionId) || 0;
    if (helpCount >= 3) {
      fullPrompt += `\n\n【重要】学生已连续请求帮助${helpCount}次，请切换到引导提示模式，给出具体步骤但仍要引导思考。`;
    }
  }
  
  return fullPrompt;
}

/**
 * Get mode display info
 */
function getModeInfo(mode) {
  return MODE_INFO[mode] || MODE_INFO.knowledge;
}

/**
 * Increment help request count for a session
 */
function incrementHelpRequest(sessionId) {
  const count = (helpRequestCounts.get(sessionId) || 0) + 1;
  helpRequestCounts.set(sessionId, count);
  return count;
}

/**
 * Reset help request count for a session
 */
function resetHelpRequest(sessionId) {
  helpRequestCounts.delete(sessionId);
}

/**
 * Get current help request count for a session
 */
function getHelpRequestCount(sessionId) {
  return helpRequestCounts.get(sessionId) || 0;
}

/**
 * Check if user message indicates a help request
 */
function isHelpRequest(message) {
  const helpPatterns = [
    /不会|不懂|不知道|不会做|做不来|帮帮我|救命|求助/,
    /怎么|如何|怎样才能|能不能帮我|可以帮我/,
    /给我答案|告诉我结果|直接说/,
    /这题|这道|这个|这个题/
  ];
  
  return helpPatterns.some(pattern => pattern.test(message));
}

/**
 * Format conversation history for API
 * @param {Array} conversations - Array of conversation objects
 */
function formatConversationHistory(conversations) {
  return conversations.map(conv => {
    let role = conv.role;
    // Map internal roles to API-compatible roles
    if (role === 'agent') {
      role = 'assistant';
    } else if (role === 'student' || role === 'user') {
      role = 'user';
    }
    return {
      role,
      content: conv.content
    };
  });
}

/**
 * Create initial message for a mode
 * @param {string} mode - The interaction mode
 * @param {Object} content - Mode-specific content
 */
function getInitialMessage(mode, content) {
  switch (mode) {
    case 'onboard':
      return content.initialMessage || '欢迎加入团队！我是李主管，今天我们来聊聊数据分析项目的事。';
    
    case 'knowledge':
      return null; // No initial message for knowledge mode
    
    case 'socratic':
      return null; // No initial message for socratic mode
    
    case 'reviewer':
      return '请提交你的成果，我会认真审核。';
    
    case 'examiner':
      return '测试中，请专注答题，AI辅助已关闭。';
    
    case 'assistant':
      return '你好！我是数据助手，需要我帮你处理什么数据操作？';
    
    default:
      return null;
  }
}

/**
 * Get understanding questions for onboard mode
 */
function getOnboardQuestions(content) {
  return content.understandingQuestions || [
    '你觉得我们这次分析项目的核心目标是什么？',
    '你打算按什么顺序推进这个项目？',
    '你认为一份好的月度分析报告应该包含哪些内容？'
  ];
}

/**
 * Validate submission for reviewer mode
 */
function validateSubmission(content, rubric) {
  const results = {
    score: 0,
    feedback: [],
    passed: false
  };
  
  if (!content || content.trim().length < 10) {
    results.feedback.push('提交内容过少，请补充完整');
    return results;
  }
  
  // Basic scoring based on content length and structure
  const wordCount = content.trim().split(/\s+/).length;
  const hasStructure = /首先|其次|最后|第一|第二|第三/.test(content);
  const hasNumbers = /\d+/.test(content);
  
  let score = 50; // Base score
  
  if (wordCount > 50) score += 15;
  if (wordCount > 100) score += 15;
  if (hasStructure) score += 10;
  if (hasNumbers) score += 10;
  
  results.score = Math.min(100, score);
  
  if (score >= 60) {
    results.passed = true;
    results.feedback.push('基本符合要求，可以继续推进');
  } else {
    results.feedback.push('内容需要更充实，请补充更多细节');
  }
  
  return results;
}

/**
 * Generate rubric-based feedback
 */
function generateRubricFeedback(submission, rubric) {
  const criteria = rubric?.criteria || ['理解准确度', '逻辑清晰度', '完整性'];
  const feedback = [];
  
  // Analyze submission
  const wordCount = submission.trim().split(/\s+/).length;
  const hasStructure = /首先|其次|最后|第一|第二|第三|一、二、三|1\.|2\.|3\./.test(submission);
  
  // Score each criterion (simplified)
  const scores = {
    '理解准确度': Math.min(100, 60 + Math.floor(wordCount / 10)),
    '逻辑清晰度': hasStructure ? 80 : 60,
    '完整性': wordCount > 50 ? 80 : 60
  };
  
  for (const criterion of criteria) {
    const score = scores[criterion] || 70;
    feedback.push({
      criterion,
      score,
      comment: score >= 80 ? '良好' : score >= 60 ? '合格' : '需改进'
    });
  }
  
  return feedback;
}

/**
 * Export agent functions
 */
window.Agent = {
  getSystemPrompt,
  getModeInfo,
  incrementHelpRequest,
  resetHelpRequest,
  getHelpRequestCount,
  isHelpRequest,
  formatConversationHistory,
  getInitialMessage,
  getOnboardQuestions,
  validateSubmission,
  generateRubricFeedback,
  MODE_PROMPTS
};
