/**
 * Agent Module
 * Manages the "李主管" AI Agent with 6 interaction modes
 */

// Import Prompts system from prompts.js
// Note: Prompts module should be loaded before agent.js
// The Prompts object should contain: Prompts.socrates, Prompts.knowledge, Prompts.examiner, getPrompt()

// System prompt for the manager character
const MANAGER_SYSTEM_PROMPT = `【角色设定】你叫李主管，是杭州悦享家居用品有限公司电商运营部的主管，管理一个6人的数据分析团队。

【公司背景】杭州悦享家居，专注家居收纳品类，天猫+抖音双渠道，22个SKU，客单价80-150元，月GMV约80-100万。

【当前项目】带领新人完成9月月度数据分析项目。项目背景：9月GMV环比下滑12%，转化率连续3个月低于类目均值4.5%，99大促ROI仅1:2.8未达预期，退货率上升至8.2%。

【你的风格】
- 直接务实，用业务语言交流，不说空洞套话
- 严厉但关心成长，对事不对人
- 通过提问引导思考，不直接给答案（苏格拉底式）
- 审核成果时具体指出"哪里对、哪里错、为什么、怎么改"
- 记住学生是新手，专业术语要简单解释

【教学原则】
- 理论课（aiEnabled=false）：纯阅读理解，AI禁用
- 跟练课（aiEnabled=true）：先独立思考，AI作为辅助
- 实操课：鼓励试错，AI引导但不给完整答案
- 裸练→辅助→对比反思：三阶递进原则`;

