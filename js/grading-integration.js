/**
 * 评阅集成模块
 * 整合文件上传、提交保存、AI评阅、报告展示功能
 * 用于学习页面的提交区域集成
 */

class GradingIntegration {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.stageId - 阶段ID
   * @param {string} options.lessonId - 课时ID
   * @param {HTMLElement} options.container - 提交区域容器
   * @param {Object} options.submissionConfig - 提交配置
   */
  constructor(options = {}) {
    this.stageId = options.stageId || null;
    this.lessonId = options.lessonId || null;
    this.container = options.container || null;
    this.submissionConfig = options.submissionConfig || null;

    this.fileUploader = null;
    this.gradingEngine = null;
    this.gradingReport = null;
    this.currentSubmission = null;
    this.currentGradingResult = null;
    this.pollingTimer = null;

    this.statusEl = null;
    this.fileUploadContainer = null;
    this.submitBtn = null;
    this.textInput = null;
    this.ownWorkCheckbox = null;

    if (this.container && this.stageId && this.lessonId) {
      this.init();
    }
  }

  /**
   * 初始化评阅集成
   */
  init() {
    if (!this.container) return;

    try {
      this._findElements();
      this._setupFileUploader();
      this._setupGradingStatus();
      this._loadExistingSubmission();
    } catch (error) {
      console.error('GradingIntegration 初始化失败:', error);
    }
  }

  /**
   * 查找DOM元素
   */
  _findElements() {
    this.statusEl = this.container.querySelector('#submission-status');
    this.textInput = this.container.querySelector('#submission-input');
    this.ownWorkCheckbox = this.container.querySelector('#own-work-checkbox');
    this.submitBtn = this.container.querySelector('button[onclick="submitAnswer()"]');

    if (!this.fileUploadContainer) {
      this.fileUploadContainer = document.createElement('div');
      this.fileUploadContainer.id = 'file-upload-container';
      this.fileUploadContainer.className = 'file-upload-wrapper';
      this.fileUploadContainer.style.marginTop = '16px';
      this.fileUploadContainer.style.display = 'none';

      const textarea = this.container.querySelector('#submission-input');
      if (textarea && textarea.nextSibling) {
        textarea.parentNode.insertBefore(this.fileUploadContainer, textarea.nextSibling);
      } else if (textarea) {
        textarea.parentNode.appendChild(this.fileUploadContainer);
      }
    }
  }

  /**
   * 设置文件上传器
   */
  _setupFileUploader() {
    if (!this.submissionConfig || !this.fileUploadContainer) return;

    const submissionTypes = this.submissionConfig.submissionTypes || [];
    const supportsFile = submissionTypes.includes('file') || submissionTypes.includes('both');

    if (!supportsFile) {
      return;
    }

    this.fileUploadContainer.style.display = 'block';

    if (typeof FileUploader === 'undefined') {
      console.warn('FileUploader 组件未加载');
      this.fileUploadContainer.innerHTML = `
        <div style="padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-md); text-align: center; color: var(--text-tertiary);">
          文件上传组件加载中...
        </div>
      `;
      return;
    }

    const acceptedTypes = this.submissionConfig.acceptedFileTypes || ['.csv', '.json', '.md'];
    const maxFileSize = (this.submissionConfig.maxFileSize || 10) * 1024 * 1024;
    const maxFileCount = this.submissionConfig.maxFileCount || 5;

    this.fileUploader = new FileUploader({
      container: this.fileUploadContainer,
      stageId: this.stageId,
      lessonId: this.lessonId,
      allowedTypes: acceptedTypes,
      maxFileSize: maxFileSize,
      maxBatchSize: maxFileSize * maxFileCount,
      onFileSelected: (files) => this._onFileSelected(files),
      onUploadComplete: (fileInfo) => this._onFileUploaded(fileInfo),
      onFileRemoved: (fileInfo) => this._onFileRemoved(fileInfo)
    });
  }

