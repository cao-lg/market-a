/**
 * AI Interaction Tracker
 * AI交互行为埋点 - 提问分类、深度评估、追问统计等
 */

const AITracker = (function() {
  // 分类关键词配置 - 按优先级排序
  const CATEGORY_KEYWORDS = {
    help: {
      keywords: ['帮我', '求助', '不会', '不懂', '困难', '卡住了', '提示', '答案', '救我', '帮帮忙', '教教我', '指导一下', '带带我', '没思路', '不知道', '做不来', '不会做', '给我答案', '告诉我结果', '直接说', '直接给'],
      weight: 1.5
    },
    method: {
      keywords: ['怎么', '如何', '怎么做', '步骤', '方法', '操作', '使用', '教程', '怎样', '怎样才能', '能不能', '可以', '教我', '学习', '学会', '掌握'],
      weight: 1.2
    },
    concept: {
      keywords: ['什么是', '定义', '含义', '概念', '解释一下', '介绍', '是什么', '理解', '什么叫', '指的是', '意思是', '说明', '解释', '含义是'],
      weight: 1.0
    },
    extension: {
      keywords: ['举个例子', '比如说', '更多', '详细', '深入', '还有什么', '补充', '展开', '具体一点', '详细一点', '再讲讲', '进一步', '拓展', '延伸'],
      weight: 0.8
    }
  };

  // 深度评估关键词
  const DEPTH_KEYWORDS = {
    why: ['为什么', '原因', '原理', '本质', '根源', '底层', '背后', '因素'],
    analyze: ['分析', '对比', '比较', '区别', '差异', '优缺点', '利弊', '影响'],
    apply: ['应用', '实践', '场景', '案例', '实例', '运用', '使用场景'],
    explore: ['创新', '探索', '未来', '趋势', '可能性', '如果', '假设', '想象']
  };

  // 追问追踪状态
  let followUpState = {
    sessionId: null,
    count: 0,
    lastUserMessage: null,
    lastTopicKeywords: []
  };

  /**
   * 提问类型自动分类
   * @param {string} text - 用户提问文本
   * @returns {Object} { category, confidence, scores }
   */
  function classifyQuestion(text) {
    if (!text || typeof text !== 'string') {
      return { category: 'unknown', confidence: 0, scores: {} };
    }

    const lowerText = text.toLowerCase();
    const scores = {};
    let totalScore = 0;

    const priorityOrder = ['help', 'method', 'concept', 'extension'];

    const strongPatterns = {
      help: [/帮我|求助|不会|不懂|困难|卡住了|救我|帮帮忙|教教我|带带我|没思路|不知道怎么做|做不来|不会做|给我答案|告诉我结果|直接给答案/],
      method: [/怎么|如何|怎么做|怎样才能|步骤|方法|操作|使用|教程|能不能帮我|可以帮我|教我/],
      concept: [/什么是|定义|含义|概念|解释一下|是什么|什么叫|指的是|意思是/],
      extension: [/举个例子|比如说|举例子|例如|比如|还有什么|补充|展开|详细一点|深入|再讲讲|进一步|拓展|延伸|具体一点/]
    };

    for (const category of priorityOrder) {
      const config = CATEGORY_KEYWORDS[category];
      let matchCount = 0;
      let matchedKeywords = [];
      
      for (const keyword of config.keywords) {
        if (lowerText.includes(keyword)) {
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }

      let strongMatch = false;
      if (strongPatterns[category]) {
        for (const pattern of strongPatterns[category]) {
          if (pattern.test(lowerText)) {
            strongMatch = true;
            break;
          }
        }
      }

      const baseScore = matchCount * config.weight;
      const finalScore = strongMatch ? baseScore * 1.5 : baseScore;

      scores[category] = {
        score: finalScore,
        baseScore,
        matchCount,
        matchedKeywords,
        strongMatch
      };
      totalScore += finalScore;
    }

    let bestCategory = 'unknown';
    let bestScore = 0;

    for (const category of priorityOrder) {
      const catData = scores[category];
      const catScore = catData.score;
      if (catScore > 0) {
        if (catData.strongMatch || bestScore === 0 || catScore >= bestScore * 0.8) {
          bestCategory = category;
          bestScore = catScore;
          break;
        }
      }
    }

    if (bestCategory === 'unknown') {
      for (const category of priorityOrder) {
        if (scores[category].score > bestScore) {
          bestScore = scores[category].score;
          bestCategory = category;
        }
      }
    }

    const confidence = totalScore > 0 ? Math.min(1, bestScore / totalScore + bestScore * 0.05) : 0;

    const flatScores = {};
    for (const [cat, data] of Object.entries(scores)) {
      flatScores[cat] = data.score;
    }

    return {
      category: bestScore > 0 ? bestCategory : 'unknown',
      confidence: Math.round(confidence * 100) / 100,
      scores: flatScores,
      matchedKeywords: scores[bestCategory]?.matchedKeywords || []
    };
  }

  /**
   * 提问深度评估
   * @param {string} text - 用户提问文本
   * @param {Object} options - 可选参数 { followUpCount }
   * @returns {number} 1-5 的深度评分
   */
  function calculateQuestionDepth(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return 1;
    }

    let depth = 1;
    const lowerText = text.toLowerCase();

    const length = text.length;
    if (length > 200) depth += 1;
    else if (length > 100) depth += 0.5;
    else if (length > 50) depth += 0.2;

    let keywordScore = 0;
    if (DEPTH_KEYWORDS.why.some(kw => lowerText.includes(kw))) {
      keywordScore += 1;
    }
    if (DEPTH_KEYWORDS.analyze.some(kw => lowerText.includes(kw))) {
      keywordScore += 0.8;
    }
    if (DEPTH_KEYWORDS.apply.some(kw => lowerText.includes(kw))) {
      keywordScore += 0.6;
    }
    if (DEPTH_KEYWORDS.explore.some(kw => lowerText.includes(kw))) {
      keywordScore += 1.2;
    }
    depth += keywordScore;

    const questionMarkCount = (text.match(/\？|\?/g) || []).length;
    if (questionMarkCount >= 3) depth += 0.5;
    else if (questionMarkCount >= 2) depth += 0.3;

    const hasMultiPart = /另外|此外|还有|而且|同时|以及|还有一个/.test(lowerText);
    if (hasMultiPart) depth += 0.3;

    if (options.followUpCount && options.followUpCount > 0) {
      depth += Math.min(1, options.followUpCount * 0.2);
    }

    depth = Math.max(1, Math.min(5, depth));
    return Math.round(depth * 10) / 10;
  }

  /**
   * 提取话题关键词（用于追问相关性判断）
   * @param {string} text - 文本
   * @returns {string[]} 关键词数组
   */
  function extractTopicKeywords(text) {
    if (!text) return [];
    
    const stopWords = ['的', '是', '了', '在', '我', '你', '他', '她', '它', '们', '和', '与', '及', '或', '但', '而', '这', '那', '个', '一', '不', '就', '都', '也', '要', '会', '能', '可以', '什么', '怎么', '如何', '为什么'];
    
    let keywords = [];
    const segments = text.split(/[，。！？、；：\s,.!?;:]/).filter(s => s.length >= 2);
    
    for (const seg of segments) {
      if (!stopWords.includes(seg) && /[\u4e00-\u9fa5]/.test(seg)) {
        keywords.push(seg);
      }
    }
    
    return keywords.slice(0, 10);
  }

  /**
   * 判断是否为追问
   * @param {string} currentMessage - 当前用户消息
   * @param {string} sessionId - 会话ID
   * @returns {boolean} 是否为追问
   */
  function isFollowUp(currentMessage, sessionId) {
    if (!currentMessage || !sessionId) return false;

    if (followUpState.sessionId !== sessionId) {
      followUpState = {
        sessionId,
        count: 0,
        lastUserMessage: null,
        lastTopicKeywords: []
      };
      return false;
    }

    if (!followUpState.lastUserMessage) return false;

    const currentKeywords = extractTopicKeywords(currentMessage);
    const lastKeywords = followUpState.lastTopicKeywords;

    if (currentKeywords.length === 0 || lastKeywords.length === 0) {
      const shortFollowUps = ['然后呢', '还有呢', '接下来呢', '然后', '还有', '继续', '接着说', '然后呢？', '还有吗'];
      if (shortFollowUps.some(p => currentMessage.includes(p))) {
        return true;
      }
      return false;
    }

    let overlapCount = 0;
    for (const kw of currentKeywords) {
      if (lastKeywords.some(lkw => lkw.includes(kw) || kw.includes(lkw))) {
        overlapCount++;
      }
    }

    const overlapRatio = overlapCount / Math.min(currentKeywords.length, lastKeywords.length);
    return overlapRatio >= 0.3;
  }

  /**
   * 追踪追问，更新追问计数
   * @param {string} userMessage - 用户消息
   * @param {string} sessionId - 会话ID
   * @returns {number} 当前追问深度
   */
  function trackFollowUp(userMessage, sessionId) {
    if (!userMessage || !sessionId) return 0;

    if (followUpState.sessionId !== sessionId) {
      followUpState = {
        sessionId,
        count: 0,
        lastUserMessage: userMessage,
        lastTopicKeywords: extractTopicKeywords(userMessage)
      };
      return 0;
    }

    const isFU = isFollowUp(userMessage, sessionId);
    
    if (isFU) {
      followUpState.count++;
    } else {
      followUpState.count = 0;
    }

    followUpState.lastUserMessage = userMessage;
    followUpState.lastTopicKeywords = extractTopicKeywords(userMessage);

    return followUpState.count;
  }

  /**
   * 获取当前追问深度
   * @param {string} sessionId - 会话ID
   * @returns {number} 追问深度
   */
  function getFollowUpCount(sessionId) {
    if (followUpState.sessionId === sessionId) {
      return followUpState.count;
    }
    return 0;
  }

  /**
   * 重置追问状态
   * @param {string} sessionId - 会话ID
   */
  function resetFollowUp(sessionId) {
    if (followUpState.sessionId === sessionId || !sessionId) {
      followUpState = {
        sessionId: null,
        count: 0,
        lastUserMessage: null,
        lastTopicKeywords: []
      };
    }
  }

  /**
   * 统计消息长度
   * @param {string} text - 消息文本
   * @returns {number} 字符数
   */
  function calculateMessageLength(text) {
    if (!text) return 0;
    return text.length;
  }

  /**
   * 统计图片数量
   * @param {string} text - 消息文本（可能包含markdown图片语法）
   * @returns {number} 图片数量
   */
  function countImages(text) {
    if (!text) return 0;
    const markdownImgRegex = /!\[.*?\]\(.*?\)/g;
    const htmlImgRegex = /<img[^>]*>/gi;
    const markdownMatches = text.match(markdownImgRegex) || [];
    const htmlMatches = text.match(htmlImgRegex) || [];
    return markdownMatches.length + htmlMatches.length;
  }

  /**
   * 检查是否包含图片
   * @param {string} text - 消息文本
   * @returns {boolean}
   */
  function hasImage(text) {
    return countImages(text) > 0;
  }

  /**
   * 计算等待时长
   * @param {number} userTimestamp - 用户发送时间戳
   * @param {number} agentTimestamp - AI回复时间戳
   * @returns {number} 等待时长（毫秒）
   */
  function calculateWaitDuration(userTimestamp, agentTimestamp) {
    if (!userTimestamp || !agentTimestamp) return 0;
    return Math.max(0, agentTimestamp - userTimestamp);
  }

  /**
   * 判断消息类型
   * @param {string} role - 角色
   * @returns {string} 'question' | 'answer'
   */
  function getMessageType(role) {
    return role === 'student' || role === 'user' ? 'question' : 'answer';
  }

  /**
   * 综合分析用户消息，生成完整元数据
   * @param {Object} params - { text, role, sessionId, timestamp }
   * @returns {Object} 元数据对象
   */
  function analyzeUserMessage({ text, role, sessionId, timestamp }) {
    const category = classifyQuestion(text);
    const followUpCount = trackFollowUp(text, sessionId);
    const depth = calculateQuestionDepth(text, { followUpCount });
    const messageLength = calculateMessageLength(text);
    const messageType = getMessageType(role);

    return {
      messageType,
      questionCategory: category.category,
      questionCategoryConfidence: category.confidence,
      questionDepth: depth,
      messageLength,
      followUpCount,
      hasImage: hasImage(text),
      imageCount: countImages(text)
    };
  }

  /**
   * 综合分析AI回复，生成完整元数据
   * @param {Object} params - { text, role, userTimestamp, agentTimestamp }
   * @returns {Object} 元数据对象
   */
  function analyzeAgentResponse({ text, role, userTimestamp, agentTimestamp }) {
    const messageLength = calculateMessageLength(text);
    const imageCount = countImages(text);
    const waitDuration = calculateWaitDuration(userTimestamp, agentTimestamp);
    const messageType = getMessageType(role);

    return {
      messageType,
      messageLength,
      hasImage: imageCount > 0,
      imageCount,
      waitDuration
    };
  }

  /**
   * 记录事件日志（便捷方法）
   * @param {Object} eventData - 事件数据
   */
  async function logEvent(eventData) {
    try {
      if (window.DB && window.DB.eventLogs && typeof window.DB.eventLogs.add === 'function') {
        await window.DB.eventLogs.add(eventData);
      }
    } catch (e) {
      console.warn('Failed to log event:', e);
    }
  }

  return {
    classifyQuestion,
    calculateQuestionDepth,
    extractTopicKeywords,
    isFollowUp,
    trackFollowUp,
    getFollowUpCount,
    resetFollowUp,
    calculateMessageLength,
    countImages,
    hasImage,
    calculateWaitDuration,
    getMessageType,
    analyzeUserMessage,
    analyzeAgentResponse,
    logEvent,
    CATEGORY_KEYWORDS,
    DEPTH_KEYWORDS
  };
})();

window.AITracker = AITracker;
