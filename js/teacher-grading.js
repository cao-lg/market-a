/**
 * 教师端评阅管理模块
 * 提供学生评阅记录加载、渲染、教师评分调整、导出等功能
 */

class TeacherGradingManager {
  /**
   * 构造函数
   */
  constructor() {
    this.gradings = [];
    this.currentStudentId = null;
    this._gradingCache = {};
  }

  /**
   * 加载学生的所有评阅记录
   * @param {string} studentId - 学生ID
   * @returns {Promise<Array>} 评阅记录列表
   */
  async loadStudentGradings(studentId) {
    try {
      if (!studentId) {
        throw new Error('学生ID不能为空');
      }

      this.currentStudentId = studentId;

      if (this._gradingCache[studentId]) {
        this.gradings = this._gradingCache[studentId];
        return this.gradings;
      }

      const hasDB = window.DB && window.DB.grading;
      if (!hasDB) {
        console.warn('DB.grading 不可用，使用模拟数据');
        this.gradings = this._generateMockGradings(studentId);
        this._gradingCache[studentId] = this.gradings;
        return this.gradings;
      }

      await window.DB.init();

      const submissions = await this._getStudentSubmissions(studentId);
      const allGradings = [];

      for (const submission of submissions) {
        try {
          const gradingResults = await window.DB.grading.getBySubmission(submission.id);
          if (gradingResults && gradingResults.length > 0) {
            gradingResults.forEach(g => {
              allGradings.push({
                ...g,
                submissionData: submission
              });
            });
          }
        } catch (e) {
          console.warn('获取评阅结果失败:', submission.id, e);
        }
      }

      allGradings.sort((a, b) => new Date(b.gradedAt) - new Date(a.gradedAt));

      this.gradings = allGradings;
      this._gradingCache[studentId] = allGradings;

      return allGradings;
    } catch (e) {
      console.error('加载学生评阅记录失败:', e);
      this.gradings = [];
      return [];
    }
  }

  /**
   * 获取学生的所有提交记录
   * @param {string} studentId - 学生ID
   * @returns {Promise<Array>} 提交记录列表
   */
  async _getStudentSubmissions(studentId) {
    try {
      const allSubmissions = await window.DB.submissions.getAll();
      return allSubmissions.filter(s => s.studentId === studentId);
    } catch (e) {
      console.warn('获取学生提交记录失败:', e);
      return [];
    }
  }

  /**
   * 生成模拟评阅数据（用于演示）
   * @param {string} studentId - 学生ID
   * @returns {Array} 模拟评阅数据
   */
  _generateMockGradings(studentId) {
    const lessonNames = [
      '第1阶段第1课：数据分析基础',
      '第1阶段第3课：数据清洗实战',
      '第2阶段第2课：可视化图表',
      '第2阶段第5课：用户行为分析',
      '第3阶段第1课：转化漏斗分析',
      '第3阶段第4课：GMV诊断报告'
    ];

    const gradingTypes = ['data', 'report', 'analysis', 'exercise'];
    const grades = ['A', 'B', 'C', 'D'];

    const gradings = [];
    for (let i = 0; i < 6; i++) {
      const score = 60 + Math.floor(Math.random() * 40);
      const gradeIndex = score >= 90 ? 0 : score >= 80 ? 1 : score >= 70 ? 2 : 3;

      gradings.push({
        id: `mock-grading-${i + 1}`,
        studentId: studentId,
        submissionId: `mock-sub-${i + 1}`,
        gradingType: gradingTypes[i % gradingTypes.length],
        overallScore: score,
        overallGrade: grades[gradeIndex],
        aiScore: score,
        teacherScore: null,
        teacherComment: '',
        reviewed: false,
        dimensionScores: {
          completeness: { score: 70 + Math.floor(Math.random() * 30), label: '完整性', description: '数据完整度评价' },
          standardization: { score: 65 + Math.floor(Math.random() * 35), label: '规范性', description: '数据规范程度' },
          accuracy: { score: 60 + Math.floor(Math.random() * 40), label: '准确性', description: '数据准确程度' },
          processingQuality: { score: 70 + Math.floor(Math.random() * 30), label: '处理质量', description: '数据处理质量' },
          fieldRichness: { score: 65 + Math.floor(Math.random() * 35), label: '字段丰富度', description: '字段丰富程度' }
        },
        highlights: [
          '数据结构清晰，字段命名规范',
          '关键指标计算准确',
          '可视化效果良好'
        ],
        issues: [
          '部分数据存在缺失值',
          '数据类型转换可以优化'
        ],
        suggestions: [
          '建议补充缺失数据',
          '可以增加更多维度的分析'
        ],
        summary: '整体完成度较好，数据质量良好，建议在数据完整性和分析深度上继续提升。',
        gradingEngine: 'mock',
        gradedAt: Date.now() - (i * 86400000 + Math.random() * 43200000),
        status: 'completed',
        lessonName: lessonNames[i]
      });
    }

    return gradings.sort((a, b) => b.gradedAt - a.gradedAt);
  }

