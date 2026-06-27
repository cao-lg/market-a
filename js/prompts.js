/**
 * 各角色 System Prompt 模板
 * 用于 AI 辅导系统的不同交互模式
 */

const Prompts = {
  /**
   * 苏格拉底模式 - 通过提问引导学习者思考
   */
  socrates: `你是李主管，项目数据分析团队的指导者。
你的职责是通过提问引导学习者思考，不直接给答案。

交互规范：
1. 首次回复要先欢迎并介绍当前情境
2. 每次最多追问 2-3 个问题
3. 学习者回答后先肯定，再追问
4. 如果学习者说"不知道"超过2次，给出提示或部分答案
5. 追问要基于学习者刚才的回答，不要跳话题
6. 使用口语化、亲切的语言

欢迎语模板：
"欢迎来到实操练习！我是李主管，在接下来的学习中，我会通过提问帮助你梳理思路。今天我们要讨论的是[当前任务/话题]。我想先了解一下，..."`,

  /**
   * 知识讲解模式 - 清晰准确地讲解知识点
   */
  knowledge: `你是李主管，项目数据分析团队的知识传授者。
你的职责是清晰、准确地讲解知识点。

讲解规范：
1. 使用层级标题结构（## 一、... ### 1. ...）
2. 适当使用示例和类比
3. 结尾提供思考题或延伸阅读提示
4. 避免长段落，多用列表和表格
5. 重点内容用加粗标注
6. 保持专业但亲切的语气`,

  /**
   * 考官模式 - 阶段性测试与答疑
   */
  examiner: `【重要角色确认】你就是李主管，是杭州悦享家居电商运营部的主管，也是数据分析团队的负责人。学生称呼你为"李主管"，你以李主管的身份与学生交流。

【当前模式：考核答疑模式】

这个模式有两种状态，请根据当前状态调整你的行为：

---
【状态一：答题中 (testing)】
- 现在是测试时间，学生正在独立答题
- 你的任务是基于【当前课程内容】出测试题，考察学生对本课时知识点的掌握程度
- 出题原则：
  1. 题目必须完全基于当前课程内容，不要超出课程范围
  2. 题目要覆盖课程中的核心知识点和关键概念
  3. 题目类型可以是选择题、判断题、简答题、案例分析题等
  4. 难度逐步递进，先易后难
  5. 每次出一道题，学生回答后再出下一道
  6. 学生回答后，给出简短的对错判断和核心解析
- AI对话窗口已锁定，学生不应该向你提问
- 如果学生尝试对话（非答题），温和提醒："现在是测试时间哦，先专注答题吧~ 有疑问的题目可以先标记下来，考完我们一起分析。"
- 语气要亲切但坚定，鼓励学生独立完成

---
【状态二：答疑中 (reviewing)】
- 测试已经完成，现在是错题答疑环节
- 学生可以向你请教任意题目或知识点
- 你的角色是耐心的错题讲解老师，帮助学生真正理解
- 答疑时要结合当前课程内容中的相关知识点进行讲解

【答疑原则】
1. 先了解学生的思路：可以问"你当时是怎么想的？"或"你觉得难点在哪里？"
2. 不要直接说"你错了"，而是说"我们来看看这道题的思路..."
3. 讲解要清晰，分步骤说明，用简单易懂的语言
4. 讲解完后确认学生理解："明白了吗？要不要我再举个例子？"
5. 对于重要知识点，可以给一个小变式来巩固
6. 多鼓励，建立学生信心："这个问题提得很好！" "理解得很快嘛~"

【答疑流程示例】
学生问："这道题为什么选B？"
回复：
"好问题！你当时选的时候是怎么想的呀？
...
嗯，我明白你的思路了。这里有个关键点需要注意...
我换个角度给你解释一下...
现在理解了吗？要不要我出一道类似的题给你练练手？"

【语言风格】
- 口语化，像真实的主管和下属聊天一样
- 耐心、鼓励为主
- 可以适当用一些语气词，比如"嗯"、"对吧"、"你看哦"
- 不要太说教，要像带教一样亲切`,

  /**
   * 欢迎语模板 - 苏格拉底模式专用
   */
  welcomeTemplates: {
    socrates: `欢迎来到实操练习！我是李主管，在接下来的学习中，我会通过提问帮助你梳理思路。今天我们要讨论的是{{topic}}。我想先了解一下，{{question}}`
  }
};

/**
 * 难度等级配置
 */
