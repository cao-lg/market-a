(function() {
  'use strict';

  const CACHE_TTL = 10 * 60 * 1000;
  const profileCache = new Map();

  function ensureDB() {
    return window.DB && typeof window.DB.init === 'function';
  }

  async function initDB() {
    if (ensureDB()) {
      await window.DB.init();
      return true;
    }
    return false;
  }

  // ============================================================
  // 模块一：自动标签生成引擎
  // ============================================================

  const TAG_RULES = [
    { id: 'beginner', name: '入门学习者', category: 'stage', weight: 0.5,
      evaluate: (p) => (p.basics?.completedLessons || 0) < 5 },
    { id: 'intermediate', name: '进阶学习者', category: 'stage', weight: 0.7,
      evaluate: (p) => {
        const c = p.basics?.completedLessons || 0;
        return c >= 5 && c <= 15;
      }},
    { id: 'advanced', name: '资深学习者', category: 'stage', weight: 0.9,
      evaluate: (p) => (p.basics?.completedLessons || 0) > 15 },
    { id: 'explorer', name: '课程探索者', category: 'stage', weight: 0.6,
      evaluate: (p) => {
        const visited = p.learningBehavior?.visitedLessons || 0;
        const completed = p.basics?.completedLessons || 0;
        const rate = visited > 0 ? completed / visited : 0;
        return visited > 10 && rate < 0.3;
      }},

    { id: 'night_owl', name: '夜猫子', category: 'habit', weight: 0.7,
      evaluate: (p) => (p.learningBehavior?.nightRatio || 0) > 0.4 },
    { id: 'early_bird', name: '早起型', category: 'habit', weight: 0.7,
      evaluate: (p) => (p.learningBehavior?.earlyMorningRatio || 0) > 0.3 },
    { id: 'fragmented', name: '碎片化学习', category: 'habit', weight: 0.6,
      evaluate: (p) => (p.learningBehavior?.fragmentedRatio || 0) > 0.5 },
    { id: 'marathon', name: '马拉松式', category: 'habit', weight: 0.8,
      evaluate: (p) => (p.learningBehavior?.marathonRatio || 0) > 0.3 },
    { id: 'diligent', name: '勤奋好学', category: 'habit', weight: 0.9,
      evaluate: (p) => (p.learningBehavior?.weeklyStudyDays || 0) > 5 },
    { id: 'casual', name: '随缘学习', category: 'habit', weight: 0.5,
      evaluate: (p) => (p.learningBehavior?.weeklyStudyDays || 0) < 2 },

    { id: 'logical_thinker', name: '逻辑强', category: 'ability', weight: 0.8,
      evaluate: (p) => (p.abilities?.logicalAnalysis || 0) > 80 },
    { id: 'data_sensitive', name: '数据敏感', category: 'ability', weight: 0.8,
      evaluate: (p) => (p.abilities?.dataProcessing || 0) > 80 },
    { id: 'good_writer', name: '文笔好', category: 'ability', weight: 0.8,
      evaluate: (p) => (p.abilities?.reportWriting || 0) > 80 },
    { id: 'careful', name: '细心型', category: 'ability', weight: 0.7,
      evaluate: (p) => {
        const accuracy = p.knowledgeMastery?.overallScore || 0;
        const mods = p.knowledgeMastery?.avgModifications || 100;
        return accuracy > 85 && mods < 2;
      }},
    { id: 'creative', name: '创意型', category: 'ability', weight: 0.7,
      evaluate: (p) => (p.aiInteraction?.creativeQuestionRatio || 0) > 0.3 },
    { id: 'problem_solver', name: '问题解决者', category: 'ability', weight: 0.8,
      evaluate: (p) => (p.abilities?.problemSolving || 0) > 80 },

    { id: 'visual_learner', name: '视觉型学习者', category: 'style', weight: 0.8,
      evaluate: (p) => (p.learningStyle?.vark?.visual || 0) > 70 },
    { id: 'reading_learner', name: '阅读型学习者', category: 'style', weight: 0.8,
      evaluate: (p) => (p.learningStyle?.vark?.readWrite || 0) > 70 },
    { id: 'kinesthetic', name: '动觉型学习者', category: 'style', weight: 0.8,
      evaluate: (p) => (p.learningStyle?.vark?.kinesthetic || 0) > 70 },
    { id: 'deep_thinker', name: '深度思考者', category: 'style', weight: 0.7,
      evaluate: (p) => (p.learningStyle?.felderSilverman?.activeReflective || 0) > 30 },
    { id: 'active_learner', name: '活跃型学习者', category: 'style', weight: 0.7,
      evaluate: (p) => (p.learningStyle?.felderSilverman?.activeReflective || 0) < -30 },
    { id: 'sequential', name: '序列型学习者', category: 'style', weight: 0.6,
      evaluate: (p) => (p.learningStyle?.felderSilverman?.sequentialGlobal || 0) < -30 },
    { id: 'global', name: '综合型学习者', category: 'style', weight: 0.6,
      evaluate: (p) => (p.learningStyle?.felderSilverman?.sequentialGlobal || 0) > 30 },

    { id: 'fast_learner', name: '快进型', category: 'progress', weight: 0.7,
      evaluate: (p) => (p.learningBehavior?.learningSpeed || 1) > 1.5 },
    { id: 'steady', name: '稳扎稳打', category: 'progress', weight: 0.8,
      evaluate: (p) => {
        const rate = p.learningBehavior?.completionRate || 0;
        const sequential = p.learningBehavior?.sequentialRatio || 0;
        return rate > 80 && sequential > 0.7;
      }},
    { id: 'reviewer', name: '反复回看', category: 'progress', weight: 0.6,
      evaluate: (p) => (p.learningBehavior?.revisitRate || 0) > 40 },
    { id: 'ai_dependent', name: 'AI依赖症', category: 'progress', weight: 0.6,
      evaluate: (p) => (p.aiInteraction?.dependencyScore || 0) > 70 },
    { id: 'independent', name: '独立思考者', category: 'progress', weight: 0.8,
      evaluate: (p) => {
        const dep = p.aiInteraction?.dependencyScore || 100;
        const acc = p.knowledgeMastery?.overallScore || 0;
        return dep < 30 && acc > 75;
      }},
    { id: 'curious', name: '勤学好问', category: 'progress', weight: 0.7,
      evaluate: (p) => {
        const perLesson = p.aiInteraction?.avgQuestionsPerLesson || 0;
        return perLesson > 15;
      }},

    // 数据质量类标签
    { id: 'data_perfectionist', name: '数据洁癖', category: 'grading', weight: 0.9,
      evaluate: (p) => {
        const stats = p.gradingStats?.data;
        if (!stats) return false;
        return stats.avgScore >= 90 && (stats.avgCompleteness || 0) >= 90 && (stats.avgStandardization || 0) >= 90;
      }},
    { id: 'data_careless', name: '马大哈', category: 'grading', weight: 0.8,
      evaluate: (p) => {
        const stats = p.gradingStats?.data;
        if (!stats) return false;
        return stats.avgScore < 60 || (stats.avgMissingRate || 0) > 20;
      }},
    { id: 'detail_oriented', name: '细节控', category: 'grading', weight: 0.8,
      evaluate: (p) => {
        const stats = p.gradingStats?.data;
        if (!stats) return false;
        return (stats.avgStandardization || 0) >= 85 && (stats.avgAccuracy || 0) >= 80;
      }},
    { id: 'big_picture', name: '粗线条', category: 'grading', weight: 0.7,
      evaluate: (p) => {
        const stats = p.gradingStats?.data;
        if (!stats) return false;
        return (stats.avgFieldRichness || 0) >= 80 && (stats.avgStandardization || 0) < 70;
      }},

    // 分析能力类标签
    { id: 'logical_rigor', name: '逻辑严谨', category: 'grading', weight: 0.9,
      evaluate: (p) => {
        const stats = p.gradingStats?.report;
        if (!stats) return false;
        return (stats.avgLogicalRigor || 0) >= 85;
      }},
    { id: 'insightful', name: '洞察敏锐', category: 'grading', weight: 0.9,
      evaluate: (p) => {
        const stats = p.gradingStats?.report;
        if (!stats) return false;
        return (stats.avgInsightDepth || 0) >= 85;
      }},
    { id: 'armchair_analyst', name: '纸上谈兵', category: 'grading', weight: 0.7,
      evaluate: (p) => {
        const stats = p.gradingStats?.report;
        if (!stats) return false;
        return (stats.avgInsightDepth || 0) >= 80 && (stats.avgSuggestionActionability || 0) < 60;
      }},
    { id: 'pragmatic', name: '实干派', category: 'grading', weight: 0.85,
      evaluate: (p) => {
        const stats = p.gradingStats?.report;
        if (!stats) return false;
        return (stats.avgSuggestionActionability || 0) >= 85;
      }},

    // 表达能力类标签
    { id: 'good_writer_grading', name: '笔杆子', category: 'grading', weight: 0.85,
      evaluate: (p) => {
        const stats = p.gradingStats?.report;
        if (!stats) return false;
        return (stats.avgExpressionClarity || 0) >= 85;
      }},
    { id: 'poor_expression', name: '词不达意', category: 'grading', weight: 0.8,
      evaluate: (p) => {
        const stats = p.gradingStats?.report;
        if (!stats) return false;
        return (stats.avgExpressionClarity || 0) < 60;
      }},
    { id: 'data_driven', name: '数据派', category: 'grading', weight: 0.85,
      evaluate: (p) => {
        const stats = p.gradingStats?.report;
        if (!stats) return false;
        return (stats.avgDataSupport || 0) >= 85;
      }},
    { id: 'vague', name: '空泛型', category: 'grading', weight: 0.8,
      evaluate: (p) => {
        const stats = p.gradingStats?.report;
        if (!stats) return false;
        return (stats.avgDataSupport || 0) < 60;
      }}
  ];

  const TagEngine = {
    generateTags(profileData) {
      const tags = [];
      const now = Date.now();
      for (const rule of TAG_RULES) {
        try {
          const matched = rule.evaluate(profileData);
          if (matched) {
            tags.push({
              id: rule.id,
              name: rule.name,
              category: rule.category,
              weight: rule.weight,
              source: 'auto',
              assignedAt: now
            });
          }
        } catch (e) {
          console.warn('Tag evaluation error:', rule.id, e);
        }
      }
      return this.sortTagsByWeight(tags);
    },

    evaluateTagRule(tagId, profileData) {
      const rule = TAG_RULES.find(r => r.id === tagId);
      if (!rule) {
        return { matched: false, weight: 0 };
      }
      try {
        const matched = rule.evaluate(profileData);
        return { matched, weight: matched ? rule.weight : 0 };
      } catch (e) {
        return { matched: false, weight: 0 };
      }
    },

    updateTags(studentId, newBehaviorData) {
      return this.generateTags(newBehaviorData);
    },

    sortTagsByWeight(tags) {
      return [...tags].sort((a, b) => b.weight - a.weight);
    },

    getAllTagRules() {
      return TAG_RULES.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        weight: r.weight
      }));
    }
  };

  // ============================================================
  // 模块二：学习风格自动识别算法
  // ============================================================

  const LearningStyleAnalyzer = {
    calculateLearningStyle(behaviorData) {
      const reading = behaviorData.reading || {};
      const conversations = behaviorData.conversations || [];
      const exam = behaviorData.exam || {};
      const userMessages = conversations.filter(c => c.role === 'user');

      const vark = this._calculateVARK(reading, userMessages, exam);
      const felderSilverman = this._calculateFelderSilverman(reading, userMessages, exam, vark);
      const confidence = this._calculateConfidence(reading, userMessages, exam);
      const primaryStyle = this._getPrimaryStyle(vark, felderSilverman);
      const styleDescription = this.getStyleDescription({ vark, felderSilverman, primaryStyle });

      return {
        vark,
        felderSilverman,
        confidence,
        primaryStyle,
        styleDescription
      };
    },

    _calculateVARK(reading, userMessages, exam) {
      let visual = 30;
      let auditory = 30;
      let readWrite = 30;
      let kinesthetic = 30;

      const imageCount = userMessages.reduce((sum, m) => sum + (m.imageCount || 0), 0);
      visual += Math.min(40, (imageCount / 10) * 20);

      const scrollEvents = reading.totalScrollEvents || 0;
      const sessions = reading.totalSessions || 1;
      const avgScrollPerSession = scrollEvents / sessions;
      if (avgScrollPerSession > 50) {
        visual += 15;
      }

      const depth = reading.avgScrollDepth || 50;
      const revisitRate = reading.revisitRate || 0;
      if (depth < 60 && revisitRate > 0.3) {
        visual += 10;
      }

      const questionPatterns = ['为什么', '怎么', '解释', '讲一下', '说明', '什么是', '请问'];
      let dialogicCount = 0;
      userMessages.forEach(m => {
        const text = m.content || '';
        if (questionPatterns.some(p => text.includes(p))) {
          dialogicCount++;
        }
      });
      const dialogicRatio = userMessages.length > 0 ? dialogicCount / userMessages.length : 0;
      if (dialogicRatio > 0.4) {
        auditory += 25;
      }

      const followUpDepth = this._calcFollowUpDepth(userMessages);
      if (followUpDepth > 3) {
        auditory += 20;
      }

      if (depth > 70 && reading.avgReadingSpeed && reading.avgReadingSpeed > 0) {
        readWrite += 30;
      }

      const copyCount = reading.totalCopyCount || 0;
      if (copyCount > 5) {
        readWrite += 15;
      }

      const activeRatio = reading.totalActiveDuration && reading.totalDuration
        ? reading.totalActiveDuration / reading.totalDuration : 0.5;
      if (activeRatio > 0.7 && depth > 60) {
        readWrite += 20;
      }

      const avgMsgLen = userMessages.length > 0
        ? userMessages.reduce((s, m) => s + (m.messageLength || m.content?.length || 0), 0) / userMessages.length
        : 0;
      if (avgMsgLen > 100) {
        readWrite += 15;
      }

      const practiceLessons = exam.totalLessons || 0;
      if (practiceLessons > 3) {
        kinesthetic += 30;
      }

      const totalQuestions = exam.totalQuestions || 0;
      if (totalQuestions > 10) {
        kinesthetic += 25;
      }

      const totalSubmissions = exam.totalSubmissions || 0;
      if (totalSubmissions > 5) {
        kinesthetic += 20;
      }

      const total = visual + auditory + readWrite + kinesthetic;
      if (total > 0) {
        visual = Math.round((visual / total) * 100);
        auditory = Math.round((auditory / total) * 100);
        readWrite = Math.round((readWrite / total) * 100);
        kinesthetic = Math.round((kinesthetic / total) * 100);
      }

      return { visual, auditory, readWrite, kinesthetic };
    },

    _calcFollowUpDepth(messages) {
      if (messages.length < 2) return 1;
      let depth = 1;
      let maxDepth = 1;
      for (let i = 1; i < messages.length; i++) {
        const prev = messages[i - 1]?.content || '';
        const curr = messages[i]?.content || '';
        if (curr.length > 10 && (curr.includes('再') || curr.includes('还') || curr.includes('那') || prev.length > 50)) {
          depth++;
          maxDepth = Math.max(maxDepth, depth);
        } else {
          depth = 1;
        }
      }
      return Math.min(5, maxDepth);
    },

    _calculateFelderSilverman(reading, userMessages, exam, vark) {
      let sensingIntuitive = 0;
      let sequentialGlobal = 0;
      let activeReflective = 0;
      let visualVerbal = 0;

      const detailQuestions = userMessages.filter(m => {
        const t = m.content || '';
        return t.includes('步骤') || t.includes('方法') || t.includes('操作') || t.includes('具体');
      }).length;
      const conceptQuestions = userMessages.filter(m => {
        const t = m.content || '';
        return t.includes('为什么') || t.includes('原理') || t.includes('本质') || t.includes('拓展');
      }).length;
      sensingIntuitive = (conceptQuestions - detailQuestions) * 5;
      sensingIntuitive = Math.max(-100, Math.min(100, sensingIntuitive));

      const revisitRate = reading.revisitRate || 0;
      const jumpCount = reading.jumpCount || 0;
      const totalSessions = reading.totalSessions || 1;
      sequentialGlobal = ((jumpCount / totalSessions) - 2) * 20 + revisitRate * 50 - 25;
      sequentialGlobal = Math.max(-100, Math.min(100, sequentialGlobal));

      const answerDuration = exam.avgDuration || 30;
      const questionCount = userMessages.length;
      const modifications = exam.totalModifications || 0;
      const totalQ = exam.totalQuestions || 1;
      activeReflective = -questionCount * 2 + (answerDuration / 3) + (modifications / totalQ) * 30 - 20;
      activeReflective = Math.max(-100, Math.min(100, activeReflective));

      visualVerbal = (vark.readWrite + vark.auditory) / 2 - vark.visual;
      visualVerbal = Math.max(-100, Math.min(100, visualVerbal));

      return {
        sensingIntuitive: Math.round(sensingIntuitive),
        sequentialGlobal: Math.round(sequentialGlobal),
        activeReflective: Math.round(activeReflective),
        visualVerbal: Math.round(visualVerbal)
      };
    },

    _calculateConfidence(reading, userMessages, exam) {
      const sessions = reading.totalSessions || 0;
      const conversations = userMessages.length;
      const questions = exam.totalQuestions || 0;

      const confidence = Math.min(100, sessions * 10 + conversations * 0.5 + questions * 2);
      return Math.round(confidence);
    },

    _getPrimaryStyle(vark, felder) {
      const styles = [
        { key: 'visual', name: '视觉型', score: vark.visual },
        { key: 'auditory', name: '听觉型', score: vark.auditory },
        { key: 'readWrite', name: '阅读型', score: vark.readWrite },
        { key: 'kinesthetic', name: '动觉型', score: vark.kinesthetic }
      ];
      styles.sort((a, b) => b.score - a.score);
      return styles[0].name;
    },

    getStyleDescription(styleData) {
      const { vark, felderSilverman, primaryStyle } = styleData;
      const parts = [];

      parts.push(`你的主导学习风格是${primaryStyle}学习者。`);

      if (vark.visual > vark.readWrite && vark.visual > vark.kinesthetic) {
        parts.push('你倾向于通过图像、图表和视觉化方式来理解和记忆信息。');
      } else if (vark.readWrite > vark.visual && vark.readWrite > vark.kinesthetic) {
        parts.push('你善于通过阅读和文字表达来吸收知识，喜欢详细的文字材料。');
      } else if (vark.kinesthetic > vark.visual && vark.kinesthetic > vark.readWrite) {
        parts.push('你偏向于通过实操、练习和亲身体验来学习，动手能力强。');
      } else {
        parts.push('你的学习风格比较均衡，能够适应多种学习方式。');
      }

      if (felderSilverman.activeReflective > 20) {
        parts.push('你属于沉思型学习者，喜欢先思考再行动，考虑问题比较深入。');
      } else if (felderSilverman.activeReflective < -20) {
        parts.push('你属于活跃型学习者，反应快，喜欢边做边学，互动性强。');
      }

      if (felderSilverman.sequentialGlobal > 20) {
        parts.push('你倾向于综合型思维，喜欢先把握整体再深入细节。');
      } else if (felderSilverman.sequentialGlobal < -20) {
        parts.push('你倾向于序列型思维，习惯按部就班、循序渐进地学习。');
      }

      return parts.join('');
    },

    getLearningTips(styleData) {
      const { vark, felderSilverman } = styleData;
      const tips = [];

      if (vark.visual > 60) {
        tips.push('多用思维导图、流程图整理知识点，视觉化有助于记忆');
        tips.push('可以尝试用不同颜色标注重点内容');
      }
      if (vark.readWrite > 60) {
        tips.push('做好学习笔记，用文字总结可以加深理解');
        tips.push('尝试用自己的话复述学到的内容');
      }
      if (vark.kinesthetic > 60) {
        tips.push('多做练习题和实操项目，在实践中巩固知识');
        tips.push('学习过程中可以适当活动，保持身体活跃有助于思考');
      }
      if (vark.auditory > 50) {
        tips.push('可以尝试朗读学习材料，或者用语音记录学习心得');
        tips.push('参与讨论和问答，通过对话加深理解');
      }

      if (felderSilverman.activeReflective < -30) {
        tips.push('注意给自己留出思考时间，不要急于下结论');
      }
      if (felderSilverman.activeReflective > 30) {
        tips.push('适当加快节奏，避免过度沉思导致效率下降');
      }

      if (felderSilverman.sequentialGlobal < -30) {
        tips.push('偶尔跳出来看看整体框架，避免陷入细节');
      }
      if (felderSilverman.sequentialGlobal > 30) {
        tips.push('注意补足基础细节，避免知识体系有漏洞');
      }

      if (tips.length === 0) {
        tips.push('保持均衡的学习方式，灵活运用各种方法');
        tips.push('定期复盘学习效果，不断优化学习策略');
      }

      return tips.slice(0, 6);
    }
  };

  // ============================================================
  // 模块三：评阅画像联动服务
  // ============================================================

  const GRADING_WEIGHT = 0.3;
  const EXISTING_WEIGHT = 0.7;
  const MAX_HISTORY_ITEMS = 10;

  const GradingProfileService = {
    /**
     * 根据评阅结果更新学生画像
     * @param {string} studentId - 学生ID
     * @param {Object} gradingResult - 评阅结果
     * @param {string} gradingType - 评阅类型 'data' | 'report'
     * @returns {Promise<Object>} 更新后的画像
     */
    async updateProfileFromGrading(studentId, gradingResult) {
      try {
        if (!studentId) {
          studentId = await ProfileService._getCurrentStudentId();
        }

        if (!gradingResult || typeof gradingResult !== 'object') {
          throw new Error('评阅结果无效');
        }

        const gradingType = gradingResult.gradingType || 
          (gradingResult.dimensionScores?.structureCompleteness ? 'report' : 'data');

        let profile = await ProfileService.getProfile(studentId).catch(() => this._createEmptyProfile(studentId));

        if (!profile.abilities) {
          profile.abilities = this._getDefaultAbilities();
        }

        if (!profile.abilityDetails) {
          profile.abilityDetails = this._getDefaultAbilityDetails();
        }

        if (gradingType === 'data') {
          this._updateDataProcessingAbility(profile, gradingResult);
        } else if (gradingType === 'report') {
          this._updateReportAbilities(profile, gradingResult);
        }

        this.addGradingToHistory(profile, gradingResult, gradingType);
        this.updateGradingStats(profile);

        const newTags = TagEngine.generateTags(profile);
        profile.tags = this._mergeTags(profile.tags || [], newTags);

        profile.updatedAt = Date.now();

        this._trackGradingCompleted(gradingType, gradingResult);

        await ProfileService.saveProfile(studentId, profile);
        profileCache.set(studentId, { profile, timestamp: Date.now() });

        return profile;
      } catch (e) {
        console.error('根据评阅结果更新画像失败:', e);
        throw e;
      }
    },

    /**
     * 更新数据处理能力模型
     */
    _updateDataProcessingAbility(profile, gradingResult) {
      const dims = gradingResult.dimensionScores || {};
      const details = profile.abilityDetails.dataProcessing || {};

      const newSubDims = {
        dataCleaning: dims.completeness?.score || 0,
        dataStandardization: dims.standardization?.score || 0,
        dataAccuracy: dims.accuracy?.score || 0,
        dataQuality: dims.processingQuality?.score || 0,
        dataEnrichment: dims.fieldRichness?.score || 0
      };

      const updatedSubDims = {};
      Object.keys(newSubDims).forEach(key => {
        const existing = details[key] || 50;
        updatedSubDims[key] = Math.round(existing * EXISTING_WEIGHT + newSubDims[key] * GRADING_WEIGHT);
      });

      profile.abilityDetails.dataProcessing = updatedSubDims;

      const subDimWeights = {
        dataCleaning: 0.25,
        dataStandardization: 0.2,
        dataAccuracy: 0.25,
        dataQuality: 0.15,
        dataEnrichment: 0.15
      };

      let overallScore = 0;
      Object.keys(updatedSubDims).forEach(key => {
        overallScore += updatedSubDims[key] * (subDimWeights[key] || 0.2);
      });

      const existingOverall = profile.abilities.dataProcessing || 50;
      profile.abilities.dataProcessing = Math.round(existingOverall * EXISTING_WEIGHT + overallScore * GRADING_WEIGHT);
    },

    /**
     * 更新报告相关能力模型
     */
    _updateReportAbilities(profile, gradingResult) {
      const dims = gradingResult.dimensionScores || {};

      const analysisDetails = profile.abilityDetails.analysisThinking || {};
      const newAnalysisSubDims = {
        logicalAnalysis: dims.logicalRigor?.score || 0,
        insightDiscovery: dims.insightDepth?.score || 0,
        solutionDesign: dims.suggestionActionability?.score || 0,
        dataDriven: dims.dataSupport?.score || 0
      };

      const updatedAnalysisDims = {};
      Object.keys(newAnalysisSubDims).forEach(key => {
        const existing = analysisDetails[key] || 50;
        updatedAnalysisDims[key] = Math.round(existing * EXISTING_WEIGHT + newAnalysisSubDims[key] * GRADING_WEIGHT);
      });

      profile.abilityDetails.analysisThinking = updatedAnalysisDims;

      const analysisWeights = {
        logicalAnalysis: 0.3,
        insightDiscovery: 0.3,
        solutionDesign: 0.25,
        dataDriven: 0.15
      };

      let analysisOverall = 0;
      Object.keys(updatedAnalysisDims).forEach(key => {
        analysisOverall += updatedAnalysisDims[key] * (analysisWeights[key] || 0.25);
      });

      const existingAnalysis = profile.abilities.logicalAnalysis || 50;
      profile.abilities.logicalAnalysis = Math.round(existingAnalysis * EXISTING_WEIGHT + analysisOverall * GRADING_WEIGHT);

      const reportDetails = profile.abilityDetails.reportWriting || {};
      const newReportSubDims = {
        reportStructure: dims.structureCompleteness?.score || 0,
        expression: dims.expressionClarity?.score || 0
      };

      const updatedReportDims = {};
      Object.keys(newReportSubDims).forEach(key => {
        const existing = reportDetails[key] || 50;
        updatedReportDims[key] = Math.round(existing * EXISTING_WEIGHT + newReportSubDims[key] * GRADING_WEIGHT);
      });

      profile.abilityDetails.reportWriting = updatedReportDims;

      const reportWeights = {
        reportStructure: 0.4,
        expression: 0.6
      };

      let reportOverall = 0;
      Object.keys(updatedReportDims).forEach(key => {
        reportOverall += updatedReportDims[key] * (reportWeights[key] || 0.5);
      });

      const existingReport = profile.abilities.reportWriting || 50;
      profile.abilities.reportWriting = Math.round(existingReport * EXISTING_WEIGHT + reportOverall * GRADING_WEIGHT);
    },

    /**
     * 添加评阅记录到历史
     */
    addGradingToHistory(profile, gradingResult, gradingType) {
      if (!profile.gradingHistory) {
        profile.gradingHistory = [];
      }

      const summary = this._createGradingSummary(gradingResult, gradingType);

      profile.gradingHistory.unshift(summary);

      if (profile.gradingHistory.length > MAX_HISTORY_ITEMS) {
        profile.gradingHistory = profile.gradingHistory.slice(0, MAX_HISTORY_ITEMS);
      }

      if (!profile.bestGrading || gradingResult.overallScore > profile.bestGrading.overallScore) {
        profile.bestGrading = summary;
      }
    },

    /**
     * 创建评阅记录摘要
     */
    _createGradingSummary(gradingResult, gradingType) {
      const dimScores = {};
      if (gradingResult.dimensionScores) {
        Object.keys(gradingResult.dimensionScores).forEach(key => {
          dimScores[key] = gradingResult.dimensionScores[key]?.score || 0;
        });
      }

      return {
        gradingType: gradingType || 'data',
        overallScore: gradingResult.overallScore || 0,
        overallGrade: gradingResult.overallGrade || 'D',
        dimensionScores: dimScores,
        gradingTime: gradingResult.gradingTime || new Date().toISOString(),
        fileName: gradingResult.fileInfo?.fileName || '',
        summary: gradingResult.summary || ''
      };
    },

    /**
     * 更新评阅统计信息
     */
    updateGradingStats(profile) {
      if (!profile.gradingHistory || profile.gradingHistory.length === 0) {
        profile.gradingStats = {
          totalCount: 0,
          data: this._getEmptyDataStats(),
          report: this._getEmptyReportStats()
        };
        return;
      }

      const history = profile.gradingHistory;
      const dataGradings = history.filter(h => h.gradingType === 'data');
      const reportGradings = history.filter(h => h.gradingType === 'report');

      profile.gradingStats = {
        totalCount: history.length,
        lastGradingTime: history[0]?.gradingTime || null,
        data: this._calcDataStats(dataGradings),
        report: this._calcReportStats(reportGradings),
        progress: this._calcProgressTrend(history)
      };
    },

    /**
     * 计算数据文件评阅统计
     */
    _calcDataStats(gradings) {
      if (gradings.length === 0) {
        return this._getEmptyDataStats();
      }

      const scores = gradings.map(g => g.overallScore || 0);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      const dims = ['completeness', 'standardization', 'accuracy', 'processingQuality', 'fieldRichness'];
      const avgDims = {};

      dims.forEach(dim => {
        const values = gradings.map(g => g.dimensionScores?.[dim] || 0).filter(v => v > 0);
        avgDims[dim] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      });

      return {
        count: gradings.length,
        avgScore: Math.round(avgScore),
        bestScore: Math.max(...scores),
        latestScore: scores[0] || 0,
        avgCompleteness: Math.round(avgDims.completeness),
        avgStandardization: Math.round(avgDims.standardization),
        avgAccuracy: Math.round(avgDims.accuracy),
        avgProcessingQuality: Math.round(avgDims.processingQuality),
        avgFieldRichness: Math.round(avgDims.fieldRichness)
      };
    },

    /**
     * 计算报告评阅统计
     */
    _calcReportStats(gradings) {
      if (gradings.length === 0) {
        return this._getEmptyReportStats();
      }

      const scores = gradings.map(g => g.overallScore || 0);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      const dims = ['structureCompleteness', 'logicalRigor', 'insightDepth', 'suggestionActionability', 'expressionClarity', 'dataSupport'];
      const avgDims = {};

      dims.forEach(dim => {
        const values = gradings.map(g => g.dimensionScores?.[dim] || 0).filter(v => v > 0);
        avgDims[dim] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      });

      return {
        count: gradings.length,
        avgScore: Math.round(avgScore),
        bestScore: Math.max(...scores),
        latestScore: scores[0] || 0,
        avgStructureCompleteness: Math.round(avgDims.structureCompleteness),
        avgLogicalRigor: Math.round(avgDims.logicalRigor),
        avgInsightDepth: Math.round(avgDims.insightDepth),
        avgSuggestionActionability: Math.round(avgDims.suggestionActionability),
        avgExpressionClarity: Math.round(avgDims.expressionClarity),
        avgDataSupport: Math.round(avgDims.dataSupport)
      };
    },

    /**
     * 计算进步趋势
     */
    _calcProgressTrend(history) {
      if (history.length < 3) {
        return { trend: 'insufficient', change: 0 };
      }

      const recent = history.slice(0, Math.min(5, Math.ceil(history.length / 2)));
      const earlier = history.slice(Math.floor(history.length / 2), history.length);

      if (earlier.length === 0) {
        return { trend: 'stable', change: 0 };
      }

      const recentAvg = recent.reduce((sum, h) => sum + (h.overallScore || 0), 0) / recent.length;
      const earlierAvg = earlier.reduce((sum, h) => sum + (h.overallScore || 0), 0) / earlier.length;

      const change = Math.round(recentAvg - earlierAvg);

      let trend = 'stable';
      if (change >= 5) trend = 'improving';
      else if (change <= -5) trend = 'declining';

      return { trend, change, recentAvg: Math.round(recentAvg), earlierAvg: Math.round(earlierAvg) };
    },

    /**
     * 生成评阅相关标签
     */
    generateGradingTags(profile, gradingResult) {
      const gradingType = gradingResult?.gradingType || 
        (gradingResult?.dimensionScores?.structureCompleteness ? 'report' : 'data');

      const tags = [];
      const now = Date.now();

      if (gradingType === 'data') {
        const dims = gradingResult.dimensionScores || {};
        const completeness = dims.completeness?.score || 0;
        const standardization = dims.standardization?.score || 0;
        const overallScore = gradingResult.overallScore || 0;
        const fieldRichness = dims.fieldRichness?.score || 0;

        if (overallScore >= 90 && completeness >= 90 && standardization >= 90) {
          tags.push({ id: 'data_perfectionist', name: '数据洁癖', category: 'grading', weight: 0.9, source: 'auto', assignedAt: now });
        }
        if (overallScore < 60) {
          tags.push({ id: 'data_careless', name: '马大哈', category: 'grading', weight: 0.8, source: 'auto', assignedAt: now });
        }
        if (standardization >= 85) {
          tags.push({ id: 'detail_oriented', name: '细节控', category: 'grading', weight: 0.8, source: 'auto', assignedAt: now });
        }
        if (fieldRichness >= 80 && standardization < 70) {
          tags.push({ id: 'big_picture', name: '粗线条', category: 'grading', weight: 0.7, source: 'auto', assignedAt: now });
        }
      } else if (gradingType === 'report') {
        const dims = gradingResult.dimensionScores || {};
        const logicalRigor = dims.logicalRigor?.score || 0;
        const insightDepth = dims.insightDepth?.score || 0;
        const suggestionActionability = dims.suggestionActionability?.score || 0;
        const expressionClarity = dims.expressionClarity?.score || 0;
        const dataSupport = dims.dataSupport?.score || 0;

        if (logicalRigor >= 85) {
          tags.push({ id: 'logical_rigor', name: '逻辑严谨', category: 'grading', weight: 0.9, source: 'auto', assignedAt: now });
        }
        if (insightDepth >= 85) {
          tags.push({ id: 'insightful', name: '洞察敏锐', category: 'grading', weight: 0.9, source: 'auto', assignedAt: now });
        }
        if (insightDepth >= 80 && suggestionActionability < 60) {
          tags.push({ id: 'armchair_analyst', name: '纸上谈兵', category: 'grading', weight: 0.7, source: 'auto', assignedAt: now });
        }
        if (suggestionActionability >= 85) {
          tags.push({ id: 'pragmatic', name: '实干派', category: 'grading', weight: 0.85, source: 'auto', assignedAt: now });
        }
        if (expressionClarity >= 85) {
          tags.push({ id: 'good_writer_grading', name: '笔杆子', category: 'grading', weight: 0.85, source: 'auto', assignedAt: now });
        }
        if (expressionClarity < 60) {
          tags.push({ id: 'poor_expression', name: '词不达意', category: 'grading', weight: 0.8, source: 'auto', assignedAt: now });
        }
        if (dataSupport >= 85) {
          tags.push({ id: 'data_driven', name: '数据派', category: 'grading', weight: 0.85, source: 'auto', assignedAt: now });
        }
        if (dataSupport < 60) {
          tags.push({ id: 'vague', name: '空泛型', category: 'grading', weight: 0.8, source: 'auto', assignedAt: now });
        }
      }

      return TagEngine.sortTagsByWeight(tags);
    },

    /**
     * 获取能力进步趋势
     */
    async getGradingProgress(studentId) {
      try {
        if (!studentId) {
          studentId = await ProfileService._getCurrentStudentId();
        }

        const profile = await ProfileService.getProfile(studentId).catch(() => null);
        if (!profile || !profile.gradingHistory || profile.gradingHistory.length < 2) {
          return {
            hasEnoughData: false,
            trend: 'insufficient',
            change: 0,
            history: profile?.gradingHistory || []
          };
        }

        const history = [...profile.gradingHistory].reverse();

        const dataProgress = this._getTypeProgress(history.filter(h => h.gradingType === 'data'));
        const reportProgress = this._getTypeProgress(history.filter(h => h.gradingType === 'report'));

        return {
          hasEnoughData: history.length >= 3,
          overallTrend: profile.gradingStats?.progress?.trend || 'stable',
          overallChange: profile.gradingStats?.progress?.change || 0,
          dataProgress,
          reportProgress,
          history: profile.gradingHistory
        };
      } catch (e) {
        console.error('获取评阅进步趋势失败:', e);
        return { hasEnoughData: false, trend: 'error', change: 0, history: [] };
      }
    },

    /**
     * 获取单类型进步数据
     */
    _getTypeProgress(history) {
      if (history.length < 2) {
        return { count: history.length, trend: 'insufficient', change: 0 };
      }

      const first = history[0]?.overallScore || 0;
      const last = history[history.length - 1]?.overallScore || 0;
      const change = last - first;

      let trend = 'stable';
      if (change >= 5) trend = 'improving';
      else if (change <= -5) trend = 'declining';

      return {
        count: history.length,
        trend,
        change: Math.round(change),
        firstScore: first,
        latestScore: last
      };
    },

    /**
     * 埋点：评阅完成事件
     */
    _trackGradingCompleted(gradingType, gradingResult) {
      try {
        const dimScores = {};
        if (gradingResult.dimensionScores) {
          Object.keys(gradingResult.dimensionScores).forEach(key => {
            dimScores[key] = gradingResult.dimensionScores[key]?.score || 0;
          });
        }

        const event = {
          eventType: 'grading_completed',
          gradingType: gradingType,
          overallScore: gradingResult.overallScore || 0,
          overallGrade: gradingResult.overallGrade || 'D',
          dimensionScores: dimScores,
          timestamp: Date.now()
        };

        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('grading_completed', { detail: event }));
        }

        if (window.Analytics && typeof window.Analytics.track === 'function') {
          window.Analytics.track('grading_completed', event);
        }

        if (window.DB && window.DB.eventLogs && typeof window.DB.eventLogs.add === 'function') {
          window.DB.eventLogs.add({
            type: 'grading_completed',
            data: event,
            createdAt: Date.now()
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('评阅完成事件埋点失败:', e);
      }
    },

    /**
     * 获取空的数据统计
     */
    _getEmptyDataStats() {
      return {
        count: 0,
        avgScore: 0,
        bestScore: 0,
        latestScore: 0,
        avgCompleteness: 0,
        avgStandardization: 0,
        avgAccuracy: 0,
        avgProcessingQuality: 0,
        avgFieldRichness: 0,
        avgMissingRate: 0
      };
    },

    /**
     * 获取空的报告统计
     */
    _getEmptyReportStats() {
      return {
        count: 0,
        avgScore: 0,
        bestScore: 0,
        latestScore: 0,
        avgStructureCompleteness: 0,
        avgLogicalRigor: 0,
        avgInsightDepth: 0,
        avgSuggestionActionability: 0,
        avgExpressionClarity: 0,
        avgDataSupport: 0
      };
    },

    /**
     * 获取默认能力模型
     */
    _getDefaultAbilities() {
      return {
        logicalAnalysis: 50,
        dataProcessing: 50,
        reportWriting: 50,
        communication: 50,
        problemSolving: 50
      };
    },

    /**
     * 获取默认能力详情（子维度）
     */
    _getDefaultAbilityDetails() {
      return {
        dataProcessing: {
          dataCleaning: 50,
          dataStandardization: 50,
          dataAccuracy: 50,
          dataQuality: 50,
          dataEnrichment: 50
        },
        analysisThinking: {
          logicalAnalysis: 50,
          insightDiscovery: 50,
          solutionDesign: 50,
          dataDriven: 50
        },
        reportWriting: {
          reportStructure: 50,
          expression: 50
        }
      };
    },

    /**
     * 创建空画像
     */
    _createEmptyProfile(studentId) {
      return {
        studentId: studentId || 'default',
        abilities: this._getDefaultAbilities(),
        abilityDetails: this._getDefaultAbilityDetails(),
        tags: [],
        gradingHistory: [],
        gradingStats: {
          totalCount: 0,
          data: this._getEmptyDataStats(),
          report: this._getEmptyReportStats()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    },

    /**
     * 合并标签（去重）
     */
    _mergeTags(existingTags, newTags) {
      const tagMap = new Map();

      (existingTags || []).forEach(tag => {
        if (tag && tag.id) {
          tagMap.set(tag.id, tag);
        }
      });

      newTags.forEach(tag => {
        if (tag && tag.id) {
          tagMap.set(tag.id, tag);
        }
      });

      return TagEngine.sortTagsByWeight(Array.from(tagMap.values()));
    }
  };

  // ============================================================
  // 模块四：画像计算服务
  // ============================================================

  const ProfileService = {
    async calculateFullProfile(studentId) {
      await initDB();
      const sid = studentId || (await this._getCurrentStudentId());

      const [
        readingData,
        examData,
        conversations,
        progressData,
        submissions,
        eventLogs,
        courseData
      ] = await Promise.all([
        this._fetchReadingData(sid),
        this._fetchExamData(sid),
        this._fetchConversations(sid),
        this._fetchProgress(sid),
        this._fetchSubmissions(sid),
        this._fetchEventLogs(sid),
        this._fetchCourseData()
      ]);

      const totalLessons = this._getTotalLessons(courseData);

      const basics = this._calcBasics(readingData, examData, progressData, totalLessons, eventLogs);
      const learningBehavior = this._calcLearningBehavior(readingData, progressData, eventLogs, totalLessons);
      const knowledgeMastery = this._calcKnowledgeMastery(examData);
      const abilities = this._calcAbilities(examData, conversations, submissions, readingData);

      const styleInput = {
        reading: readingData,
        conversations: conversations,
        exam: examData
      };
      const learningStyle = LearningStyleAnalyzer.calculateLearningStyle(styleInput);

      const aiInteraction = this._calcAIInteraction(conversations, progressData);

      const partialProfile = {
        basics,
        learningBehavior,
        knowledgeMastery,
        abilities,
        learningStyle,
        aiInteraction
      };

      const tags = TagEngine.generateTags(partialProfile);

      const fullProfile = {
        ...partialProfile,
        tags,
        calculatedAt: Date.now(),
        studentId: sid,
        totalLessons
      };

      profileCache.set(sid, { profile: fullProfile, timestamp: Date.now() });

      await this.saveProfile(sid, fullProfile);

      return fullProfile;
    },

    async updateProfileIncremental(studentId, newData) {
      const sid = studentId || (await this._getCurrentStudentId());
      const cached = profileCache.get(sid);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.profile;
      }

      return await this.calculateFullProfile(sid);
    },

    async getProfile(studentId) {
      const sid = studentId || (await this._getCurrentStudentId());
      const cached = profileCache.get(sid);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.profile;
      }

      await initDB();
      const stored = await window.DB.profiles.get(sid);
      if (stored && stored.calculatedAt && Date.now() - stored.calculatedAt < CACHE_TTL) {
        profileCache.set(sid, { profile: stored, timestamp: stored.calculatedAt });
        return stored;
      }

      return await this.calculateFullProfile(sid);
    },

    async saveProfile(studentId, profile) {
      await initDB();
      const saveData = {
        ...profile,
        id: studentId,
        studentId,
        updatedAt: Date.now()
      };
      return await window.DB.profiles.save(saveData);
    },

    async _getCurrentStudentId() {
      if (window.StudentManager && typeof window.StudentManager.getCurrentStudent === 'function') {
        try {
          const s = await window.StudentManager.getCurrentStudent();
          if (s && s.id) return s.id;
        } catch (e) {}
      }
      return localStorage.getItem('current_student_id') || localStorage.getItem('default_student_id') || 'default';
    },

    async _fetchReadingData(studentId) {
      try {
        const stats = await window.DB.readingBehavior.getStats(studentId);
        const records = await this._getAllReadingRecords(studentId);
        return {
          ...stats,
          records,
          totalSessions: stats.totalSessions || records.length || 0,
          totalDuration: stats.totalDuration || 0,
          totalActiveDuration: stats.totalActiveDuration || 0,
          totalScrollEvents: records.reduce((s, r) => s + (r.scrollEvents || 0), 0),
          totalCopyCount: stats.totalCopyCount || 0,
          revisitRate: this._calcRevisitRate(records),
          jumpCount: this._calcJumpCount(records)
        };
      } catch (e) {
        console.warn('Fetch reading data error:', e);
        return { totalSessions: 0, totalDuration: 0, totalActiveDuration: 0, records: [], avgScrollDepth: 0 };
      }
    },

    async _getAllReadingRecords(studentId) {
      try {
        const all = await this._getAllFromStore('reading_behavior', studentId);
        return all;
      } catch (e) {
        return [];
      }
    },

    async _getAllFromStore(storeName, studentId) {
      return new Promise((resolve) => {
        const req = indexedDB.open('MarketDataAnalysisDB', 3);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const index = store.index('studentId');
          const getReq = index.getAll(studentId);
          getReq.onsuccess = () => resolve(getReq.result || []);
          getReq.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      });
    },

    _calcRevisitRate(records) {
      const lessonMap = new Map();
      records.forEach(r => {
        const lid = r.lessonId;
        if (lid) {
          lessonMap.set(lid, (lessonMap.get(lid) || 0) + 1);
        }
      });
      let revisited = 0;
      lessonMap.forEach(count => {
        if (count > 1) revisited++;
      });
      const total = lessonMap.size || 1;
      return (revisited / total) * 100;
    },

    _calcJumpCount(records) {
      let jumps = 0;
      records.forEach(r => {
        if (r.scrollEvents && r.maxScrollDepth) {
          const rate = r.scrollEvents / Math.max(1, r.maxScrollDepth);
          if (rate > 2) jumps++;
        }
      });
      return jumps;
    },

    async _fetchExamData(studentId) {
      try {
        const stats = await window.DB.examBehavior.getStats(studentId);
        const records = await this._getAllFromStore('exam_behavior', studentId);
        return {
          ...stats,
          records,
          totalQuestions: stats.totalQuestions || 0,
          correctCount: stats.correctCount || 0,
          totalDuration: stats.totalDuration || 0,
          avgDuration: stats.avgDuration || 0,
          totalModifications: stats.totalModifications || 0,
          avgModifications: records.length > 0 ? stats.totalModifications / records.length : 0,
          topicStats: stats.topicStats || {},
          totalSubmissions: 0,
          totalLessons: new Set(records.map(r => r.lessonId).filter(Boolean)).size
        };
      } catch (e) {
        console.warn('Fetch exam data error:', e);
        return { totalQuestions: 0, correctCount: 0, records: [], topicStats: {}, avgDuration: 0 };
      }
    },

    async _fetchConversations(studentId) {
      try {
        return await window.DB.conversations.getAll();
      } catch (e) {
        return [];
      }
    },

    async _fetchProgress(studentId) {
      try {
        return await window.DB.progress.getAll();
      } catch (e) {
        return [];
      }
    },

    async _fetchSubmissions(studentId) {
      try {
        return await window.DB.submissions.getAll();
      } catch (e) {
        return [];
      }
    },

    async _fetchEventLogs(studentId) {
      try {
        return await window.DB.eventLogs.query(studentId, {});
      } catch (e) {
        return [];
      }
    },

    async _fetchCourseData() {
      try {
        const res = await fetch('data/course-content.json');
        if (res.ok) return await res.json();
      } catch (e) {}
      return { stages: [] };
    },

    _getTotalLessons(courseData) {
      if (!courseData?.stages) return 50;
      let total = 0;
      courseData.stages.forEach(s => {
        total += s.lessons?.length || s.totalLessons || 0;
      });
      return total || 50;
    },

    _calcBasics(reading, exam, progress, totalLessons, eventLogs) {
      const completedLessons = progress.filter(p => p.status === 'completed' || p.completed).length;
      const timestamps = this._extractTimestamps(reading.records || [], eventLogs || []);
      const studyDays = this._getUniqueDays(timestamps);
      const totalStudyTime = (reading.totalDuration || 0) + (exam.totalDuration || 0);

      let currentStage = 1;
      const sorted = [...progress].sort((a, b) => {
        const sa = parseInt((a.stageId || '').replace(/\D/g, '')) || 0;
        const sb = parseInt((b.stageId || '').replace(/\D/g, '')) || 0;
        return sb - sa;
      });
      if (sorted.length > 0) {
        currentStage = parseInt((sorted[0].stageId || '').replace(/\D/g, '')) || 1;
      }

      return {
        totalStudyTime: Math.round(totalStudyTime),
        totalStudyDays: studyDays,
        currentStage,
        completedLessons,
        totalLessons,
        firstStudyAt: timestamps.length > 0 ? Math.min(...timestamps) : null,
        lastStudyAt: timestamps.length > 0 ? Math.max(...timestamps) : null
      };
    },

    _extractTimestamps(readingRecords, eventLogs) {
      const timestamps = [];
      readingRecords.forEach(r => {
        if (r.startTime) timestamps.push(r.startTime);
        if (r.createdAt) timestamps.push(r.createdAt);
        if (r.endTime) timestamps.push(r.endTime);
      });
      eventLogs.forEach(e => {
        if (e.timestamp) timestamps.push(e.timestamp);
      });
      return timestamps.filter(t => t && typeof t === 'number');
    },

    _getUniqueDays(timestamps) {
      const days = new Set();
      timestamps.forEach(t => {
        const d = new Date(t);
        days.add(d.toDateString());
      });
      return days.size;
    },

    _calcLearningBehavior(reading, progress, eventLogs, totalLessons) {
      const records = reading.records || [];
      const totalDays = this._getUniqueDays(this._extractTimestamps(records, eventLogs));
      const totalDuration = reading.totalDuration || 0;
      const totalSessions = reading.totalSessions || records.length || 1;

      const avgDailyDuration = totalDays > 0 ? totalDuration / totalDays : 0;
      const avgSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
      const avgReadingDepth = reading.avgScrollDepth || 0;

      const completedCount = progress.filter(p => p.status === 'completed' || p.completed).length;
      const completionRate = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;

      const revisitRate = reading.revisitRate || 0;

      const weeklyStudyDays = totalDays > 0 ? Math.min(7, totalDays / Math.max(1, Math.ceil(totalDays / 7))) : 0;

      const timeDist = this._getTimeDistribution(records, eventLogs);

      const visitedLessons = new Set([
        ...records.map(r => r.lessonId),
        ...progress.map(p => p.lessonId)
      ].filter(Boolean)).size;

      let fragmentedCount = 0;
      let marathonCount = 0;
      records.forEach(r => {
        const dur = (r.totalDuration || 0) / 1000 / 60;
        if (dur < 10) fragmentedCount++;
        if (dur > 45) marathonCount++;
      });
      const fragmentedRatio = totalSessions > 0 ? fragmentedCount / totalSessions : 0;
      const marathonRatio = totalSessions > 0 ? marathonCount / totalSessions : 0;

      const sequentialRatio = this._calcSequentialRatio(progress);

      const learningSpeed = this._calcLearningSpeed(progress, records);

      return {
        avgDailyDuration: Math.round(avgDailyDuration),
        avgSessionDuration: Math.round(avgSessionDuration),
        avgReadingDepth: Math.round(avgReadingDepth * 100) / 100,
        completionRate: Math.round(completionRate * 10) / 10,
        revisitRate: Math.round(revisitRate * 10) / 10,
        studyFrequency: Math.round(weeklyStudyDays * 10) / 10,
        weeklyStudyDays: Math.round(weeklyStudyDays * 10) / 10,
        preferredTimeOfDay: timeDist.preferred,
        timeDistribution: timeDist.distribution,
        nightRatio: timeDist.nightRatio,
        earlyMorningRatio: timeDist.earlyMorningRatio,
        visitedLessons,
        fragmentedRatio: Math.round(fragmentedRatio * 100) / 100,
        marathonRatio: Math.round(marathonRatio * 100) / 100,
        sequentialRatio: Math.round(sequentialRatio * 100) / 100,
        learningSpeed: Math.round(learningSpeed * 100) / 100
      };
    },

    _getTimeDistribution(records, eventLogs) {
      const hours = { morning: 0, afternoon: 0, evening: 0, night: 0, earlyMorning: 0 };
      const allTimes = [];

      records.forEach(r => {
        if (r.startTime) allTimes.push(new Date(r.startTime).getHours());
        if (r.createdAt) allTimes.push(new Date(r.createdAt).getHours());
      });
      eventLogs.forEach(e => {
        if (e.timestamp) allTimes.push(new Date(e.timestamp).getHours());
      });

      allTimes.forEach(h => {
        if (h >= 6 && h < 9) hours.earlyMorning++;
        if (h >= 9 && h < 12) hours.morning++;
        else if (h >= 12 && h < 18) hours.afternoon++;
        else if (h >= 18 && h < 22) hours.evening++;
        else if (h >= 22 || h < 2) hours.night++;
      });

      const total = allTimes.length || 1;
      const distribution = {
        earlyMorning: Math.round((hours.earlyMorning / total) * 100),
        morning: Math.round((hours.morning / total) * 100),
        afternoon: Math.round((hours.afternoon / total) * 100),
        evening: Math.round((hours.evening / total) * 100),
        night: Math.round((hours.night / total) * 100)
      };

      let preferred = 'evening';
      let max = 0;
      Object.entries(distribution).forEach(([k, v]) => {
        if (v > max) { max = v; preferred = k; }
      });

      return {
        preferred,
        distribution,
        nightRatio: hours.night / total,
        earlyMorningRatio: hours.earlyMorning / total
      };
    },

    _calcSequentialRatio(progress) {
      const byStage = new Map();
      progress.forEach(p => {
        const sid = p.stageId || 'unknown';
        if (!byStage.has(sid)) byStage.set(sid, []);
        byStage.get(sid).push(p);
      });

      let totalPairs = 0;
      let sequentialPairs = 0;

      byStage.forEach(items => {
        const sorted = [...items].sort((a, b) => {
          const la = parseInt((a.lessonId || '').replace(/\D/g, '')) || 0;
          const lb = parseInt((b.lessonId || '').replace(/\D/g, '')) || 0;
          return la - lb;
        });
        for (let i = 1; i < sorted.length; i++) {
          totalPairs++;
          const prev = parseInt((sorted[i - 1].lessonId || '').replace(/\D/g, '')) || 0;
          const curr = parseInt((sorted[i].lessonId || '').replace(/\D/g, '')) || 0;
          if (curr - prev <= 1) sequentialPairs++;
        }
      });

      return totalPairs > 0 ? sequentialPairs / totalPairs : 1;
    },

    _calcLearningSpeed(progress, records) {
      const completed = progress.filter(p => p.status === 'completed' || p.completed).length;
      const totalHours = (records.reduce((s, r) => s + (r.totalDuration || 0), 0)) / 1000 / 3600;
      if (totalHours < 0.5) return 1;
      const speed = completed / totalHours;
      const baseline = 2;
      return speed / baseline;
    },

    _calcKnowledgeMastery(exam) {
      const total = exam.totalQuestions || 0;
      const correct = exam.correctCount || 0;
      const overallScore = total > 0 ? (correct / total) * 100 : 0;

      const topics = {};
      const weakTopics = [];
      const strongTopics = [];

      const topicStats = exam.topicStats || {};
      Object.entries(topicStats).forEach(([topic, stat]) => {
        const score = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
        topics[topic] = {
          score: Math.round(score * 10) / 10,
          total: stat.total,
          correct: stat.correct,
          totalDuration: stat.totalDuration || 0
        };
        if (score < 60) weakTopics.push(topic);
        if (score > 85) strongTopics.push(topic);
      });

      return {
        overallScore: Math.round(overallScore * 10) / 10,
        topics,
        weakTopics,
        strongTopics,
        totalQuestions: total,
        avgModifications: exam.avgModifications || 0
      };
    },

    _calcAbilities(exam, conversations, submissions, reading) {
      const userMsgs = conversations.filter(c => c.role === 'user');
      const totalQ = exam.totalQuestions || 0;
      const accuracy = totalQ > 0 ? (exam.correctCount || 0) / totalQ : 0.5;

      const logicalAnalysis = this._calcLogicalAnalysis(exam, userMsgs, accuracy);
      const dataProcessing = this._calcDataProcessing(exam, userMsgs, accuracy);
      const reportWriting = this._calcReportWriting(submissions, userMsgs, accuracy);
      const communication = this._calcCommunication(userMsgs, reading);
      const problemSolving = this._calcProblemSolving(exam, userMsgs, accuracy);

      return {
        logicalAnalysis: Math.round(logicalAnalysis),
        dataProcessing: Math.round(dataProcessing),
        reportWriting: Math.round(reportWriting),
        communication: Math.round(communication),
        problemSolving: Math.round(problemSolving)
      };
    },

    _calcLogicalAnalysis(exam, userMsgs, baseAccuracy) {
      const base = baseAccuracy * 60;
      let bonus = 0;

      const deepQuestions = userMsgs.filter(m => {
        const t = m.content || '';
        return t.includes('为什么') || t.includes('原因') || t.includes('分析') || t.includes('逻辑');
      }).length;
      bonus += Math.min(20, deepQuestions * 2);

      const depthScore = userMsgs.reduce((s, m) => s + (m.questionDepth || 3), 0) / Math.max(1, userMsgs.length);
      bonus += (depthScore / 5) * 20;

      return Math.min(100, Math.max(0, base + bonus));
    },

    _calcDataProcessing(exam, userMsgs, baseAccuracy) {
      const base = baseAccuracy * 60;
      let bonus = 0;

      const dataQuestions = userMsgs.filter(m => {
        const t = m.content || '';
        return t.includes('数据') || t.includes('Excel') || t.includes('统计') || t.includes('计算') || t.includes('指标');
      }).length;
      bonus += Math.min(25, dataQuestions * 3);

      const copyCount = 0;
      bonus += Math.min(15, copyCount * 2);

      return Math.min(100, Math.max(0, base + bonus));
    },

    _calcReportWriting(submissions, userMsgs, baseAccuracy) {
      const base = baseAccuracy * 60;
      let bonus = 0;

      const subCount = submissions.length;
      bonus += Math.min(25, subCount * 5);

      const avgMsgLen = userMsgs.length > 0
        ? userMsgs.reduce((s, m) => s + (m.messageLength || m.content?.length || 0), 0) / userMsgs.length
        : 0;
      bonus += Math.min(15, avgMsgLen / 20);

      return Math.min(100, Math.max(0, base + bonus));
    },

    _calcCommunication(userMsgs, reading) {
      let base = 50;

      const totalMsgs = userMsgs.length;
      base += Math.min(25, totalMsgs * 0.5);

      const avgLen = userMsgs.length > 0
        ? userMsgs.reduce((s, m) => s + (m.messageLength || m.content?.length || 0), 0) / userMsgs.length
        : 0;
      base += Math.min(15, avgLen / 30);

      const claritySignals = userMsgs.filter(m => {
        const t = m.content || '';
        return t.includes('首先') || t.includes('其次') || t.includes('最后') || t.includes('总结');
      }).length;
      base += Math.min(10, claritySignals * 2);

      return Math.min(100, Math.max(0, base));
    },

    _calcProblemSolving(exam, userMsgs, baseAccuracy) {
      const base = baseAccuracy * 60;
      let bonus = 0;

      const comprehensiveQ = Object.keys(exam.topicStats || {}).length;
      bonus += Math.min(20, comprehensiveQ * 4);

      const helpRequests = userMsgs.filter(m => {
        const t = m.content || '';
        return t.includes('帮我') || t.includes('教我') || t.includes('不会') || t.includes('求助');
      }).length;
      const helpRatio = userMsgs.length > 0 ? helpRequests / userMsgs.length : 0;
      bonus += Math.max(0, 20 - helpRatio * 40);

      const modificationRatio = exam.totalQuestions > 0
        ? (exam.totalModifications || 0) / exam.totalQuestions : 0;
      bonus += Math.min(10, modificationRatio * 10);

      return Math.min(100, Math.max(0, base + bonus));
    },

    _calcAIInteraction(conversations, progress) {
      const userMsgs = conversations.filter(c => c.role === 'user');
      const totalUser = userMsgs.length;
      const totalConvs = conversations.length;

      let helpCount = 0;
      let creativeCount = 0;
      let totalDepth = 0;
      let feedbackLikes = 0;
      let feedbackDislikes = 0;
      let imageCount = 0;
      let totalWait = 0;
      let waitCount = 0;
      const modeMap = new Map();

      userMsgs.forEach(m => {
        const content = m.content || '';
        const patterns = ['帮我', '教我', '怎么做', '怎么算', '给我答案', '告诉我'];
        if (patterns.some(p => content.includes(p))) helpCount++;

        const creativePatterns = ['创意', '想法', '方案', '设计', '想象'];
        if (creativePatterns.some(p => content.includes(p))) creativeCount++;

        totalDepth += m.questionDepth || 3;

        if (m.feedback === 'like') feedbackLikes++;
        if (m.feedback === 'dislike') feedbackDislikes++;

        imageCount += m.imageCount || 0;

        const mode = m.agentMode || m.mode || 'default';
        modeMap.set(mode, (modeMap.get(mode) || 0) + 1);
      });

      conversations.filter(c => c.role === 'assistant').forEach(m => {
        if (m.waitDuration) {
          totalWait += m.waitDuration;
          waitCount++;
        }
      });

      const dependencyScore = totalUser > 0 ? Math.min(100, (helpCount / totalUser) * 150) : 0;
      const avgQuestionDepth = totalUser > 0 ? totalDepth / totalUser : 3;
      const feedbackTotal = feedbackLikes + feedbackDislikes;
      const feedbackSatisfaction = feedbackTotal > 0 ? (feedbackLikes / feedbackTotal) * 100 : 100;

      let preferredMode = 'knowledge';
      let maxMode = 0;
      modeMap.forEach((count, mode) => {
        if (count > maxMode) { maxMode = count; preferredMode = mode; }
      });

      const modeDistribution = {};
      modeMap.forEach((v, k) => { modeDistribution[k] = v; });

      const completedLessons = progress.filter(p => p.status === 'completed' || p.completed).length;
      const avgQuestionsPerLesson = completedLessons > 0 ? totalUser / completedLessons : totalUser;

      const creativeQuestionRatio = totalUser > 0 ? creativeCount / totalUser : 0;

      const avgResponseWait = waitCount > 0 ? totalWait / waitCount : 0;

      return {
        dependencyScore: Math.round(dependencyScore * 10) / 10,
        avgQuestionDepth: Math.round(avgQuestionDepth * 10) / 10,
        feedbackSatisfaction: Math.round(feedbackSatisfaction),
        preferredMode,
        modeDistribution,
        imageGenerationCount: imageCount,
        totalConversations: totalUser,
        avgResponseWait: Math.round(avgResponseWait * 1000) / 1000,
        avgQuestionsPerLesson: Math.round(avgQuestionsPerLesson * 10) / 10,
        creativeQuestionRatio: Math.round(creativeQuestionRatio * 100) / 100
      };
    },

    clearCache(studentId) {
      if (studentId) {
        profileCache.delete(studentId);
      } else {
        profileCache.clear();
      }
    }
  };

  // ============================================================
  // 导出到全局
  // ============================================================

  window.StudentProfileService = {
    TagEngine,
    LearningStyleAnalyzer,
    ProfileService,
    GradingProfileService,

    generateTags: (profileData) => TagEngine.generateTags(profileData),
    evaluateTagRule: (tagId, profileData) => TagEngine.evaluateTagRule(tagId, profileData),
    updateTags: (studentId, data) => TagEngine.updateTags(studentId, data),
    sortTagsByWeight: (tags) => TagEngine.sortTagsByWeight(tags),
    getAllTagRules: () => TagEngine.getAllTagRules(),

    calculateLearningStyle: (behaviorData) => LearningStyleAnalyzer.calculateLearningStyle(behaviorData),
    getStyleDescription: (styleData) => LearningStyleAnalyzer.getStyleDescription(styleData),
    getLearningTips: (styleData) => LearningStyleAnalyzer.getLearningTips(styleData),

    calculateFullProfile: (studentId) => ProfileService.calculateFullProfile(studentId),
    updateProfileIncremental: (studentId, newData) => ProfileService.updateProfileIncremental(studentId, newData),
    getProfile: (studentId) => ProfileService.getProfile(studentId),
    saveProfile: (studentId, profile) => ProfileService.saveProfile(studentId, profile),
    clearCache: (studentId) => ProfileService.clearCache(studentId),

    updateProfileFromGrading: (studentId, gradingResult) => GradingProfileService.updateProfileFromGrading(studentId, gradingResult),
    addGradingToHistory: (profile, gradingResult, gradingType) => GradingProfileService.addGradingToHistory(profile, gradingResult, gradingType),
    updateGradingStats: (profile) => GradingProfileService.updateGradingStats(profile),
    generateGradingTags: (profile, gradingResult) => GradingProfileService.generateGradingTags(profile, gradingResult),
    getGradingProgress: (studentId) => GradingProfileService.getGradingProgress(studentId)
  };

})();