  /**
   * 获取评阅统计概览
   * @param {string} studentId - 学生ID
   * @returns {Object} 统计数据
   */
  getGradingStats(studentId = null) {
    const gradings = studentId ? (this._gradingCache[studentId] || []) : this.gradings;

    if (gradings.length === 0) {
      return {
        totalCount: 0,
        avgScore: 0,
        maxScore: 0,
        minScore: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0 },
        reviewedCount: 0,
        trend: 'stable'
      };
    }

    const scores = gradings.map(g => g.teacherScore || g.overallScore || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0 };
    gradings.forEach(g => {
      const grade = g.overallGrade || this._scoreToGrade(g.teacherScore || g.overallScore);
      if (gradeDistribution[grade] !== undefined) {
        gradeDistribution[grade]++;
      }
    });

    const reviewedCount = gradings.filter(g => g.reviewed || g.teacherScore !== null).length;

    let trend = 'stable';
    if (scores.length >= 2) {
      const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
      const secondHalf = scores.slice(Math.ceil(scores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (secondAvg - firstAvg > 5) trend = 'up';
      else if (firstAvg - secondAvg > 5) trend = 'down';
    }

    return {
      totalCount: gradings.length,
      avgScore: Math.round(avgScore * 10) / 10,
      maxScore: Math.round(maxScore),
      minScore: Math.round(minScore),
      gradeDistribution,
      reviewedCount,
      trend
    };
  }

  /**
   * 分数转等级
   * @param {number} score - 分数
   * @returns {string} 等级 A/B/C/D
   */
  _scoreToGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    return 'D';
  }

