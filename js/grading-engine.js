/**
 * AI 评阅引擎
 * 基于数据特征的智能评阅系统，支持 5 维度评分模型
 */

class GradingEngine {
  constructor(options = {}) {
    this.apiKey = options.apiKey || null;
    this.maxRetries = 2;
  }

  /**
   * 数据文件评阅
   * @param {Object} fileInfo - 文件信息 { fileName, fileType, fileSize }
   * @param {Object} features - DataParser.extractFeatures() 返回的特征数据
   * @param {Object} options - 评阅选项 { lessonContext?, rubric?, context? }
   * @returns {Object} 结构化评阅结果
   */
  async gradeDataFile(fileInfo, features, options = {}) {
    try {
      if (!features || features.error) {
        return this._buildErrorResult(features?.error || '数据特征无效');
      }

      const prompt = this.buildDataGradingPrompt(features, options);
      const messages = [
        { role: 'system', content: this._getSystemPrompt() },
        { role: 'user', content: prompt }
      ];

      const response = await this._callAI(messages, options);
      const result = this.parseGradingResult(response);

      if (!result) {
        return this._fallbackScore(features, 'AI 返回结果解析失败，使用基础评分');
      }

      result.fileInfo = fileInfo;
      result.gradingTime = new Date().toISOString();

      return result;
    } catch (error) {
      console.warn('AI 评阅失败，使用基础评分:', error.message);
      return this._fallbackScore(features, error.message);
    }
  }

  /**
   * 带重试机制的数据文件评阅
   * @param {Object} fileInfo - 文件信息
   * @param {Object} features - 数据特征
   * @param {Object} options - 评阅选项
   * @returns {Object} 结构化评阅结果
   */
  async gradeDataFileWithRetry(fileInfo, features, options = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.gradeDataFile(fileInfo, features, options);
        if (result && !result.error) {
          result.attempts = attempt + 1;
          return result;
        }
        lastError = result?.error || '未知错误';
      } catch (error) {
        lastError = error.message;
      }