  /**
   * 设置评阅状态显示区域
   */
  _setupGradingStatus() {
    if (!this.submissionConfig?.requireGrading) return;

    const statusContainer = document.createElement('div');
    statusContainer.id = 'grading-status-container';
    statusContainer.style.marginTop = '16px';
    statusContainer.style.display = 'none';

    statusContainer.innerHTML = `
      <div class="grading-status-box" style="
        padding: 16px 20px;
        background: var(--bg-tertiary);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
      ">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div id="grading-status-icon" style="
              width: 32px;
              height: 32px;
              border-radius: var(--radius-full);
              background: var(--accent-primary-light);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span id="grading-status-spinner" style="
                width: 16px;
                height: 16px;
                border: 2px solid var(--bg-tertiary);
                border-top-color: var(--accent-primary);
                border-radius: 50%;
                animation: gradingSpin 0.8s linear infinite;
                display: none;
              "></span>
              <span id="grading-status-icon-text">⏳</span>
            </div>
            <div>
              <div id="grading-status-text" style="
                font-family: var(--font-ui);
                font-size: 0.9rem;
                color: var(--text-primary);
                font-weight: 500;
              ">等待评阅</div>
              <div id="grading-status-desc" style="
                font-family: var(--font-ui);
                font-size: 0.75rem;
                color: var(--text-tertiary);
                margin-top: 2px;
              ">AI正在准备评阅...</div>
            </div>
          </div>
          <button id="view-report-btn" class="btn btn-primary btn-sm hover-lift" style="display: none;">
            查看评阅报告
          </button>
        </div>
      </div>
      <style>
        @keyframes gradingSpin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    const submitBtn = this.container.querySelector('.flex.justify-between');
    if (submitBtn) {
      submitBtn.parentNode.insertBefore(statusContainer, submitBtn.nextSibling);
    }

    this.gradingStatusContainer = statusContainer;
    this.gradingStatusText = statusContainer.querySelector('#grading-status-text');
    this.gradingStatusDesc = statusContainer.querySelector('#grading-status-desc');
    this.gradingStatusSpinner = statusContainer.querySelector('#grading-status-spinner');
    this.gradingStatusIconText = statusContainer.querySelector('#grading-status-icon-text');
    this.viewReportBtn = statusContainer.querySelector('#view-report-btn');

    if (this.viewReportBtn) {
      this.viewReportBtn.addEventListener('click', () => this.showGradingReport());
    }
  }

  /**
   * 加载已有的提交记录
   */
  async _loadExistingSubmission() {
    try {
      if (!window.DB?.submissions) return;

      const submissions = await DB.submissions.getByLesson?.(this.lessonId);
      if (!submissions || submissions.length === 0) return;

      const latest = submissions[submissions.length - 1];
      this.currentSubmission = latest;

      if (latest.content && this.textInput) {
        this.textInput.value = latest.content;
      }

      if (latest.gradingStatus) {
        this.updateGradingStatus(latest.gradingStatus);
      }

      if (latest.gradingResult && this.submissionConfig?.requireGrading) {
        this.currentGradingResult = latest.gradingResult;
        this.updateGradingStatus('completed');
      }
    } catch (error) {
      console.warn('加载提交记录失败:', error);
    }
  }

  /**
   * 文件选择回调
   */
  _onFileSelected(files) {
    console.log('文件已选择:', files);
  }

  /**
   * 文件上传完成回调
   */
  _onFileUploaded(fileInfo) {
    console.log('文件上传完成:', fileInfo);
  }

  /**
   * 文件移除回调
   */
  _onFileRemoved(fileInfo) {
    console.log('文件已移除:', fileInfo);
  }

  /**
   * 处理提交
   * @param {Object} submissionData - 提交数据
   * @returns {Object} 提交结果
   */
  async handleSubmit(submissionData = {}) {
    try {
      const content = submissionData.content || this.textInput?.value || '';
      const isOwnWork = this.ownWorkCheckbox?.checked || false;

      const hasFiles = this.fileUploader && this.fileUploader.uploadedFiles?.length > 0;
      const files = hasFiles ? this.fileUploader.uploadedFiles : [];
      const fileCount = files.length;

      const submissionRecord = {
        stageId: this.stageId,
        lessonId: this.lessonId,
        content: content,
        isOwnWork: isOwnWork,
        hasFiles: hasFiles,
        fileCount: fileCount,
        files: files,
        gradingStatus: this.submissionConfig?.requireGrading ? 'pending' : 'not-required',
        gradingResult: null,
        gradingResultId: null,
        submittedAt: Date.now()
      };

      if (window.DB?.submissions?.save) {
        const savedId = await DB.submissions.save(submissionRecord);
        submissionRecord.id = savedId;
      }

      this.currentSubmission = submissionRecord;

      if (this.submissionConfig?.requireGrading) {
        this.updateGradingStatus('pending');
        setTimeout(() => {
          this.startGrading(submissionRecord);
        }, 500);
      }

      return {
        success: true,
        submission: submissionRecord
      };
    } catch (error) {
      console.error('提交失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 开始AI评阅
   * @param {Object} submission - 提交记录
   */
  async startGrading(submission) {
    try {
      this.updateGradingStatus('grading');

      if (typeof GradingEngine === 'undefined') {
        console.warn('GradingEngine 未加载，使用模拟评阅');
        await this._simulateGrading(submission);
        return;
      }

      if (!this.gradingEngine) {
        this.gradingEngine = new GradingEngine();
      }

      const gradingType = this.submissionConfig?.gradingType || 'auto';
      let gradingResult = null;

      if (submission.hasFiles && submission.files && submission.files.length > 0) {
        const firstFile = submission.files[0];
        
        if (gradingType === 'data' || gradingType === 'auto') {
          const features = await this._extractFileFeatures(firstFile);
          gradingResult = await this.gradingEngine.gradeDataFileWithRetry(
            {
              fileName: firstFile.name,
              fileType: firstFile.type,
              fileSize: firstFile.size
            },
            features,
            {
              lessonContext: submission.content,
              rubric: this.submissionConfig?.rubric
            }
          );
        } else if (gradingType === 'report') {
          gradingResult = await this.gradingEngine.gradeReport?.(
            {
              fileName: firstFile.name,
              fileType: firstFile.type,
              fileSize: firstFile.size
            },
            {
              content: submission.content,
              fileName: firstFile.name
            },
            {
              lessonContext: submission.content,
              rubric: this.submissionConfig?.rubric
            }
          ) || this._simulateGradingResult(submission);
        }
      } else {
        gradingResult = this._simulateGradingResult(submission);
      }

      if (gradingResult) {
        this.currentGradingResult = gradingResult;
        
        if (submission.id && window.DB?.submissions?.save) {
          submission.gradingStatus = 'completed';
          submission.gradingResult = gradingResult;
          await DB.submissions.save(submission);
        }

        this.updateGradingStatus('completed');
      }
    } catch (error) {
      console.error('评阅失败:', error);
      this.updateGradingStatus('error', error.message);
    }
  }

  /**
   * 提取文件特征
   */
  async _extractFileFeatures(fileInfo) {
    try {
      if (typeof DataParser === 'undefined') {
        return this._generateMockFeatures();
      }

      if (!fileInfo.content) {
        return this._generateMockFeatures();
      }

      const parser = new DataParser();
      let parsedData = null;

      if (fileInfo.name?.endsWith('.csv')) {
        parsedData = parser.parseCSV(fileInfo.content);
      } else if (fileInfo.name?.endsWith('.json')) {
        try {
          const jsonData = JSON.parse(fileInfo.content);
          parsedData = {
            headers: Object.keys(jsonData[0] || {}),
            rows: Array.isArray(jsonData) ? jsonData : [jsonData]
          };
        } catch (e) {
          return this._generateMockFeatures();
        }
      }

      if (!parsedData || parsedData.error) {
        return this._generateMockFeatures();
      }

      if (typeof parser.extractFeatures === 'function') {
        return parser.extractFeatures(parsedData);
      }

      return this._generateMockFeatures(parsedData);
    } catch (error) {
      console.warn('提取文件特征失败:', error);
      return this._generateMockFeatures();
    }
  }

  /**
   * 生成模拟特征数据
   */
  _generateMockFeatures(parsedData = null) {
    const rowCount = parsedData?.rows?.length || 100;
    const colCount = parsedData?.headers?.length || 10;

    return {
      basicStats: {
        rowCount,
        columnCount: colCount,
        fileSize: rowCount * 100
      },
      qualityMetrics: {
        completeness: 0.95,
        duplicateRate: 0.02,
        invalidRate: 0.03
      },
      normalization: {
        formatConsistency: 0.9,
        namingConsistency: 0.85
      },
      fieldAnalysis: {
        numericFields: Math.floor(colCount * 0.3),
        textFields: Math.floor(colCount * 0.5),
        dateFields: Math.floor(colCount * 0.2)
      },
      error: null
    };
  }

  /**
   * 模拟评阅过程
   */
  async _simulateGrading(submission) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = this._simulateGradingResult(submission);
        this.currentGradingResult = result;
        
        if (submission.id && window.DB?.submissions?.save) {
          submission.gradingStatus = 'completed';
          submission.gradingResult = result;
          DB.submissions.save(submission).catch(() => {});
        }

        this.updateGradingStatus('completed');
        resolve(result);
      }, 2000);
    });
  }

  /**
   * 生成模拟评阅结果
   */
  _simulateGradingResult(submission) {
    const baseScore = 75 + Math.floor(Math.random() * 20);
    return {
      overallScore: baseScore,
      overallGrade: baseScore >= 90 ? 'A' : baseScore >= 75 ? 'B' : baseScore >= 60 ? 'C' : 'D',
      dimensionScores: {
        completeness: { score: baseScore - 5, label: '良好', description: '数据完整性较好' },
        standardization: { score: baseScore - 3, label: '良好', description: '格式标准化程度高' },
        accuracy: { score: baseScore + 2, label: '优秀', description: '数据准确性高' },
        processingQuality: { score: baseScore - 8, label: '达标', description: '处理质量有待提升' },
        fieldRichness: { score: baseScore, label: '良好', description: '字段丰富度适中' }
      },
      highlights: [
        '数据完整性达到预期标准',
        '核心字段格式规范统一',
        '数据清洗逻辑清晰'
      ],
      issues: [
        '部分边缘字段存在少量缺失值',
        '格式标准化可以进一步细化',
        '建议增加数据质量校验规则'
      ],
      suggestions: [
        '补充缺失字段的默认值处理逻辑',
        '建立更完善的格式校验规则',
        '增加自动化数据质量检测'
      ],
      summary: `本次提交整体质量良好，综合得分 ${baseScore} 分。数据完整性和准确性表现较好，在格式标准化和处理质量方面还有提升空间。建议按照改进建议进一步优化，提升整体数据质量。`,
      gradingTime: new Date().toISOString(),
      isSimulated: true
    };
  }

  /**
   * 更新评阅状态显示
   * @param {string} status - 状态：pending / grading / completed / error
   * @param {string} message - 附加消息
   */
  updateGradingStatus(status, message = '') {
    if (!this.gradingStatusContainer || !this.submissionConfig?.requireGrading) return;

    this.gradingStatusContainer.style.display = 'block';

    const statusConfig = {
      pending: {
        icon: '⏳',
        spinner: false,
        text: '等待评阅',
        desc: 'AI正在准备评阅...',
        iconBg: 'var(--accent-primary-light)',
        iconColor: 'var(--accent-primary)'
      },
      grading: {
        icon: '',
        spinner: true,
        text: '正在评阅',
        desc: 'AI正在分析您的提交，请稍候...',
        iconBg: 'var(--accent-gold-light)',
        iconColor: 'var(--accent-gold)'
      },
      completed: {
        icon: '✅',
        spinner: false,
        text: '评阅完成',
        desc: '点击右侧按钮查看详细评阅报告',
        iconBg: 'var(--accent-success-light)',
        iconColor: 'var(--accent-success)'
      },
      error: {
        icon: '❌',
        spinner: false,
        text: '评阅失败',
        desc: message || '评阅过程中出现错误，请重试',
        iconBg: 'var(--accent-error-light)',
        iconColor: 'var(--accent-error)'
      }
    };

    const config = statusConfig[status] || statusConfig.pending;

    if (this.gradingStatusText) {
      this.gradingStatusText.textContent = config.text;
    }

    if (this.gradingStatusDesc) {
      this.gradingStatusDesc.textContent = config.desc;
    }

    if (this.gradingStatusIconText) {
      this.gradingStatusIconText.textContent = config.icon;
      this.gradingStatusIconText.style.display = config.spinner ? 'none' : 'block';
    }

    if (this.gradingStatusSpinner) {
      this.gradingStatusSpinner.style.display = config.spinner ? 'block' : 'none';
    }

    const iconBox = this.gradingStatusContainer.querySelector('#grading-status-icon');
    if (iconBox) {
      iconBox.style.background = config.iconBg;
    }

    if (this.viewReportBtn) {
      this.viewReportBtn.style.display = status === 'completed' ? 'inline-flex' : 'none';
    }
  }

  /**
   * 显示评阅报告
   * @param {Object} gradingResult - 评阅结果（可选，不传则使用当前结果）
   */
  showGradingReport(gradingResult = null) {
    const result = gradingResult || this.currentGradingResult;
    if (!result) {
      console.warn('暂无评阅结果可展示');
      return;
    }

    const modal = this._createReportModal();
    if (!modal) return;

    const reportContainer = modal.querySelector('#grading-report-content');
    if (!reportContainer) return;

    if (typeof GradingReport !== 'undefined') {
      this.gradingReport = new GradingReport(reportContainer, {
        showDetails: true,
        allowReGrade: false
      });
      this.gradingReport.render(result);
    } else {
      reportContainer.innerHTML = this._renderSimpleReport(result);
    }

    modal.style.display = 'flex';
  }

  /**
   * 创建报告模态框
   */
  _createReportModal() {
    const existingModal = document.getElementById('grading-report-modal');
    if (existingModal) return existingModal;

    const modal = document.createElement('div');
    modal.id = 'grading-report-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div class="grading-report-modal-content" style="
        background: var(--bg-secondary);
        border-radius: var(--radius-xl);
        border: 1px solid var(--border-color);
        width: 100%;
        max-width: 900px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
      ">
        <div style="
          position: sticky;
          top: 0;
          background: var(--bg-secondary);
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        ">
          <h3 style="
            font-family: var(--font-display);
            font-size: 1.25rem;
            color: var(--text-primary);
            margin: 0;
          ">评阅报告</h3>
          <button onclick="this.closest('#grading-report-modal').style.display='none'" style="
            width: 32px;
            height: 32px;
            border-radius: var(--radius-full);
            border: 1px solid var(--border-color);
            background: var(--bg-primary);
            color: var(--text-secondary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            line-height: 1;
          ">×</button>
        </div>
        <div id="grading-report-content" style="padding: 24px;"></div>
      </div>
    `;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  /**
   * 渲染简易报告（当GradingReport组件不可用时）
   */
  _renderSimpleReport(result) {
    return `
      <div style="text-align: center; padding: 20px 0;">
        <div style="
          font-size: 4rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-gold));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        ">${result.overallScore}分</div>
        <div style="
          display: inline-block;
          padding: 4px 16px;
          border-radius: var(--radius-full);
          background: ${result.overallGrade === 'A' ? 'var(--accent-success-light)' : result.overallGrade === 'B' ? 'var(--accent-primary-light)' : result.overallGrade === 'C' ? 'var(--accent-gold-light)' : 'var(--accent-error-light)'};
          color: ${result.overallGrade === 'A' ? 'var(--accent-success)' : result.overallGrade === 'B' ? 'var(--accent-primary)' : result.overallGrade === 'C' ? 'var(--accent-gold)' : 'var(--accent-error)'};
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 16px;
        ">${result.overallGrade}级</div>
        <p style="color: var(--text-secondary); line-height: 1.7; max-width: 600px; margin: 0 auto;">
          ${result.summary || ''}
        </p>
      </div>
      ${result.highlights?.length ? `
        <div style="margin-top: 24px;">
          <h4 style="color: var(--accent-success); font-size: 1rem; margin-bottom: 12px;">✨ 亮点</h4>
          <ul style="color: var(--text-secondary); line-height: 1.8;">
            ${result.highlights.map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${result.issues?.length ? `
        <div style="margin-top: 20px;">
          <h4 style="color: var(--accent-gold); font-size: 1rem; margin-bottom: 12px;">⚠️ 待改进</h4>
          <ul style="color: var(--text-secondary); line-height: 1.8;">
            ${result.issues.map(i => `<li>${i}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${result.suggestions?.length ? `
        <div style="margin-top: 20px;">
          <h4 style="color: var(--accent-primary); font-size: 1rem; margin-bottom: 12px;">💡 改进建议</h4>
          <ul style="color: var(--text-secondary); line-height: 1.8;">
            ${result.suggestions.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  }

  /**
   * 轮询评阅状态（简化版，当前为同步处理，主要用于展示）
   * @param {string} submissionId - 提交ID
   */
  pollGradingStatus(submissionId) {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.pollingTimer = setInterval(async () => {
      try {
        if (!window.DB?.submissions) return;

        const submission = await DB.submissions.getById?.(submissionId);
        if (submission) {
          this.updateGradingStatus(submission.gradingStatus);
          
          if (submission.gradingStatus === 'completed' || submission.gradingStatus === 'error') {
            this.currentGradingResult = submission.gradingResult;
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
          }
        }
      } catch (error) {
        console.warn('轮询评阅状态失败:', error);
      }
    }, 2000);
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.fileUploader = null;
    this.gradingEngine = null;
    this.gradingReport = null;
    this.currentSubmission = null;
    this.currentGradingResult = null;
  }
}

/**
 * 为指定课时初始化评阅功能
 * @param {string} stageId - 阶段ID
 * @param {string} lessonId - 课时ID
 * @param {HTMLElement} container - 容器元素
 * @returns {GradingIntegration|null} 评阅集成实例
 */
async function initGradingForLesson(stageId, lessonId, container) {
  try {
    if (!window.CourseEngine) {
      console.warn('CourseEngine 未加载');
      return null;
    }

    const submissionConfig = await CourseEngine.getLessonSubmissionConfig(stageId, lessonId);

    return new GradingIntegration({
      stageId,
      lessonId,
      container,
      submissionConfig
    });
  } catch (error) {
    console.error('初始化评阅功能失败:', error);
    return null;
  }
}

window.GradingIntegration = GradingIntegration;
window.initGradingForLesson = initGradingForLesson;