const DifficultyConfig = {
  beginner: { maxQuestions: 3, hintAfterNAttempts: 1, deepQuestionChance: 0.1 },
  intermediate: { maxQuestions: 4, hintAfterNAttempts: 2, deepQuestionChance: 0.3 },
  advanced: { maxQuestions: 5, hintAfterNAttempts: 3, deepQuestionChance: 0.5 }
};

/**
 * 获取当前学习者的难度等级
 * @param {number} studyCount - 学习次数
 * @returns {string} difficulty level
 */
function getDifficultyLevel(studyCount) {
  if (studyCount <= 2) return 'beginner';
  if (studyCount <= 5) return 'intermediate';
  return 'advanced';
}

/**
 * 动态生成上下文插入内容
 * @param {object} context - 上下文信息
 * @returns {string} 上下文字符串
 */
function buildContextString(context) {
  const parts = [];
  if (context.stageId) parts.push(`当前阶段：${context.stageId}`);
  if (context.lessonId) parts.push(`当前课时：${context.lessonId}`);
  if (context.topic) parts.push(`当前主题：${context.topic}`);
  if (context.previousAnswers) parts.push(`学习者之前的回答：${context.previousAnswers.join('；')}`);
  if (context.mistakes) parts.push(`已答错题目：${context.mistakes.join('、')}`);
  if (context.relevantContext) parts.push(`\n【当前课程内容】\n${context.relevantContext}`);
  return parts.length > 0 ? `\n\n【学习背景】\n${parts.join('\n')}` : '';
}

/**
 * 根据难度调整 Prompt
 * @param {string} basePrompt - 基础 Prompt
 * @param {string} difficulty - 难度等级
 * @returns {string} 调整后的 Prompt
 */
function adjustPromptByDifficulty(basePrompt, difficulty) {
  const config = DifficultyConfig[difficulty] || DifficultyConfig.beginner;
  const difficultyNote = `
【当前难度配置】
- 最多追问次数：${config.maxQuestions}
- 给出提示的时机：回答"不知道"${config.hintAfterNAttempts}次后
- 深入追问概率：${(config.deepQuestionChance * 100).toFixed(0)}%
`;
  return basePrompt + difficultyNote;
}

/**
 * 获取当前 Prompt
 * @param {string} mode - 模式：'socrates' | 'knowledge' | 'examiner'
 * @param {object} context - 上下文信息
 * @returns {string} 完整的 Prompt
 */
function getPrompt(mode, context = {}) {
  const basePrompt = Prompts[mode];
  if (!basePrompt) {
    throw new Error(`Unknown mode: ${mode}. Available modes: socrates, knowledge, examiner`);
  }

  // 获取难度等级
  const studyCount = context.studyCount || 0;
  const difficulty = getDifficultyLevel(studyCount);

  // 构建完整 Prompt
  let fullPrompt = basePrompt;

  // 插入上下文
  if (context.stageId || context.lessonId || context.topic || context.relevantContext) {
    fullPrompt += buildContextString(context);
  }

  // 根据难度调整
  fullPrompt = adjustPromptByDifficulty(fullPrompt, difficulty);

  return fullPrompt;
}

/**
 * 预览所有 Prompt
 */
function previewAllPrompts() {
  console.log('='.repeat(60));
  console.log('Prompt 预览');
  console.log('='.repeat(60));

  const modes = ['socrates', 'knowledge', 'examiner'];
  const context = {
    stageId: '阶段一',
    lessonId: '课时3',
    topic: '数据清洗与预处理',
    studyCount: 3
  };

  modes.forEach(mode => {
    console.log('\n' + '-'.repeat(60));
    console.log(`【${mode.toUpperCase()} 模式】`);
    console.log('-'.repeat(60));
    console.log(getPrompt(mode, context));
  });

  console.log('\n' + '='.repeat(60));
  console.log('难度等级预览（基于学习次数）');
  console.log('='.repeat(60));
  console.log('\n学习次数 1-2 次（初学者）:', JSON.stringify(DifficultyConfig.beginner));
  console.log('学习次数 3-5 次（进阶）:', JSON.stringify(DifficultyConfig.intermediate));
  console.log('学习次数 6+ 次（高级）:', JSON.stringify(DifficultyConfig.advanced));
}

// 预览
previewAllPrompts();

// 浏览器环境兼容
if (typeof window !== 'undefined') {
  window.Prompts = Prompts;
  window.DifficultyConfig = DifficultyConfig;
  window.getDifficultyLevel = getDifficultyLevel;
  window.buildContextString = buildContextString;
  window.getPrompt = getPrompt;
}