  /**
   * 渲染评阅列表
   * @param {HTMLElement|string} container - 容器元素或选择器
   * @param {Array} gradings - 评阅记录列表
   */
  renderGradingList(container, gradings) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) {
      console.error('Grading list container not found');
      return;
    }

    if (!gradings || gradings.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">暂无评阅记录</div>
          <div class="empty-state-desc">该学生暂无文件评阅记录</div>
        </div>
      `;
      return;
    }

    let html = '<div class="grading-list space-y-3">';

    gradings.forEach((grading, index) => {
      const finalScore = grading.teacherScore || grading.overallScore;
      const finalGrade = this._scoreToGrade(finalScore);
      const gradeClass = `grade-${finalGrade.toLowerCase()}`;
      const typeLabel = this._getGradingTypeLabel(grading.gradingType);
      const hasTeacherReview = grading.teacherScore !== null || grading.reviewed;

      html += `
        <div class="grading-item" data-grading-id="${grading.id}" style="
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--space-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        " onmouseover="this.style.borderColor='var(--accent-primary)'" onmouseout="this.style.borderColor='var(--border-color)'">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-2">
                <h4 class="font-medium text-sm truncate" style="color: var(--text-primary);">
                  ${grading.lessonName || grading.submissionData?.lessonId || '未知课时'}
                </h4>
                <span class="badge ${gradeClass}" style="
                  font-size: 0.65rem;
                  padding: 2px 8px;
                  border-radius: var(--radius-full);
                  font-weight: 600;
                ">${finalGrade}</span>
                ${hasTeacherReview ? '<span class="badge badge-success" style="font-size: 0.65rem; padding: 2px 8px;">已审核</span>' : ''}
              </div>
              <div class="flex items-center gap-4 text-xs" style="color: var(--text-tertiary);">
                <span>类型：${typeLabel}</span>
                <span>${new Date(grading.gradedAt).toLocaleDateString('zh-CN')}</span>
                ${grading.teacherScore !== null ? `<span style="color: var(--accent-teal);">教师评分</span>` : ''}
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-2xl font-bold font-display" style="color: var(--accent-primary);">
                ${finalScore}
                <span class="text-sm font-normal" style="color: var(--text-tertiary);">分</span>
              </div>
              ${grading.teacherScore !== null && grading.aiScore !== grading.teacherScore ? `
                <div class="text-xs mt-1" style="color: var(--text-tertiary);">
                  AI: ${grading.aiScore} → 教师: ${grading.teacherScore}
                </div>
              ` : ''}
            </div>
          </div>
          <div class="grading-detail hidden mt-4 pt-4" style="border-top: 1px solid var(--border-color);">
          </div>
        </div>
      `;
    });

    html += '</div>';
    el.innerHTML = html;

    const items = el.querySelectorAll('.grading-item');
    items.forEach((item, index) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.toggleGradingDetail(item, gradings[index]);
      });
    });
  }

  /**
   * 切换评阅详情展开/收起
   * @param {HTMLElement} item - 列表项元素
   * @param {Object} grading - 评阅数据
   */
  toggleGradingDetail(item, grading) {
    const detailEl = item.querySelector('.grading-detail');
    if (detailEl.classList.contains('hidden')) {
      detailEl.classList.remove('hidden');
      this._renderGradingDetail(detailEl, grading);
    } else {
      detailEl.classList.add('hidden');
    }
  }

  /**
   * 渲染评阅详情
   * @param {HTMLElement} container - 容器
   * @param {Object} grading - 评阅数据
   */
  _renderGradingDetail(container, grading) {
    const finalScore = grading.teacherScore || grading.overallScore;
    const dimensions = grading.dimensionScores || {};

    let dimensionsHtml = '';
    Object.values(dimensions).forEach((dim, i) => {
      if (!dim || typeof dim !== 'object') return;
      const score = dim.score || 0;
      const scoreLevel = score >= 85 ? 'high' : score >= 70 ? 'medium' : 'low';
      dimensionsHtml += `
        <div style="margin-bottom: 8px;">
          <div class="flex justify-between text-xs mb-1">
            <span style="color: var(--text-secondary);">${dim.label || `维度${i + 1}`}</span>
            <span style="color: var(--text-primary); font-weight: 500;">${score}分</span>
          </div>
          <div style="height: 4px; background: var(--bg-quaternary); border-radius: var(--radius-full);">
            <div style="height: 100%; width: ${score}%; border-radius: var(--radius-full); 
              background: ${scoreLevel === 'high' ? 'linear-gradient(90deg, var(--accent-success), var(--accent-teal))' :
                scoreLevel === 'medium' ? 'linear-gradient(90deg, var(--accent-warning), var(--accent-gold))' :
                'linear-gradient(90deg, var(--accent-danger), var(--accent-secondary))'};">
            </div>
          </div>
        </div>
      `;
    });

    let highlightsHtml = '';
    if (grading.highlights && grading.highlights.length > 0) {
      highlightsHtml = grading.highlights.map(h =>
        `<li style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">✓ ${h}</li>`
      ).join('');
    }

    let issuesHtml = '';
    if (grading.issues && grading.issues.length > 0) {
      issuesHtml = grading.issues.map(i =>
        `<li style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">⚠ ${i}</li>`
      ).join('');
    }

    let suggestionsHtml = '';
    if (grading.suggestions && grading.suggestions.length > 0) {
      suggestionsHtml = grading.suggestions.map(s =>
        `<li style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">💡 ${s}</li>`
      ).join('');
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h5 class="text-sm font-medium mb-3" style="color: var(--text-primary);">维度评分</h5>
          ${dimensionsHtml || '<p class="text-xs" style="color: var(--text-tertiary);">暂无维度数据</p>'}
        </div>
        <div>
          <h5 class="text-sm font-medium mb-3" style="color: var(--text-primary);">评阅摘要</h5>
          <p class="text-sm leading-relaxed" style="color: var(--text-secondary);">
            ${grading.summary || '暂无摘要'}
          </p>
        </div>
      </div>

      ${highlightsHtml || issuesHtml || suggestionsHtml ? `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          ${highlightsHtml ? `
            <div>
              <h5 class="text-sm font-medium mb-2" style="color: var(--accent-success);">亮点</h5>
              <ul class="list-none p-0 m-0">${highlightsHtml}</ul>
            </div>
          ` : ''}
          ${issuesHtml ? `
            <div>
              <h5 class="text-sm font-medium mb-2" style="color: var(--accent-warning);">问题</h5>
              <ul class="list-none p-0 m-0">${issuesHtml}</ul>
            </div>
          ` : ''}
          ${suggestionsHtml ? `
            <div>
              <h5 class="text-sm font-medium mb-2" style="color: var(--accent-info);">建议</h5>
              <ul class="list-none p-0 m-0">${suggestionsHtml}</ul>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="mt-4 pt-4 flex items-center justify-between" style="border-top: 1px solid var(--border-color);">
        <div class="flex items-center gap-3">
          <span class="text-xs" style="color: var(--text-tertiary);">
            AI评分：${grading.aiScore || grading.overallScore}分
          </span>
          ${grading.teacherScore !== null ? `
            <span class="text-xs" style="color: var(--accent-teal);">
              教师评分：${grading.teacherScore}分
            </span>
          ` : ''}
        </div>
        <div class="flex items-center gap-2">
          <button onclick="event.stopPropagation(); window.TeacherGradingManager.showEditScoreModal('${grading.id}')" 
                  class="btn btn-ghost text-xs" style="padding: 6px 12px;">
            调整评分
          </button>
          <button onclick="event.stopPropagation(); window.TeacherGradingManager.markAsReviewed('${grading.id}')" 
                  class="btn btn-primary text-xs ${grading.reviewed ? 'opacity-50 cursor-not-allowed' : ''}" 
                  style="padding: 6px 12px;"
                  ${grading.reviewed ? 'disabled' : ''}>
            ${grading.reviewed ? '已审核' : '标记已审核'}
          </button>
        </div>
      </div>

      ${grading.teacherComment ? `
        <div class="mt-4 p-3 rounded-lg" style="background: var(--bg-tertiary);">
          <h5 class="text-sm font-medium mb-2" style="color: var(--text-primary);">教师评语</h5>
          <p class="text-sm" style="color: var(--text-secondary);">${grading.teacherComment}</p>
        </div>
      ` : ''}
    `;
  }

  /**
   * 获取评阅类型标签
   * @param {string} type - 类型
   * @returns {string} 中文标签
   */
  _getGradingTypeLabel(type) {
    const labels = {
      data: '数据文件',
      report: '分析报告',
      analysis: '分析作业',
      exercise: '练习题',
      project: '项目作业'
    };
    return labels[type] || type || '其他';
  }

  /**
   * 显示评分调整弹窗
   * @param {string} gradingId - 评阅ID
   */
  showEditScoreModal(gradingId) {
    const grading = this.gradings.find(g => g.id == gradingId || String(g.id) === String(gradingId));
    if (!grading) {
      this._showToast('error', '错误', '未找到评阅记录');
      return;
    }

    const currentScore = grading.teacherScore !== null ? grading.teacherScore : grading.overallScore;
    const currentComment = grading.teacherComment || '';

    const modal = document.createElement('div');
    modal.className = 'tooltip-modal';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
      <div class="tooltip-modal-content" style="max-width: 450px;">
        <div class="tooltip-modal-header">
          <h3 class="tooltip-modal-title">调整评分</h3>
          <button class="tooltip-modal-close" onclick="this.closest('.tooltip-modal').remove()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="tooltip-modal-body">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">课时</label>
            <p class="text-sm" style="color: var(--text-secondary);">${grading.lessonName || '未知课时'}</p>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">
              AI评分：${grading.aiScore || grading.overallScore}分
            </label>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">教师评分</label>
            <input type="number" id="teacher-score-input" value="${currentScore}" 
                   min="0" max="100" class="w-full p-2 rounded-lg text-lg font-medium"
                   style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">教师评语</label>
            <textarea id="teacher-comment-input" rows="3" 
                      class="w-full p-2 rounded-lg text-sm resize-none"
                      style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
                      placeholder="请输入评语...">${currentComment}</textarea>
          </div>
          <div class="flex justify-end gap-2">
            <button onclick="this.closest('.tooltip-modal').remove()" class="btn btn-ghost">取消</button>
            <button onclick="window.TeacherGradingManager.confirmEditScore('${gradingId}')" class="btn btn-primary">确认修改</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * 确认修改评分
   * @param {string} gradingId - 评阅ID
   */
  async confirmEditScore(gradingId) {
    try {
      const scoreInput = document.getElementById('teacher-score-input');
      const commentInput = document.getElementById('teacher-comment-input');

      const teacherScore = parseInt(scoreInput.value, 10);
      const teacherComment = commentInput.value.trim();

      if (isNaN(teacherScore) || teacherScore < 0 || teacherScore > 100) {
        this._showToast('error', '输入错误', '请输入0-100之间的分数');
        return;
      }

      const success = await this.updateTeacherScore(gradingId, teacherScore, teacherComment);

      if (success) {
        document.querySelector('.tooltip-modal:last-of-type')?.remove();
        this._showToast('success', '修改成功', '评分和评语已更新');
        this._refreshCurrentView();
      } else {
        this._showToast('error', '修改失败', '无法更新评分');
      }
    } catch (e) {
      console.error('确认修改评分失败:', e);
      this._showToast('error', '错误', e.message || '操作失败');
    }
  }

  /**
   * 更新教师评分和评语
   * @param {string} gradingId - 评阅ID
   * @param {number} teacherScore - 教师评分
   * @param {string} teacherComment - 教师评语
   * @returns {Promise<boolean>} 是否成功
   */
  async updateTeacherScore(gradingId, teacherScore, teacherComment = '') {
    try {
      const grading = this.gradings.find(g => g.id == gradingId || String(g.id) === String(gradingId));
      if (!grading) {
        return false;
      }

      if (window.DB && window.DB.grading && typeof grading.id === 'number') {
        await window.DB.grading.update(grading.id, {
          teacherScore,
          teacherComment,
          reviewed: true,
          teacherUpdatedAt: Date.now()
        });
      }

      grading.teacherScore = teacherScore;
      grading.teacherComment = teacherComment;
      grading.reviewed = true;
      grading.teacherUpdatedAt = Date.now();

      if (this.currentStudentId && this._gradingCache[this.currentStudentId]) {
        const idx = this._gradingCache[this.currentStudentId].findIndex(
          g => g.id == gradingId || String(g.id) === String(gradingId)
        );
        if (idx !== -1) {
          this._gradingCache[this.currentStudentId][idx] = grading;
        }
      }

      return true;
    } catch (e) {
      console.error('更新教师评分失败:', e);
      return false;
    }
  }

  /**
   * 标记为已审核
   * @param {string} gradingId - 评阅ID
   */
  async markAsReviewed(gradingId) {
    try {
      const grading = this.gradings.find(g => g.id == gradingId || String(g.id) === String(gradingId));
      if (!grading) {
        this._showToast('error', '错误', '未找到评阅记录');
        return;
      }

      if (grading.reviewed) {
        return;
      }

      if (window.DB && window.DB.grading && typeof grading.id === 'number') {
        await window.DB.grading.update(grading.id, {
          reviewed: true,
          reviewedAt: Date.now()
        });
      }

      grading.reviewed = true;
      grading.reviewedAt = Date.now();

      if (this.currentStudentId && this._gradingCache[this.currentStudentId]) {
        const idx = this._gradingCache[this.currentStudentId].findIndex(
          g => g.id == gradingId || String(g.id) === String(gradingId)
        );
        if (idx !== -1) {
          this._gradingCache[this.currentStudentId][idx] = grading;
        }
      }

      this._showToast('success', '操作成功', '已标记为已审核');
      this._refreshCurrentView();
    } catch (e) {
      console.error('标记已审核失败:', e);
      this._showToast('error', '错误', e.message || '操作失败');
    }
  }

  /**
   * 导出学生所有评阅结果为JSON
   * @param {string} studentId - 学生ID
   * @param {string} studentName - 学生姓名
   */
  async exportGradings(studentId, studentName = 'student') {
    try {
      const gradings = this._gradingCache[studentId] || this.gradings;

      if (!gradings || gradings.length === 0) {
        this._showToast('warning', '无数据', '没有可导出的评阅记录');
        return;
      }

      const exportData = {
        exportVersion: '1.0',
        exportType: 'grading-export',
        studentId: studentId,
        studentName: studentName,
        exportDate: new Date().toISOString(),
        totalCount: gradings.length,
        statistics: this.getGradingStats(studentId),
        gradings: gradings.map(g => ({
          id: g.id,
          lessonName: g.lessonName,
          gradingType: g.gradingType,
          aiScore: g.aiScore || g.overallScore,
          teacherScore: g.teacherScore,
          finalScore: g.teacherScore || g.overallScore,
          finalGrade: this._scoreToGrade(g.teacherScore || g.overallScore),
          teacherComment: g.teacherComment || '',
          reviewed: g.reviewed || false,
          dimensionScores: g.dimensionScores,
          highlights: g.highlights,
          issues: g.issues,
          suggestions: g.suggestions,
          summary: g.summary,
          gradedAt: g.gradedAt,
          teacherUpdatedAt: g.teacherUpdatedAt || null
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grading-${studentName}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this._showToast('success', '导出成功', `已导出 ${gradings.length} 条评阅记录`);
    } catch (e) {
      console.error('导出评阅结果失败:', e);
      this._showToast('error', '导出失败', e.message || '导出失败');
    }
  }

  /**
   * 获取班级评阅统计（基于本地所有学生）
   * @returns {Promise<Object>} 班级统计数据
   */
  async getClassGradingStats() {
    try {
      let students = [];

      if (window.StudentManager && typeof window.StudentManager.listStudents === 'function') {
        students = await window.StudentManager.listStudents();
      }

      const allStats = [];

      for (const student of students) {
        const gradings = await this.loadStudentGradings(student.id);
        if (gradings.length > 0) {
          const stats = this.getGradingStats(student.id);
          allStats.push({
            studentId: student.id,
            studentName: student.name,
            ...stats
          });
        }
      }

      if (allStats.length === 0) {
        return {
          totalStudents: 0,
          totalGradings: 0,
          classAvgScore: 0,
          gradeDistribution: { A: 0, B: 0, C: 0, D: 0 },
          reviewedRate: 0,
          studentStats: []
        };
      }

      const totalGradings = allStats.reduce((sum, s) => sum + s.totalCount, 0);
      const classAvgScore = allStats.reduce((sum, s) => sum + s.avgScore, 0) / allStats.length;
      const reviewedCount = allStats.reduce((sum, s) => sum + s.reviewedCount, 0);

      const gradeDistribution = { A: 0, B: 0, C: 0, D: 0 };
      allStats.forEach(s => {
        Object.keys(gradeDistribution).forEach(g => {
          gradeDistribution[g] += s.gradeDistribution[g] || 0;
        });
      });

      return {
        totalStudents: allStats.length,
        totalGradings,
        classAvgScore: Math.round(classAvgScore * 10) / 10,
        gradeDistribution,
        reviewedRate: totalGradings > 0 ? Math.round((reviewedCount / totalGradings) * 100) : 0,
        studentStats: allStats.sort((a, b) => b.avgScore - a.avgScore)
      };
    } catch (e) {
      console.error('获取班级评阅统计失败:', e);
      return {
        totalStudents: 0,
        totalGradings: 0,
        classAvgScore: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0 },
        reviewedRate: 0,
        studentStats: []
      };
    }
  }

  /**
   * 刷新当前视图
   */
  _refreshCurrentView() {
    const event = new CustomEvent('grading-updated');
    window.dispatchEvent(event);
  }

  /**
   * 显示Toast提示
   * @param {string} type - 类型
   * @param {string} title - 标题
   * @param {string} message - 消息
   */
  _showToast(type, title, message) {
    if (typeof showToast === 'function') {
      showToast(type, title, message);
      return;
    }

    const container = document.getElementById('toast-container');
    if (!container) {
      console.log(`[${type}] ${title}: ${message}`);
      return;
    }

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-radius: 8px;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      box-shadow: var(--shadow-md); margin-bottom: 8px;
      animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `
      <span style="font-size: 1.2rem;">${icons[type] || 'ℹ'}</span>
      <div>
        <div style="font-weight: 600; color: var(--text-primary);">${title}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary);">${message}</div>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

window.TeacherGradingManager = new TeacherGradingManager();
