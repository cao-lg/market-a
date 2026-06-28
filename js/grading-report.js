/**
 * AI 评阅报告展示组件
 * 基于 GradingEngine 返回结果，渲染完整的评阅报告
 * 支持雷达图（ECharts）、条形图（纯CSS降级）、导出等功能
 */

class GradingReport {
  /**
   * 构造函数
   * @param {HTMLElement|string} container - DOM元素或选择器
   * @param {Object} options - 配置选项
   * @param {boolean} [options.showDetails=true] - 是否默认显示详情
   * @param {boolean} [options.allowReGrade=false] - 是否允许重新评阅
   * @param {Function} [options.onReGrade] - 重新评阅回调
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      console.error('GradingReport: 容器元素不存在');
      return;
    }

    this.options = {
      showDetails: true,
      allowReGrade: false,
      onReGrade: null,
      ...options
    };

    this.result = null;
    this.chartInstance = null;
    this._styleInjected = false;

    this._init();
  }

  /**
   * 初始化
   */
  _init() {
    this._injectStyles();
    this.container.classList.add('grading-report-container');
  }

  /**
   * 注入CSS样式
   */
  _injectStyles() {
    if (this._styleInjected) return;

    const styleId = 'grading-report-styles';
    if (document.getElementById(styleId)) {
      this._styleInjected = true;
      return;
    }

    const css = `
      .grading-report-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: #f0ebe5;
        background-color: #111010;
        border-radius: 14px;
        max-width: 100%;
      }

      .gr-loading, .gr-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
      }

      .gr-loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #2d2a28;
        border-top-color: #d48c52;
        border-radius: 50%;
        animation: gr-spin 0.8s linear infinite;
        margin-bottom: 16px;
      }

      @keyframes gr-spin {
        to { transform: rotate(360deg); }
      }

      .gr-loading-text, .gr-error-text {
        color: #a8a095;
        font-size: 0.9rem;
      }

      .gr-error-icon {
        font-size: 2.5rem;
        margin-bottom: 12px;
      }

      .gr-section {
        background-color: #171615;
        border: 1px solid #2d2a28;
        border-radius: 10px;
        padding: 24px;
        margin-bottom: 16px;
        position: relative;
        overflow: hidden;
      }

      .gr-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(212, 140, 82, 0.2), transparent);
        opacity: 0.5;
      }

      .gr-section-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: #f0ebe5;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .gr-section-title-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(212, 140, 82, 0.15);
        border-radius: 6px;
        font-size: 0.9rem;
      }

      .gr-overall-card {
        text-align: center;
        padding: 32px 24px;
        background: linear-gradient(135deg, #171615 0%, #1f1d1c 100%);
      }

      .gr-score-display {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 24px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }

      .gr-score-number {
        font-size: 4rem;
        font-weight: 700;
        line-height: 1;
        font-family: Georgia, 'Playfair Display', serif;
        background: linear-gradient(135deg, #d48c52, #e6b455);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .gr-grade-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 72px;
        height: 72px;
        border-radius: 50%;
        font-size: 2rem;
        font-weight: 700;
        font-family: Georgia, serif;
        color: #fff;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }

      .gr-grade-a { background: linear-gradient(135deg, #6a9e6e, #5a9e8f); }
      .gr-grade-b { background: linear-gradient(135deg, #6b8caf, #5a9e8f); }
      .gr-grade-c { background: linear-gradient(135deg, #d48c52, #c99a4a); }
      .gr-grade-d { background: linear-gradient(135deg, #c45e4b, #c4653e); }

      .gr-summary-text {
        font-size: 1rem;
        color: #a8a095;
        line-height: 1.7;
        max-width: 600px;
        margin: 0 auto 16px;
      }

      .gr-meta-row {
        display: flex;
        justify-content: center;
        gap: 20px;
        flex-wrap: wrap;
        font-size: 0.8rem;
        color: #6e665d;
      }

      .gr-meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .gr-dimensions-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      @media (max-width: 768px) {
        .gr-dimensions-grid {
          grid-template-columns: 1fr;
        }
      }

      .gr-chart-container {
        min-height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .gr-dimension-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .gr-dimension-item {
        background-color: #1f1d1c;
        border: 1px solid #2d2a28;
        border-radius: 8px;
        padding: 14px 16px;
        cursor: pointer;
        transition: all 0.25s ease;
      }

      .gr-dimension-item:hover {
        border-color: #3d3936;
        background-color: #272524;
      }

      .gr-dimension-item.expanded {
        border-color: rgba(212, 140, 82, 0.3);
      }

      .gr-dimension-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .gr-dimension-name {
        font-weight: 500;
        color: #f0ebe5;
        font-size: 0.9rem;
      }

      .gr-dimension-score-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .gr-dimension-score {
        font-weight: 600;
        font-size: 1.1rem;
        font-family: 'JetBrains Mono', monospace;
        color: #d48c52;
        min-width: 40px;
        text-align: right;
      }

      .gr-dimension-label {
        font-size: 0.7rem;
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }

      .gr-label-excellent { background: rgba(106, 158, 110, 0.15); color: #6a9e6e; }
      .gr-label-good { background: rgba(107, 140, 175, 0.15); color: #6b8caf; }
      .gr-label-average { background: rgba(201, 154, 74, 0.15); color: #c99a4a; }
      .gr-label-pass { background: rgba(196, 101, 62, 0.15); color: #c4653e; }
      .gr-label-poor { background: rgba(196, 94, 75, 0.15); color: #c45e4b; }

      .gr-dimension-bar {
        margin-top: 10px;
        height: 6px;
        background-color: #2d2a28;
        border-radius: 3px;
        overflow: hidden;
      }

      .gr-dimension-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.6s ease;
      }

      .gr-bar-excellent { background: linear-gradient(90deg, #6a9e6e, #5a9e8f); }
      .gr-bar-good { background: linear-gradient(90deg, #6b8caf, #5a9e8f); }
      .gr-bar-average { background: linear-gradient(90deg, #d48c52, #e6b455); }
      .gr-bar-pass { background: linear-gradient(90deg, #c4653e, #d48c52); }
      .gr-bar-poor { background: linear-gradient(90deg, #c45e4b, #c4653e); }

      .gr-dimension-detail {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease, margin-top 0.3s ease;
      }

      .gr-dimension-item.expanded .gr-dimension-detail {
        max-height: 200px;
        margin-top: 12px;
      }

      .gr-dimension-desc {
        font-size: 0.85rem;
        color: #a8a095;
        line-height: 1.6;
        padding-top: 12px;
        border-top: 1px solid #2d2a28;
      }

      .gr-highlight-item, .gr-issue-item, .gr-suggestion-item {
        background-color: #1f1d1c;
        border: 1px solid #2d2a28;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 10px;
        transition: all 0.2s ease;
      }

      .gr-highlight-item:hover, .gr-issue-item:hover, .gr-suggestion-item:hover {
        border-color: #3d3936;
        transform: translateY(-1px);
      }

      .gr-highlight-item {
        border-left: 3px solid #6a9e6e;
      }

      .gr-highlight-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }

      .gr-highlight-icon {
        color: #6a9e6e;
        font-size: 1.1rem;
      }

      .gr-highlight-title {
        font-weight: 500;
        color: #f0ebe5;
        font-size: 0.95rem;
      }

      .gr-highlight-desc {
        font-size: 0.85rem;
        color: #a8a095;
        line-height: 1.6;
        margin-left: 28px;
      }

      .gr-issue-stats {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .gr-issue-stat {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        padding: 6px 12px;
        background-color: #1f1d1c;
        border-radius: 6px;
      }

      .gr-issue-stat-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .gr-dot-high { background: #c45e4b; }
      .gr-dot-medium { background: #d48c52; }
      .gr-dot-low { background: #c99a4a; }

      .gr-issue-item {
        border-left: 3px solid #c45e4b;
      }

      .gr-issue-item.severity-medium {
        border-left-color: #d48c52;
      }

      .gr-issue-item.severity-low {
        border-left-color: #c99a4a;
      }

      .gr-issue-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        cursor: pointer;
      }

      .gr-issue-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
      }

      .gr-severity-badge {
        font-size: 0.65rem;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        flex-shrink: 0;
      }

      .gr-severity-high {
        background: rgba(196, 94, 75, 0.15);
        color: #c45e4b;
      }

      .gr-severity-medium {
        background: rgba(212, 140, 82, 0.15);
        color: #d48c52;
      }

      .gr-severity-low {
        background: rgba(201, 154, 74, 0.15);
        color: #c99a4a;
      }

      .gr-issue-title {
        font-weight: 500;
        color: #f0ebe5;
        font-size: 0.95rem;
      }

      .gr-expand-icon {
        color: #6e665d;
        font-size: 0.8rem;
        transition: transform 0.3s ease;
        flex-shrink: 0;
      }

      .gr-issue-item.expanded .gr-expand-icon {
        transform: rotate(180deg);
      }

      .gr-issue-body {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease, margin-top 0.3s ease;
      }

      .gr-issue-item.expanded .gr-issue-body {
        max-height: 300px;
        margin-top: 12px;
      }

      .gr-issue-desc {
        font-size: 0.85rem;
        color: #a8a095;
        line-height: 1.6;
        margin-bottom: 10px;
      }

      .gr-issue-column {
        display: inline-block;
        font-size: 0.75rem;
        padding: 2px 8px;
        background: rgba(107, 140, 175, 0.15);
        color: #6b8caf;
        border-radius: 4px;
        margin-bottom: 10px;
        font-family: 'JetBrains Mono', monospace;
      }

      .gr-suggestion-text {
        font-size: 0.85rem;
        color: #a8a095;
        line-height: 1.6;
        padding-top: 10px;
        border-top: 1px solid #2d2a28;
      }

      .gr-suggestion-text strong {
        color: #d48c52;
      }

      .gr-suggestion-item {
        border-left: 3px solid #6b8caf;
      }

      .gr-suggestion-item.priority-high {
        border-left-color: #c45e4b;
      }

      .gr-suggestion-item.priority-medium {
        border-left-color: #d48c52;
      }

      .gr-suggestion-item.priority-low {
        border-left-color: #c99a4a;
      }

      .gr-suggestion-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .gr-priority-badge {
        font-size: 0.65rem;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .gr-priority-high {
        background: rgba(196, 94, 75, 0.15);
        color: #c45e4b;
      }

      .gr-priority-medium {
        background: rgba(212, 140, 82, 0.15);
        color: #d48c52;
      }

      .gr-priority-low {
        background: rgba(201, 154, 74, 0.15);
        color: #c99a4a;
      }

      .gr-suggestion-title {
        font-weight: 500;
        color: #f0ebe5;
        font-size: 0.95rem;
      }

      .gr-suggestion-desc {
        font-size: 0.85rem;
        color: #a8a095;
        line-height: 1.6;
      }

      .gr-actions-section {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .gr-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        font-size: 0.875rem;
        font-weight: 500;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
        white-space: nowrap;
      }

      .gr-btn:hover {
        transform: translateY(-1px);
      }

      .gr-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .gr-btn-primary {
        background: linear-gradient(135deg, #d48c52, #c4653e);
        color: #0a0908;
        box-shadow: 0 2px 8px rgba(212, 140, 82, 0.2);
      }

      .gr-btn-primary:hover:not(:disabled) {
        box-shadow: 0 4px 16px rgba(212, 140, 82, 0.3);
      }

      .gr-btn-secondary {
        background-color: #1f1d1c;
        color: #f0ebe5;
        border-color: #2d2a28;
      }

      .gr-btn-secondary:hover:not(:disabled) {
        background-color: #272524;
        border-color: #3d3936;
      }

      .gr-btn-success {
        background-color: #6a9e6e;
        color: #fff;
      }

      .gr-btn-success:hover:not(:disabled) {
        background-color: #7aae7e;
      }

      .gr-rubric-section {
        margin-top: 16px;
      }

      .gr-rubric-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 0;
        cursor: pointer;
        color: #a8a095;
        font-size: 0.875rem;
        border-top: 1px solid #2d2a28;
        transition: color 0.2s ease;
      }

      .gr-rubric-toggle:hover {
        color: #f0ebe5;
      }

      .gr-rubric-icon {
        transition: transform 0.3s ease;
      }

      .gr-rubric-section.expanded .gr-rubric-icon {
        transform: rotate(180deg);
      }

      .gr-rubric-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }

      .gr-rubric-section.expanded .gr-rubric-content {
        max-height: 600px;
      }

      .gr-rubric-inner {
        padding: 16px 0;
        font-size: 0.85rem;
        color: #a8a095;
        line-height: 1.7;
      }

      .gr-rubric-inner h4 {
        color: #f0ebe5;
        font-size: 0.9rem;
        margin: 12px 0 6px;
      }

      .gr-rubric-inner ul {
        padding-left: 20px;
        margin-bottom: 8px;
      }

      .gr-rubric-inner li {
        margin-bottom: 4px;
      }

      .gr-history-section {
        margin-top: 16px;
      }

      .gr-history-title {
        font-size: 0.9rem;
        font-weight: 500;
        color: #f0ebe5;
        margin-bottom: 10px;
        padding-top: 16px;
        border-top: 1px solid #2d2a28;
      }

      .gr-history-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .gr-history-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background-color: #1f1d1c;
        border-radius: 6px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .gr-history-item:hover {
        background-color: #272524;
      }

      .gr-history-score {
        font-weight: 600;
        color: #d48c52;
        font-family: 'JetBrains Mono', monospace;
      }

      .gr-history-time {
        color: #6e665d;
      }

      .gr-css-radar {
        position: relative;
        width: 280px;
        height: 280px;
        margin: 0 auto;
      }

      .gr-css-radar-svg {
        width: 100%;
        height: 100%;
      }

      .gr-css-radar-polygon {
        fill: rgba(212, 140, 82, 0.2);
        stroke: #d48c52;
        stroke-width: 2;
        transition: all 0.5s ease;
      }

      .gr-css-radar-grid {
        fill: none;
        stroke: #2d2a28;
        stroke-width: 1;
      }

      .gr-css-radar-axis {
        stroke: #2d2a28;
        stroke-width: 1;
      }

      .gr-css-radar-label {
        fill: #a8a095;
        font-size: 11px;
        text-anchor: middle;
        dominant-baseline: middle;
      }

      .gr-css-radar-dot {
        fill: #d48c52;
        stroke: #fff;
        stroke-width: 2;
        transition: all 0.3s ease;
      }

      .gr-empty-state {
        text-align: center;
        padding: 30px;
        color: #6e665d;
        font-size: 0.875rem;
      }

      @media (max-width: 640px) {
        .gr-section {
          padding: 16px;
        }

        .gr-score-number {
          font-size: 3rem;
        }

        .gr-grade-badge {
          width: 56px;
          height: 56px;
          font-size: 1.5rem;
        }

        .gr-score-display {
          gap: 16px;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    this._styleInjected = true;
  }

  /**
   * 渲染评阅报告
   * @param {Object} result - GradingEngine返回的评阅结果
   */
  render(result) {
    if (!this.container) return;

    if (!result || typeof result !== 'object') {
      this.showError('评阅结果数据无效');
      return;
    }

    this.result = result;
    this.container.innerHTML = '';

    try {
      this._renderOverallCard();
      this._renderDimensionsSection();
      this._renderHighlightsSection();
      this._renderIssuesSection();
      this._renderSuggestionsSection();
      this._renderActionsSection();
    } catch (error) {
      console.error('GradingReport 渲染失败:', error);
      this.showError('报告渲染失败: ' + error.message);
    }
  }

  /**
   * 渲染总评分卡片
   */
  _renderOverallCard() {
    const { overallScore, overallGrade, summary, gradingTime, fileInfo, isBaseScore, isFallback } = this.result;

    const gradeClass = `gr-grade-${overallGrade?.toLowerCase() || 'd'}`;
    const gradingTypeText = isFallback ? '基础评分（AI不可用）' : isBaseScore ? '基础评分' : 'AI智能评阅';
    const timeText = gradingTime ? this._formatTime(gradingTime) : this._formatTime(new Date().toISOString());

    const section = document.createElement('div');
    section.className = 'gr-section gr-overall-card';
    section.innerHTML = `
      <div class="gr-score-display">
        <div class="gr-score-number">${overallScore || 0}</div>
        <div class="gr-grade-badge ${gradeClass}">${overallGrade || 'D'}</div>
      </div>
      <p class="gr-summary-text">${summary || '暂无评阅摘要'}</p>
      <div class="gr-meta-row">
        <div class="gr-meta-item">
          <span>📅</span>
          <span>${timeText}</span>
        </div>
        <div class="gr-meta-item">
          <span>📊</span>
          <span>${gradingTypeText}</span>
        </div>
        ${fileInfo?.fileName ? `
        <div class="gr-meta-item">
          <span>📁</span>
          <span>${fileInfo.fileName}</span>
        </div>
        ` : ''}
      </div>
    `;

    this.container.appendChild(section);
  }

  /**
   * 渲染各维度得分展示
   */
  _renderDimensionsSection() {
    const { dimensionScores } = this.result;
    if (!dimensionScores) return;

    const section = document.createElement('div');
    section.className = 'gr-section';

    section.innerHTML = `
      <div class="gr-section-title">
        <span class="gr-section-title-icon">📊</span>
        各维度得分
      </div>
      <div class="gr-dimensions-grid">
        <div class="gr-chart-container" id="gr-chart-container"></div>
        <div class="gr-dimension-list" id="gr-dimension-list"></div>
      </div>
    `;

    this.container.appendChild(section);

    this._renderDimensionList(dimensionScores);
    this._renderChart(dimensionScores);
  }

  /**
   * 渲染维度列表
   */
  _renderDimensionList(dimensionScores) {
    const listEl = document.getElementById('gr-dimension-list');
    if (!listEl) return;

    const dimNames = {
      completeness: '完整性',
      standardization: '规范性',
      accuracy: '准确性',
      processingQuality: '处理质量',
      fieldRichness: '字段丰富度'
    };

    const dims = Object.entries(dimensionScores);

    dims.forEach(([key, dim], index) => {
      const score = dim.score || 0;
      const labelClass = this._getScoreLabelClass(score);
      const barClass = this._getScoreBarClass(score);

      const item = document.createElement('div');
      item.className = 'gr-dimension-item';
      if (this.options.showDetails && index === 0) {
        item.classList.add('expanded');
      }

      item.innerHTML = `
        <div class="gr-dimension-header">
          <span class="gr-dimension-name">${dimNames[key] || key}</span>
          <div class="gr-dimension-score-row">
            <span class="gr-dimension-label ${labelClass}">${dim.label || '-'}</span>
            <span class="gr-dimension-score">${score}</span>
          </div>
        </div>
        <div class="gr-dimension-bar">
          <div class="gr-dimension-bar-fill ${barClass}" style="width: ${score}%"></div>
        </div>
        <div class="gr-dimension-detail">
          <div class="gr-dimension-desc">${dim.description || '暂无描述'}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
      });

      listEl.appendChild(item);
    });
  }

  /**
   * 渲染图表（优先ECharts雷达图，降级纯CSS）
   */
  _renderChart(dimensionScores) {
    const chartContainer = document.getElementById('gr-chart-container');
    if (!chartContainer) return;

    if (typeof echarts !== 'undefined') {
      this._renderRadarChart(dimensionScores);
    } else {
      this.renderBarChart(dimensionScores);
    }
  }

  /**
   * 渲染雷达图（使用ECharts）
   * @param {Object} dimensionScores - 维度得分
   */
  renderRadarChart(dimensionScores) {
    const chartContainer = document.getElementById('gr-chart-container');
    if (!chartContainer || typeof echarts === 'undefined') {
      this.renderBarChart(dimensionScores);
      return;
    }

    if (this.chartInstance) {
      this.chartInstance.dispose();
    }

    const dimNames = {
      completeness: '完整性',
      standardization: '规范性',
      accuracy: '准确性',
      processingQuality: '处理质量',
      fieldRichness: '字段丰富度'
    };

    const indicators = [];
    const values = [];

    Object.entries(dimensionScores).forEach(([key, dim]) => {
      indicators.push({
        name: dimNames[key] || key,
        max: 100
      });
      values.push(dim.score || 0);
    });

    this.chartInstance = echarts.init(chartContainer);

    const option = {
      backgroundColor: 'transparent',
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#a8a095',
          fontSize: 12
        },
        splitLine: {
          lineStyle: {
            color: '#2d2a28'
          }
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(45, 42, 40, 0.3)', 'rgba(45, 42, 40, 0.5)']
          }
        },
        axisLine: {
          lineStyle: {
            color: '#2d2a28'
          }
        }
      },
      series: [{
        type: 'radar',
        data: [{
          value: values,
          name: '得分',
          areaStyle: {
            color: 'rgba(212, 140, 82, 0.2)'
          },
          lineStyle: {
            color: '#d48c52',
            width: 2
          },
          itemStyle: {
            color: '#d48c52',
            borderColor: '#fff',
            borderWidth: 2
          }
        }]
      }],
      tooltip: {
        trigger: 'item',
        backgroundColor: '#171615',
        borderColor: '#2d2a28',
        textStyle: {
          color: '#f0ebe5'
        }
      }
    };

    this.chartInstance.setOption(option);

    const handleResize = () => {
      if (this.chartInstance) {
        this.chartInstance.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    this._resizeHandler = handleResize;
  }

  /**
   * 渲染纯CSS条形图（降级方案）
   * @param {Object} dimensionScores - 维度得分
   */
  renderBarChart(dimensionScores) {
    const chartContainer = document.getElementById('gr-chart-container');
    if (!chartContainer) return;

    const dimNames = {
      completeness: '完整性',
      standardization: '规范性',
      accuracy: '准确性',
      processingQuality: '处理质量',
      fieldRichness: '字段丰富度'
    };

    const dims = Object.entries(dimensionScores);
    const dimCount = dims.length;
    const centerX = 140;
    const centerY = 140;
    const radius = 100;

    const angleStep = (Math.PI * 2) / dimCount;
    const startAngle = -Math.PI / 2;

    let gridPolygons = '';
    for (let i = 1; i <= 4; i++) {
      const r = (radius * i) / 4;
      let points = [];
      for (let j = 0; j < dimCount; j++) {
        const angle = startAngle + j * angleStep;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        points.push(`${x},${y}`);
      }
      gridPolygons += `<polygon class="gr-css-radar-grid" points="${points.join(' ')}" />`;
    }

    let axisLines = '';
    let labels = '';
    for (let i = 0; i < dimCount; i++) {
      const angle = startAngle + i * angleStep;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      axisLines += `<line class="gr-css-radar-axis" x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" />`;

      const labelR = radius + 20;
      const labelX = centerX + labelR * Math.cos(angle);
      const labelY = centerY + labelR * Math.sin(angle);
      labels += `<text class="gr-css-radar-label" x="${labelX}" y="${labelY}">${dimNames[dims[i][0]] || dims[i][0]}</text>`;
    }

    let dataPoints = [];
    let dots = '';
    for (let i = 0; i < dimCount; i++) {
      const score = dims[i][1].score || 0;
      const r = (radius * score) / 100;
      const angle = startAngle + i * angleStep;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      dataPoints.push(`${x},${y}`);
      dots += `<circle class="gr-css-radar-dot" cx="${x}" cy="${y}" r="4" />`;
    }

    chartContainer.innerHTML = `
      <div class="gr-css-radar">
        <svg class="gr-css-radar-svg" viewBox="0 0 280 280">
          ${gridPolygons}
          ${axisLines}
          <polygon class="gr-css-radar-polygon" points="${dataPoints.join(' ')}" />
          ${dots}
          ${labels}
        </svg>
      </div>
    `;
  }

  /**
   * 渲染亮点展示
   */
  _renderHighlightsSection() {
    const { highlights } = this.result;
    if (!highlights || highlights.length === 0) return;

    const section = document.createElement('div');
    section.className = 'gr-section';

    let highlightsHtml = '';
    highlights.forEach(h => {
      highlightsHtml += `
        <div class="gr-highlight-item">
          <div class="gr-highlight-header">
            <span class="gr-highlight-icon">✓</span>
            <span class="gr-highlight-title">${this._escapeHtml(h.title)}</span>
          </div>
          <div class="gr-highlight-desc">${this._escapeHtml(h.description || '')}</div>
        </div>
      `;
    });

    section.innerHTML = `
      <div class="gr-section-title">
        <span class="gr-section-title-icon">✨</span>
        做得好的地方
      </div>
      ${highlightsHtml}
    `;

    this.container.appendChild(section);
  }

  /**
   * 渲染问题清单
   */
  _renderIssuesSection() {
    const { issues } = this.result;
    if (!issues || issues.length === 0) return;

    const sortedIssues = [...issues].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
    });

    const highCount = sortedIssues.filter(i => i.severity === 'high').length;
    const mediumCount = sortedIssues.filter(i => i.severity === 'medium').length;
    const lowCount = sortedIssues.filter(i => i.severity === 'low').length;

    const section = document.createElement('div');
    section.className = 'gr-section';

    let issuesHtml = '';
    sortedIssues.forEach((issue, index) => {
      const severityText = { high: '高风险', medium: '中风险', low: '低风险' }[issue.severity] || '中风险';
      const severityClass = `gr-severity-${issue.severity || 'medium'}`;
      const itemClass = `severity-${issue.severity || 'medium'}`;

      issuesHtml += `
        <div class="gr-issue-item ${itemClass}" data-index="${index}">
          <div class="gr-issue-header">
            <div class="gr-issue-title-row">
              <span class="gr-severity-badge ${severityClass}">${severityText}</span>
              <span class="gr-issue-title">${this._escapeHtml(issue.title)}</span>
            </div>
            <span class="gr-expand-icon">▼</span>
          </div>
          <div class="gr-issue-body">
            <div class="gr-issue-desc">${this._escapeHtml(issue.description || '')}</div>
            ${issue.column ? `<span class="gr-issue-column">${this._escapeHtml(issue.column)}</span>` : ''}
            <div class="gr-suggestion-text">
              <strong>改进建议：</strong>${this._escapeHtml(issue.suggestion || '暂无建议')}
            </div>
          </div>
        </div>
      `;
    });

    section.innerHTML = `
      <div class="gr-section-title">
        <span class="gr-section-title-icon">⚠️</span>
        需要改进的问题
      </div>
      <div class="gr-issue-stats">
        <div class="gr-issue-stat">
          <span class="gr-issue-stat-dot gr-dot-high"></span>
          <span>高风险 ${highCount} 个</span>
        </div>
        <div class="gr-issue-stat">
          <span class="gr-issue-stat-dot gr-dot-medium"></span>
          <span>中风险 ${mediumCount} 个</span>
        </div>
        <div class="gr-issue-stat">
          <span class="gr-issue-stat-dot gr-dot-low"></span>
          <span>低风险 ${lowCount} 个</span>
        </div>
      </div>
      ${issuesHtml}
    `;

    this.container.appendChild(section);

    section.querySelectorAll('.gr-issue-item').forEach(item => {
      const header = item.querySelector('.gr-issue-header');
      header.addEventListener('click', () => {
        item.classList.toggle('expanded');
      });
    });
  }

  /**
   * 渲染改进建议
   */
  _renderSuggestionsSection() {
    const { suggestions } = this.result;
    if (!suggestions || suggestions.length === 0) return;

    const sortedSuggestions = [...suggestions].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    });

    const section = document.createElement('div');
    section.className = 'gr-section';

    let suggestionsHtml = '';
    sortedSuggestions.forEach(s => {
      const priorityText = { high: '高优先级', medium: '中优先级', low: '低优先级' }[s.priority] || '中优先级';
      const priorityClass = `gr-priority-${s.priority || 'medium'}`;
      const itemClass = `priority-${s.priority || 'medium'}`;

      suggestionsHtml += `
        <div class="gr-suggestion-item ${itemClass}">
          <div class="gr-suggestion-header">
            <span class="gr-priority-badge ${priorityClass}">${priorityText}</span>
            <span class="gr-suggestion-title">${this._escapeHtml(s.title)}</span>
          </div>
          <div class="gr-suggestion-desc">${this._escapeHtml(s.description || '')}</div>
        </div>
      `;
    });

    section.innerHTML = `
      <div class="gr-section-title">
        <span class="gr-section-title-icon">💡</span>
        改进建议
      </div>
      ${suggestionsHtml}
    `;

    this.container.appendChild(section);
  }

  /**
   * 渲染评分依据与操作区
   */
  _renderActionsSection() {
    const section = document.createElement('div');
    section.className = 'gr-section';

    const hasHistory = this.result && this.result.history && Array.isArray(this.result.history) && this.result.history.length > 0;

    let historyHtml = '';
    if (hasHistory) {
      let historyItems = '';
      this.result.history.slice(0, 5).forEach((h, i) => {
        historyItems += `
          <div class="gr-history-item" data-index="${i}">
            <span class="gr-history-score">${h.overallScore || 0}分</span>
            <span class="gr-history-time">${h.gradingTime ? this._formatTime(h.gradingTime) : '-'}</span>
          </div>
        `;
      });
      historyHtml = `
        <div class="gr-history-section">
          <div class="gr-history-title">评阅历史记录</div>
          <div class="gr-history-list">${historyItems}</div>
        </div>
      `;
    }

    section.innerHTML = `
      <div class="gr-section-title">
        <span class="gr-section-title-icon">⚙️</span>
        操作与评分依据
      </div>
      <div class="gr-actions-section">
        ${this.options.allowReGrade ? `
          <button class="gr-btn gr-btn-primary" id="gr-regrade-btn">
            <span>🔄</span>
            重新评阅
          </button>
        ` : ''}
        <button class="gr-btn gr-btn-secondary" id="gr-export-json-btn">
          <span>📄</span>
          导出 JSON
        </button>
        <button class="gr-btn gr-btn-secondary" id="gr-export-md-btn">
          <span>📝</span>
          导出 Markdown
        </button>
      </div>
      <div class="gr-rubric-section" id="gr-rubric-section">
        <div class="gr-rubric-toggle" id="gr-rubric-toggle">
          <span class="gr-rubric-icon">▼</span>
          查看评分标准说明
        </div>
        <div class="gr-rubric-content">
          <div class="gr-rubric-inner">
            <h4>1. 完整性 (25%)</h4>
            <ul>
              <li>数据完整度：缺失值比例、空值处理</li>
              <li>列完整性：必要字段是否齐全</li>
              <li>评分标准：缺失率&lt;2%得满分，每增加5%扣10分</li>
            </ul>
            <h4>2. 规范性 (20%)</h4>
            <ul>
              <li>命名规范：字段命名是否统一、符合规范</li>
              <li>格式统一：同一字段格式是否一致</li>
              <li>类型正确：数据类型是否合理</li>
            </ul>
            <h4>3. 准确性 (25%)</h4>
            <ul>
              <li>异常值处理：是否存在明显异常值</li>
              <li>逻辑一致性：数据间逻辑关系是否合理</li>
              <li>数据质量：错误数据、矛盾数据比例</li>
            </ul>
            <h4>4. 处理质量 (15%)</h4>
            <ul>
              <li>去重处理：重复数据是否已清理</li>
              <li>无效数据：空行、无效记录是否已清理</li>
              <li>数据转换：格式转换质量</li>
            </ul>
            <h4>5. 字段丰富度 (15%)</h4>
            <ul>
              <li>衍生字段：是否有计算字段、衍生指标</li>
              <li>指标计算：关键业务指标是否完备</li>
              <li>维度丰富：分析维度是否足够</li>
            </ul>
          </div>
        </div>
      </div>
      ${historyHtml}
    `;

    this.container.appendChild(section);

    const regradeBtn = document.getElementById('gr-regrade-btn');
    if (regradeBtn && this.options.allowReGrade && this.options.onReGrade) {
      regradeBtn.addEventListener('click', () => {
        if (typeof this.options.onReGrade === 'function') {
          this.options.onReGrade();
        }
      });
    }

    const jsonBtn = document.getElementById('gr-export-json-btn');
    if (jsonBtn) {
      jsonBtn.addEventListener('click', () => this.exportAsJSON(this.result));
    }

    const mdBtn = document.getElementById('gr-export-md-btn');
    if (mdBtn) {
      mdBtn.addEventListener('click', () => this.exportAsMarkdown(this.result));
    }

    const rubricToggle = document.getElementById('gr-rubric-toggle');
    const rubricSection = document.getElementById('gr-rubric-section');
    if (rubricToggle && rubricSection) {
      rubricToggle.addEventListener('click', () => {
        rubricSection.classList.toggle('expanded');
      });
    }
  }

  /**
   * 导出JSON格式报告
   * @param {Object} result - 评阅结果
   */
  exportAsJSON(result) {
    if (!result) return;

    try {
      const jsonStr = JSON.stringify(result, null, 2);
      this._downloadFile(jsonStr, 'grading-report.json', 'application/json');
    } catch (error) {
      console.error('导出JSON失败:', error);
      this._showToast('导出失败', 'error');
    }
  }

  /**
   * 导出Markdown格式报告
   * @param {Object} result - 评阅结果
   */
  exportAsMarkdown(result) {
    if (!result) return;

    try {
      const { overallScore, overallGrade, dimensionScores, highlights, issues, suggestions, summary, gradingTime, fileInfo } = result;

      const dimNames = {
        completeness: '完整性',
        standardization: '规范性',
        accuracy: '准确性',
        processingQuality: '处理质量',
        fieldRichness: '字段丰富度'
      };

      let md = `# 数据质量评阅报告\n\n`;

      md += `## 概览\n\n`;
      md += `- **综合得分**: ${overallScore} 分 (${overallGrade})\n`;
      if (gradingTime) {
        md += `- **评阅时间**: ${this._formatTime(gradingTime)}\n`;
      }
      if (fileInfo?.fileName) {
        md += `- **文件名称**: ${fileInfo.fileName}\n`;
      }
      md += `\n> ${summary || '暂无摘要'}\n\n`;

      md += `## 各维度得分\n\n`;
      md += `| 维度 | 得分 | 等级 | 描述 |\n`;
      md += `|------|------|------|------|\n`;
      if (dimensionScores) {
        Object.entries(dimensionScores).forEach(([key, dim]) => {
          md += `| ${dimNames[key] || key} | ${dim.score || 0} | ${dim.label || '-'} | ${dim.description || ''} |\n`;
        });
      }
      md += `\n`;

      if (highlights && highlights.length > 0) {
        md += `## 做得好的地方\n\n`;
        highlights.forEach((h, i) => {
          md += `### ${i + 1}. ${h.title}\n\n${h.description || ''}\n\n`;
        });
      }

      if (issues && issues.length > 0) {
        md += `## 需要改进的问题\n\n`;
        const severityText = { high: '🔴 高风险', medium: '🟡 中风险', low: '🟢 低风险' };
        const sortedIssues = [...issues].sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
        });
        sortedIssues.forEach((issue, i) => {
          md += `### ${i + 1}. ${severityText[issue.severity] || '中风险'} - ${issue.title}\n\n`;
          if (issue.description) {
            md += `${issue.description}\n\n`;
          }
          if (issue.column) {
            md += `**相关字段**: \`${issue.column}\`\n\n`;
          }
          if (issue.suggestion) {
            md += `**改进建议**: ${issue.suggestion}\n\n`;
          }
        });
      }

      if (suggestions && suggestions.length > 0) {
        md += `## 改进建议\n\n`;
        const priorityText = { high: '🔴 高优先级', medium: '🟡 中优先级', low: '🟢 低优先级' };
        const sortedSuggestions = [...suggestions].sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
        });
        sortedSuggestions.forEach((s, i) => {
          md += `### ${i + 1}. ${priorityText[s.priority] || '中优先级'} - ${s.title}\n\n${s.description || ''}\n\n`;
        });
      }

      md += `---\n\n*本报告由 AI 智能评阅系统自动生成*`;

      this._downloadFile(md, 'grading-report.md', 'text/markdown');
    } catch (error) {
      console.error('导出Markdown失败:', error);
      this._showToast('导出失败', 'error');
    }
  }

  /**
   * 显示加载状态
   */
  showLoading() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="gr-section">
        <div class="gr-loading">
          <div class="gr-loading-spinner"></div>
          <div class="gr-loading-text">正在生成评阅报告...</div>
        </div>
      </div>
    `;
  }

  /**
   * 显示错误状态
   * @param {string} message - 错误消息
   */
  showError(message) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="gr-section">
        <div class="gr-error">
          <div class="gr-error-icon">❌</div>
          <div class="gr-error-text">${this._escapeHtml(message || '加载失败')}</div>
        </div>
      </div>
    `;
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.chartInstance) {
      this.chartInstance.dispose();
      this.chartInstance = null;
    }

    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    if (this.container) {
      this.container.classList.remove('grading-report-container');
      this.container.innerHTML = '';
    }

    this.result = null;
    this.options = null;
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取分数对应的标签CSS类
   */
  _getScoreLabelClass(score) {
    if (score >= 90) return 'gr-label-excellent';
    if (score >= 80) return 'gr-label-good';
    if (score >= 70) return 'gr-label-average';
    if (score >= 60) return 'gr-label-pass';
    return 'gr-label-poor';
  }

  /**
   * 获取分数对应的进度条CSS类
   */
  _getScoreBarClass(score) {
    if (score >= 90) return 'gr-bar-excellent';
    if (score >= 80) return 'gr-bar-good';
    if (score >= 70) return 'gr-bar-average';
    if (score >= 60) return 'gr-bar-pass';
    return 'gr-bar-poor';
  }

  /**
   * 格式化时间
   */
  _formatTime(isoString) {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '-';
    }
  }

  /**
   * HTML转义
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 下载文件
   */
  _downloadFile(content, fileName, mimeType) {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this._showToast('导出成功', 'success');
    } catch (error) {
      console.error('文件下载失败:', error);
      this._showToast('导出失败', 'error');
    }
  }

  /**
   * 显示提示消息
   */
  _showToast(message, type = 'info') {
    const existing = document.querySelector('.gr-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'gr-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: #171615;
      border: 1px solid #2d2a28;
      border-radius: 8px;
      color: #f0ebe5;
      font-size: 0.875rem;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: gr-toast-in 0.3s ease;
      border-left: 3px solid ${type === 'success' ? '#6a9e6e' : type === 'error' ? '#c45e4b' : '#d48c52'};
    `;
    toast.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes gr-toast-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes gr-toast-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'gr-toast-out 0.3s ease forwards';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  }
}

if (typeof window !== 'undefined') {
  window.GradingReport = GradingReport;
}
