/**
 * Dialog Logger Service
 * 记录每轮对话：用户消息、AI回复、时间戳、角色类型
 * 扩展：埋点监控、数据质量检查、数据管理
 */

class LogService {
  constructor() {
    this.STORAGE_KEY = 'dialog_logs';
    this.PANEL_ID = 'dialog-logger-panel';
    this.isDeveloperMode = false;
    this.logs = this._loadFromStorage();
    this.currentTab = 'dialog';
    this.eventFilter = 'all';
    this.eventPollTimer = null;
    this.lastEventCount = 0;
  }

  _generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  _loadFromStorage() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load logs from storage:', e);
      return [];
    }
  }

  _saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save logs to storage:', e);
    }
  }

  add({ sessionId, role, agentMode, message, metadata = {}, userTimestamp }) {
    const entry = {
      id: this._generateId(),
      sessionId: sessionId || '',
      timestamp: Date.now(),
      role: role,
      agentMode: agentMode || 'knowledge',
      message: message || '',
      metadata: {
        stageId: metadata.stageId || '',
        lessonId: metadata.lessonId || '',
        model: metadata.model || '',
        tokens: metadata.tokens || 0
      }
    };

    if (window.AITracker) {
      try {
        if (role === 'student' || role === 'user') {
          const analysis = AITracker.analyzeUserMessage({
            text: message,
            role,
            sessionId,
            timestamp: entry.timestamp
          });
          entry.metadata = { ...entry.metadata, ...analysis };
        } else {
          const analysis = AITracker.analyzeAgentResponse({
            text: message,
            role,
            userTimestamp: userTimestamp,
            agentTimestamp: entry.timestamp
          });
          entry.metadata = { ...entry.metadata, ...analysis };
        }
      } catch (e) {
        console.warn('AITracker analysis failed:', e);
      }
    }

    this.logs.push(entry);
    this._saveToStorage();

    if (this.isDeveloperMode) {
      this._updatePanel();
    }

    return entry;
  }

  get(options = {}) {
    let result = [...this.logs];

    if (options.sessionId) {
      result = result.filter(log => log.sessionId === options.sessionId);
    }

    if (options.role) {
      result = result.filter(log => log.role === options.role);
    }

    if (options.limit) {
      result = result.slice(-options.limit);
    }

    return result;
  }

  export() {
    const data = {
      exportedAt: new Date().toISOString(),
      totalCount: this.logs.length,
      logs: this.logs
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `dialog-logs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  clear() {
    this.logs = [];
    this._saveToStorage();
    if (this.isDeveloperMode) {
      this._updatePanel();
    }
  }

  togglePanel() {
    this.isDeveloperMode = !this.isDeveloperMode;

    if (this.isDeveloperMode) {
      this._createPanel();
    } else {
      this._removePanel();
    }
  }

  _createPanel() {
    if (document.getElementById(this.PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = this.PANEL_ID;
    panel.innerHTML = this._getPanelStyles() + this._getPanelHTML();

    document.body.insertBefore(panel, document.body.firstChild);

    this._bindPanelEvents();
    this._updatePanel();
    this._startEventPolling();
  }

  _removePanel() {
    const panel = document.getElementById(this.PANEL_ID);
    if (panel) {
      panel.remove();
    }
    this._stopEventPolling();
  }

  _startEventPolling() {
    if (this.eventPollTimer) return;
    this.eventPollTimer = setInterval(() => {
      if (this.currentTab === 'events' && this.isDeveloperMode) {
        this._refreshEventTab();
      }
    }, 2000);
  }

  _stopEventPolling() {
    if (this.eventPollTimer) {
      clearInterval(this.eventPollTimer);
      this.eventPollTimer = null;
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    panel.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    panel.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
    });

    this._updateTabContent(tabName);
  }

  async _updateTabContent(tabName) {
    switch (tabName) {
      case 'dialog':
        this._updatePanel();
        break;
      case 'events':
        this._refreshEventTab();
        break;
      case 'reading':
        this._refreshReadingTab();
        break;
      case 'exam':
        this._refreshExamTab();
        break;
      case 'profile':
        this._refreshProfileTab();
        break;
      case 'quality':
        this._refreshQualityTab();
        break;
      case 'data':
        this._refreshDataTab();
        break;
    }
  }

  async _refreshEventTab() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    const eventList = panel.querySelector('#event-log-list');
    const eventStats = panel.querySelector('#event-stats');
    if (!eventList || !eventStats) return;

    try {
      let events = [];
      if (window.DB && window.DB.eventLogs) {
        events = await window.DB.eventLogs.query(null, { limit: 100 });
      }

      if (events.length === this.lastEventCount && eventList.children.length > 0) {
        return;
      }
      this.lastEventCount = events.length;

      const filteredEvents = this.eventFilter === 'all' 
        ? events 
        : events.filter(e => e.eventType === this.eventFilter);

      const eventTypes = {};
      events.forEach(e => {
        eventTypes[e.eventType] = (eventTypes[e.eventType] || 0) + 1;
      });

      eventStats.innerHTML = Object.entries(eventTypes).map(([type, count]) => `
        <span class="stat-pill">
          <span class="stat-pill-label">${type || 'unknown'}</span>
          <span class="stat-pill-value">${count}</span>
        </span>
      `).join('');

      if (filteredEvents.length === 0) {
        eventList.innerHTML = '<div class="log-empty">暂无事件埋点数据</div>';
        return;
      }

      const recentEvents = filteredEvents.slice(-50).reverse();
      eventList.innerHTML = recentEvents.map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const propsStr = JSON.stringify(event.properties || {});
        const preview = propsStr.length > 60 ? propsStr.substring(0, 60) + '...' : propsStr;
        
        return `
          <div class="event-item" onclick="LogService._toggleEventDetail(this)">
            <div class="event-header">
              <span class="event-type-badge ${event.eventType}">${event.eventType || 'unknown'}</span>
              <span class="event-name">${event.eventName || event.eventType || '-'}</span>
              <span class="event-time">${time}</span>
            </div>
            <div class="event-preview">${this._escapeHtml(preview)}</div>
            <div class="event-detail" style="display:none;">
              <pre>${this._escapeHtml(JSON.stringify(event, null, 2))}</pre>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      eventList.innerHTML = `<div class="log-empty">加载失败: ${e.message}</div>`;
    }
  }

  _toggleEventDetail(element) {
    const detail = element.querySelector('.event-detail');
    if (detail) {
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    }
  }

  setEventFilter(filter) {
    this.eventFilter = filter;
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    panel.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    this._refreshEventTab();
  }

  async _refreshReadingTab() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    const readingList = panel.querySelector('#reading-session-list');
    const readingStats = panel.querySelector('#reading-stats');
    if (!readingList || !readingStats) return;

    try {
      let stats = { totalSessions: 0, totalDuration: 0, avgScrollDepth: 0, avgReadingSpeed: 0 };
      let sessions = [];

      if (window.DB && window.DB.readingBehavior) {
        stats = await window.DB.readingBehavior.getStats();
        const allRecords = await this._getAllReadingRecords();
        const sessionMap = new Map();
        
        allRecords.forEach(r => {
          const sid = r.sessionId || r.lessonId || 'unknown';
          if (!sessionMap.has(sid)) {
            sessionMap.set(sid, {
              sessionId: sid,
              lessonId: r.lessonId,
              startTime: r.createdAt || r.startTime,
              endTime: r.createdAt || r.endTime,
              duration: r.totalDuration || r.activeDuration || 0,
              maxDepth: r.maxScrollDepth || 0,
              avgSpeed: r.avgReadingSpeed || 0,
              revisitCount: 0
            });
          } else {
            const existing = sessionMap.get(sid);
            existing.revisitCount++;
            existing.endTime = r.createdAt || r.endTime;
            existing.duration += r.totalDuration || r.activeDuration || 0;
          }
        });
        
        sessions = Array.from(sessionMap.values()).sort((a, b) => b.startTime - a.startTime);
      }

      const formatDuration = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}分${secs}秒`;
      };

      readingStats.innerHTML = `
        <div class="stat-card">
          <div class="stat-card-value">${stats.totalSessions}</div>
          <div class="stat-card-label">阅读会话</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${formatDuration(stats.totalDuration)}</div>
          <div class="stat-card-label">总时长</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${Math.round(stats.avgScrollDepth || 0)}%</div>
          <div class="stat-card-label">平均深度</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${Math.round(stats.avgReadingSpeed || 0)}</div>
          <div class="stat-card-label">平均速度(字/分)</div>
        </div>
      `;

      if (sessions.length === 0) {
        readingList.innerHTML = '<div class="log-empty">暂无阅读行为数据</div>';
        return;
      }

      readingList.innerHTML = sessions.slice(0, 20).map(session => {
        const time = new Date(session.startTime).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        return `
          <div class="session-item">
            <div class="session-header">
              <span class="session-lesson">${session.lessonId || '未知课程'}</span>
              <span class="session-time">${time}</span>
            </div>
            <div class="session-meta">
              <span>时长: ${formatDuration(session.duration)}</span>
              <span>深度: ${Math.round(session.maxDepth)}%</span>
              <span>回访: ${session.revisitCount}次</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      readingList.innerHTML = `<div class="log-empty">加载失败: ${e.message}</div>`;
    }
  }

  async _getAllReadingRecords() {
    try {
      return await new Promise((resolve) => {
        const req = indexedDB.open('MarketDataAnalysisDB', 3);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('reading_behavior', 'readonly');
          const store = tx.objectStore('reading_behavior');
          const getReq = store.getAll();
          getReq.onsuccess = () => resolve(getReq.result || []);
          getReq.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }

  async _refreshExamTab() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    const examList = panel.querySelector('#exam-record-list');
    const examStats = panel.querySelector('#exam-stats');
    const topicStats = panel.querySelector('#topic-stats');
    if (!examList || !examStats || !topicStats) return;

    try {
      let stats = {
        totalQuestions: 0,
        correctCount: 0,
        accuracy: 0,
        avgDuration: 0,
        topicStats: {}
      };
      let records = [];

      if (window.DB && window.DB.examBehavior) {
        stats = await window.DB.examBehavior.getStats();
        records = await this._getAllExamRecords();
        records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }

      const formatDuration = (ms) => {
        const seconds = Math.floor(ms / 1000);
        return `${seconds}秒`;
      };

      examStats.innerHTML = `
        <div class="stat-card">
          <div class="stat-card-value">${stats.totalQuestions}</div>
          <div class="stat-card-label">答题总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${stats.correctCount}</div>
          <div class="stat-card-label">正确数</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${Math.round(stats.accuracy || 0)}%</div>
          <div class="stat-card-label">正确率</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${formatDuration(stats.avgDuration || 0)}</div>
          <div class="stat-card-label">平均用时</div>
        </div>
      `;

      const topicEntries = Object.entries(stats.topicStats || {});
      if (topicEntries.length > 0) {
        topicStats.innerHTML = `
          <div class="topic-stats-title">知识点掌握度</div>
          <div class="topic-list">
            ${topicEntries.map(([topic, stat]) => {
              const accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
              const barColor = accuracy >= 80 ? 'var(--accent-success)' : accuracy >= 60 ? 'var(--accent-gold)' : 'var(--accent-danger)';
              return `
                <div class="topic-item">
                  <div class="topic-header">
                    <span class="topic-name">${topic}</span>
                    <span class="topic-accuracy">${accuracy}% (${stat.correct}/${stat.total})</span>
                  </div>
                  <div class="progress-bar-small">
                    <div class="progress-fill" style="width: ${accuracy}%; background: ${barColor};"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        topicStats.innerHTML = '';
      }

      if (records.length === 0) {
        examList.innerHTML = '<div class="log-empty">暂无答题行为数据</div>';
        return;
      }

      examList.innerHTML = records.slice(0, 20).map(record => {
        const time = new Date(record.createdAt || record.timestamp || 0).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        const isCorrect = record.isCorrect ? 'correct' : 'incorrect';
        const statusText = record.isCorrect ? '正确' : (record.skipped ? '跳过' : '错误');
        
        return `
          <div class="exam-item ${isCorrect}">
            <div class="exam-header">
              <span class="exam-topic">${record.topic || record.questionId || '未知'}</span>
              <span class="exam-status ${isCorrect}">${statusText}</span>
            </div>
            <div class="exam-meta">
              <span>课程: ${record.lessonId || '-'}</span>
              <span>用时: ${formatDuration(record.duration || 0)}</span>
              <span>${time}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      examList.innerHTML = `<div class="log-empty">加载失败: ${e.message}</div>`;
    }
  }

  async _getAllExamRecords() {
    try {
      return await new Promise((resolve) => {
        const req = indexedDB.open('MarketDataAnalysisDB', 3);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('exam_behavior', 'readonly');
          const store = tx.objectStore('exam_behavior');
          const getReq = store.getAll();
          getReq.onsuccess = () => resolve(getReq.result || []);
          getReq.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }

  async _refreshProfileTab() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    const profileContent = panel.querySelector('#profile-content');
    if (!profileContent) return;

    try {
      let profile = null;
      if (window.StudentProfileService && window.StudentProfileService.getProfile) {
        profile = await window.StudentProfileService.getProfile();
      } else if (window.DB && window.DB.profiles) {
        profile = await window.DB.profiles.get();
      }

      if (!profile) {
        profileContent.innerHTML = '<div class="log-empty">暂无学生画像数据</div>';
        return;
      }

      const basics = profile.basics || {};
      const abilities = profile.abilities || {};
      const tags = profile.tags || [];
      const knowledgeMastery = profile.knowledgeMastery || {};

      const dimensionScores = [
        { name: '学习基础', score: Math.min(100, (basics.completedLessons || 0) * 2) },
        { name: '知识掌握', score: knowledgeMastery.overallScore || 0 },
        { name: '逻辑分析', score: abilities.logicalAnalysis || 0 },
        { name: '数据处理', score: abilities.dataProcessing || 0 },
        { name: '沟通表达', score: abilities.communication || 0 },
        { name: '问题解决', score: abilities.problemSolving || 0 }
      ];

      profileContent.innerHTML = `
        <div class="profile-section">
          <div class="profile-section-title">画像快照</div>
          <div class="profile-basics">
            <div><span class="label">当前阶段:</span> 第${basics.currentStage || 1}阶段</div>
            <div><span class="label">已完成课时:</span> ${basics.completedLessons || 0}/${basics.totalLessons || 64}</div>
            <div><span class="label">学习天数:</span> ${basics.totalStudyDays || 0}天</div>
            <div><span class="label">累计时长:</span> ${Math.round((basics.totalStudyTime || 0) / 60000)}分钟</div>
          </div>
        </div>
        
        <div class="profile-section">
          <div class="profile-section-title">6大维度得分</div>
          <div class="dimension-list">
            ${dimensionScores.map(d => `
              <div class="dimension-item">
                <div class="dimension-header">
                  <span class="dimension-name">${d.name}</span>
                  <span class="dimension-score">${Math.round(d.score)}分</span>
                </div>
                <div class="progress-bar-small">
                  <div class="progress-fill" style="width: ${d.score}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="profile-section">
          <div class="profile-section-title">自动标签 (${tags.length})</div>
          <div class="tag-list">
            ${tags.map(tag => `
              <span class="tag-badge tag-${tag.category || 'default'}">
                ${tag.name}
                <span class="tag-weight">${Math.round(tag.weight * 100)}%</span>
              </span>
            `).join('')}
          </div>
        </div>
        
        <div class="profile-section">
          <div class="profile-section-title">画像数据</div>
          <details class="profile-details">
            <summary>查看完整 JSON 数据</summary>
            <pre class="profile-json">${this._escapeHtml(JSON.stringify(profile, null, 2))}</pre>
          </details>
        </div>
      `;
    } catch (e) {
      profileContent.innerHTML = `<div class="log-empty">加载失败: ${e.message}</div>`;
    }
  }

  async _refreshQualityTab() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    const qualityContent = panel.querySelector('#quality-content');
    if (!qualityContent) return;

    try {
      const results = await this._runQualityChecks();

      qualityContent.innerHTML = `
        <div class="quality-section">
          <div class="quality-section-title">埋点覆盖率检查</div>
          <div class="quality-list">
            ${results.coverage.map(item => `
              <div class="quality-item ${item.status}">
                <div class="quality-item-header">
                  <span class="quality-name">${item.name}</span>
                  <span class="quality-status ${item.status}">${item.statusText}</span>
                </div>
                <div class="quality-detail">${item.detail}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="quality-section">
          <div class="quality-section-title">数据一致性检查</div>
          <div class="quality-list">
            ${results.consistency.map(item => `
              <div class="quality-item ${item.status}">
                <div class="quality-item-header">
                  <span class="quality-name">${item.name}</span>
                  <span class="quality-status ${item.status}">${item.statusText}</span>
                </div>
                <div class="quality-detail">${item.detail}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="quality-section">
          <div class="quality-section-title">数据量统计</div>
          <div class="quality-stats-grid">
            ${results.dataVolume.map(item => `
              <div class="quality-stat-card">
                <div class="quality-stat-value">${item.value}</div>
                <div class="quality-stat-label">${item.name}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="quality-summary ${results.overallStatus}">
          <strong>总体评估:</strong> ${results.overallText}
        </div>
      `;
    } catch (e) {
      qualityContent.innerHTML = `<div class="log-empty">检查失败: ${e.message}</div>`;
    }
  }

  async _runQualityChecks() {
    const coverage = [];
    const consistency = [];
    const dataVolume = [];

    try {
      const eventLogs = window.DB?.eventLogs ? await window.DB.eventLogs.query(null, {}) : [];
      const readingRecords = await this._getAllReadingRecords();
      const examRecords = await this._getAllExamRecords();
      const conversations = window.DB?.conversations ? await window.DB.conversations.getAll() : [];
      const progress = window.DB?.progress ? await window.DB.progress.getAll() : [];
      const profiles = window.DB?.profiles ? await window.DB.profiles.getAll() : [];
      const students = window.DB?.students ? await window.DB.students.getAll() : [];

      const eventTypes = {};
      eventLogs.forEach(e => {
        eventTypes[e.eventType] = (eventTypes[e.eventType] || 0) + 1;
      });

      const expectedTypes = ['page_view', 'scroll_depth', 'ai_message', 'mode_switch'];
      expectedTypes.forEach(type => {
        const count = eventTypes[type] || 0;
        const status = count > 0 ? 'pass' : 'warning';
        coverage.push({
          name: `${type} 事件`,
          status,
          statusText: count > 0 ? '正常' : '缺失',
          detail: `已采集 ${count} 条${count > 0 ? ' ✓' : ' - 建议检查埋点是否正确触发'}`
        });
      });

      coverage.push({
        name: '阅读行为埋点',
        status: readingRecords.length > 0 ? 'pass' : 'warning',
        statusText: readingRecords.length > 0 ? '正常' : '缺失',
        detail: `已采集 ${readingRecords.length} 条阅读行为记录`
      });

      coverage.push({
        name: '答题行为埋点',
        status: examRecords.length > 0 ? 'pass' : 'warning',
        statusText: examRecords.length > 0 ? '正常' : '缺失',
        detail: `已采集 ${examRecords.length} 条答题行为记录`
      });

      const requiredEventFields = ['eventType', 'timestamp', 'studentId'];
      let missingFieldCount = 0;
      eventLogs.forEach(e => {
        requiredEventFields.forEach(f => {
          if (!e[f]) missingFieldCount++;
        });
      });
      const fieldCompleteness = eventLogs.length > 0 
        ? Math.round(((eventLogs.length * requiredEventFields.length - missingFieldCount) / (eventLogs.length * requiredEventFields.length)) * 100)
        : 100;

      coverage.push({
        name: '事件数据完整性',
        status: fieldCompleteness >= 95 ? 'pass' : 'error',
        statusText: fieldCompleteness >= 95 ? '良好' : '异常',
        detail: `必填字段完整率: ${fieldCompleteness}%`
      });

      const studentId = localStorage.getItem('current_student_id') || localStorage.getItem('default_student_id');
      const eventStudentIds = new Set(eventLogs.map(e => e.studentId).filter(Boolean));
      const allStudentIds = new Set([
        ...eventStudentIds,
        ...new Set(readingRecords.map(r => r.studentId).filter(Boolean)),
        ...new Set(examRecords.map(r => r.studentId).filter(Boolean))
      ]);

      consistency.push({
        name: '学生ID一致性',
        status: allStudentIds.size <= 1 ? 'pass' : 'warning',
        statusText: allStudentIds.size <= 1 ? '一致' : '不一致',
        detail: `检测到 ${allStudentIds.size} 个不同的学生ID`
      });

      const now = Date.now();
      const futureEvents = eventLogs.filter(e => e.timestamp > now + 86400000);
      const oldEvents = eventLogs.filter(e => e.timestamp < now - 365 * 86400000);
      
      consistency.push({
        name: '时间戳合理性',
        status: futureEvents.length === 0 && oldEvents.length < 10 ? 'pass' : 'warning',
        statusText: futureEvents.length === 0 && oldEvents.length < 10 ? '正常' : '异常',
        detail: `未来时间数据: ${futureEvents.length}条, 超过1年数据: ${oldEvents.length}条`
      });

      const eventSignatures = new Set();
      let duplicateCount = 0;
      eventLogs.forEach(e => {
        const sig = `${e.eventType}_${e.timestamp}_${e.studentId}`;
        if (eventSignatures.has(sig)) duplicateCount++;
        eventSignatures.add(sig);
      });

      consistency.push({
        name: '重复数据检测',
        status: duplicateCount === 0 ? 'pass' : 'warning',
        statusText: duplicateCount === 0 ? '无重复' : '有重复',
        detail: `检测到约 ${duplicateCount} 条疑似重复数据`
      });

      dataVolume.push({ name: '事件埋点', value: eventLogs.length });
      dataVolume.push({ name: '阅读行为', value: readingRecords.length });
      dataVolume.push({ name: '答题行为', value: examRecords.length });
      dataVolume.push({ name: 'AI对话', value: conversations.length });
      dataVolume.push({ name: '学习进度', value: progress.length });
      dataVolume.push({ name: '学生画像', value: profiles.length });

      let totalSize = 0;
      try {
        const estimate = await navigator.storage.estimate();
        totalSize = estimate.usage || 0;
      } catch (e) {}

      dataVolume.push({ 
        name: '存储使用量', 
        value: (totalSize / 1024 / 1024).toFixed(2) + ' MB' 
      });

      const passCount = [...coverage, ...consistency].filter(i => i.status === 'pass').length;
      const totalChecks = coverage.length + consistency.length;
      const passRate = totalChecks > 0 ? (passCount / totalChecks) * 100 : 100;

      let overallStatus = 'pass';
      let overallText = `数据质量良好 (${Math.round(passRate)}% 通过)`;
      if (passRate < 60) {
        overallStatus = 'error';
        overallText = `数据质量较差 (${Math.round(passRate)}% 通过)，请检查埋点配置`;
      } else if (passRate < 90) {
        overallStatus = 'warning';
        overallText = `数据质量一般 (${Math.round(passRate)}% 通过)，建议优化部分埋点`;
      }

      return {
        coverage,
        consistency,
        dataVolume,
        overallStatus,
        overallText
      };
    } catch (e) {
      console.error('Quality check error:', e);
      return {
        coverage: [{ name: '检查失败', status: 'error', statusText: '错误', detail: e.message }],
        consistency: [],
        dataVolume: [],
        overallStatus: 'error',
        overallText: '数据质量检查失败'
      };
    }
  }

  async _refreshDataTab() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    const dataContent = panel.querySelector('#data-content');
    if (!dataContent) return;

    dataContent.innerHTML = `
      <div class="data-section">
        <div class="data-section-title">数据导出</div>
        <div class="data-actions">
          <button class="panel-btn data-btn" onclick="LogService.exportAllData('current')">
            📤 导出当前学生数据
          </button>
          <button class="panel-btn data-btn" onclick="LogService.exportAllData('all')">
            📤 导出所有学生数据
          </button>
        </div>
        <div class="data-hint">导出为 JSON 格式，包含所有学习相关数据</div>
      </div>
      
      <div class="data-section">
        <div class="data-section-title">数据导入</div>
        <div class="data-actions">
          <label class="panel-btn data-btn data-import-label">
            📥 导入数据文件
            <input type="file" accept=".json" style="display:none" onchange="LogService.importData(this)">
          </label>
        </div>
        <div class="data-hint">支持导入之前导出的 JSON 数据文件</div>
      </div>
      
      <div class="data-section">
        <div class="data-section-title">清除数据</div>
        <div class="data-actions">
          <button class="panel-btn data-btn danger-btn" onclick="LogService.clearDataConfirm('current')">
            🗑️ 清除当前学生数据
          </button>
          <button class="panel-btn data-btn danger-btn" onclick="LogService.clearDataConfirm('all')">
            🗑️ 清除所有数据
          </button>
        </div>
        <div class="data-hint">清除的数据无法恢复，请谨慎操作</div>
      </div>
      
      <div id="import-preview-section" style="display:none;">
        <div class="data-section-title">导入预览</div>
        <div id="import-preview-content"></div>
        <div class="data-actions">
          <button class="panel-btn data-btn" onclick="LogService.cancelImport()">取消</button>
          <button class="panel-btn data-btn" onclick="LogService.confirmImport('merge')">合并导入</button>
          <button class="panel-btn data-btn danger-btn" onclick="LogService.confirmImport('overwrite')">覆盖导入</button>
        </div>
      </div>
    `;
  }

  async exportAllData(scope = 'current') {
    try {
      const allData = {
        exportVersion: '2.0',
        exportDate: new Date().toISOString(),
        exportScope: scope,
        tables: {}
      };

      const tables = [
        'students', 'learning_progress', 'ai_conversations', 'submissions',
        'assessments', 'behavior_metrics', 'reading_behavior', 'exam_behavior',
        'event_logs', 'student_profiles'
      ];

      for (const tableName of tables) {
        const records = await this._getAllRecordsFromTable(tableName);
        allData.tables[tableName] = records;
      }

      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `学生数据_${scope === 'all' ? '全部' : '当前'}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this._showToast('success', '导出成功', '数据已导出为 JSON 文件');
    } catch (e) {
      this._showToast('error', '导出失败', e.message);
    }
  }

  async _getAllRecordsFromTable(tableName) {
    try {
      return await new Promise((resolve, reject) => {
        const req = indexedDB.open('MarketDataAnalysisDB', 3);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(tableName)) {
            resolve([]);
            return;
          }
          const tx = db.transaction(tableName, 'readonly');
          const store = tx.objectStore(tableName);
          const getReq = store.getAll();
          getReq.onsuccess = () => resolve(getReq.result || []);
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return [];
    }
  }

  _pendingImportData = null;

  async importData(input) {
    const file = input.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.tables || !data.exportVersion) {
        throw new Error('无效的数据文件格式');
      }

      this._pendingImportData = data;

      const previewSection = document.querySelector('#import-preview-section');
      const previewContent = document.querySelector('#import-preview-content');
      
      if (previewSection && previewContent) {
        previewSection.style.display = 'block';
        
        const tableSummaries = Object.entries(data.tables).map(([name, records]) => `
          <div class="preview-table-item">
            <span class="preview-table-name">${name}</span>
            <span class="preview-table-count">${records.length} 条</span>
          </div>
        `).join('');

        previewContent.innerHTML = `
          <div class="import-info">
            <div><strong>导出版本:</strong> ${data.exportVersion}</div>
            <div><strong>导出时间:</strong> ${new Date(data.exportDate).toLocaleString('zh-CN')}</div>
            <div><strong>导出范围:</strong> ${data.exportScope === 'all' ? '全部学生' : '当前学生'}</div>
          </div>
          <div class="preview-tables">
            ${tableSummaries}
          </div>
        `;
      }

      this._showToast('info', '文件已加载', '请预览后确认导入方式');
    } catch (e) {
      this._showToast('error', '导入失败', '无效的 JSON 文件: ' + e.message);
    }

    input.value = '';
  }

  cancelImport() {
    this._pendingImportData = null;
    const previewSection = document.querySelector('#import-preview-section');
    if (previewSection) {
      previewSection.style.display = 'none';
    }
  }

  async confirmImport(mode) {
    if (!this._pendingImportData) return;

    const confirmed = confirm(`确定要以${mode === 'overwrite' ? '覆盖' : '合并'}模式导入数据吗？${mode === 'overwrite' ? '这将删除现有数据！' : ''}`);
    if (!confirmed) return;

    try {
      const data = this._pendingImportData;

      if (mode === 'overwrite') {
        await this._clearAllTables();
      }

      for (const [tableName, records] of Object.entries(data.tables)) {
        await this._bulkAddToTable(tableName, records);
      }

      this._pendingImportData = null;
      const previewSection = document.querySelector('#import-preview-section');
      if (previewSection) {
        previewSection.style.display = 'none';
      }

      this._showToast('success', '导入成功', '数据已成功导入');
      
      if (this.currentTab === 'quality') {
        this._refreshQualityTab();
      }
    } catch (e) {
      this._showToast('error', '导入失败', e.message);
    }
  }

  async _clearAllTables() {
    const tables = [
      'students', 'learning_progress', 'ai_conversations', 'submissions',
      'assessments', 'behavior_metrics', 'reading_behavior', 'exam_behavior',
      'event_logs', 'student_profiles'
    ];

    return new Promise((resolve, reject) => {
      const req = indexedDB.open('MarketDataAnalysisDB', 3);
      req.onsuccess = () => {
        const db = req.result;
        const existingTables = tables.filter(t => db.objectStoreNames.contains(t));
        const tx = db.transaction(existingTables, 'readwrite');
        
        existingTables.forEach(tableName => {
          tx.objectStore(tableName).clear();
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async _bulkAddToTable(tableName, records) {
    if (!records || records.length === 0) return;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open('MarketDataAnalysisDB', 3);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(tableName)) {
          resolve();
          return;
        }
        const tx = db.transaction(tableName, 'readwrite');
        const store = tx.objectStore(tableName);

        let completed = 0;
        records.forEach(record => {
          const addReq = store.put(record);
          addReq.onsuccess = () => {
            completed++;
            if (completed === records.length) {
              resolve();
            }
          };
          addReq.onerror = () => {
            completed++;
            if (completed === records.length) {
              resolve();
            }
          };
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  clearDataConfirm(scope) {
    const message = scope === 'all' 
      ? '确定要清除所有数据吗？此操作不可恢复！' 
      : '确定要清除当前学生数据吗？此操作不可恢复！';
    
    if (confirm(message)) {
      this._clearData(scope);
    }
  }

  async _clearData(scope) {
    try {
      if (scope === 'all') {
        if (window.DB?.clearAll) {
          await window.DB.clearAll();
        }
        localStorage.clear();
      } else {
        const studentId = localStorage.getItem('current_student_id') || localStorage.getItem('default_student_id');
        if (window.DB?.clearStudentData && studentId) {
          await window.DB.clearStudentData(studentId);
        }
      }

      this._showToast('success', '已清除', '数据已成功清除');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      this._showToast('error', '清除失败', e.message);
    }
  }

  _showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    if (!container) {
      alert(`${title}: ${message}`);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  _getPanelStyles() {
    return `
      <style>
        #${this.PANEL_ID} {
          position: fixed;
          top: 70px;
          right: 10px;
          width: 480px;
          max-height: 70vh;
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border-color, #3a3a5c);
          border-radius: 12px;
          z-index: 10000;
          font-family: var(--font-ui, system-ui);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
        }
        #${this.PANEL_ID} .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #3a3a5c);
          background: var(--bg-tertiary, #16162a);
          border-radius: 12px 12px 0 0;
          cursor: move;
        }
        #${this.PANEL_ID} .panel-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #${this.PANEL_ID} .panel-actions {
          display: flex;
          gap: 8px;
        }
        #${this.PANEL_ID} .panel-btn {
          padding: 4px 10px;
          border: 1px solid var(--border-color, #3a3a5c);
          background: var(--bg-secondary, #1a1a2e);
          color: var(--text-secondary, #a0a0b0);
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        #${this.PANEL_ID} .panel-btn:hover {
          background: var(--accent-primary, #d48c52);
          color: white;
          border-color: var(--accent-primary, #d48c52);
        }
        #${this.PANEL_ID} .panel-btn.close {
          background: transparent;
          color: var(--text-tertiary, #666);
        }
        #${this.PANEL_ID} .panel-btn.close:hover {
          background: var(--accent-danger, #e74c3c);
          color: white;
          border-color: var(--accent-danger, #e74c3c);
        }
        #${this.PANEL_ID} .tabs {
          display: flex;
          gap: 2px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color, #3a3a5c);
          background: var(--bg-tertiary, #16162a);
          overflow-x: auto;
        }
        #${this.PANEL_ID} .tab-btn {
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--text-tertiary, #888);
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
          transition: all 0.2s;
        }
        #${this.PANEL_ID} .tab-btn:hover {
          color: var(--text-secondary, #a0a0b0);
          background: var(--bg-secondary, #1a1a2e);
        }
        #${this.PANEL_ID} .tab-btn.active {
          color: var(--accent-primary, #d48c52);
          background: var(--bg-secondary, #1a1a2e);
          font-weight: 600;
        }
        #${this.PANEL_ID} .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          max-height: calc(70vh - 140px);
        }
        #${this.PANEL_ID} .tab-content {
          display: none;
        }
        #${this.PANEL_ID} .tab-content.active {
          display: block;
        }
        #${this.PANEL_ID} .log-entry {
          padding: 8px 12px;
          margin-bottom: 8px;
          background: var(--bg-tertiary, #16162a);
          border-radius: 8px;
          border-left: 3px solid var(--accent-primary, #d48c52);
        }
        #${this.PANEL_ID} .log-entry.student {
          border-left-color: var(--accent-success, #2ecc71);
        }
        #${this.PANEL_ID} .log-entry.agent {
          border-left-color: var(--accent-primary, #d48c52);
        }
        #${this.PANEL_ID} .log-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 11px;
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .log-role {
          font-weight: 600;
        }
        #${this.PANEL_ID} .log-role.student {
          color: var(--accent-success, #2ecc71);
        }
        #${this.PANEL_ID} .log-role.agent {
          color: var(--accent-primary, #d48c52);
        }
        #${this.PANEL_ID} .log-message {
          font-size: 12px;
          color: var(--text-secondary, #a0a0b0);
          line-height: 1.4;
          word-break: break-word;
          max-height: 60px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #${this.PANEL_ID} .log-empty {
          text-align: center;
          padding: 32px;
          color: var(--text-tertiary, #888);
          font-size: 13px;
        }
        #${this.PANEL_ID} .panel-footer {
          padding: 8px 12px;
          border-top: 1px solid var(--border-color, #3a3a5c);
          font-size: 11px;
          color: var(--text-tertiary, #888);
          text-align: center;
        }
        #${this.PANEL_ID} .panel-toggle {
          position: fixed;
          top: 70px;
          right: 10px;
          padding: 8px 16px;
          background: var(--accent-primary, #d48c52);
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 12px;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(212, 140, 82, 0.3);
          transition: all 0.2s;
        }
        #${this.PANEL_ID} .panel-toggle:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(212, 140, 82, 0.4);
        }
        #${this.PANEL_ID} .filter-bar {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        #${this.PANEL_ID} .filter-btn {
          padding: 4px 10px;
          border: 1px solid var(--border-color, #3a3a5c);
          background: var(--bg-tertiary, #16162a);
          color: var(--text-tertiary, #888);
          border-radius: 16px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
        }
        #${this.PANEL_ID} .filter-btn:hover {
          border-color: var(--accent-primary, #d48c52);
          color: var(--text-secondary, #a0a0b0);
        }
        #${this.PANEL_ID} .filter-btn.active {
          background: var(--accent-primary, #d48c52);
          color: white;
          border-color: var(--accent-primary, #d48c52);
        }
        #${this.PANEL_ID} .event-stats-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        #${this.PANEL_ID} .stat-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: var(--bg-tertiary, #16162a);
          border-radius: 16px;
          font-size: 11px;
        }
        #${this.PANEL_ID} .stat-pill-label {
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .stat-pill-value {
          color: var(--accent-primary, #d48c52);
          font-weight: 600;
        }
        #${this.PANEL_ID} .event-item {
          padding: 10px 12px;
          margin-bottom: 8px;
          background: var(--bg-tertiary, #16162a);
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        #${this.PANEL_ID} .event-item:hover {
          background: var(--bg-secondary, #1a1a2e);
        }
        #${this.PANEL_ID} .event-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        #${this.PANEL_ID} .event-type-badge {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
          background: var(--accent-primary, #d48c52);
          color: white;
        }
        #${this.PANEL_ID} .event-type-badge.page_view {
          background: #3498db;
        }
        #${this.PANEL_ID} .event-type-badge.scroll_depth {
          background: #9b59b6;
        }
        #${this.PANEL_ID} .event-type-badge.ai_message {
          background: #e67e22;
        }
        #${this.PANEL_ID} .event-type-badge.mode_switch {
          background: #1abc9c;
        }
        #${this.PANEL_ID} .event-name {
          flex: 1;
          font-size: 12px;
          color: var(--text-primary, #fff);
          font-weight: 500;
        }
        #${this.PANEL_ID} .event-time {
          font-size: 11px;
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .event-preview {
          font-size: 11px;
          color: var(--text-tertiary, #888);
          font-family: monospace;
        }
        #${this.PANEL_ID} .event-detail {
          margin-top: 8px;
          padding: 8px;
          background: var(--bg-primary, #0f0f1a);
          border-radius: 6px;
          font-size: 11px;
          color: var(--text-secondary, #a0a0b0);
          max-height: 200px;
          overflow: auto;
        }
        #${this.PANEL_ID} .event-detail pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-all;
        }
        #${this.PANEL_ID} .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }
        #${this.PANEL_ID} .stat-card {
          background: var(--bg-tertiary, #16162a);
          padding: 12px;
          border-radius: 8px;
          text-align: center;
        }
        #${this.PANEL_ID} .stat-card-value {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent-primary, #d48c52);
          margin-bottom: 4px;
        }
        #${this.PANEL_ID} .stat-card-label {
          font-size: 11px;
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .session-item,
        #${this.PANEL_ID} .exam-item {
          padding: 10px 12px;
          margin-bottom: 8px;
          background: var(--bg-tertiary, #16162a);
          border-radius: 8px;
        }
        #${this.PANEL_ID} .session-header,
        #${this.PANEL_ID} .exam-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        #${this.PANEL_ID} .session-lesson,
        #${this.PANEL_ID} .exam-topic {
          font-size: 12px;
          color: var(--text-primary, #fff);
          font-weight: 500;
        }
        #${this.PANEL_ID} .session-time {
          font-size: 11px;
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .session-meta,
        #${this.PANEL_ID} .exam-meta {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .exam-status {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
        }
        #${this.PANEL_ID} .exam-status.correct {
          background: rgba(46, 204, 113, 0.2);
          color: var(--accent-success, #2ecc71);
        }
        #${this.PANEL_ID} .exam-status.incorrect {
          background: rgba(231, 76, 60, 0.2);
          color: var(--accent-danger, #e74c3c);
        }
        #${this.PANEL_ID} .topic-stats-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          margin: 16px 0 10px;
        }
        #${this.PANEL_ID} .topic-item {
          margin-bottom: 8px;
        }
        #${this.PANEL_ID} .topic-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 11px;
        }
        #${this.PANEL_ID} .topic-name {
          color: var(--text-secondary, #a0a0b0);
        }
        #${this.PANEL_ID} .topic-accuracy {
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .progress-bar-small {
          height: 4px;
          background: var(--bg-primary, #0f0f1a);
          border-radius: 2px;
          overflow: hidden;
        }
        #${this.PANEL_ID} .progress-fill {
          height: 100%;
          background: var(--accent-primary, #d48c52);
          border-radius: 2px;
          transition: width 0.3s;
        }
        #${this.PANEL_ID} .profile-section {
          margin-bottom: 20px;
        }
        #${this.PANEL_ID} .profile-section-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--border-color, #3a3a5c);
        }
        #${this.PANEL_ID} .profile-basics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary, #a0a0b0);
        }
        #${this.PANEL_ID} .profile-basics .label {
          color: var(--text-tertiary, #888);
          margin-right: 6px;
        }
        #${this.PANEL_ID} .dimension-item {
          margin-bottom: 10px;
        }
        #${this.PANEL_ID} .dimension-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;
        }
        #${this.PANEL_ID} .dimension-name {
          color: var(--text-secondary, #a0a0b0);
        }
        #${this.PANEL_ID} .dimension-score {
          color: var(--accent-primary, #d48c52);
          font-weight: 600;
        }
        #${this.PANEL_ID} .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        #${this.PANEL_ID} .tag-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 11px;
          background: var(--bg-tertiary, #16162a);
          border: 1px solid var(--border-color, #3a3a5c);
        }
        #${this.PANEL_ID} .tag-stage { border-color: #3498db; color: #3498db; }
        #${this.PANEL_ID} .tag-habit { border-color: #9b59b6; color: #9b59b6; }
        #${this.PANEL_ID} .tag-ability { border-color: #2ecc71; color: #2ecc71; }
        #${this.PANEL_ID} .tag-style { border-color: #e67e22; color: #e67e22; }
        #${this.PANEL_ID} .tag-progress { border-color: #1abc9c; color: #1abc9c; }
        #${this.PANEL_ID} .tag-weight {
          font-size: 10px;
          opacity: 0.7;
        }
        #${this.PANEL_ID} .profile-details {
          background: var(--bg-tertiary, #16162a);
          padding: 10px;
          border-radius: 8px;
        }
        #${this.PANEL_ID} .profile-details summary {
          cursor: pointer;
          color: var(--text-secondary, #a0a0b0);
          font-size: 12px;
        }
        #${this.PANEL_ID} .profile-json {
          margin-top: 10px;
          padding: 10px;
          background: var(--bg-primary, #0f0f1a);
          border-radius: 6px;
          font-size: 10px;
          color: var(--text-tertiary, #888);
          max-height: 200px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-all;
        }
        #${this.PANEL_ID} .quality-section {
          margin-bottom: 20px;
        }
        #${this.PANEL_ID} .quality-section-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--border-color, #3a3a5c);
        }
        #${this.PANEL_ID} .quality-item {
          padding: 10px 12px;
          margin-bottom: 8px;
          background: var(--bg-tertiary, #16162a);
          border-radius: 8px;
          border-left: 3px solid var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .quality-item.pass {
          border-left-color: var(--accent-success, #2ecc71);
        }
        #${this.PANEL_ID} .quality-item.warning {
          border-left-color: var(--accent-gold, #f39c12);
        }
        #${this.PANEL_ID} .quality-item.error {
          border-left-color: var(--accent-danger, #e74c3c);
        }
        #${this.PANEL_ID} .quality-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        #${this.PANEL_ID} .quality-name {
          font-size: 12px;
          color: var(--text-primary, #fff);
          font-weight: 500;
        }
        #${this.PANEL_ID} .quality-status {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
        }
        #${this.PANEL_ID} .quality-status.pass {
          background: rgba(46, 204, 113, 0.2);
          color: var(--accent-success, #2ecc71);
        }
        #${this.PANEL_ID} .quality-status.warning {
          background: rgba(243, 156, 18, 0.2);
          color: var(--accent-gold, #f39c12);
        }
        #${this.PANEL_ID} .quality-status.error {
          background: rgba(231, 76, 60, 0.2);
          color: var(--accent-danger, #e74c3c);
        }
        #${this.PANEL_ID} .quality-detail {
          font-size: 11px;
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .quality-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        #${this.PANEL_ID} .quality-stat-card {
          background: var(--bg-tertiary, #16162a);
          padding: 10px;
          border-radius: 8px;
          text-align: center;
        }
        #${this.PANEL_ID} .quality-stat-value {
          font-size: 16px;
          font-weight: 700;
          color: var(--accent-primary, #d48c52);
          margin-bottom: 2px;
        }
        #${this.PANEL_ID} .quality-stat-label {
          font-size: 10px;
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .quality-summary {
          padding: 12px;
          border-radius: 8px;
          font-size: 12px;
          text-align: center;
          margin-top: 16px;
        }
        #${this.PANEL_ID} .quality-summary.pass {
          background: rgba(46, 204, 113, 0.1);
          color: var(--accent-success, #2ecc71);
          border: 1px solid rgba(46, 204, 113, 0.3);
        }
        #${this.PANEL_ID} .quality-summary.warning {
          background: rgba(243, 156, 18, 0.1);
          color: var(--accent-gold, #f39c12);
          border: 1px solid rgba(243, 156, 18, 0.3);
        }
        #${this.PANEL_ID} .quality-summary.error {
          background: rgba(231, 76, 60, 0.1);
          color: var(--accent-danger, #e74c3c);
          border: 1px solid rgba(231, 76, 60, 0.3);
        }
        #${this.PANEL_ID} .data-section {
          margin-bottom: 20px;
        }
        #${this.PANEL_ID} .data-section-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--border-color, #3a3a5c);
        }
        #${this.PANEL_ID} .data-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        #${this.PANEL_ID} .data-btn {
          flex: 1;
          min-width: 120px;
          padding: 10px 12px;
          font-size: 12px;
        }
        #${this.PANEL_ID} .danger-btn {
          color: var(--accent-danger, #e74c3c);
          border-color: rgba(231, 76, 60, 0.3);
        }
        #${this.PANEL_ID} .danger-btn:hover {
          background: var(--accent-danger, #e74c3c);
          color: white;
          border-color: var(--accent-danger, #e74c3c);
        }
        #${this.PANEL_ID} .data-hint {
          font-size: 11px;
          color: var(--text-tertiary, #888);
        }
        #${this.PANEL_ID} .data-import-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        #${this.PANEL_ID} .import-info {
          background: var(--bg-tertiary, #16162a);
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 12px;
          color: var(--text-secondary, #a0a0b0);
          line-height: 1.8;
        }
        #${this.PANEL_ID} .preview-tables {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          margin-bottom: 12px;
        }
        #${this.PANEL_ID} .preview-table-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 10px;
          background: var(--bg-tertiary, #16162a);
          border-radius: 6px;
          font-size: 11px;
        }
        #${this.PANEL_ID} .preview-table-name {
          color: var(--text-secondary, #a0a0b0);
        }
        #${this.PANEL_ID} .preview-table-count {
          color: var(--accent-primary, #d48c52);
          font-weight: 600;
        }
      </style>
    `;
  }

  _getPanelHTML() {
    return `
      <div class="panel-header">
        <span class="panel-title">
          <span>🔧</span>
          开发者面板
        </span>
        <div class="panel-actions">
          <button class="panel-btn close" onclick="LogService.togglePanel()">✕</button>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="dialog" onclick="LogService.switchTab('dialog')">对话日志</button>
        <button class="tab-btn" data-tab="events" onclick="LogService.switchTab('events')">事件埋点</button>
        <button class="tab-btn" data-tab="reading" onclick="LogService.switchTab('reading')">阅读行为</button>
        <button class="tab-btn" data-tab="exam" onclick="LogService.switchTab('exam')">答题行为</button>
        <button class="tab-btn" data-tab="profile" onclick="LogService.switchTab('profile')">学生画像</button>
        <button class="tab-btn" data-tab="quality" onclick="LogService.switchTab('quality')">数据质量</button>
        <button class="tab-btn" data-tab="data" onclick="LogService.switchTab('data')">数据管理</button>
      </div>
      <div class="panel-body">
        <div class="tab-content active" data-tab="dialog" id="tab-dialog">
          <div id="${this.PANEL_ID}-body">
            <div class="log-empty">暂无日志记录</div>
          </div>
        </div>
        <div class="tab-content" data-tab="events" id="tab-events">
          <div class="event-stats-bar" id="event-stats"></div>
          <div class="filter-bar">
            <button class="filter-btn active" data-filter="all" onclick="LogService.setEventFilter('all')">全部</button>
            <button class="filter-btn" data-filter="page_view" onclick="LogService.setEventFilter('page_view')">页面访问</button>
            <button class="filter-btn" data-filter="scroll_depth" onclick="LogService.setEventFilter('scroll_depth')">滚动深度</button>
            <button class="filter-btn" data-filter="ai_message" onclick="LogService.setEventFilter('ai_message')">AI对话</button>
            <button class="filter-btn" data-filter="mode_switch" onclick="LogService.setEventFilter('mode_switch')">模式切换</button>
          </div>
          <div id="event-log-list">
            <div class="log-empty">加载中...</div>
          </div>
        </div>
        <div class="tab-content" data-tab="reading" id="tab-reading">
          <div class="stats-grid" id="reading-stats"></div>
          <div id="reading-session-list">
            <div class="log-empty">加载中...</div>
          </div>
        </div>
        <div class="tab-content" data-tab="exam" id="tab-exam">
          <div class="stats-grid" id="exam-stats"></div>
          <div id="topic-stats"></div>
          <div id="exam-record-list">
            <div class="log-empty">加载中...</div>
          </div>
        </div>
        <div class="tab-content" data-tab="profile" id="tab-profile">
          <div id="profile-content">
            <div class="log-empty">加载中...</div>
          </div>
        </div>
        <div class="tab-content" data-tab="quality" id="tab-quality">
          <div id="quality-content">
            <div class="log-empty">加载中...</div>
          </div>
        </div>
        <div class="tab-content" data-tab="data" id="tab-data">
          <div id="data-content">
            <div class="log-empty">加载中...</div>
          </div>
        </div>
      </div>
      <div class="panel-footer">
        双击标题栏可折叠面板 · 可拖动移动位置
      </div>
    `;
  }

  _bindPanelEvents() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    const header = panel.querySelector('.panel-header');
    const body = panel.querySelector('.panel-body');

    header.addEventListener('dblclick', () => {
      if (body.style.display === 'none') {
        body.style.display = 'block';
      } else {
        body.style.display = 'none';
      }
    });

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.panel-btn')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      panel.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = (startLeft + dx) + 'px';
      panel.style.top = (startTop + dy) + 'px';
      panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      panel.style.transition = '';
    });
  }

  _updatePanel() {
    const panel = document.getElementById(this.PANEL_ID);
    if (!panel) return;

    const countEl = panel.querySelector(`#${this.PANEL_ID}-count`);
    const bodyEl = panel.querySelector(`#${this.PANEL_ID}-body`);

    if (!countEl || !bodyEl) return;

    countEl.textContent = this.logs.length;

    if (this.logs.length === 0) {
      bodyEl.innerHTML = '<div class="log-empty">暂无日志记录</div>';
      return;
    }

    const recentLogs = this.logs.slice(-20).reverse();

    bodyEl.innerHTML = recentLogs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const modeLabel = {
        socratic: '苏格拉底',
        knowledge: '知识讲解',
        examiner: '考核答疑',
        onboard: '情景导入',
        reviewer: '主管审稿',
        simulatedTest: '模拟测试',
        assistant: '数据助手'
      }[log.agentMode] || log.agentMode;

      const messagePreview = log.message.length > 100
        ? log.message.substring(0, 100) + '...'
        : log.message;

      return `
        <div class="log-entry ${log.role}">
          <div class="log-meta">
            <span class="log-role ${log.role}">${log.role === 'student' ? '学生' : 'AI'}</span>
            <span>${modeLabel}</span>
            <span>${time}</span>
          </div>
          <div class="log-message">${this._escapeHtml(messagePreview)}</div>
        </div>
      `;
    }).join('');
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.LogService = new LogService();
window.toggleLogPanel = () => LogService.togglePanel();