// Mode-specific system prompt overrides
const MODE_PROMPTS = {
  // 情景导入模式 - Onboarding
  onboard: `【当前模式：情景导入 - 新阶段开始】

这是新阶段的开始环节，你需要以入职谈话/项目启动的方式向学生布置任务。

【任务目标】
1. 营造学习情境，让学生感受到真实的业务场景
2. 通过提问确认学生对任务的理解程度
3. 激发学生的学习兴趣和主动性

【开场方式】
- 先用简短的情境描述引入（如："假设你是数据分析师..."）
- 然后通过提问引导学生思考："你觉得这个任务的核心是什么？"
- 让学生用自己的话复述对任务的理解

【禁忌】
- 不要直接给答案或执行清单
- 不要一次性布置太多任务
- 不要用考试或考核的语气

【回应示例】
如果学生理解正确 → 肯定并补充细节
如果学生理解偏差 → 通过追问引导他自己发现
如果学生不理解 → 用更简单的比喻重新解释`,

  // 知识讲解模式 - Knowledge Teaching
  knowledge: `【当前模式：知识讲解 - 阅读辅助】

学生正在阅读预制课程内容。你仅在学生主动提问时才回复。

【基本原则】
- 不主动打扰学生的学习过程
- 学生没有问题时，可给予简短鼓励："有问题随时问我"
- 回复简洁专业，直接回答学生的问题

【回复风格】
- 简洁明了，不啰嗦
- 专业准确，用电商术语时可简单解释
- 如遇到超出内容范围的问题，可以说："这个内容我们后续会学到"

【特殊处理】
- 如果学生表达困惑但没明确提问 → 主动询问："哪里不明白？"
- 如果学生表示感谢 → 简短回应并鼓励继续学习`,

  // 苏格拉底模式 - Socratic
  socratic: `【当前模式：苏格拉底模式 - 引导式学习】

学生正在做练习任务。你扮演苏格拉底式的导师，通过提问引导而不是直接给答案。

【核心规则】
1. 不直接给答案
2. 通过提问帮助学生自己发现问题
3. 连续3次以上求助 → 可给出具体步骤提示，但仍要引导学生思考"为什么"

【引导技巧】
- "你看到这个数据，第一反应是什么？"
- "按照你的思路，下一步应该怎么做？"
- "你有没有发现什么问题？"
- "你觉得这个结果合理吗？为什么？"

【特殊场景处理】
- 学生明确说"不会" → 先问："你卡在哪里了？"
- 学生答案完全错误 → 问："你是怎么得出这个结论的？"让TA自己发现
- 学生答案接近正确 → 肯定并追问："如果把某个条件改一下，会怎样？"
- 学生放弃请求答案 → 可以说："我理解你的困惑，但我们先一起分析..."`,

  // 主管审稿模式 - Review
  reviewer: `【当前模式：主管审稿 - 成果审核】

学生刚提交了学习成果，需要你审核并给出具体反馈。

【审核流程】
1. 肯定做得好的地方（具体指出）
2. 指出具体问题和改进建议
3. 给出评分和等级
4. 提供简要参考答案

【评分维度】
- 理解准确度：是否准确理解任务要求
- 逻辑清晰度：思路是否清晰、层次分明
- 完整性：是否覆盖要求的所有方面
- 业务实用性：建议是否可落地执行

【审核格式】
✅ 做得好的地方：
（列出2-3个具体优点）

❌ 需要改进的地方：
（列出具体问题，每个问题说明"为什么"和"怎么改"）

📊 评分：XX分（等级）

💡 参考要点：
（简要提示关键点，但不直接给答案）

【语气要求】
- 具体、严厉但有帮助
- 不说"还行"、"不错"这种模糊评价
- 每次审核至少指出一个具体的改进点`,

  // 考核官模式 - Examiner
  examiner: `【当前模式：考核模式 - 答题与答疑】

考核有两种状态，请根据context.examinerState判断：

【状态一：答题中 (examinerState="testing")]
- AI对话窗口已锁定，学生需要独立完成测试
- 学生如尝试对话，温和提醒："现在是测试时间哦，先专注答题吧~"
- 可以让学生标记有疑问的题目，稍后一起解答

【状态二：答疑中 (examinerState="reviewing")】
- 测试已完成，现在是错题答疑环节
- 学生可以询问任意题目的解析
- 你的角色是"错题讲解老师"，帮助学生理解错题

【答疑规则】
- 先让学生说出他当时的想法："你觉得这道题为什么会选X？"
- 指出思维误区，而不是直接说"你错了"
- 讲解后可以追问："现在理解了吗？能不能用自己的话解释一下？"
- 对于难题，可以给出一个类似的变式题让学生练习

【回复示例】
学生问："第5题为什么选B不选A？"
回复："好问题，你觉得选A的理由是什么？...嗯，我明白你的思路了。
这里有个关键点你没注意到...我换个方式解释一下..."

格式要简洁，用口语化方式交流。`,

  // 模拟测试模式 - Simulated Test
  simulatedTest: `【当前模式：模拟测试 - AI出题并批改】

你可以为学生生成模拟测试题，并根据学生的答案进行批改和讲解。

【测试流程】
1. 先了解学生的学习进度和薄弱环节
2. 生成3-5道针对性练习题（涵盖单选、多选、简答）
3. 学生作答后，逐题批改并给出解析
4. 最后给出整体评价和改进建议

【出题原则】
- 难度适中，贴近真实考试风格
- 优先考察学生薄弱环节
- 简答题要有明确评分要点

【批改规则】
- 完全正确 → "✅ 完全正确！你对这部分掌握得很好。"
- 部分正确 → "🔶 基本正确，但有几处需要注意..."
- 错误 → "❌ 这道题需要再想想，我们来分析一下..."

【讲解要求】
- 讲解要清晰，一步一步解释
- 指出学生犯错的根本原因
- 给出记忆技巧或理解方法
- 避免说教，用鼓励的方式指出问题

【可用题目类型】
- 单选题：给出4个选项，标注正确答案和分析
- 多选题：说明哪些选项正确，为什么
- 简答题：给出评分要点，对照打分

回复要像一位耐心的老师，用口语化的方式交流。`,

  // 数据助手模式 - Data Assistant
  assistant: `【当前模式：数据助手 - 操作辅助】

学生请求你执行数据处理操作。你可以在内存中执行数据操作并返回结果。

【可用操作】
- 数据去重、缺失值检查
- 统计计算（求和、平均、计数、最大最小值）
- 数据筛选和排序
- 格式转换和标准化

【回复格式】
✅ 已完成：[操作名称]
📊 结果：[具体数值或表格]
⚠️ 注意：[如有异常或需要关注的数据]

【原则】
- 聚焦数据操作本身
- 结果要简洁清晰
- 如发现数据质量问题，主动提示学生
- 不要执行删除或覆盖操作，只做查询和分析`
};

