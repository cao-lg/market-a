/**
 * Issue Tracker - 问题追踪系统
 * 用于追踪学习平台中的AI回复问题
 */
const IssueTracker = (function() {
  const STORAGE_KEY = 'issue-tracker-data';
  const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
  const STATUSES = ['待确认', '待修复', '修复中', '已修复', '延期'];

  const PRIORITY_CONFIG = {
    P0: { label: 'P0', color: '#ef4444', description: '角色定位完全错误，回复答非所问' },
    P1: { label: 'P1', color: '#f97316', description: '引导方式不当，学习者感到困惑' },
    P2: { label: 'P2', color: '#eab308', description: '细节优化，措辞、格式问题' },
    P3: { label: 'P3', color: '#22c55e', description: '锦上添花，功能增强建议' }
  };

  // 数据操作
  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function save(issues) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
  }

  // 生成唯一ID
  function generateId() {
    return `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // API: 添加问题
  function add(issue) {
    const issues = getAll();
    const newIssue = {
      id: generateId(),
      title: issue.title || '',
      description: issue.description || '',
      priority: PRIORITIES.includes(issue.priority) ? issue.priority : 'P2',
      status: STATUSES.includes(issue.status) ? issue.status : '待确认',
      createdAt: Date.now(),
      assignee: issue.assignee || '',
      dueDate: issue.dueDate || null,
      ...issue
    };
    issues.unshift(newIssue);
    save(issues);
    return newIssue;
  }

  // API: 更新问题
  function update(id, updates) {
    const issues = getAll();
    const index = issues.findIndex(i => i.id === id);
    if (index === -1) return null;
    
    issues[index] = { ...issues[index], ...updates, id };
    save(issues);
    return issues[index];
  }

  // API: 按优先级筛选
  function getByPriority(priority) {
    if (!priority || priority === '全部') return getAll();
    return getAll().filter(i => i.priority === priority);
  }

  // API: 导出数据
  function exportData() {
    const issues = getAll();
    return JSON.stringify(issues, null, 2);
  }

  // 删除问题
  function remove(id) {
    const issues = getAll().filter(i => i.id !== id);
    save(issues);
  }

  // 获取统计数据
  function getStats() {
    const issues = getAll();
    const stats = {
      total: issues.length,
      byPriority: {},
      byStatus: {}
    };
    
    PRIORITIES.forEach(p => stats.byPriority[p] = 0);
    STATUSES.forEach(s => stats.byStatus[s] = 0);
    
    issues.forEach(i => {
      stats.byPriority[i.priority]++;
      stats.byStatus[i.status]++;
    });
    
    return stats;
  }

  return {
    add,
    update,
    getByPriority,
    export: exportData,
    remove,
    getAll,
    getStats,
    PRIORITIES,
    STATUSES,
    PRIORITY_CONFIG
  };
})();

// 开发者面板
const IssueTrackerPanel = (function() {
  let panel = null;
  let isVisible = false;
  let collapsed = false;

  function createPanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'issue-tracker-panel';
    panel.innerHTML = getPanelStyles() + getPanelHTML();
    document.body.appendChild(panel);

    bindEvents();
    return panel;
  }

  function getPanelStyles() {
    return `
      <style>
        #issue-tracker-panel {
          position: fixed;
          top: 60px;
          right: 16px;
          width: 420px;
          max-height: calc(100vh - 80px);
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border-color, #2d2d44);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          z-index: 10000;
          font-family: var(--font-ui, -apple-system, sans-serif);
          display: none;
          flex-direction: column;
          overflow: hidden;
        }
        #issue-tracker-panel.visible {
          display: flex;
        }
        #issue-tracker-panel.collapsed .issue-list-container {
          display: none;
        }
        #issue-tracker-panel.collapsed .issue-form-container {
          display: none;
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-tertiary, #16162a);
          border-bottom: 1px solid var(--border-color, #2d2d44);
          cursor: pointer;
        }
        .panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14px;
          color: var(--text-primary, #fff);
        }
        .panel-title-icon {
          font-size: 16px;
        }
        .panel-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .panel-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: var(--text-secondary, #a0a0b0);
          cursor: pointer;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .panel-btn:hover {
          background: var(--bg-primary, #1f1f3a);
          color: var(--text-primary, #fff);
        }
        .panel-btn.collapse-btn::after {
          content: '▼';
          font-size: 10px;
        }
        #issue-tracker-panel.collapsed .panel-btn.collapse-btn::after {
          content: '▲';
        }
        .panel-stats {
          display: flex;
          gap: 12px;
          padding: 10px 16px;
          background: var(--bg-primary, #1f1f3a);
          border-bottom: 1px solid var(--border-color, #2d2d44);
          font-size: 12px;
        }
        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .stat-value {
          font-weight: 600;
          color: var(--text-primary, #fff);
        }
        .issue-list-container {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }
        .issue-form-container {
          padding: 12px;
          border-top: 1px solid var(--border-color, #2d2d44);
          background: var(--bg-tertiary, #16162a);
        }
        .issue-item {
          padding: 10px 12px;
          background: var(--bg-primary, #1f1f3a);
          border-radius: 8px;
          margin-bottom: 8px;
          border-left: 3px solid;
          cursor: pointer;
          transition: all 0.2s;
        }
        .issue-item:hover {
          transform: translateX(2px);
        }
        .issue-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .issue-priority {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          color: #fff;
        }
        .issue-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--bg-tertiary, #2a2a40);
          color: var(--text-secondary, #a0a0b0);
        }
        .issue-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #fff);
          margin-bottom: 4px;
        }
        .issue-meta {
          font-size: 11px;
          color: var(--text-tertiary, #6b6b80);
        }
        .issue-desc {
          font-size: 12px;
          color: var(--text-secondary, #a0a0b0);
          margin-top: 4px;
          line-height: 1.4;
        }
        .form-group {
          margin-bottom: 10px;
        }
        .form-label {
          display: block;
          font-size: 11px;
          color: var(--text-secondary, #a0a0b0);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-input, .form-select, .form-textarea {
          width: 100%;
          padding: 8px 10px;
          background: var(--bg-primary, #1f1f3a);
          border: 1px solid var(--border-color, #2d2d44);
          border-radius: 6px;
          color: var(--text-primary, #fff);
          font-size: 13px;
          font-family: inherit;
          box-sizing: border-box;
        }
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
          border-color: var(--accent-primary, #d48c52);
        }
        .form-textarea {
          resize: vertical;
          min-height: 60px;
        }
        .form-row {
          display: flex;
          gap: 8px;
        }
        .form-row .form-group {
          flex: 1;
        }
        .btn-add {
          width: 100%;
          padding: 10px;
          background: linear-gradient(135deg, var(--accent-primary, #d48c52), var(--accent-gold, #c9a227));
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-add:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(212, 140, 82, 0.3);
        }
        .priority-select {
          display: flex;
          gap: 6px;
        }
        .priority-option {
          flex: 1;
          padding: 6px;
          text-align: center;
          border-radius: 6px;
          border: 1px solid var(--border-color, #2d2d44);
          background: var(--bg-primary, #1f1f3a);
          color: var(--text-secondary, #a0a0b0);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .priority-option:hover {
          border-color: var(--text-tertiary, #6b6b80);
        }
        .priority-option.selected {
          color: #fff;
        }
        .empty-state {
          text-align: center;
          padding: 32px 16px;
          color: var(--text-tertiary, #6b6b80);
        }
        .empty-state-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }
        .issue-detail-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          z-index: 10001;
          display: none;
          align-items: center;
          justify-content: center;
        }
        .issue-detail-overlay.visible {
          display: flex;
        }
        .issue-detail-modal {
          width: 480px;
          max-height: 80vh;
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          overflow: hidden;
        }
        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--border-color, #2d2d44);
        }
        .detail-body {
          padding: 16px;
          max-height: 60vh;
          overflow-y: auto;
        }
        .detail-actions {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid var(--border-color, #2d2d44);
        }
        .detail-btn {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border-color, #2d2d44);
          background: var(--bg-primary, #1f1f3a);
          color: var(--text-primary, #fff);
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .detail-btn:hover {
          background: var(--bg-tertiary, #2a2a40);
        }
        .detail-btn.danger {
          border-color: var(--accent-danger, #ef4444);
          color: var(--accent-danger, #ef4444);
        }
        .detail-btn.danger:hover {
          background: var(--accent-danger, #ef4444);
          color: #fff;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          background: var(--bg-tertiary, #2a2a40);
          color: var(--text-secondary, #a0a0b0);
        }
        .export-hint {
          font-size: 11px;
          color: var(--text-tertiary, #6b6b80);
          text-align: center;
          padding: 8px;
        }
      </style>
    `;
  }

  function getPanelHTML() {
    const stats = IssueTracker.getStats();
    return `
      <div class="panel-header" onclick="IssueTrackerPanel.toggleCollapse()">
        <div class="panel-title">
          <span class="panel-title-icon">🐛</span>
          <span>问题追踪</span>
          <span class="stat-value" style="margin-left: 4px;">${stats.total}</span>
        </div>
        <div class="panel-actions">
          <button class="panel-btn" onclick="event.stopPropagation(); IssueTrackerPanel.exportData()" title="导出">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="panel-btn collapse-btn" title="折叠"></button>
          <button class="panel-btn" onclick="event.stopPropagation(); IssueTrackerPanel.close()" title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="panel-stats">
        ${IssueTracker.PRIORITIES.map(p => {
          const config = IssueTracker.PRIORITY_CONFIG[p];
          const count = stats.byPriority[p] || 0;
          return `<div class="stat-item">
            <span class="stat-dot" style="background: ${config.color}"></span>
            <span style="color: var(--text-secondary)">${p}:</span>
            <span class="stat-value">${count}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="issue-list-container" id="issue-list"></div>
      <div class="issue-form-container">
        <form id="issue-form" onsubmit="IssueTrackerPanel.addIssue(event)">
          <div class="form-group">
            <label class="form-label">优先级</label>
            <div class="priority-select" id="priority-select">
              ${IssueTracker.PRIORITIES.map(p => {
                const config = IssueTracker.PRIORITY_CONFIG[p];
                return `<button type="button" class="priority-option${p === 'P2' ? ' selected' : ''}" 
                  data-priority="${p}" 
                  style="${p === 'P2' ? `background: ${config.color}; border-color: ${config.color};` : ''}"
                  onclick="IssueTrackerPanel.selectPriority('${p}')">${p}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">标题</label>
            <input type="text" class="form-input" id="issue-title" placeholder="问题简述" required>
          </div>
          <div class="form-group">
            <label class="form-label">描述</label>
            <textarea class="form-textarea" id="issue-desc" placeholder="详细描述问题..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">状态</label>
              <select class="form-select" id="issue-status">
                ${IssueTracker.STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">指派给</label>
              <input type="text" class="form-input" id="issue-assignee" placeholder="负责人">
            </div>
          </div>
          <button type="submit" class="btn-add">添加问题</button>
        </form>
      </div>
      <div class="export-hint">Ctrl+Shift+I 切换面板</div>
    `;
  }

  function bindEvents() {
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        toggle();
      }
    });
  }

  function selectPriority(priority) {
    document.querySelectorAll('.priority-option').forEach(btn => {
      const p = btn.dataset.priority;
      const config = IssueTracker.PRIORITY_CONFIG[p];
      if (p === priority) {
        btn.classList.add('selected');
        btn.style.background = config.color;
        btn.style.borderColor = config.color;
        btn.style.color = '#fff';
      } else {
        btn.classList.remove('selected');
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }
    });
  }

  function getSelectedPriority() {
    const selected = document.querySelector('.priority-option.selected');
    return selected ? selected.dataset.priority : 'P2';
  }

  function addIssue(e) {
    e.preventDefault();
    const issue = {
      title: document.getElementById('issue-title').value.trim(),
      description: document.getElementById('issue-desc').value.trim(),
      priority: getSelectedPriority(),
      status: document.getElementById('issue-status').value,
      assignee: document.getElementById('issue-assignee').value.trim()
    };

    IssueTracker.add(issue);
    
    // Reset form
    document.getElementById('issue-title').value = '';
    document.getElementById('issue-desc').value = '';
    document.getElementById('issue-assignee').value = '';
    
    renderList();
    updateStats();
  }

  function renderList() {
    const container = document.getElementById('issue-list');
    const issues = IssueTracker.getAll();

    if (issues.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div>暂无问题</div>
          <div style="font-size: 11px; margin-top: 4px;">添加一个问题开始追踪</div>
        </div>
      `;
      return;
    }

    container.innerHTML = issues.map(issue => {
      const config = IssueTracker.PRIORITY_CONFIG[issue.priority];
      const date = new Date(issue.createdAt).toLocaleDateString('zh-CN');
      return `
        <div class="issue-item" style="border-left-color: ${config.color};" onclick="IssueTrackerPanel.showDetail('${issue.id}')">
          <div class="issue-item-header">
            <span class="issue-priority" style="background: ${config.color}">${issue.priority}</span>
            <span class="issue-status">${issue.status}</span>
          </div>
          <div class="issue-title">${escapeHtml(issue.title)}</div>
          ${issue.description ? `<div class="issue-desc">${escapeHtml(issue.description.substring(0, 80))}${issue.description.length > 80 ? '...' : ''}</div>` : ''}
          <div class="issue-meta">${date} ${issue.assignee ? '· ' + escapeHtml(issue.assignee) : ''}</div>
        </div>
      `;
    }).join('');
  }

  function updateStats() {
    const stats = IssueTracker.getStats();
    const header = panel.querySelector('.panel-title .stat-value');
    if (header) header.textContent = stats.total;

    const statsContainer = panel.querySelector('.panel-stats');
    if (statsContainer) {
      statsContainer.innerHTML = IssueTracker.PRIORITIES.map(p => {
        const config = IssueTracker.PRIORITY_CONFIG[p];
        const count = stats.byPriority[p] || 0;
        return `<div class="stat-item">
          <span class="stat-dot" style="background: ${config.color}"></span>
          <span style="color: var(--text-secondary)">${p}:</span>
          <span class="stat-value">${count}</span>
        </div>`;
      }).join('');
    }
  }

  function showDetail(id) {
    const issue = IssueTracker.getAll().find(i => i.id === id);
    if (!issue) return;

    const config = IssueTracker.PRIORITY_CONFIG[issue.priority];
    const overlay = document.createElement('div');
    overlay.className = 'issue-detail-overlay';
    overlay.id = 'issue-detail-overlay';
    overlay.onclick = function(e) {
      if (e.target === overlay) closeDetail();
    };

    overlay.innerHTML = `
      <div class="issue-detail-modal">
        <div class="detail-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="issue-priority" style="background: ${config.color}">${issue.priority}</span>
            <span class="issue-title" style="margin: 0;">${escapeHtml(issue.title)}</span>
          </div>
          <button class="panel-btn" onclick="IssueTrackerPanel.closeDetail()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="detail-body">
          ${issue.description ? `<p style="color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6;">${escapeHtml(issue.description)}</p>` : ''}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px;">
            <div>
              <div style="color: var(--text-tertiary); margin-bottom: 2px;">状态</div>
              <div class="status-badge">${issue.status}</div>
            </div>
            <div>
              <div style="color: var(--text-tertiary); margin-bottom: 2px;">指派给</div>
              <div style="color: var(--text-primary);">${escapeHtml(issue.assignee || '-')}</div>
            </div>
            <div>
              <div style="color: var(--text-tertiary); margin-bottom: 2px;">创建时间</div>
              <div style="color: var(--text-primary);">${new Date(issue.createdAt).toLocaleString('zh-CN')}</div>
            </div>
            <div>
              <div style="color: var(--text-tertiary); margin-bottom: 2px;">优先级</div>
              <div style="color: ${config.color}; font-weight: 600;">${config.label} - ${config.description}</div>
            </div>
          </div>
        </div>
        <div class="detail-actions">
          <button class="detail-btn" onclick="IssueTrackerPanel.changeStatus('${issue.id}')">修改状态</button>
          <button class="detail-btn danger" onclick="IssueTrackerPanel.deleteIssue('${issue.id}')">删除</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('visible'), 10);
  }

  function closeDetail() {
    const overlay = document.getElementById('issue-detail-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    }
  }

  function changeStatus(id) {
    const issue = IssueTracker.getAll().find(i => i.id === id);
    if (!issue) return;

    const currentIndex = IssueTracker.STATUSES.indexOf(issue.status);
    const nextIndex = (currentIndex + 1) % IssueTracker.STATUSES.length;
    IssueTracker.update(id, { status: IssueTracker.STATUSES[nextIndex] });
    closeDetail();
    renderList();
    updateStats();
  }

  function deleteIssue(id) {
    if (confirm('确定要删除这个问题吗？')) {
      IssueTracker.remove(id);
      closeDetail();
      renderList();
      updateStats();
    }
  }

  function exportData() {
    const data = IssueTracker.export();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `issues-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function open() {
    if (!panel) createPanel();
    panel.classList.add('visible');
    panel.classList.remove('collapsed');
    isVisible = true;
    renderList();
    updateStats();
  }

  function close() {
    if (panel) {
      panel.classList.remove('visible');
      isVisible = false;
    }
  }

  function toggle() {
    if (isVisible) {
      close();
    } else {
      open();
    }
  }

  function toggleCollapse() {
    if (panel) {
      panel.classList.toggle('collapsed');
      collapsed = panel.classList.contains('collapsed');
    }
  }

  // 初始化
  createPanel();

  return {
    open,
    close,
    toggle,
    toggleCollapse,
    addIssue,
    selectPriority,
    showDetail,
    closeDetail,
    changeStatus,
    deleteIssue,
    exportData
  };
})();

// 全局快捷键
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    e.preventDefault();
    IssueTrackerPanel.toggle();
  }
});