      if (attempt < this.maxRetries) {
        await this._delay(1000 * (attempt + 1));
      }
    }

    return this._fallbackScore(features, `多次重试失败: ${lastError}`);
  }

  /**
   * 构建数据评阅 Prompt
   * @param {Object} features - 数据特征
   * @param {Object} options - 评阅选项
   * @returns {string} 完整的 Prompt
   */
  buildDataGradingPrompt(features, options = {}) {
    const parts = [];

    parts.push('【数据特征摘要】');
    parts.push(this._buildFeatureSummary(features));

    parts.push('\n【评分维度说明】');
    parts.push(this._buildRubricText(options.rubric));

    if (options.lessonContext) {
      parts.push('\n【课程上下文】');
      parts.push(options.lessonContext);
    }

    if (options.context) {
      parts.push('\n【补充说明】');
      parts.push(options.context);
    }

    parts.push('\n【输出格式要求】');
    parts.push(this._buildOutputFormat());

    parts.push('\n【重要提示】');
    parts.push('1. 请严格按照 JSON 格式输出，不要添加任何额外的解释文字');
    parts.push('2. 评分要客观公正，基于数据特征进行分析');
    parts.push('3. 问题和建议要具体可操作');
    parts.push('4. 亮点部分要突出数据的优势和价值');

    return parts.join('\n');
  }

  /**
   * 基于数据特征计算基础分（降级方案）
   * @param {Object} features - 数据特征
   * @returns {Object} 基础评分结果
   */
  calculateBaseScore(features) {
    if (!features || features.error) {
      return this._buildErrorResult(features?.error || '数据特征无效');
    }

    const { basicStats, qualityMetrics, normalization, fieldAnalysis } = features;

    const completenessScore = this._calcCompletenessScore(qualityMetrics, basicStats);
    const standardizationScore = this._calcStandardizationScore(normalization, fieldAnalysis);
    const accuracyScore = this._calcAccuracyScore(features);
    const processingQualityScore = this._calcProcessingQualityScore(qualityMetrics);
    const fieldRichnessScore = this._calcFieldRichnessScore(basicStats, fieldAnalysis, features);

    const dimensionScores = {
      completeness: {
        score: completenessScore,
        label: GradingEngine.scoreToLabel(completenessScore),
        description: this._getCompletenessDesc(completenessScore, qualityMetrics)
      },
      standardization: {
        score: standardizationScore,
        label: GradingEngine.scoreToLabel(standardizationScore),
        description: this._getStandardizationDesc(standardizationScore, normalization)
      },
      accuracy: {
        score: accuracyScore,
        label: GradingEngine.scoreToLabel(accuracyScore),
        description: this._getAccuracyDesc(accuracyScore, features)
      },
      processingQuality: {
        score: processingQualityScore,
        label: GradingEngine.scoreToLabel(processingQualityScore),
        description: this._getProcessingQualityDesc(processingQualityScore, qualityMetrics)
      },
      fieldRichness: {
        score: fieldRichnessScore,
        label: GradingEngine.scoreToLabel(fieldRichnessScore),
        description: this._getFieldRichnessDesc(fieldRichnessScore, basicStats, fieldAnalysis)
      }
    };

    const weights = {
      completeness: 0.25,
      standardization: 0.2,
      accuracy: 0.25,
      processingQuality: 0.15,
      fieldRichness: 0.15
    };

    const overallScore = Math.round(
      completenessScore * weights.completeness +
      standardizationScore * weights.standardization +
      accuracyScore * weights.accuracy +
      processingQualityScore * weights.processingQuality +
      fieldRichnessScore * weights.fieldRichness
    );

    const highlights = this._generateBaseHighlights(features, dimensionScores);
    const issues = this._generateBaseIssues(features, dimensionScores);
    const suggestions = this._generateBaseSuggestions(issues);
    const summary = this._generateBaseSummary(overallScore, dimensionScores);

    return {
      overallScore,
      overallGrade: GradingEngine.scoreToGrade(overallScore),
      dimensionScores,
      highlights,
      issues,
      suggestions,
      summary,
      isBaseScore: true
    };
  }

  /**
   * 解析 AI 返回的评阅结果
   * @param {string} text - AI 返回的文本
   * @returns {Object|null} 解析后的结果对象
   */
  parseGradingResult(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    let jsonStr = text.trim();

    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const result = JSON.parse(jsonStr);
      return this._normalizeResult(result);
    } catch (e) {
      console.warn('JSON 解析失败，尝试修复:', e.message);

      const fixed = this._fixJson(jsonStr);
      if (fixed) {
        try {
          const result = JSON.parse(fixed);
          return this._normalizeResult(result);
        } catch (e2) {
          console.warn('修复后仍解析失败:', e2.message);
        }
      }

      return null;
    }
  }

  /**
   * 分数转等级
   * @param {number} score - 分数 (0-100)
   * @returns {string} 等级 A/B/C/D
   */
  static scoreToGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  /**
   * 分数转标签文本
   * @param {number} score - 分数
   * @returns {string} 标签
   */
  static scoreToLabel(score) {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '中等';
    if (score >= 60) return '及格';
    return '待提升';
  }

  /**
   * 格式化问题描述
   * @param {string} text - 原始问题文本
   * @returns {string} 格式化后的问题描述
   */
  static formatIssue(text) {
    if (!text) return '';

    let formatted = String(text).trim();

    formatted = formatted.replace(/^[：:·\-\s]+/, '');
    formatted = formatted.replace(/[。！？\s]+$/, '');

    if (formatted.length > 100) {
      formatted = formatted.substring(0, 97) + '...';
    }

    return formatted;
  }

  // ==================== 内部方法 ====================

  /**
   * 获取系统 Prompt
   */
  _getSystemPrompt() {
    return `你是一位专业的数据质量评阅专家，负责评估数据文件的质量。

你的职责：
1. 基于提供的数据特征，从5个维度客观评估数据质量
2. 给出具体的问题和可操作的改进建议
3. 评分要公正、合理、有依据
4. 严格按照指定的 JSON 格式输出结果

评阅原则：
- 客观公正：基于数据事实，不主观臆断
- 具体明确：问题和建议要具体，避免空泛
- 建设性：以帮助改进为目的，而非批评
- 平衡视角：既要指出问题，也要肯定亮点`;
  }

  /**
   * 构建数据特征摘要
   */
  _buildFeatureSummary(features) {
    const { basicStats, qualityMetrics, fieldAnalysis, normalization, numericStats } = features;
    const lines = [];

    lines.push('## 基本统计');
    lines.push(`- 行数：${basicStats.rowCount}`);
    lines.push(`- 列数：${basicStats.columnCount}`);
    lines.push(`- 数据单元格总数：${basicStats.totalCells}`);
    lines.push(`- 文件大小：${this._formatFileSize(basicStats.fileSize)}`);

    lines.push('\n## 质量指标');
    lines.push(`- 缺失率：${(qualityMetrics.missingRate * 100).toFixed(2)}%`);
    lines.push(`- 重复行比例：${(qualityMetrics.duplicateRowRate * 100).toFixed(2)}%`);
    lines.push(`- 重复行数：${qualityMetrics.duplicateRowCount}`);
    lines.push(`- 空列数：${qualityMetrics.emptyColumnCount}`);
    lines.push(`- 单值列数：${qualityMetrics.singleValueColumnCount}`);

    lines.push('\n## 字段分析');
    lines.push(`- 数值列：${fieldAnalysis.numericColumns.length} 个 (${fieldAnalysis.numericColumns.join(', ') || '无'})`);
    lines.push(`- 日期列：${fieldAnalysis.dateColumns.length} 个 (${fieldAnalysis.dateColumns.join(', ') || '无'})`);
    lines.push(`- 文本列：${fieldAnalysis.stringColumns.length} 个 (${fieldAnalysis.stringColumns.slice(0, 5).join(', ')}${fieldAnalysis.stringColumns.length > 5 ? '...' : ''})`);

    lines.push('\n## 规范化指标');
    lines.push(`- 命名规范得分：${normalization.namingScore}/100`);
    lines.push(`- 格式一致性得分：${normalization.formatConsistency}/100`);
    if (normalization.dateFormat) {
      const dateFmts = Object.entries(normalization.dateFormat)
        .map(([col, info]) => `${col}: ${info.format} (${(info.matchRate * 100).toFixed(0)}%)`)
        .join('; ');
      lines.push(`- 日期格式：${dateFmts || '无'}`);
    }

    if (numericStats && Object.keys(numericStats).length > 0) {
      lines.push('\n## 数值列统计');
      for (const [col, stats] of Object.entries(numericStats)) {
        lines.push(`- ${col}:`);
        lines.push(`  范围: [${stats.min}, ${stats.max}]`);
        lines.push(`  均值: ${stats.avg.toFixed(2)}, 中位数: ${stats.median.toFixed(2)}`);
        lines.push(`  标准差: ${stats.stdDev.toFixed(2)}`);
        lines.push(`  零值: ${stats.zeros}, 负值: ${stats.negatives}`);
        lines.push(`  异常值: ${stats.outliers} 个`);
      }
    }

    if (qualityMetrics.missingByColumn) {
      const highMissing = Object.entries(qualityMetrics.missingByColumn)
        .filter(([_, rate]) => rate > 0.1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (highMissing.length > 0) {
        lines.push('\n## 高缺失列 (缺失率 > 10%)');
        highMissing.forEach(([col, rate]) => {
          lines.push(`- ${col}: ${(rate * 100).toFixed(1)}%`);
        });
      }
    }

    return lines.join('\n');
  }

  /**
   * 构建评分标准文本
   */
  _buildRubricText(customRubric) {
    if (customRubric && typeof customRubric === 'object') {
      return JSON.stringify(customRubric, null, 2);
    }

    return `### 1. 完整性 (completeness) - 权重 25%
- 数据完整度：缺失值比例、空值处理
- 列完整性：必要字段是否齐全
- 评分标准：缺失率<2%得满分，每增加5%扣10分

### 2. 规范性 (standardization) - 权重 20%
- 命名规范：字段命名是否统一、符合规范
- 格式统一：同一字段格式是否一致
- 类型正确：数据类型是否合理
- 评分标准：命名得分+格式一致性综合评定

### 3. 准确性 (accuracy) - 权重 25%
- 异常值处理：是否存在明显异常值
- 逻辑一致性：数据间逻辑关系是否合理
- 数据质量：错误数据、矛盾数据比例
- 评分标准：异常值比例、数据质量综合评定

### 4. 处理质量 (processingQuality) - 权重 15%
- 去重处理：重复数据是否已清理
- 无效数据：空行、无效记录是否已清理
- 数据转换：格式转换质量
- 评分标准：重复率、空值率综合评定

### 5. 字段丰富度 (fieldRichness) - 权重 15%
- 衍生字段：是否有计算字段、衍生指标
- 指标计算：关键业务指标是否完备
- 维度丰富：分析维度是否足够
- 评分标准：字段数量、类型多样性、维度丰富度综合评定`;
  }

  /**
   * 构建输出格式要求
   */
  _buildOutputFormat() {
    return `请严格按照以下 JSON 格式输出评阅结果：

\`\`\`json
{
  "overallScore": 85,
  "overallGrade": "B",
  "dimensionScores": {
    "completeness": {
      "score": 90,
      "label": "优秀",
      "description": "数据完整性良好，缺失率仅为1.5%，主要缺失集中在可选字段"
    },
    "standardization": {
      "score": 80,
      "label": "良好",
      "description": "字段命名基本规范，部分日期格式不够统一"
    },
    "accuracy": {
      "score": 85,
      "label": "良好",
      "description": "数据准确性较好，存在少量异常值但不影响整体分析"
    },
    "processingQuality": {
      "score": 75,
      "label": "中等",
      "description": "数据处理质量中等，存在3%的重复记录"
    },
    "fieldRichness": {
      "score": 70,
      "label": "中等",
      "description": "字段维度基本满足分析需求，可适当增加衍生指标"
    }
  },
  "highlights": [
    {
      "title": "数据规模充足",
      "description": "数据量达到10000+行，满足统计分析要求"
    }
  ],
  "issues": [
    {
      "severity": "high",
      "title": "用户ID字段存在重复",
      "description": "发现52条重复记录，可能影响用户唯一性统计",
      "column": "user_id",
      "suggestion": "建议使用 DISTINCT 或去重函数清理重复数据"
    },
    {
      "severity": "medium",
      "title": "注册时间格式不统一",
      "description": "部分日期使用 YYYY/MM/DD 格式，与主格式不一致",
      "column": "register_time",
      "suggestion": "统一转换为 YYYY-MM-DD 格式"
    },
    {
      "severity": "low",
      "title": "备注字段缺失较多",
      "description": "备注字段缺失率达15%，但该字段为可选字段",
      "column": "remark",
      "suggestion": "如非必要字段可忽略，否则建议补充缺失值"
    }
  ],
  "suggestions": [
    {
      "priority": "high",
      "title": "清理重复数据",
      "description": "优先处理重复记录，确保数据唯一性"
    },
    {
      "priority": "medium",
      "title": "统一日期格式",
      "description": "将所有日期字段统一为标准格式"
    },
    {
      "priority": "low",
      "title": "增加衍生字段",
      "description": "可考虑增加用户生命周期、订单金额区间等衍生维度"
    }
  ],
  "summary": "整体数据质量良好，综合得分85分，等级为B。数据完整性和准确性表现优秀，但在数据处理质量和字段丰富度方面还有提升空间。建议优先处理重复数据问题，统一日期格式，并考虑增加衍生字段以丰富分析维度。"
}
\`\`\`

注意：
- overallScore 为 0-100 的整数
- overallGrade 为 A/B/C/D 之一（90+为A，75-89为B，60-74为C，<60为D）
- label 可以是：优秀/良好/中等/及格/待提升
- severity 为 high/medium/low
- priority 为 high/medium/low
- 至少提供 2 个亮点，3 个问题，3 条建议
- summary 控制在 100-200 字之间`;
  }

  /**
   * 调用 AI API
   */
  async _callAI(messages, options = {}) {
    if (typeof window !== 'undefined' && window.AI && window.AI.sendChatRequestSync) {
      const response = await window.AI.sendChatRequestSync(messages, {
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 3000
      });

      if (response && response.choices && response.choices[0]?.message?.content) {
        return response.choices[0].message.content;
      }

      throw new Error('AI 响应格式无效');
    }

    throw new Error('AI 服务不可用');
  }

  /**
   * 降级评分
   */
  _fallbackScore(features, errorMessage) {
    const baseResult = this.calculateBaseScore(features);
    baseResult.error = errorMessage;
    baseResult.isFallback = true;
    baseResult.fallbackReason = errorMessage;
    return baseResult;
  }

  /**
   * 构建错误结果
   */
  _buildErrorResult(message) {
    return {
      overallScore: 0,
      overallGrade: 'D',
      dimensionScores: {
        completeness: { score: 0, label: '待提升', description: '数据无效' },
        standardization: { score: 0, label: '待提升', description: '数据无效' },
        accuracy: { score: 0, label: '待提升', description: '数据无效' },
        processingQuality: { score: 0, label: '待提升', description: '数据无效' },
        fieldRichness: { score: 0, label: '待提升', description: '数据无效' }
      },
      highlights: [],
      issues: [{
        severity: 'high',
        title: '数据解析失败',
        description: message,
        suggestion: '请检查数据文件格式是否正确'
      }],
      suggestions: [{
        priority: 'high',
        title: '检查数据文件',
        description: '请确保上传的文件格式正确且包含有效数据'
      }],
      summary: `数据评阅失败：${message}`,
      error: message
    };
  }

  // ==================== 基础评分计算 ====================

  _calcCompletenessScore(qualityMetrics, basicStats) {
    let score = 100;

    const missingRate = qualityMetrics.missingRate;
    if (missingRate <= 0.02) {
      score = 100;
    } else if (missingRate <= 0.05) {
      score = 90;
    } else if (missingRate <= 0.1) {
      score = 80;
    } else if (missingRate <= 0.2) {
      score = 65;
    } else if (missingRate <= 0.4) {
      score = 45;
    } else {
      score = 25;
    }

    if (qualityMetrics.emptyColumnCount > 0) {
      const emptyRatio = qualityMetrics.emptyColumnCount / basicStats.columnCount;
      score -= emptyRatio * 30;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcStandardizationScore(normalization, fieldAnalysis) {
    const namingScore = normalization.namingScore || 0;
    const formatConsistency = normalization.formatConsistency || 0;

    const score = namingScore * 0.5 + formatConsistency * 0.5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcAccuracyScore(features) {
    let score = 100;
    const { numericStats, basicStats, fieldAnalysis } = features;

    if (numericStats && Object.keys(numericStats).length > 0) {
      let totalOutlierRatio = 0;
      let numericColCount = 0;

      for (const stats of Object.values(numericStats)) {
        if (basicStats.rowCount > 0) {
          const outlierRatio = stats.outliers / basicStats.rowCount;
          totalOutlierRatio += outlierRatio;
          numericColCount++;
        }
      }

      if (numericColCount > 0) {
        const avgOutlierRatio = totalOutlierRatio / numericColCount;
        if (avgOutlierRatio <= 0.01) {
          score = 95;
        } else if (avgOutlierRatio <= 0.03) {
          score = 85;
        } else if (avgOutlierRatio <= 0.05) {
          score = 75;
        } else if (avgOutlierRatio <= 0.1) {
          score = 60;
        } else {
          score = 45;
        }
      }
    } else {
      score = 80;
    }

    const singleValueRatio = (features.qualityMetrics.singleValueColumnCount || 0) / basicStats.columnCount;
    if (singleValueRatio > 0.3) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcProcessingQualityScore(qualityMetrics) {
    let score = 100;

    const duplicateRate = qualityMetrics.duplicateRowRate || 0;
    if (duplicateRate === 0) {
      score = 100;
    } else if (duplicateRate <= 0.01) {
      score = 90;
    } else if (duplicateRate <= 0.03) {
      score = 75;
    } else if (duplicateRate <= 0.05) {
      score = 60;
    } else if (duplicateRate <= 0.1) {
      score = 45;
    } else {
      score = 30;
    }

    const missingRate = qualityMetrics.missingRate || 0;
    if (missingRate > 0.1) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcFieldRichnessScore(basicStats, fieldAnalysis, features) {
    let score = 50;

    const columnCount = basicStats.columnCount;
    if (columnCount >= 20) {
      score += 20;
    } else if (columnCount >= 10) {
      score += 15;
    } else if (columnCount >= 5) {
      score += 10;
    } else {
      score += 5;
    }

    const typeDiversity = [
      fieldAnalysis.numericColumns.length > 0,
      fieldAnalysis.dateColumns.length > 0,
      fieldAnalysis.stringColumns.length > 0
    ].filter(Boolean).length;

    score += typeDiversity * 8;

    const numericRatio = fieldAnalysis.numericColumns.length / columnCount;
    if (numericRatio >= 0.3 && numericRatio <= 0.7) {
      score += 6;
    }

    if (features.numericStats && Object.keys(features.numericStats).length >= 3) {
      score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ==================== 基础评分描述生成 ====================

  _getCompletenessDesc(score, qualityMetrics) {
    const missingRate = (qualityMetrics.missingRate * 100).toFixed(1);
    if (score >= 90) {
      return `数据完整性优秀，缺失率仅为 ${missingRate}%，数据质量良好`;
    } else if (score >= 70) {
      return `数据完整性良好，缺失率为 ${missingRate}%，存在少量缺失值`;
    } else if (score >= 60) {
      return `数据完整性一般，缺失率为 ${missingRate}%，需要关注缺失值处理`;
    } else {
      return `数据完整性较差，缺失率为 ${missingRate}%，建议补充数据或处理缺失值`;
    }
  }

  _getStandardizationDesc(score, normalization) {
    const namingScore = normalization.namingScore || 0;
    const formatScore = normalization.formatConsistency || 0;
    if (score >= 90) {
      return `数据规范性优秀，命名规范(${namingScore}分)和格式一致性(${formatScore}分)表现良好`;
    } else if (score >= 70) {
      return `数据规范性良好，命名规范得分 ${namingScore}，格式一致性得分 ${formatScore}`;
    } else if (score >= 60) {
      return `数据规范性一般，建议优化字段命名和格式统一`;
    } else {
      return `数据规范性较差，需要重点改善命名规范和格式一致性`;
    }
  }

  _getAccuracyDesc(score, features) {
    const { numericStats } = features;
    let outlierInfo = '';

    if (numericStats && Object.keys(numericStats).length > 0) {
      const totalOutliers = Object.values(numericStats).reduce((sum, s) => sum + s.outliers, 0);
      outlierInfo = `，共检测到 ${totalOutliers} 个异常值`;
    }

    if (score >= 90) {
      return `数据准确性优秀${outlierInfo}，数据质量可靠`;
    } else if (score >= 70) {
      return `数据准确性良好${outlierInfo}，整体质量较好`;
    } else if (score >= 60) {
      return `数据准确性一般${outlierInfo}，建议检查异常值`;
    } else {
      return `数据准确性较差${outlierInfo}，需要重点关注数据质量`;
    }
  }

  _getProcessingQualityDesc(score, qualityMetrics) {
    const dupRate = (qualityMetrics.duplicateRowRate * 100).toFixed(1);
    const dupCount = qualityMetrics.duplicateRowCount;
    if (score >= 90) {
      return `数据处理质量优秀，重复率仅 ${dupRate}%(${dupCount}条)，数据干净整洁`;
    } else if (score >= 70) {
      return `数据处理质量良好，重复率 ${dupRate}%(${dupCount}条)，基本满足分析需求`;
    } else if (score >= 60) {
      return `数据处理质量一般，重复率 ${dupRate}%(${dupCount}条)，建议进行去重处理`;
    } else {
      return `数据处理质量较差，重复率 ${dupRate}%(${dupCount}条)，必须进行数据清洗`;
    }
  }

  _getFieldRichnessDesc(score, basicStats, fieldAnalysis) {
    const colCount = basicStats.columnCount;
    const numCount = fieldAnalysis.numericColumns.length;
    const dateCount = fieldAnalysis.dateColumns.length;
    if (score >= 80) {
      return `字段丰富度优秀，共 ${colCount} 个字段，涵盖数值(${numCount}个)、日期(${dateCount}个)等多种类型`;
    } else if (score >= 60) {
      return `字段丰富度良好，共 ${colCount} 个字段，基本满足分析需求`;
    } else if (score >= 50) {
      return `字段丰富度一般，共 ${colCount} 个字段，可考虑增加衍生字段`;
    } else {
      return `字段丰富度不足，仅 ${colCount} 个字段，建议丰富分析维度`;
    }
  }

  // ==================== 基础评分亮点/问题/建议生成 ====================

  _generateBaseHighlights(features, dimensionScores) {
    const highlights = [];
    const { basicStats, qualityMetrics } = features;

    if (basicStats.rowCount >= 1000) {
      highlights.push({
        title: '数据规模充足',
        description: `数据量达到 ${basicStats.rowCount} 行，满足统计分析的样本量要求`
      });
    }

    if (qualityMetrics.missingRate <= 0.02) {
      highlights.push({
        title: '数据完整性高',
        description: `缺失率仅 ${(qualityMetrics.missingRate * 100).toFixed(1)}%，数据完整度优秀`
      });
    }

    if (qualityMetrics.duplicateRowRate === 0) {
      highlights.push({
        title: '数据无重复',
        description: '数据中未发现重复记录，数据唯一性良好'
      });
    }

    if (dimensionScores.standardization.score >= 85) {
      highlights.push({
        title: '字段规范统一',
        description: '字段命名规范，格式一致性高，便于后续分析使用'
      });
    }

    if (basicStats.columnCount >= 10) {
      highlights.push({
        title: '字段维度丰富',
        description: `共 ${basicStats.columnCount} 个字段，涵盖多个分析维度`
      });
    }

    if (highlights.length < 2) {
      highlights.push({
        title: '数据结构清晰',
        description: '数据结构完整，字段类型明确，具备良好的分析基础'
      });
    }

    return highlights.slice(0, 5);
  }

  _generateBaseIssues(features, dimensionScores) {
    const issues = [];
    const { qualityMetrics, basicStats, fieldAnalysis, numericStats } = features;

    if (qualityMetrics.duplicateRowCount > 0) {
      const severity = qualityMetrics.duplicateRowRate > 0.03 ? 'high' :
                       qualityMetrics.duplicateRowRate > 0.01 ? 'medium' : 'low';
      issues.push({
        severity,
        title: '存在重复记录',
        description: `检测到 ${qualityMetrics.duplicateRowCount} 条重复记录（占比 ${(qualityMetrics.duplicateRowRate * 100).toFixed(1)}%）`,
        suggestion: '建议使用去重函数（如 DISTINCT 或 drop_duplicates）清理重复数据'
      });
    }

    if (qualityMetrics.missingRate > 0.05) {
      const highMissingCols = Object.entries(qualityMetrics.missingByColumn || {})
        .filter(([_, rate]) => rate > 0.1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const severity = qualityMetrics.missingRate > 0.15 ? 'high' :
                       qualityMetrics.missingRate > 0.1 ? 'medium' : 'low';

      issues.push({
        severity,
        title: '数据缺失较多',
        description: `整体缺失率为 ${(qualityMetrics.missingRate * 100).toFixed(1)}%${highMissingCols.length > 0 ? `，高缺失字段：${highMissingCols.map(([col, rate]) => `${col}(${(rate * 100).toFixed(0)}%)`).join('、')}` : ''}`,
        column: highMissingCols[0]?.[0],
        suggestion: '建议根据业务需求，采用填充、删除或标记等方式处理缺失值'
      });
    }

    if (dimensionScores.standardization.score < 70) {
      issues.push({
        severity: 'medium',
        title: '字段规范性待提升',
        description: `命名规范得分 ${features.normalization.namingScore}，格式一致性得分 ${features.normalization.formatConsistency}`,
        suggestion: '建议统一字段命名规范（如蛇形命名法），并确保同类型字段格式一致'
      });
    }

    if (numericStats && Object.keys(numericStats).length > 0) {
      const colsWithOutliers = Object.entries(numericStats)
        .filter(([_, stats]) => stats.outliers > 0)
        .sort((a, b) => b[1].outliers - a[1].outliers)
        .slice(0, 2);

      if (colsWithOutliers.length > 0 && colsWithOutliers[0][1].outliers / basicStats.rowCount > 0.02) {
        const [col, stats] = colsWithOutliers[0];
        const severity = stats.outliers / basicStats.rowCount > 0.05 ? 'high' : 'medium';
        issues.push({
          severity,
          title: `${col} 存在异常值`,
          description: `检测到 ${stats.outliers} 个异常值，范围 [${stats.min}, ${stats.max}]`,
          column: col,
          suggestion: '建议使用箱线图等方法检查异常值，根据业务场景决定保留或处理'
        });
      }
    }

    if (qualityMetrics.emptyColumnCount > 0) {
      issues.push({
        severity: 'low',
        title: '存在空字段',
        description: `发现 ${qualityMetrics.emptyColumnCount} 个空列，无任何有效数据`,
        suggestion: '建议删除空字段，简化数据结构'
      });
    }

    if (qualityMetrics.singleValueColumnCount > 0 && qualityMetrics.singleValueColumnCount / basicStats.columnCount > 0.2) {
      issues.push({
        severity: 'low',
        title: '单值字段较多',
        description: `${qualityMetrics.singleValueColumnCount} 个字段仅包含单一值，分析价值有限`,
        suggestion: '评估单值字段的业务必要性，无意义的字段可考虑删除'
      });
    }

    if (issues.length < 3) {
      issues.push({
        severity: 'low',
        title: '可进一步优化',
        description: '数据整体质量良好，但仍有优化空间',
        suggestion: '建议增加衍生指标字段，丰富分析维度'
      });
    }

    return issues.slice(0, 8);
  }

  _generateBaseSuggestions(issues) {
    const suggestions = [];
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    const lowIssues = issues.filter(i => i.severity === 'low');

    highIssues.forEach(issue => {
      suggestions.push({
        priority: 'high',
        title: issue.title,
        description: issue.suggestion || `建议优先处理：${issue.title}`
      });
    });

    mediumIssues.forEach(issue => {
      suggestions.push({
        priority: 'medium',
        title: issue.title,
        description: issue.suggestion || `建议处理：${issue.title}`
      });
    });

    lowIssues.forEach(issue => {
      suggestions.push({
        priority: 'low',
        title: issue.title,
        description: issue.suggestion || `可选优化：${issue.title}`
      });
    });

    if (suggestions.length < 3) {
      suggestions.push({
        priority: 'low',
        title: '增加衍生字段',
        description: '考虑增加计算字段或衍生指标，丰富数据维度'
      });
    }

    return suggestions.slice(0, 6);
  }

  _generateBaseSummary(overallScore, dimensionScores) {
    const grade = GradingEngine.scoreToGrade(overallScore);
    const dims = dimensionScores;

    const strengths = [];
    const weaknesses = [];

    if (dims.completeness.score >= 80) strengths.push('完整性');
    else weaknesses.push('完整性');

    if (dims.standardization.score >= 80) strengths.push('规范性');
    else weaknesses.push('规范性');

    if (dims.accuracy.score >= 80) strengths.push('准确性');
    else weaknesses.push('准确性');

    if (dims.processingQuality.score >= 80) strengths.push('处理质量');
    else weaknesses.push('处理质量');

    if (dims.fieldRichness.score >= 80) strengths.push('字段丰富度');
    else weaknesses.push('字段丰富度');

    let summary = `综合评阅得分 ${overallScore} 分，等级为 ${grade}。`;

    if (strengths.length > 0) {
      summary += `在${strengths.join('、')}方面表现较好。`;
    }

    if (weaknesses.length > 0) {
      summary += `${weaknesses.join('、')}方面仍有提升空间。`;
    }

    summary += '建议根据问题优先级逐步优化数据质量。';

    return summary;
  }

  // ==================== 结果规范化 ====================

  _normalizeResult(result) {
    if (!result || typeof result !== 'object') return null;

    const normalized = {
      overallScore: Math.max(0, Math.min(100, parseInt(result.overallScore) || 0)),
      overallGrade: result.overallGrade || GradingEngine.scoreToGrade(parseInt(result.overallScore) || 0),
      dimensionScores: this._normalizeDimensionScores(result.dimensionScores),
      highlights: Array.isArray(result.highlights) ? result.highlights.filter(h => h && h.title).map(h => ({
        title: String(h.title || ''),
        description: String(h.description || '')
      })) : [],
      issues: Array.isArray(result.issues) ? result.issues.filter(i => i && i.title).map(i => ({
        severity: ['high', 'medium', 'low'].includes(i.severity) ? i.severity : 'medium',
        title: String(i.title || ''),
        description: String(i.description || ''),
        column: i.column || undefined,
        suggestion: String(i.suggestion || '')
      })) : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter(s => s && s.title).map(s => ({
        priority: ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium',
        title: String(s.title || ''),
        description: String(s.description || '')
      })) : [],
      summary: String(result.summary || '')
    };

    if (normalized.highlights.length === 0) {
      normalized.highlights.push({ title: '数据结构完整', description: '数据具备基本的分析结构' });
    }

    if (normalized.issues.length === 0) {
      normalized.issues.push({
        severity: 'low',
        title: '可进一步优化',
        description: '数据质量良好，仍有优化空间',
        suggestion: '持续关注数据质量，定期检查'
      });
    }

    if (normalized.suggestions.length === 0) {
      normalized.suggestions.push({
        priority: 'low',
        title: '持续优化',
        description: '建立数据质量监控机制，持续改进'
      });
    }

    if (!normalized.summary) {
      normalized.summary = `综合得分 ${normalized.overallScore} 分，等级 ${normalized.overallGrade}。`;
    }

    return normalized;
  }

  _normalizeDimensionScores(dimensionScores) {
    const dimensions = ['completeness', 'standardization', 'accuracy', 'processingQuality', 'fieldRichness'];
    const defaultLabels = { completeness: '完整性', standardization: '规范性', accuracy: '准确性', processingQuality: '处理质量', fieldRichness: '字段丰富度' };

    const normalized = {};

    dimensions.forEach(dim => {
      const score = dimensionScores?.[dim]?.score;
      const numScore = Math.max(0, Math.min(100, parseInt(score) || 0));

      normalized[dim] = {
        score: numScore,
        label: dimensionScores?.[dim]?.label || GradingEngine.scoreToLabel(numScore),
        description: dimensionScores?.[dim]?.description || `${defaultLabels[dim]}得分 ${numScore} 分`
      };
    });

    return normalized;
  }

  // ==================== 工具方法 ====================

  _fixJson(jsonStr) {
    let fixed = jsonStr;

    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    fixed = fixed.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    try {
      JSON.parse(fixed);
      return fixed;
    } catch (e) {
      return null;
    }
  }

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== 报告评阅 ====================

  /**
   * 报告评阅
   * @param {Object} fileInfo - 文件信息 { fileName, fileType, fileSize }
   * @param {Object} reportFeatures - ReportAnalyzer.extractStructureFeatures() + analyzeContentQuality() 的结果
   * @param {Object} options - 评阅选项 { lessonContext?, rubric?, context?, stageTitle?, lessonTitle? }
   * @returns {Object} 结构化评阅结果
   */
  async gradeReport(fileInfo, reportFeatures, options = {}) {
    try {
      if (!reportFeatures || reportFeatures.error) {
        return this._buildReportErrorResult(reportFeatures?.error || '报告特征无效');
      }

      const prompt = this.buildReportGradingPrompt(reportFeatures, options);
      const messages = [
        { role: 'system', content: this._getReportSystemPrompt() },
        { role: 'user', content: prompt }
      ];

      const response = await this._callAI(messages, options);
      const result = this.parseReportGradingResult(response);

      if (!result) {
        return this._fallbackReportScore(reportFeatures, 'AI 返回结果解析失败，使用基础评分');
      }

      result.gradingType = 'report';
      result.fileInfo = fileInfo;
      result.gradingTime = new Date().toISOString();

      return result;
    } catch (error) {
      console.warn('AI 报告评阅失败，使用基础评分:', error.message);
      return this._fallbackReportScore(reportFeatures, error.message);
    }
  }

  /**
   * 带重试机制的报告评阅
   * @param {Object} fileInfo - 文件信息
   * @param {Object} reportFeatures - 报告特征
   * @param {Object} options - 评阅选项
   * @returns {Object} 结构化评阅结果
   */
  async gradeReportWithRetry(fileInfo, reportFeatures, options = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.gradeReport(fileInfo, reportFeatures, options);
        if (result && !result.error) {
          result.attempts = attempt + 1;
          return result;
        }
        lastError = result?.error || '未知错误';
      } catch (error) {
        lastError = error.message;
      }

      if (attempt < this.maxRetries) {
        await this._delay(1000 * (attempt + 1));
      }
    }

    return this._fallbackReportScore(reportFeatures, `多次重试失败: ${lastError}`);
  }

  /**
   * 构建报告评阅 Prompt
   * @param {Object} reportFeatures - 报告特征
   * @param {Object} options - 评阅选项
   * @returns {string} 完整的 Prompt
   */
  buildReportGradingPrompt(reportFeatures, options = {}) {
    const parts = [];

    parts.push('【报告结构特征摘要】');
    parts.push(this._buildReportStructureSummary(reportFeatures));

    parts.push('\n【内容质量特征摘要】');
    parts.push(this._buildReportQualitySummary(reportFeatures));

    parts.push('\n【评分维度说明】');
    parts.push(this._buildReportRubricText(options.rubric));

    if (options.stageTitle || options.lessonTitle) {
      parts.push('\n【课程上下文】');
      if (options.stageTitle) {
        parts.push(`阶段：${options.stageTitle}`);
      }
      if (options.lessonTitle) {
        parts.push(`课程：${options.lessonTitle}`);
      }
    }

    if (options.lessonContext) {
      parts.push('\n【课程内容背景】');
      parts.push(options.lessonContext);
    }

    if (options.context) {
      parts.push('\n【补充说明】');
      parts.push(options.context);
    }

    parts.push('\n【输出格式要求】');
    parts.push(this._buildReportOutputFormat());

    parts.push('\n【重要提示】');
    parts.push('1. 请严格按照 JSON 格式输出，不要添加任何额外的解释文字');
    parts.push('2. 评分要客观公正，基于报告特征进行分析');
    parts.push('3. 问题和建议要具体可操作');
    parts.push('4. 亮点部分要突出报告的优势和价值');

    return parts.join('\n');
  }

  /**
   * 基于报告特征计算基础分（降级方案）
   * @param {Object} reportFeatures - 报告特征
   * @returns {Object} 基础评分结果
   */
  calculateReportBaseScore(reportFeatures) {
    if (!reportFeatures || reportFeatures.error) {
      return this._buildReportErrorResult(reportFeatures?.error || '报告特征无效');
    }

    const structureCompletenessScore = this._calcReportStructureScore(reportFeatures);
    const logicalRigorScore = this._calcReportLogicalRigorScore(reportFeatures);
    const insightDepthScore = this._calcReportInsightDepthScore(reportFeatures);
    const suggestionActionabilityScore = this._calcReportSuggestionActionabilityScore(reportFeatures);
    const expressionClarityScore = this._calcReportExpressionClarityScore(reportFeatures);
    const dataSupportScore = this._calcReportDataSupportScore(reportFeatures);

    const dimensionScores = {
      structureCompleteness: {
        score: structureCompletenessScore,
        label: GradingEngine.scoreToLabel(structureCompletenessScore),
        description: this._getStructureCompletenessDesc(structureCompletenessScore, reportFeatures)
      },
      logicalRigor: {
        score: logicalRigorScore,
        label: GradingEngine.scoreToLabel(logicalRigorScore),
        description: this._getLogicalRigorDesc(logicalRigorScore, reportFeatures)
      },
      insightDepth: {
        score: insightDepthScore,
        label: GradingEngine.scoreToLabel(insightDepthScore),
        description: this._getInsightDepthDesc(insightDepthScore, reportFeatures)
      },
      suggestionActionability: {
        score: suggestionActionabilityScore,
        label: GradingEngine.scoreToLabel(suggestionActionabilityScore),
        description: this._getSuggestionActionabilityDesc(suggestionActionabilityScore, reportFeatures)
      },
      expressionClarity: {
        score: expressionClarityScore,
        label: GradingEngine.scoreToLabel(expressionClarityScore),
        description: this._getExpressionClarityDesc(expressionClarityScore, reportFeatures)
      },
      dataSupport: {
        score: dataSupportScore,
        label: GradingEngine.scoreToLabel(dataSupportScore),
        description: this._getDataSupportDesc(dataSupportScore, reportFeatures)
      }
    };

    const weights = {
      structureCompleteness: 0.15,
      logicalRigor: 0.2,
      insightDepth: 0.2,
      suggestionActionability: 0.2,
      expressionClarity: 0.1,
      dataSupport: 0.15
    };

    const overallScore = Math.round(
      structureCompletenessScore * weights.structureCompleteness +
      logicalRigorScore * weights.logicalRigor +
      insightDepthScore * weights.insightDepth +
      suggestionActionabilityScore * weights.suggestionActionability +
      expressionClarityScore * weights.expressionClarity +
      dataSupportScore * weights.dataSupport
    );

    const overallGrade = GradingEngine.reportScoreToGrade(overallScore);
    const gradeDetails = GradingEngine.getGradeDescription(overallGrade);

    const highlights = this._generateReportBaseHighlights(reportFeatures, dimensionScores);
    const issues = this._generateReportBaseIssues(reportFeatures, dimensionScores);
    const suggestions = this._generateReportBaseSuggestions(issues);
    const summary = this._generateReportBaseSummary(overallScore, overallGrade, dimensionScores);

    return {
      gradingType: 'report',
      overallScore,
      overallGrade,
      dimensionScores,
      highlights,
      issues,
      suggestions,
      summary,
      gradeDetails,
      isBaseScore: true
    };
  }

  /**
   * 解析 AI 返回的报告评阅结果
   * @param {string} text - AI 返回的文本
   * @returns {Object|null} 解析后的结果对象
   */
  parseReportGradingResult(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    let jsonStr = text.trim();

    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const result = JSON.parse(jsonStr);
      return this._normalizeReportResult(result);
    } catch (e) {
      console.warn('报告评阅 JSON 解析失败，尝试修复:', e.message);

      const fixed = this._fixJson(jsonStr);
      if (fixed) {
        try {
          const result = JSON.parse(fixed);
          return this._normalizeReportResult(result);
        } catch (e2) {
          console.warn('修复后仍解析失败:', e2.message);
        }
      }

      return null;
    }
  }

  // ==================== 报告评阅内部方法 ====================

  /**
   * 获取报告评阅系统 Prompt
   */
  _getReportSystemPrompt() {
    return `你是一位专业的报告评阅专家，负责评估分析报告的质量。

你的职责：
1. 基于提供的报告特征，从6个维度客观评估报告质量
2. 给出具体的问题和可操作的改进建议
3. 评分要公正、合理、有依据
4. 严格按照指定的 JSON 格式输出结果

评阅原则：
- 客观公正：基于报告事实，不主观臆断
- 具体明确：问题和建议要具体，避免空泛
- 建设性：以帮助改进为目的，而非批评
- 平衡视角：既要指出问题，也要肯定亮点`;
  }

  /**
   * 构建报告结构特征摘要
   */
  _buildReportStructureSummary(reportFeatures) {
    const lines = [];
    const sf = reportFeatures.structureFeatures || reportFeatures;

    lines.push('## 基本信息');
    lines.push(`- 总字数：${sf.totalWordCount || 0}`);
    lines.push(`- 标题数量：${sf.headingCount || 0}`);
    lines.push(`- 段落数量：${sf.paragraphCount || (reportFeatures.paragraphs?.length || 0)}`);

    if (sf.headingLevelDistribution) {
      const hld = sf.headingLevelDistribution;
      lines.push(`- 标题层级分布：H1:${hld.h1 || 0}, H2:${hld.h2 || 0}, H3:${hld.h3 || 0}, H4+:${(hld.h4 || 0) + (hld.h5 || 0) + (hld.h6 || 0)}`);
    }

    lines.push('\n## 内容元素');
    lines.push(`- 表格数量：${sf.tableCount || 0}`);
    lines.push(`- 列表数量：${sf.listCount || 0}`);
    lines.push(`- 图片数量：${sf.imageCount || 0}`);
    lines.push(`- 代码块数量：${sf.codeBlockCount || 0}`);

    lines.push('\n## 结构检测');
    lines.push(`- 有总结部分：${sf.hasSummary ? '是' : '否'}`);
    lines.push(`- 有分析部分：${sf.hasAnalysis ? '是' : '否'}`);
    lines.push(`- 有建议部分：${sf.hasSuggestions ? '是' : '否'}`);
    lines.push(`- 有数据支撑：${sf.hasData ? '是' : '否'}`);

    lines.push('\n## 结构评分');
    lines.push(`- 结构完整性得分：${sf.structureCompleteness || sf.structureScore || 0}/100`);
    lines.push(`- 数据支撑得分：${sf.dataSupportScore || 0}/100`);
    lines.push(`- 内容丰富度得分：${sf.richnessScore || 0}/100`);

    return lines.join('\n');
  }

  /**
   * 构建内容质量特征摘要
   */
  _buildReportQualitySummary(reportFeatures) {
    const lines = [];
    const qf = reportFeatures.qualityFeatures || reportFeatures;

    lines.push('## 语言质量');
    lines.push(`- 词汇丰富度：${(qf.vocabularyRichness || 0).toFixed(3)}`);
    lines.push(`- 专业术语密度：${((qf.termDensity || 0) * 100).toFixed(2)}%`);
    lines.push(`- 整体质量得分：${qf.overallQualityScore || 0}/100`);

    lines.push('\n## 数据引用');
    lines.push(`- 数据引用次数：${qf.dataReferences || 0}`);

    if (qf.dataReferenceDetails && qf.dataReferenceDetails.length > 0) {
      const examples = qf.dataReferenceDetails.slice(0, 5).map(d => d.value);
      lines.push(`- 数据引用示例：${examples.join('、')}`);
    }

    lines.push('\n## 建议条目');
    lines.push(`- 建议数量：${qf.suggestionCount || 0}`);

    if (qf.suggestions && qf.suggestions.length > 0) {
      lines.push('- 建议示例：');
      qf.suggestions.slice(0, 3).forEach((s, i) => {
        lines.push(`  ${i + 1}. ${s.substring(0, 50)}${s.length > 50 ? '...' : ''}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 构建报告评分标准文本
   */
  _buildReportRubricText(customRubric) {
    if (customRubric && typeof customRubric === 'object') {
      return JSON.stringify(customRubric, null, 2);
    }

    return `### 1. 结构完整性 (structureCompleteness) - 权重 15%
- 标题层级：是否有清晰的标题层级结构
- 模块完整性：是否包含背景、分析、结论、建议等核心模块
- 结构清晰度：整体结构是否逻辑清晰、层次分明
- 评分标准：A级(90+)结构完整层次分明；B级(80+)结构基本完整；C级(60+)有基本结构；D级(<60)结构缺失严重

### 2. 逻辑严谨性 (logicalRigor) - 权重 20%
- 推理链条：论证过程是否完整连贯
- 因果关系：因果分析是否合理准确
- 论据充分性：论据是否充分支撑结论
- 评分标准：A级(90+)逻辑严密论证充分；B级(80+)逻辑清晰有论据；C级(60+)有基本逻辑；D级(<60)逻辑混乱

### 3. 洞察深度 (insightDepth) - 权重 20%
- 问题诊断：是否能准确识别核心问题
- 根因分析：是否深入分析根本原因
- 发现机会：是否有价值的发现和洞见
- 评分标准：A级(90+)洞察深刻有启发性；B级(80+)有分析有发现；C级(60+)有基本分析；D级(<60)缺乏洞察不足

### 4. 建议可落地性 (suggestionActionability) - 权重 20%
- 具体性：建议是否具体明确
- 可衡量性：是否有可衡量的目标
- 时间维度：是否有时间规划和优先级
- 评分标准：A级(90+)建议具体可落地；B级(80+)有明确建议；C级(60+)有基本建议；D级(<60)建议空泛

### 5. 表达清晰度 (expressionClarity) - 权重 10%
- 层次分明：表达是否条理清晰
- 语言专业：用词是否专业准确
- 可读性：是否易于阅读理解
- 评分标准：A级(90+)表达精准流畅；B级(80+)表达清晰；C级(60+)表达基本清楚；D级(<60)表达混乱

### 6. 数据支撑度 (dataSupport) - 权重 15%
- 图表使用：是否合理使用图表
- 数据引用：是否有充分的数据引用
- 量化表述：是否使用量化数据支撑观点
- 评分标准：A级(90+)数据充分图表丰富；B级(80+)有数据有支撑；C级(60+)有基本数据；D级(<60)数据缺乏`;
  }

  /**
   * 构建报告输出格式要求
   */
  _buildReportOutputFormat() {
    return `请严格按照以下 JSON 格式输出评阅结果：

\`\`\`json
{
  "overallScore": 85,
  "overallGrade": "B",
  "dimensionScores": {
    "structureCompleteness": {
      "score": 90,
      "label": "优秀",
      "description": "报告结构完整，标题层级清晰，包含背景、分析、建议等核心模块"
    },
    "logicalRigor": {
      "score": 85,
      "label": "良好",
      "description": "逻辑链条清晰，因果关系明确，论据较为充分"
    },
    "insightDepth": {
      "score": 80,
      "label": "良好",
      "description": "有一定的洞察深度，能识别核心问题并进行分析"
    },
    "suggestionActionability": {
      "score": 75,
      "label": "中等",
      "description": "建议方向明确，但具体性和可衡量性有待提升"
    },
    "expressionClarity": {
      "score": 85,
      "label": "良好",
      "description": "表达清晰流畅，层次分明，易于阅读理解"
    },
    "dataSupport": {
      "score": 80,
      "label": "良好",
      "description": "有一定的数据支撑，使用了表格和数据引用"
    }
  },
  "highlights": [
    {
      "title": "结构完整清晰",
      "description": "报告结构完整，标题层级分明，逻辑清晰"
    }
  ],
  "issues": [
    {
      "severity": "high",
      "title": "建议缺乏具体实施步骤",
      "description": "建议部分较为笼统，缺乏具体的实施步骤和时间规划",
      "section": "建议部分",
      "suggestion": "建议为每条建议补充具体的实施步骤、责任人和时间节点"
    },
    {
      "severity": "medium",
      "title": "数据支撑可进一步加强",
      "description": "部分观点缺乏数据支撑，论证说服力不足",
      "section": "分析部分",
      "suggestion": "建议增加相关数据和图表，增强论证的说服力"
    },
    {
      "severity": "low",
      "title": "洞察深度可提升",
      "description": "分析停留在表面，缺乏深入的根因分析",
      "section": "分析部分",
      "suggestion": "建议深入分析问题的根本原因，提供更有深度的洞察"
    }
  ],
  "suggestions": [
    {
      "priority": "high",
      "title": "增强建议的可落地性",
      "description": "为建议补充具体实施步骤、衡量指标和时间规划"
    },
    {
      "priority": "medium",
      "title": "增加数据支撑",
      "description": "补充相关数据和图表，增强论证说服力"
    },
    {
      "priority": "low",
      "title": "深化洞察深度",
      "description": "深入分析问题根本原因，提供更有深度的洞察"
    }
  ],
  "summary": "整体报告质量良好，综合得分85分，等级为B。报告结构完整清晰，逻辑较为严谨，有一定的洞察深度。建议在可落地性和数据支撑方面还有提升空间。建议优先完善建议的具体实施方案，增加数据支撑，并深化洞察深度。",
  "gradeDetails": {
    "level": "B",
    "description": "良好",
    "requirements": "结构完整，有分析有建议，数据支撑较为充分"
  }
}
\`\`\`

注意：
- overallScore 为 0-100 的整数
- overallGrade 为 A/B/C/D 之一（90+为A，80-89为B，60-79为C，<60为D）
- label 可以是：优秀/良好/中等/及格/待提升
- severity 为 high/medium/low
- priority 为 high/medium/low
- 至少提供 2 个亮点，3 个问题，3 条建议
- summary 控制在 100-200 字之间
- gradeDetails 包含等级、描述和要求`;
  }

  /**
   * 报告降级评分
   */
  _fallbackReportScore(reportFeatures, errorMessage) {
    const baseResult = this.calculateReportBaseScore(reportFeatures);
    baseResult.error = errorMessage;
    baseResult.isFallback = true;
    baseResult.fallbackReason = errorMessage;
    return baseResult;
  }

  /**
   * 构建报告错误结果
   */
  _buildReportErrorResult(message) {
    return {
      gradingType: 'report',
      overallScore: 0,
      overallGrade: 'D',
      dimensionScores: {
        structureCompleteness: { score: 0, label: '待提升', description: '报告无效' },
        logicalRigor: { score: 0, label: '待提升', description: '报告无效' },
        insightDepth: { score: 0, label: '待提升', description: '报告无效' },
        suggestionActionability: { score: 0, label: '待提升', description: '报告无效' },
        expressionClarity: { score: 0, label: '待提升', description: '报告无效' },
        dataSupport: { score: 0, label: '待提升', description: '报告无效' }
      },
      highlights: [],
      issues: [{
        severity: 'high',
        title: '报告解析失败',
        description: message,
        suggestion: '请检查报告文件格式是否正确'
      }],
      suggestions: [{
        priority: 'high',
        title: '检查报告文件',
        description: '请确保上传的报告格式正确且包含有效内容'
      }],
      summary: `报告评阅失败：${message}`,
      gradeDetails: GradingEngine.getGradeDescription('D'),
      error: message
    };
  }

  // ==================== 报告基础评分计算 ====================

  _calcReportStructureScore(reportFeatures) {
    let score = 50;
    const sf = reportFeatures.structureFeatures || reportFeatures;

    if (sf.structureCompleteness !== undefined) {
      score = sf.structureCompleteness;
    } else if (sf.structureScore !== undefined) {
      score = sf.structureScore;
    } else {
      const headingCount = sf.headingCount || 0;
      if (headingCount >= 10) score += 30;
      else if (headingCount >= 6) score += 25;
      else if (headingCount >= 3) score += 15;
      else if (headingCount >= 1) score += 5;

      if (sf.hasSummary) score += 10;
      if (sf.hasAnalysis) score += 10;
      if (sf.hasSuggestions) score += 10;

      const hld = sf.headingLevelDistribution || {};
      if (hld.h1 > 0) score += 5;
      if (hld.h2 > 0) score += 5;
      if (hld.h3 > 0) score += 5;
    }

    const wordCount = sf.totalWordCount || 0;
    if (wordCount >= 2000) score += 10;
    else if (wordCount >= 1000) score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcReportLogicalRigorScore(reportFeatures) {
    let score = 50;
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const qf = reportFeatures.qualityFeatures || reportFeatures;

    if (sf.hasAnalysis) score += 15;
    if (sf.hasSummary) score += 10;
    if (sf.hasSuggestions) score += 10;

    const headingCount = sf.headingCount || 0;
    if (headingCount >= 6) score += 10;
    else if (headingCount >= 3) score += 5;

    const qualityScore = qf.overallQualityScore || 0;
    score += qualityScore * 0.15;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcReportInsightDepthScore(reportFeatures) {
    let score = 40;
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const qf = reportFeatures.qualityFeatures || reportFeatures;

    if (sf.hasAnalysis) score += 20;

    const dataRefs = qf.dataReferences || 0;
    if (dataRefs >= 10) score += 15;
    else if (dataRefs >= 5) score += 10;
    else if (dataRefs >= 2) score += 5;

    const termDensity = qf.termDensity || 0;
    score += Math.min(15, termDensity * 200);

    const vocabRichness = qf.vocabularyRichness || 0;
    score += Math.min(10, vocabRichness * 50);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcReportSuggestionActionabilityScore(reportFeatures) {
    let score = 40;
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const qf = reportFeatures.qualityFeatures || reportFeatures;

    if (sf.hasSuggestions) score += 20;

    const suggestionCount = qf.suggestionCount || 0;
    if (suggestionCount >= 5) score += 20;
    else if (suggestionCount >= 3) score += 15;
    else if (suggestionCount >= 1) score += 8;

    const tableCount = sf.tableCount || 0;
    if (tableCount > 0) score += 10;

    const dataRefs = qf.dataReferences || 0;
    if (dataRefs >= 5) score += 10;
    else if (dataRefs >= 2) score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcReportExpressionClarityScore(reportFeatures) {
    let score = 60;
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const qf = reportFeatures.qualityFeatures || reportFeatures;

    const structureScore = sf.structureCompleteness || sf.structureScore || 0;
    score += structureScore * 0.2;

    const vocabRichness = qf.vocabularyRichness || 0;
    score += Math.min(15, vocabRichness * 100);

    const wordCount = sf.totalWordCount || 0;
    if (wordCount >= 500) score += 5;
    if (wordCount >= 1000) score += 5;

    const listCount = sf.listCount || 0;
    if (listCount >= 3) score += 5;
    else if (listCount >= 1) score += 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcReportDataSupportScore(reportFeatures) {
    let score = 30;
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const qf = reportFeatures.qualityFeatures || reportFeatures;

    if (sf.dataSupportScore !== undefined) {
      score = sf.dataSupportScore;
    } else {
      const tableCount = sf.tableCount || 0;
      if (tableCount >= 3) score += 30;
      else if (tableCount >= 1) score += 20;

      const codeBlockCount = sf.codeBlockCount || 0;
      if (codeBlockCount > 0) score += 10;

      const imageCount = sf.imageCount || 0;
      if (imageCount > 0) score += 10;

      if (sf.hasData) score += 10;
    }

    const dataRefs = qf.dataReferences || 0;
    if (dataRefs >= 10) score += 20;
    else if (dataRefs >= 5) score += 15;
    else if (dataRefs >= 2) score += 10;
    else if (dataRefs >= 1) score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ==================== 报告基础评分描述生成 ====================

  _getStructureCompletenessDesc(score, reportFeatures) {
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const headingCount = sf.headingCount || 0;
    if (score >= 90) {
      return `结构完整性优秀，共 ${headingCount} 个标题，层级清晰，模块完整`;
    } else if (score >= 70) {
      return `结构完整性良好，共 ${headingCount} 个标题，结构基本完整`;
    } else if (score >= 60) {
      return `结构完整性一般，共 ${headingCount} 个标题，部分模块有所缺失`;
    } else {
      return `结构完整性较差，标题数量不足，核心模块缺失`;
    }
  }

  _getLogicalRigorDesc(score, reportFeatures) {
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const hasAnalysis = sf.hasAnalysis;
    if (score >= 90) {
      return '逻辑严谨性优秀，推理链条完整，因果关系清晰，论证充分';
    } else if (score >= 70) {
      return `逻辑严谨性良好，${hasAnalysis ? '有分析部分' : '逻辑基本清晰'}，有一定论证`;
    } else if (score >= 60) {
      return '逻辑严谨性一般，有基本逻辑但论证不够充分';
    } else {
      return '逻辑严谨性较差，缺乏完整的推理链条和充分的论证';
    }
  }

  _getInsightDepthDesc(score, reportFeatures) {
    const qf = reportFeatures.qualityFeatures || reportFeatures;
    const dataRefs = qf.dataReferences || 0;
    if (score >= 90) {
      return `洞察深度优秀，有 ${dataRefs} 处数据引用，分析深入有洞见`;
    } else if (score >= 70) {
      return `洞察深度良好，有 ${dataRefs} 处数据引用，有一定分析深度`;
    } else if (score >= 60) {
      return `洞察深度一般，有 ${dataRefs} 处数据引用，分析较为表面`;
    } else {
      return '洞察深度不足，缺乏深入分析和有价值的发现';
    }
  }

  _getSuggestionActionabilityDesc(score, reportFeatures) {
    const qf = reportFeatures.qualityFeatures || reportFeatures;
    const suggestionCount = qf.suggestionCount || 0;
    if (score >= 90) {
      return `建议可落地性优秀，共 ${suggestionCount} 条建议，具体明确可执行`;
    } else if (score >= 70) {
      return `建议可落地性良好，共 ${suggestionCount} 条建议，方向明确`;
    } else if (score >= 60) {
      return `建议可落地性一般，共 ${suggestionCount} 条建议，具体性有待提升`;
    } else {
      return '建议可落地性较差，建议数量不足或过于空泛';
    }
  }

  _getExpressionClarityDesc(score, reportFeatures) {
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const wordCount = sf.totalWordCount || 0;
    if (score >= 90) {
      return `表达清晰度优秀，共 ${wordCount} 字，层次分明，语言专业流畅`;
    } else if (score >= 70) {
      return `表达清晰度良好，共 ${wordCount} 字，表达清晰，易于理解`;
    } else if (score >= 60) {
      return `表达清晰度一般，共 ${wordCount} 字，表达基本清楚`;
    } else {
      return '表达清晰度较差，条理不够清晰，可读性有待提升';
    }
  }

  _getDataSupportDesc(score, reportFeatures) {
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const qf = reportFeatures.qualityFeatures || reportFeatures;
    const tableCount = sf.tableCount || 0;
    const dataRefs = qf.dataReferences || 0;
    if (score >= 90) {
      return `数据支撑度优秀，${tableCount} 个表格，${dataRefs} 处数据引用，数据充分`;
    } else if (score >= 70) {
      return `数据支撑度良好，${tableCount} 个表格，${dataRefs} 处数据引用`;
    } else if (score >= 60) {
      return `数据支撑度一般，${tableCount} 个表格，${dataRefs} 处数据引用`;
    } else {
      return '数据支撑度不足，缺乏足够的数据和图表支撑';
    }
  }

  // ==================== 报告基础评分亮点/问题/建议生成 ====================

  _generateReportBaseHighlights(reportFeatures, dimensionScores) {
    const highlights = [];
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const qf = reportFeatures.qualityFeatures || reportFeatures;

    if (dimensionScores.structureCompleteness.score >= 80) {
      highlights.push({
        title: '结构完整清晰',
        description: `报告结构完整，共 ${sf.headingCount || 0} 个标题，层级分明，逻辑清晰`
      });
    }

    if (dimensionScores.dataSupport.score >= 80) {
      highlights.push({
        title: '数据支撑充分',
        description: `报告中有 ${sf.tableCount || 0} 个表格，${qf.dataReferences || 0} 处数据引用，数据支撑充足`
      });
    }

    if (dimensionScores.expressionClarity.score >= 80) {
      highlights.push({
        title: '表达清晰流畅',
        description: '报告表达清晰，层次分明，语言专业，可读性强'
      });
    }

    if (sf.hasAnalysis && dimensionScores.logicalRigor.score >= 75) {
      highlights.push({
        title: '逻辑分析到位',
        description: '报告有独立的分析部分，逻辑链条清晰，论证较为充分'
      });
    }

    if (sf.hasSuggestions && dimensionScores.suggestionActionability.score >= 75) {
      highlights.push({
        title: '建议方向明确',
        description: `报告包含 ${qf.suggestionCount || 0} 条建议，方向明确有参考价值`
      });
    }

    if ((sf.totalWordCount || 0) >= 1000) {
      highlights.push({
        title: '内容充实',
        description: `报告内容充实，共 ${sf.totalWordCount} 字，信息量充足`
      });
    }

    if (highlights.length < 2) {
      highlights.push({
        title: '报告结构基本完整',
        description: '报告具备基本的结构框架，有一定的分析和建议内容'
      });
    }

    return highlights.slice(0, 5);
  }

  _generateReportBaseIssues(reportFeatures, dimensionScores) {
    const issues = [];
    const sf = reportFeatures.structureFeatures || reportFeatures;
    const qf = reportFeatures.qualityFeatures || reportFeatures;

    if (!sf.hasSummary) {
      issues.push({
        severity: 'high',
        title: '缺少总结部分',
        description: '报告缺少总结或结论部分，整体结构不完整',
        section: '结构',
        suggestion: '建议增加总结或结论部分，概括核心发现和观点'
      });
    }

    if (!sf.hasAnalysis) {
      issues.push({
        severity: 'high',
        title: '缺少分析部分',
        description: '报告缺少独立的分析部分，洞察深度不足',
        section: '分析部分',
        suggestion: '建议增加分析章节，深入分析问题原因和内在逻辑'
      });
    }

    if (!sf.hasSuggestions) {
      issues.push({
        severity: 'high',
        title: '缺少建议部分',
        description: '报告缺少建议或行动计划部分，缺乏落地指导',
        section: '建议部分',
        suggestion: '建议增加建议或行动计划章节，提出具体可操作的改进措施'
      });
    }

    if (dimensionScores.dataSupport.score < 60) {
      issues.push({
        severity: 'high',
        title: '数据支撑不足',
        description: `报告数据支撑不足，仅 ${sf.tableCount || 0} 个表格，${qf.dataReferences || 0} 处数据引用`,
        section: '全文',
        suggestion: '建议增加相关数据、表格和图表，用数据支撑观点和结论'
      });
    }

    if (dimensionScores.suggestionActionability.score < 65) {
      issues.push({
        severity: 'medium',
        title: '建议可落地性待提升',
        description: '建议部分较为笼统，缺乏具体的实施步骤和衡量标准',
        section: '建议部分',
        suggestion: '建议为每条建议补充具体实施步骤、衡量指标和时间节点'
      });
    }

    if (dimensionScores.insightDepth.score < 65) {
      issues.push({
        severity: 'medium',
        title: '洞察深度有待加强',
        description: '分析较为表面，缺乏深入的根因分析和有价值的洞见',
        section: '分析部分',
        suggestion: '建议深入分析问题的根本原因，提供更有深度的洞察和发现'
      });
    }

    if (dimensionScores.logicalRigor.score < 65) {
      issues.push({
        severity: 'medium',
        title: '逻辑严谨性不足',
        description: '逻辑链条不够完整，因果关系不够清晰，论证不够充分',
        section: '全文',
        suggestion: '建议梳理逻辑结构，完善论证链条，增强因果关系分析'
      });
    }

    if ((sf.headingCount || 0) < 3) {
      issues.push({
        severity: 'low',
        title: '标题层级偏少',
        description: `报告标题数量较少（${sf.headingCount || 0}个），结构层次不够清晰`,
        section: '结构',
        suggestion: '建议增加二级、三级标题，使结构层次更加清晰'
      });
    }

    if (dimensionScores.expressionClarity.score < 70) {
      issues.push({
        severity: 'low',
        title: '表达清晰度可提升',
        description: '表达不够清晰流畅，可读性有待提升',
        section: '全文',
        suggestion: '建议优化语言表达，使用更专业准确的用词，增强条理性'
      });
    }

    if (issues.length < 3) {
      issues.push({
        severity: 'low',
        title: '可进一步优化',
        description: '报告整体质量良好，但仍有提升空间',
        section: '全文',
        suggestion: '建议持续优化报告质量，提升各维度表现'
      });
    }

    return issues.slice(0, 8);
  }

  _generateReportBaseSuggestions(issues) {
    const suggestions = [];
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    const lowIssues = issues.filter(i => i.severity === 'low');

    highIssues.forEach(issue => {
      suggestions.push({
        priority: 'high',
        title: issue.title,
        description: issue.suggestion || `建议优先处理：${issue.title}`
      });
    });

    mediumIssues.forEach(issue => {
      suggestions.push({
        priority: 'medium',
        title: issue.title,
        description: issue.suggestion || `建议处理：${issue.title}`
      });
    });

    lowIssues.forEach(issue => {
      suggestions.push({
        priority: 'low',
        title: issue.title,
        description: issue.suggestion || `可选优化：${issue.title}`
      });
    });

    if (suggestions.length < 3) {
      suggestions.push({
        priority: 'low',
        title: '持续优化报告质量',
        description: '持续改进报告各维度质量，提升整体水平'
      });
    }

    return suggestions.slice(0, 6);
  }

  _generateReportBaseSummary(overallScore, overallGrade, dimensionScores) {
    const dims = dimensionScores;

    const strengths = [];
    const weaknesses = [];

    if (dims.structureCompleteness.score >= 80) strengths.push('结构完整性');
    else weaknesses.push('结构完整性');

    if (dims.logicalRigor.score >= 80) strengths.push('逻辑严谨性');
    else weaknesses.push('逻辑严谨性');

    if (dims.insightDepth.score >= 80) strengths.push('洞察深度');
    else weaknesses.push('洞察深度');

    if (dims.suggestionActionability.score >= 80) strengths.push('建议可落地性');
    else weaknesses.push('建议可落地性');

    if (dims.expressionClarity.score >= 80) strengths.push('表达清晰度');
    else weaknesses.push('表达清晰度');

    if (dims.dataSupport.score >= 80) strengths.push('数据支撑度');
    else weaknesses.push('数据支撑度');

    let summary = `综合评阅得分 ${overallScore} 分，等级为 ${overallGrade}。`;

    if (strengths.length > 0) {
      summary += `在${strengths.join('、')}方面表现较好。`;
    }

    if (weaknesses.length > 0) {
      summary += `${weaknesses.slice(0, 3).join('、')}方面仍有提升空间。`;
    }

    summary += '建议根据问题优先级逐步优化报告质量。';

    return summary;
  }

  // ==================== 报告结果规范化 ====================

  _normalizeReportResult(result) {
    if (!result || typeof result !== 'object') return null;

    const overallScore = Math.max(0, Math.min(100, parseInt(result.overallScore) || 0));
    const overallGrade = result.overallGrade || GradingEngine.reportScoreToGrade(overallScore);

    const normalized = {
      gradingType: 'report',
      overallScore,
      overallGrade,
      dimensionScores: this._normalizeReportDimensionScores(result.dimensionScores),
      highlights: Array.isArray(result.highlights) ? result.highlights.filter(h => h && h.title).map(h => ({
        title: String(h.title || ''),
        description: String(h.description || '')
      })) : [],
      issues: Array.isArray(result.issues) ? result.issues.filter(i => i && i.title).map(i => ({
        severity: ['high', 'medium', 'low'].includes(i.severity) ? i.severity : 'medium',
        title: String(i.title || ''),
        description: String(i.description || ''),
        section: i.section || undefined,
        suggestion: String(i.suggestion || '')
      })) : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter(s => s && s.title).map(s => ({
        priority: ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium',
        title: String(s.title || ''),
        description: String(s.description || '')
      })) : [],
      summary: String(result.summary || ''),
      gradeDetails: result.gradeDetails || GradingEngine.getGradeDescription(overallGrade)
    };

    if (normalized.highlights.length === 0) {
      normalized.highlights.push({ title: '报告结构完整', description: '报告具备基本的分析结构' });
    }

    if (normalized.issues.length === 0) {
      normalized.issues.push({
        severity: 'low',
        title: '可进一步优化',
        description: '报告质量良好，仍有优化空间',
        suggestion: '持续关注报告质量，定期检查'
      });
    }

    if (normalized.suggestions.length === 0) {
      normalized.suggestions.push({
        priority: 'low',
        title: '持续优化',
        description: '建立报告质量监控机制，持续改进'
      });
    }

    if (!normalized.summary) {
      normalized.summary = `综合得分 ${normalized.overallScore} 分，等级 ${normalized.overallGrade}。`;
    }

    return normalized;
  }

  _normalizeReportDimensionScores(dimensionScores) {
    const dimensions = ['structureCompleteness', 'logicalRigor', 'insightDepth', 'suggestionActionability', 'expressionClarity', 'dataSupport'];
    const defaultLabels = {
      structureCompleteness: '结构完整性',
      logicalRigor: '逻辑严谨性',
      insightDepth: '洞察深度',
      suggestionActionability: '建议可落地性',
      expressionClarity: '表达清晰度',
      dataSupport: '数据支撑度'
    };

    const normalized = {};

    dimensions.forEach(dim => {
      const score = dimensionScores?.[dim]?.score;
      const numScore = Math.max(0, Math.min(100, parseInt(score) || 0));

      normalized[dim] = {
        score: numScore,
        label: dimensionScores?.[dim]?.label || GradingEngine.scoreToLabel(numScore),
        description: dimensionScores?.[dim]?.description || `${defaultLabels[dim]}得分 ${numScore} 分`
      };
    });

    return normalized;
  }

  // ==================== 静态方法 ====================

  /**
   * 报告分数转等级
   * @param {number} score - 分数 (0-100)
   * @returns {string} 等级 A/B/C/D
   */
  static reportScoreToGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  /**
   * 获取等级描述
   * @param {string} grade - 等级 A/B/C/D
   * @param {string} gradingType - 评阅类型 'report' | 'data'
   * @returns {Object} 等级详情 { level, description, requirements }
   */
  static getGradeDescription(grade, gradingType = 'report') {
    const descriptions = {
      report: {
        A: {
          level: 'A',
          description: '优秀',
          requirements: '结构完整，洞察深刻，建议落地，数据充分'
        },
        B: {
          level: 'B',
          description: '良好',
          requirements: '结构完整，有分析有建议，数据支撑较为充分'
        },
        C: {
          level: 'C',
          description: '达标',
          requirements: '基本完整，有基本分析'
        },
        D: {
          level: 'D',
          description: '待改进',
          requirements: '明显缺失或不足，需要重点改进'
        }
      },
      data: {
        A: {
          level: 'A',
          description: '优秀',
          requirements: '数据质量优秀，各维度表现突出'
        },
        B: {
          level: 'B',
          description: '良好',
          requirements: '数据质量良好，基本满足分析需求'
        },
        C: {
          level: 'C',
          description: '达标',
          requirements: '数据质量一般，需要部分改进'
        },
        D: {
          level: 'D',
          description: '待改进',
          requirements: '数据质量较差，需要重点改进'
        }
      }
    };

    return descriptions[gradingType]?.[grade] || descriptions.report.D;
  }

  /**
   * 获取评分标准
   * @param {string} gradingType - 评阅类型 'report' | 'data' | 'excel'
   * @returns {Object} 评分标准
   */
  static getRubricCriteria(gradingType = 'report') {
    const rubrics = {
      report: {
        structureCompleteness: {
          name: '结构完整性',
          weight: 0.15,
          description: '标题层级、模块完整性、结构清晰度'
        },
        logicalRigor: {
          name: '逻辑严谨性',
          weight: 0.2,
          description: '推理链条、因果关系、论据充分性'
        },
        insightDepth: {
          name: '洞察深度',
          weight: 0.2,
          description: '问题诊断、根因分析、发现机会'
        },
        suggestionActionability: {
          name: '建议可落地性',
          weight: 0.2,
          description: '具体性、可衡量性、时间维度'
        },
        expressionClarity: {
          name: '表达清晰度',
          weight: 0.1,
          description: '层次分明、语言专业、可读性'
        },
        dataSupport: {
          name: '数据支撑度',
          weight: 0.15,
          description: '图表使用、数据引用、量化表述'
        }
      },
      data: {
        completeness: {
          name: '完整性',
          weight: 0.25,
          description: '数据完整度、列完整性、缺失值处理'
        },
        standardization: {
          name: '规范性',
          weight: 0.2,
          description: '命名规范、格式统一、类型正确'
        },
        accuracy: {
          name: '准确性',
          weight: 0.25,
          description: '异常值处理、逻辑一致性、数据质量'
        },
        processingQuality: {
          name: '处理质量',
          weight: 0.15,
          description: '去重处理、无效数据、数据转换'
        },
        fieldRichness: {
          name: '字段丰富度',
          weight: 0.15,
          description: '衍生字段、指标计算、维度丰富'
        }
      },
      excel: {
        structureQuality: {
          name: '结构质量',
          weight: 0.2,
          description: '工作表组织、数据区域清晰度、格式规范'
        },
        formulaQuality: {
          name: '公式质量',
          weight: 0.25,
          description: '公式正确性、可维护性、绝对引用使用'
        },
        dataQuality: {
          name: '数据质量',
          weight: 0.25,
          description: '数据完整性、格式一致性、数据有效性'
        },
        readability: {
          name: '可读性',
          weight: 0.15,
          description: '命名、注释、颜色使用、层次清晰'
        },
        professionalism: {
          name: '专业度',
          weight: 0.15,
          description: '整体专业度、细节处理'
        }
      }
    };

    return rubrics[gradingType] || rubrics.report;
  }

  // ==================== Excel 评阅 ====================

  /**
   * Excel文件评阅
   * @param {Object} fileInfo - 文件信息 { fileName, fileType, fileSize }
   * @param {Object} excelFeatures - DataParser.parseExcel() 返回的Excel特征数据
   * @param {Object} options - 评阅选项 { lessonContext?, rubric?, context? }
   * @returns {Promise<Object>} 结构化评阅结果
   */
  async gradeExcelFile(fileInfo, excelFeatures, options = {}) {
    try {
      if (!excelFeatures || excelFeatures.error) {
        return this._buildExcelErrorResult(excelFeatures?.error || 'Excel特征无效');
      }

      const prompt = this.buildExcelGradingPrompt(excelFeatures, options);
      const messages = [
        { role: 'system', content: this._getExcelSystemPrompt() },
        { role: 'user', content: prompt }
      ];

      const response = await this._callAI(messages, options);
      const result = this.parseExcelGradingResult(response);

      if (!result) {
        return this._fallbackExcelScore(excelFeatures, 'AI 返回结果解析失败，使用基础评分');
      }

      result.gradingType = 'excel';
      result.fileInfo = fileInfo;
      result.gradingTime = new Date().toISOString();

      return result;
    } catch (error) {
      console.warn('AI Excel评阅失败，使用基础评分:', error.message);
      return this._fallbackExcelScore(excelFeatures, error.message);
    }
  }

  /**
   * 带重试机制的Excel文件评阅
   * @param {Object} fileInfo - 文件信息
   * @param {Object} excelFeatures - Excel特征
   * @param {Object} options - 评阅选项
   * @returns {Promise<Object>} 结构化评阅结果
   */
  async gradeExcelFileWithRetry(fileInfo, excelFeatures, options = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.gradeExcelFile(fileInfo, excelFeatures, options);
        if (result && !result.error) {
          result.attempts = attempt + 1;
          return result;
        }
        lastError = result?.error || '未知错误';
      } catch (error) {
        lastError = error.message;
      }

      if (attempt < this.maxRetries) {
        await this._delay(1000 * (attempt + 1));
      }
    }

    return this._fallbackExcelScore(excelFeatures, `多次重试失败: ${lastError}`);
  }

  /**
   * 构建Excel评阅 Prompt
   * @param {Object} excelFeatures - Excel特征
   * @param {Object} options - 评阅选项
   * @returns {string} 完整的 Prompt
   */
  buildExcelGradingPrompt(excelFeatures, options = {}) {
    const parts = [];

    parts.push('【Excel文件特征摘要】');
    parts.push(this._buildExcelFeatureSummary(excelFeatures));

    parts.push('\n【评分维度说明】');
    parts.push(this._buildExcelRubricText(options.rubric));

    if (options.lessonContext) {
      parts.push('\n【课程上下文】');
      parts.push(options.lessonContext);
    }

    if (options.context) {
      parts.push('\n【补充说明】');
      parts.push(options.context);
    }

    parts.push('\n【输出格式要求】');
    parts.push(this._buildExcelOutputFormat());

    parts.push('\n【重要提示】');
    parts.push('1. 请严格按照 JSON 格式输出，不要添加任何额外的解释文字');
    parts.push('2. 评分要客观公正，基于Excel特征进行分析');
    parts.push('3. 问题和建议要具体可操作');
    parts.push('4. 亮点部分要突出Excel的优势和价值');

    return parts.join('\n');
  }

  /**
   * 基于Excel特征计算基础分（降级方案）
   * @param {Object} excelFeatures - Excel特征
   * @returns {Object} 基础评分结果
   */
  calculateExcelBaseScore(excelFeatures) {
    if (!excelFeatures || excelFeatures.error) {
      return this._buildExcelErrorResult(excelFeatures?.error || 'Excel特征无效');
    }

    const structureQualityScore = this._calcExcelStructureQualityScore(excelFeatures);
    const formulaQualityScore = this._calcExcelFormulaQualityScore(excelFeatures);
    const dataQualityScore = this._calcExcelDataQualityScore(excelFeatures);
    const readabilityScore = this._calcExcelReadabilityScore(excelFeatures);
    const professionalismScore = this._calcExcelProfessionalismScore(excelFeatures);

    const dimensionScores = {
      structureQuality: {
        score: structureQualityScore,
        label: GradingEngine.scoreToLabel(structureQualityScore),
        description: this._getStructureQualityDesc(structureQualityScore, excelFeatures)
      },
      formulaQuality: {
        score: formulaQualityScore,
        label: GradingEngine.scoreToLabel(formulaQualityScore),
        description: this._getFormulaQualityDesc(formulaQualityScore, excelFeatures)
      },
      dataQuality: {
        score: dataQualityScore,
        label: GradingEngine.scoreToLabel(dataQualityScore),
        description: this._getDataQualityDesc(dataQualityScore, excelFeatures)
      },
      readability: {
        score: readabilityScore,
        label: GradingEngine.scoreToLabel(readabilityScore),
        description: this._getReadabilityDesc(readabilityScore, excelFeatures)
      },
      professionalism: {
        score: professionalismScore,
        label: GradingEngine.scoreToLabel(professionalismScore),
        description: this._getProfessionalismDesc(professionalismScore, excelFeatures)
      }
    };

    const weights = {
      structureQuality: 0.2,
      formulaQuality: 0.25,
      dataQuality: 0.25,
      readability: 0.15,
      professionalism: 0.15
    };

    const overallScore = Math.round(
      structureQualityScore * weights.structureQuality +
      formulaQualityScore * weights.formulaQuality +
      dataQualityScore * weights.dataQuality +
      readabilityScore * weights.readability +
      professionalismScore * weights.professionalism
    );

    const highlights = this._generateExcelBaseHighlights(excelFeatures, dimensionScores);
    const issues = this._generateExcelBaseIssues(excelFeatures, dimensionScores);
    const suggestions = this._generateExcelBaseSuggestions(issues);
    const summary = this._generateExcelBaseSummary(overallScore, dimensionScores);

    return {
      gradingType: 'excel',
      overallScore,
      overallGrade: GradingEngine.scoreToGrade(overallScore),
      dimensionScores,
      highlights,
      issues,
      suggestions,
      summary,
      isBaseScore: true
    };
  }

  /**
   * 解析 AI 返回的Excel评阅结果
   * @param {string} text - AI 返回的文本
   * @returns {Object|null} 解析后的结果对象
   */
  parseExcelGradingResult(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    let jsonStr = text.trim();

    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const result = JSON.parse(jsonStr);
      return this._normalizeExcelResult(result);
    } catch (e) {
      console.warn('Excel评阅 JSON 解析失败，尝试修复:', e.message);

      const fixed = this._fixJson(jsonStr);
      if (fixed) {
        try {
          const result = JSON.parse(fixed);
          return this._normalizeExcelResult(result);
        } catch (e2) {
          console.warn('修复后仍解析失败:', e2.message);
        }
      }

      return null;
    }
  }

  // ==================== Excel评阅内部方法 ====================

  /**
   * 获取Excel评阅系统 Prompt
   */
  _getExcelSystemPrompt() {
    return `你是一位专业的Excel评阅专家，负责评估Excel文件的质量和专业程度。

你的职责：
1. 基于提供的Excel特征，从5个维度客观评估Excel文件质量
2. 给出具体的问题和可操作的改进建议
3. 评分要公正、合理、有依据
4. 严格按照指定的 JSON 格式输出结果

评阅原则：
- 客观公正：基于Excel事实，不主观臆断
- 具体明确：问题和建议要具体，避免空泛
- 建设性：以帮助改进为目的，而非批评
- 平衡视角：既要指出问题，也要肯定亮点`;
  }

  /**
   * 构建Excel特征摘要
   */
  _buildExcelFeatureSummary(excelFeatures) {
    const lines = [];
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const st = ef.structure || {};
    const fmt = ef.formatting || {};
    const ql = ef.quality || {};

    lines.push('## 基本信息');
    lines.push(`- 工作表数量：${bs.sheetCount || 1}`);
    lines.push(`- 工作表名称：${(bs.sheetNames || []).join(', ')}`);
    lines.push(`- 总行数：${bs.totalRows || 0}`);
    lines.push(`- 总列数：${bs.totalColumns || 0}`);
    lines.push(`- 总单元格数：${bs.totalCells || 0}`);

    lines.push('\n## 公式情况');
    lines.push(`- 公式总数：${bs.totalFormulas || 0}`);
    if (st.formulaComplexity) {
      lines.push(`- 公式平均复杂度：${(st.formulaComplexity.avgComplexity || 0).toFixed(2)}`);
    }

    const firstSheet = (bs.sheetNames && bs.sheetNames.length > 0) ? bs.sheetNames[0] : null;
    if (firstSheet && fmt && fmt[firstSheet]) {
      const sheetFmt = fmt[firstSheet];
      lines.push('\n## 格式情况（首个工作表）');
      lines.push(`- 粗体单元格：${sheetFmt.boldCells || 0}`);
      lines.push(`- 斜体单元格：${sheetFmt.italicCells || 0}`);
      lines.push(`- 颜色单元格：${sheetFmt.coloredCells || 0}`);
      lines.push(`- 日期格式单元格：${sheetFmt.dateFormatCells || 0}`);
      lines.push(`- 数字格式单元格：${sheetFmt.numberFormatCells || 0}`);
      lines.push(`- 货币格式单元格：${sheetFmt.currencyFormatCells || 0}`);
      lines.push(`- 百分比格式单元格：${sheetFmt.percentFormatCells || 0}`);
      lines.push(`- 合并单元格：${sheetFmt.mergedCells || 0} 处`);
    }

    lines.push('\n## 质量指标');
    lines.push(`- 结构得分：${ql.structureScore || 0}/100`);
    lines.push(`- 命名得分：${ql.namingScore || 0}/100`);

    if (excelFeatures.headers && excelFeatures.headers.length > 0) {
      lines.push('\n## 数据列（首个工作表）');
      lines.push(`- 列名：${excelFeatures.headers.join(', ')}`);
      lines.push(`- 数据行数：${(excelFeatures.rows || []).length}`);
    }

    return lines.join('\n');
  }

  /**
   * 构建Excel评分标准文本
   */
  _buildExcelRubricText(customRubric) {
    if (customRubric && typeof customRubric === 'object') {
      return JSON.stringify(customRubric, null, 2);
    }

    return `### 1. 结构质量 (structureQuality) - 权重 20%
- 工作表组织：工作表命名是否清晰、分类是否合理
- 数据区域清晰度：数据区域是否明确、是否有标题行
- 格式规范：单元格格式是否规范、是否有合并单元格等问题
- 评分标准：A级(90+)结构清晰规范；B级(80+)结构基本合理；C级(60+)有基本结构；D级(<60)结构混乱

### 2. 公式质量 (formulaQuality) - 权重 25%
- 公式正确性：公式逻辑是否正确、是否有错误
- 可维护性：公式是否清晰易读、是否有注释
- 绝对引用使用：是否合理使用绝对引用($)、是否便于复制
- 评分标准：A级(90+)公式规范高效；B级(80+)公式基本正确；C级(60+)有基本公式；D级(<60)公式错误或缺失

### 3. 数据质量 (dataQuality) - 权重 25%
- 数据完整性：缺失值比例、空值处理
- 格式一致性：同一列数据格式是否一致
- 数据有效性：数据是否合理、是否有异常值
- 评分标准：A级(90+)数据质量优秀；B级(80+)数据质量良好；C级(60+)数据基本可用；D级(<60)数据质量较差

### 4. 可读性 (readability) - 权重 15%
- 命名规范：工作表、单元格命名是否规范易懂
- 注释说明：是否有必要的注释和说明
- 颜色使用：颜色使用是否合理、是否有助于理解
- 层次清晰：信息层次是否分明、重点是否突出
- 评分标准：A级(90+)可读性优秀；B级(80+)可读性良好；C级(60+)可读性一般；D级(<60)可读性较差

### 5. 专业度 (professionalism) - 权重 15%
- 整体专业度：整体呈现是否专业、美观
- 细节处理：细节处理是否到位、是否有错误
- 评分标准：A级(90+)非常专业；B级(80+)较为专业；C级(60+)基本专业；D级(<60)专业度不足`;
  }

  /**
   * 构建Excel输出格式要求
   */
  _buildExcelOutputFormat() {
    return `请严格按照以下 JSON 格式输出评阅结果：

\`\`\`json
{
  "overallScore": 85,
  "overallGrade": "B",
  "dimensionScores": {
    "structureQuality": {
      "score": 85,
      "label": "良好",
      "description": "结构质量良好，工作表组织清晰，数据区域明确"
    },
    "formulaQuality": {
      "score": 80,
      "label": "良好",
      "description": "公式基本正确，可维护性较好，部分公式可优化"
    },
    "dataQuality": {
      "score": 88,
      "label": "良好",
      "description": "数据质量良好，完整性高，格式基本一致"
    },
    "readability": {
      "score": 75,
      "label": "中等",
      "description": "可读性中等，命名基本规范，可增加注释说明"
    },
    "professionalism": {
      "score": 82,
      "label": "良好",
      "description": "专业度良好，整体呈现较为专业"
    }
  },
  "highlights": [
    {
      "title": "数据结构清晰",
      "description": "工作表组织合理，数据区域明确，便于理解和使用"
    }
  ],
  "issues": [
    {
      "severity": "high",
      "title": "部分公式缺少绝对引用",
      "description": "部分公式未使用绝对引用，复制时可能出错",
      "sheet": "Sheet1",
      "suggestion": "建议对需要固定引用的单元格使用$符号进行绝对引用"
    },
    {
      "severity": "medium",
      "title": "缺少注释说明",
      "description": "复杂公式没有注释，不利于理解和维护",
      "sheet": "Sheet1",
      "suggestion": "建议为复杂公式添加注释，说明公式用途和逻辑"
    },
    {
      "severity": "low",
      "title": "格式可进一步优化",
      "description": "部分单元格格式不够统一，影响整体美观",
      "sheet": "Sheet1",
      "suggestion": "建议统一数据格式，增强整体专业性"
    }
  ],
  "suggestions": [
    {
      "priority": "high",
      "title": "优化公式引用",
      "description": "检查并修正公式中的引用方式，确保复制正确性"
    },
    {
      "priority": "medium",
      "title": "增加注释说明",
      "description": "为复杂公式和重要数据添加注释说明"
    },
    {
      "priority": "low",
      "title": "统一格式规范",
      "description": "统一单元格格式，提升整体专业度"
    }
  ],
  "summary": "整体Excel文件质量良好，综合得分85分，等级为B。结构质量和数据质量表现较好，公式质量和可读性还有提升空间。建议优先优化公式引用方式，增加注释说明，并统一格式规范。"
}
\`\`\`

注意：
- overallScore 为 0-100 的整数
- overallGrade 为 A/B/C/D 之一（90+为A，75-89为B，60-74为C，<60为D）
- label 可以是：优秀/良好/中等/及格/待提升
- severity 为 high/medium/low
- priority 为 high/medium/low
- 至少提供 2 个亮点，3 个问题，3 条建议
- summary 控制在 100-200 字之间`;
  }

  /**
   * Excel降级评分
   */
  _fallbackExcelScore(excelFeatures, errorMessage) {
    const baseResult = this.calculateExcelBaseScore(excelFeatures);
    baseResult.error = errorMessage;
    baseResult.isFallback = true;
    baseResult.fallbackReason = errorMessage;
    return baseResult;
  }

  /**
   * 构建Excel错误结果
   */
  _buildExcelErrorResult(message) {
    return {
      gradingType: 'excel',
      overallScore: 0,
      overallGrade: 'D',
      dimensionScores: {
        structureQuality: { score: 0, label: '待提升', description: 'Excel文件无效' },
        formulaQuality: { score: 0, label: '待提升', description: 'Excel文件无效' },
        dataQuality: { score: 0, label: '待提升', description: 'Excel文件无效' },
        readability: { score: 0, label: '待提升', description: 'Excel文件无效' },
        professionalism: { score: 0, label: '待提升', description: 'Excel文件无效' }
      },
      highlights: [],
      issues: [{
        severity: 'high',
        title: 'Excel解析失败',
        description: message,
        suggestion: '请检查Excel文件格式是否正确'
      }],
      suggestions: [{
        priority: 'high',
        title: '检查Excel文件',
        description: '请确保上传的Excel文件格式正确且包含有效数据'
      }],
      summary: `Excel评阅失败：${message}`,
      error: message
    };
  }

  // ==================== Excel基础评分计算 ====================

  _calcExcelStructureQualityScore(excelFeatures) {
    let score = 50;
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const ql = ef.quality || {};
    const fmt = ef.formatting || {};

    if (ql.structureScore !== undefined) {
      score = ql.structureScore;
    } else {
      const sheetCount = bs.sheetCount || 1;
      if (sheetCount >= 5) score += 25;
      else if (sheetCount >= 3) score += 20;
      else if (sheetCount >= 2) score += 15;
      else if (sheetCount >= 1) score += 10;
    }

    const firstSheet = (bs.sheetNames && bs.sheetNames.length > 0) ? bs.sheetNames[0] : null;
    if (firstSheet && fmt && fmt[firstSheet]) {
      const sheetFmt = fmt[firstSheet];
      if (sheetFmt.boldCells > 0) score += 5;
      if (sheetFmt.mergedCells > 0) score -= 10;
    }

    if (excelFeatures.headers && excelFeatures.headers.length > 0) {
      score += 15;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcExcelFormulaQualityScore(excelFeatures) {
    let score = 50;
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const st = ef.structure || {};

    const formulaCount = bs.totalFormulas || 0;
    if (formulaCount === 0) {
      return 40;
    }

    score += 20;

    if (formulaCount >= 20) score += 15;
    else if (formulaCount >= 10) score += 10;
    else if (formulaCount >= 5) score += 5;

    const fc = st.formulaComplexity || {};
    const avgComplexity = fc.avgComplexity || 0;
    if (avgComplexity >= 3) score += 10;
    else if (avgComplexity >= 2) score += 8;
    else if (avgComplexity >= 1.5) score += 5;

    let absoluteRefCount = 0;
    if (excelFeatures.formulas) {
      for (const sheetFormulas of Object.values(excelFeatures.formulas)) {
        if (Array.isArray(sheetFormulas)) {
          for (const f of sheetFormulas) {
            if (f.formula && f.formula.includes('$')) {
              absoluteRefCount++;
            }
          }
        }
      }
    }
    if (formulaCount > 0) {
      const absoluteRefRate = absoluteRefCount / formulaCount;
      if (absoluteRefRate >= 0.5) score += 10;
      else if (absoluteRefRate >= 0.3) score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcExcelDataQualityScore(excelFeatures) {
    let score = 70;
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const ql = ef.quality || {};

    const rowCount = bs.totalRows || 0;
    const colCount = bs.totalColumns || 0;

    if (rowCount >= 1000) score += 10;
    else if (rowCount >= 100) score += 8;
    else if (rowCount >= 10) score += 5;

    if (colCount >= 10) score += 5;
    else if (colCount >= 5) score += 3;

    if (ql.namingScore !== undefined) {
      score = score * 0.7 + ql.namingScore * 0.3;
    }

    const fmt = ef.formatting || {};
    const firstSheet = (bs.sheetNames && bs.sheetNames.length > 0) ? bs.sheetNames[0] : null;
    if (firstSheet && fmt && fmt[firstSheet]) {
      const sheetFmt = fmt[firstSheet];
      const formattedCells = (sheetFmt.dateFormatCells || 0) + (sheetFmt.numberFormatCells || 0) + 
                             (sheetFmt.currencyFormatCells || 0) + (sheetFmt.percentFormatCells || 0);
      if (formattedCells > 0) score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcExcelReadabilityScore(excelFeatures) {
    let score = 55;
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const ql = ef.quality || {};
    const fmt = ef.formatting || {};

    if (ql.namingScore !== undefined) {
      score = ql.namingScore * 0.6 + score * 0.4;
    }

    const sheetNames = bs.sheetNames || [];
    const defaultNames = sheetNames.filter(n => /^Sheet\d+$/i.test(n)).length;
    if (defaultNames === 0 && sheetNames.length > 0) {
      score += 10;
    } else if (sheetNames.length > 0) {
      score -= defaultNames * 5;
    }

    const firstSheet = sheetNames.length > 0 ? sheetNames[0] : null;
    if (firstSheet && fmt && fmt[firstSheet]) {
      const sheetFmt = fmt[firstSheet];
      if (sheetFmt.boldCells > 0) score += 5;
      if (sheetFmt.coloredCells > 0) score += 3;
    }

    if (excelFeatures.headers && excelFeatures.headers.length > 0) {
      const hasChineseHeaders = excelFeatures.headers.some(h => /[\u4e00-\u9fa5]/.test(h));
      const hasEnglishHeaders = excelFeatures.headers.some(h => /[a-zA-Z]/.test(h));
      if (hasChineseHeaders || hasEnglishHeaders) score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _calcExcelProfessionalismScore(excelFeatures) {
    let score = 55;
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const fmt = ef.formatting || {};

    const sheetCount = bs.sheetCount || 1;
    if (sheetCount >= 5) score += 10;
    else if (sheetCount >= 3) score += 8;
    else if (sheetCount >= 2) score += 5;

    const formulaCount = bs.totalFormulas || 0;
    if (formulaCount >= 20) score += 10;
    else if (formulaCount >= 10) score += 8;
    else if (formulaCount >= 5) score += 5;
    else if (formulaCount > 0) score += 3;

    const firstSheet = (bs.sheetNames && bs.sheetNames.length > 0) ? bs.sheetNames[0] : null;
    if (firstSheet && fmt && fmt[firstSheet]) {
      const sheetFmt = fmt[firstSheet];
      const formatTypes = [
        sheetFmt.dateFormatCells > 0,
        sheetFmt.currencyFormatCells > 0,
        sheetFmt.percentFormatCells > 0,
        sheetFmt.boldCells > 0
      ].filter(Boolean).length;
      score += formatTypes * 3;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ==================== Excel基础评分描述生成 ====================

  _getStructureQualityDesc(score, excelFeatures) {
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const sheetCount = bs.sheetCount || 1;

    if (score >= 90) {
      return `结构质量优秀，共 ${sheetCount} 个工作表，组织清晰，数据区域明确`;
    } else if (score >= 70) {
      return `结构质量良好，共 ${sheetCount} 个工作表，结构基本合理`;
    } else if (score >= 60) {
      return `结构质量一般，共 ${sheetCount} 个工作表，部分结构有待优化`;
    } else {
      return `结构质量较差，工作表组织不够清晰，建议优化结构`;
    }
  }

  _getFormulaQualityDesc(score, excelFeatures) {
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const formulaCount = bs.totalFormulas || 0;

    if (score >= 90) {
      return `公式质量优秀，共 ${formulaCount} 个公式，逻辑清晰，引用规范`;
    } else if (score >= 70) {
      return `公式质量良好，共 ${formulaCount} 个公式，基本正确可用`;
    } else if (score >= 60) {
      return `公式质量一般，共 ${formulaCount} 个公式，部分可优化`;
    } else {
      return formulaCount === 0 
        ? '公式质量不足，未检测到公式，建议增加计算逻辑'
        : `公式质量较差，共 ${formulaCount} 个公式，需要优化`;
    }
  }

  _getDataQualityDesc(score, excelFeatures) {
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const rowCount = bs.totalRows || 0;
    const colCount = bs.totalColumns || 0;

    if (score >= 90) {
      return `数据质量优秀，共 ${rowCount} 行 ${colCount} 列，数据完整规范`;
    } else if (score >= 70) {
      return `数据质量良好，共 ${rowCount} 行 ${colCount} 列，数据基本完整`;
    } else if (score >= 60) {
      return `数据质量一般，共 ${rowCount} 行 ${colCount} 列，部分数据需优化`;
    } else {
      return `数据质量较差，共 ${rowCount} 行 ${colCount} 列，建议检查数据质量`;
    }
  }

  _getReadabilityDesc(score, excelFeatures) {
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const ql = ef.quality || {};

    if (score >= 90) {
      return '可读性优秀，命名规范，层次清晰，易于理解和维护';
    } else if (score >= 70) {
      return '可读性良好，命名基本规范，整体较为清晰';
    } else if (score >= 60) {
      return '可读性一般，命名和格式有待优化';
    } else {
      return '可读性较差，建议优化命名和格式，增加注释说明';
    }
  }

  _getProfessionalismDesc(score, excelFeatures) {
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};

    if (score >= 90) {
      return '专业度优秀，整体呈现专业美观，细节处理到位';
    } else if (score >= 70) {
      return '专业度良好，整体呈现较为专业';
    } else if (score >= 60) {
      return '专业度一般，部分细节可进一步优化';
    } else {
      return '专业度不足，建议提升整体呈现质量和细节处理';
    }
  }

  // ==================== Excel基础评分亮点/问题/建议生成 ====================

  _generateExcelBaseHighlights(excelFeatures, dimensionScores) {
    const highlights = [];
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};

    if (dimensionScores.structureQuality.score >= 80) {
      highlights.push({
        title: '结构清晰合理',
        description: `共 ${bs.sheetCount || 1} 个工作表，组织清晰，数据区域明确`
      });
    }

    if (dimensionScores.formulaQuality.score >= 80 && (bs.totalFormulas || 0) > 0) {
      highlights.push({
        title: '公式质量良好',
        description: `共 ${bs.totalFormulas} 个公式，逻辑清晰，引用规范`
      });
    }

    if (dimensionScores.dataQuality.score >= 80) {
      highlights.push({
        title: '数据质量优秀',
        description: `共 ${bs.totalRows || 0} 行 ${bs.totalColumns || 0} 列数据，质量良好`
      });
    }

    if (dimensionScores.readability.score >= 80) {
      highlights.push({
        title: '可读性强',
        description: '命名规范，层次清晰，易于理解和维护'
      });
    }

    if (dimensionScores.professionalism.score >= 80) {
      highlights.push({
        title: '专业度高',
        description: '整体呈现专业美观，细节处理到位'
      });
    }

    if ((bs.totalFormulas || 0) >= 10) {
      highlights.push({
        title: '公式应用丰富',
        description: `文件中包含 ${bs.totalFormulas} 个公式，自动化程度较高`
      });
    }

    if ((bs.sheetCount || 1) >= 3) {
      highlights.push({
        title: '工作表组织完善',
        description: `共 ${bs.sheetCount} 个工作表，分类清晰合理`
      });
    }

    if (highlights.length < 2) {
      highlights.push({
        title: 'Excel结构完整',
        description: 'Excel文件具备基本结构，有一定的数据内容'
      });
    }

    return highlights.slice(0, 5);
  }

  _generateExcelBaseIssues(excelFeatures, dimensionScores) {
    const issues = [];
    const ef = excelFeatures.excelFeatures || excelFeatures;
    const bs = ef.basicStats || {};
    const fmt = ef.formatting || {};

    if ((bs.totalFormulas || 0) === 0) {
      issues.push({
        severity: 'high',
        title: '缺少计算公式',
        description: '文件中未检测到公式，缺乏自动化计算能力',
        sheet: bs.sheetNames?.[0] || '',
        suggestion: '建议根据业务需求添加必要的计算公式，提高自动化程度'
      });
    }

    let absoluteRefCount = 0;
    let totalFormulaCount = 0;
    if (excelFeatures.formulas) {
      for (const sheetFormulas of Object.values(excelFeatures.formulas)) {
        if (Array.isArray(sheetFormulas)) {
          for (const f of sheetFormulas) {
            totalFormulaCount++;
            if (f.formula && f.formula.includes('$')) {
              absoluteRefCount++;
            }
          }
        }
      }
    }
    if (totalFormulaCount > 0 && absoluteRefCount / totalFormulaCount < 0.3) {
      issues.push({
        severity: 'medium',
        title: '绝对引用使用不足',
        description: `仅 ${absoluteRefCount}/${totalFormulaCount} 个公式使用了绝对引用，复制时可能出错`,
        sheet: bs.sheetNames?.[0] || '',
        suggestion: '建议对需要固定引用的单元格使用$符号进行绝对引用'
      });
    }

    if (dimensionScores.structureQuality.score < 65) {
      issues.push({
        severity: 'medium',
        title: '结构质量有待提升',
        description: '工作表组织和数据区域清晰度有待改进',
        sheet: bs.sheetNames?.[0] || '',
        suggestion: '建议优化工作表命名，明确数据区域，减少合并单元格'
      });
    }

    if (dimensionScores.readability.score < 65) {
      issues.push({
        severity: 'medium',
        title: '可读性待提升',
        description: '命名规范和格式清晰度有待改进',
        sheet: bs.sheetNames?.[0] || '',
        suggestion: '建议优化工作表和列的命名，添加必要的注释说明'
      });
    }

    const firstSheet = (bs.sheetNames && bs.sheetNames.length > 0) ? bs.sheetNames[0] : null;
    if (firstSheet && fmt && fmt[firstSheet] && fmt[firstSheet].mergedCells > 0) {
      issues.push({
        severity: 'low',
        title: '存在合并单元格',
        description: `检测到 ${fmt[firstSheet].mergedCells} 处合并单元格，可能影响数据处理`,
        sheet: firstSheet,
        suggestion: '建议尽量减少合并单元格，保持数据结构的规范性'
      });
    }

    const defaultSheetNames = (bs.sheetNames || []).filter(n => /^Sheet\d+$/i.test(n));
    if (defaultSheetNames.length > 0) {
      issues.push({
        severity: 'low',
        title: '工作表命名不规范',
        description: `${defaultSheetNames.length} 个工作表使用默认命名（Sheet1等）`,
        sheet: defaultSheetNames.join(', '),
        suggestion: '建议为每个工作表设置有意义的名称，便于理解和维护'
      });
    }

    if (dimensionScores.professionalism.score < 70) {
      issues.push({
        severity: 'low',
        title: '专业度可提升',
        description: '整体专业度和细节处理有待改进',
        sheet: bs.sheetNames?.[0] || '',
        suggestion: '建议优化格式设置，统一风格，提升整体专业度'
      });
    }

    if (issues.length < 3) {
      issues.push({
        severity: 'low',
        title: '可进一步优化',
        description: 'Excel整体质量良好，但仍有提升空间',
        suggestion: '持续优化Excel质量，提升各维度表现'
      });
    }

    return issues.slice(0, 8);
  }

  _generateExcelBaseSuggestions(issues) {
    const suggestions = [];
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    const lowIssues = issues.filter(i => i.severity === 'low');

    highIssues.forEach(issue => {
      suggestions.push({
        priority: 'high',
        title: issue.title,
        description: issue.suggestion || `建议优先处理：${issue.title}`
      });
    });

    mediumIssues.forEach(issue => {
      suggestions.push({
        priority: 'medium',
        title: issue.title,
        description: issue.suggestion || `建议处理：${issue.title}`
      });
    });

    lowIssues.forEach(issue => {
      suggestions.push({
        priority: 'low',
        title: issue.title,
        description: issue.suggestion || `可选优化：${issue.title}`
      });
    });

    if (suggestions.length < 3) {
      suggestions.push({
        priority: 'low',
        title: '持续优化Excel质量',
        description: '持续改进Excel各维度质量，提升整体水平'
      });
    }

    return suggestions.slice(0, 6);
  }

  _generateExcelBaseSummary(overallScore, dimensionScores) {
    const dims = dimensionScores;

    const strengths = [];
    const weaknesses = [];

    if (dims.structureQuality.score >= 80) strengths.push('结构质量');
    else weaknesses.push('结构质量');

    if (dims.formulaQuality.score >= 80) strengths.push('公式质量');
    else weaknesses.push('公式质量');

    if (dims.dataQuality.score >= 80) strengths.push('数据质量');
    else weaknesses.push('数据质量');

    if (dims.readability.score >= 80) strengths.push('可读性');
    else weaknesses.push('可读性');

    if (dims.professionalism.score >= 80) strengths.push('专业度');
    else weaknesses.push('专业度');

    let summary = `综合评阅得分 ${overallScore} 分，等级为 ${GradingEngine.scoreToGrade(overallScore)}。`;

    if (strengths.length > 0) {
      summary += `在${strengths.join('、')}方面表现较好。`;
    }

    if (weaknesses.length > 0) {
      summary += `${weaknesses.slice(0, 3).join('、')}方面仍有提升空间。`;
    }

    summary += '建议根据问题优先级逐步优化Excel质量。';

    return summary;
  }

  // ==================== Excel结果规范化 ====================

  _normalizeExcelResult(result) {
    if (!result || typeof result !== 'object') return null;

    const overallScore = Math.max(0, Math.min(100, parseInt(result.overallScore) || 0));
    const overallGrade = result.overallGrade || GradingEngine.scoreToGrade(overallScore);

    const normalized = {
      gradingType: 'excel',
      overallScore,
      overallGrade,
      dimensionScores: this._normalizeExcelDimensionScores(result.dimensionScores),
      highlights: Array.isArray(result.highlights) ? result.highlights.filter(h => h && h.title).map(h => ({
        title: String(h.title || ''),
        description: String(h.description || '')
      })) : [],
      issues: Array.isArray(result.issues) ? result.issues.filter(i => i && i.title).map(i => ({
        severity: ['high', 'medium', 'low'].includes(i.severity) ? i.severity : 'medium',
        title: String(i.title || ''),
        description: String(i.description || ''),
        sheet: i.sheet || undefined,
        suggestion: String(i.suggestion || '')
      })) : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter(s => s && s.title).map(s => ({
        priority: ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium',
        title: String(s.title || ''),
        description: String(s.description || '')
      })) : [],
      summary: String(result.summary || '')
    };

    if (normalized.highlights.length === 0) {
      normalized.highlights.push({ title: 'Excel结构完整', description: 'Excel具备基本的结构和数据内容' });
    }

    if (normalized.issues.length === 0) {
      normalized.issues.push({
        severity: 'low',
        title: '可进一步优化',
        description: 'Excel质量良好，仍有优化空间',
        suggestion: '持续关注Excel质量，定期检查'
      });
    }

    if (normalized.suggestions.length === 0) {
      normalized.suggestions.push({
        priority: 'low',
        title: '持续优化',
        description: '建立Excel质量规范，持续改进'
      });
    }

    if (!normalized.summary) {
      normalized.summary = `综合得分 ${normalized.overallScore} 分，等级 ${normalized.overallGrade}。`;
    }

    return normalized;
  }

  _normalizeExcelDimensionScores(dimensionScores) {
    const dimensions = ['structureQuality', 'formulaQuality', 'dataQuality', 'readability', 'professionalism'];
    const defaultLabels = {
      structureQuality: '结构质量',
      formulaQuality: '公式质量',
      dataQuality: '数据质量',
      readability: '可读性',
      professionalism: '专业度'
    };

    const normalized = {};

    dimensions.forEach(dim => {
      const score = dimensionScores?.[dim]?.score;
      const numScore = Math.max(0, Math.min(100, parseInt(score) || 0));

      normalized[dim] = {
        score: numScore,
        label: dimensionScores?.[dim]?.label || GradingEngine.scoreToLabel(numScore),
        description: dimensionScores?.[dim]?.description || `${defaultLabels[dim]}得分 ${numScore} 分`
      };
    });

    return normalized;
  }
}

if (typeof window !== 'undefined') {
  window.GradingEngine = GradingEngine;
}