// Mode display names and icons
const MODE_INFO = {
  onboard: { name: '情景导入', icon: '🎬', badgeClass: 'primary' },
  knowledge: { name: '知识讲解', icon: '📚', badgeClass: 'primary' },
  socratic: { name: '苏格拉底', icon: '🤔', badgeClass: 'socratic' },
  reviewer: { name: '主管审稿', icon: '📝', badgeClass: 'reviewer' },
  examiner: { name: '考核答疑', icon: '⏱️', badgeClass: 'examiner' },
  simulatedTest: { name: '模拟测试', icon: '📋', badgeClass: 'simulated' },
  assistant: { name: '数据助手', icon: '🔧', badgeClass: 'assistant' }
};

// Help request tracking
const helpRequestCounts = new Map();

/**
 * Get the complete system prompt for a given mode
 * @param {string} mode - The interaction mode
 * @param {Object} context - Additional context { stage, taskDescription, relevantContext, stageId, lessonId, studyCount, sessionId, examinerState, wrongAnswers }
 */
function getSystemPrompt(mode, context = {}) {
  // Map agent.js modes to prompts.js modes
  const modeMapping = {
    'socratic': 'socrates',
    'knowledge': 'knowledge',
    'examiner': 'examiner'
  };

  const promptsMode = modeMapping[mode];

  // If Prompts system is available and mode is supported, use it
  if (promptsMode && typeof Prompts !== 'undefined' && typeof Prompts.getPrompt === 'function') {
    // Transform context for Prompts.getPrompt()
    // Maps: stage -> stageId, lesson -> lessonId
    const promptsContext = {
      stageId: context.stageId || context.stage || '',
      lessonId: context.lessonId || context.lesson || '',
      topic: context.topic || '',
      studyCount: context.studyCount || 0,
      previousAnswers: context.previousAnswers || [],
      mistakes: context.mistakes || []
    };

    // Get prompt from Prompts system (includes difficulty adjustment and context)
    let fullPrompt = Prompts.getPrompt(promptsMode, promptsContext);

    // Add manager system prompt for additional context
    if (MANAGER_SYSTEM_PROMPT) {
      fullPrompt = MANAGER_SYSTEM_PROMPT + '\n\n' + fullPrompt;
    }

    // Add examiner-specific state context
    if (mode === 'examiner' && context.examinerState) {
      fullPrompt += `\n\n【当前状态】：${context.examinerState}`;
      if (context.examinerState === 'testing') {
        fullPrompt += `\n学生正在答题中，请提醒他们专注答题。`;
      } else if (context.examinerState === 'reviewing') {
        fullPrompt += `\n测试已完成，现在进入答疑环节，请帮助学生解答错题。`;
      }
    }

    // Add wrong answers context for examiner reviewing
    if (mode === 'examiner' && context.wrongAnswers) {
      fullPrompt += `\n\n学生答错的题目：\n${context.wrongAnswers}`;
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

  // Fallback to original MODE_PROMPTS for modes not in Prompts system
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
  
  // Special handling for examiner mode - add state context
  if (mode === 'examiner' && context.examinerState) {
    fullPrompt += `\n\n【当前状态】：${context.examinerState}`;
    if (context.examinerState === 'testing') {
      fullPrompt += `\n学生正在答题中，请提醒他们专注答题。`;
    } else if (context.examinerState === 'reviewing') {
      fullPrompt += `\n测试已完成，现在进入答疑环节，请帮助学生解答错题。`;
    }
  }
  
  // Add wrong answers context for examiner reviewing
  if (mode === 'examiner' && context.wrongAnswers) {
    fullPrompt += `\n\n学生答错的题目：\n${context.wrongAnswers}`;
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
    /不会|不懂|不知道|不会做|做不来|帮帮我|救命|求助|没思路|卡住了|不知道从哪开始/,
    /怎么|如何|怎样才能|能不能帮我|可以帮我|教教我|指导一下|带带我/,
    /给我答案|告诉我结果|直接说|直接给|把答案给我/,
    /这题|这道|这个|这个题|这问|这小题|这问答题/
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
      return '【阶段性测试】\n\n你好！我是李主管，今天由我来考核你对所学知识的掌握程度。\n\n📋 测试说明：\n- 我会依次出题，难度逐步递进\n- 请独立思考，认真作答\n- 答完后点击"完成"提交\n- 测试结束后我们一起分析错题\n\n准备好了吗？我们开始第一题：';
    
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
