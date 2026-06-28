(function() {
  'use strict';

  const STORAGE_KEY_CURRENT = 'current_student_id';
  const STORAGE_KEY_DEFAULT = 'default_student_id';
  const STORAGE_KEY_NAME_SET = 'student_name_set';

  let currentStudent = null;
  let studentsCache = null;
  let initPromise = null;

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getDefaultStudentId() {
    let id = localStorage.getItem(STORAGE_KEY_DEFAULT);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(STORAGE_KEY_DEFAULT, id);
    }
    return id;
  }

  function getCurrentStudentIdSync() {
    return localStorage.getItem(STORAGE_KEY_CURRENT) || getDefaultStudentId();
  }

  async function ensureDB() {
    if (window.DB && typeof window.DB.init === 'function') {
      await window.DB.init();
      return true;
    }
    return false;
  }

  async function loadStudentsFromDB() {
    const hasDB = await ensureDB();
    if (!hasDB) {
      return [];
    }
    try {
      return await window.DB.students.getAll();
    } catch (e) {
      console.error('Failed to load students:', e);
      return [];
    }
  }

  async function saveStudentToDB(student) {
    const hasDB = await ensureDB();
    if (!hasDB) {
      return student;
    }
    try {
      return await window.DB.students.save(student);
    } catch (e) {
      console.error('Failed to save student:', e);
      return student;
    }
  }

  async function deleteStudentFromDB(studentId) {
    const hasDB = await ensureDB();
    if (!hasDB) {
      return;
    }
    try {
      await window.DB.students.delete(studentId);
    } catch (e) {
      console.error('Failed to delete student:', e);
    }
  }

  async function createDefaultStudent() {
    const now = Date.now();
    const id = getDefaultStudentId();
    const student = {
      id: id,
      name: '小学习者',
      avatar: '👤',
      createdAt: now,
      updatedAt: now
    };
    await saveStudentToDB(student);
    studentsCache = null;
    return student;
  }

  async function ensureDefaultStudent() {
    const students = await listStudents();
    if (students.length === 0) {
      return await createDefaultStudent();
    }
    
    const defaultId = getDefaultStudentId();
    const hasDefault = students.some(s => s.id === defaultId);
    
    if (!hasDefault) {
      const first = students[0];
      localStorage.setItem(STORAGE_KEY_DEFAULT, first.id);
      return first;
    }
    
    return students.find(s => s.id === defaultId);
  }

  async function listStudents() {
    if (studentsCache) {
      return studentsCache;
    }
    studentsCache = await loadStudentsFromDB();
    return studentsCache;
  }

  async function getCurrentStudent() {
    if (currentStudent) {
      return currentStudent;
    }

    const studentId = getCurrentStudentIdSync();
    
    const hasDB = await ensureDB();
    if (hasDB) {
      try {
        const student = await window.DB.students.getById(studentId);
        if (student) {
          currentStudent = student;
          return student;
        }
      } catch (e) {
        console.error('Failed to get student:', e);
      }
    }
    
    const defaultStudent = await ensureDefaultStudent();
    currentStudent = defaultStudent;
    localStorage.setItem(STORAGE_KEY_CURRENT, defaultStudent.id);
    return defaultStudent;
  }

  async function setCurrentStudent(studentId) {
    const students = await listStudents();
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
      throw new Error('学生不存在');
    }
    
    currentStudent = student;
    localStorage.setItem(STORAGE_KEY_CURRENT, studentId);
    
    if (window.StudentManager.onStudentChange) {
      window.StudentManager.onStudentChange(student);
    }
    
    return student;
  }

  async function addStudent({ name, avatar }) {
    const now = Date.now();
    const student = {
      id: generateUUID(),
      name: name || '新学生',
      avatar: avatar || '😊',
      createdAt: now,
      updatedAt: now
    };
    
    await saveStudentToDB(student);
    studentsCache = null;
    
    return student;
  }

  async function updateStudent(studentId, data) {
    const students = await listStudents();
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
      throw new Error('学生不存在');
    }
    
    const updated = {
      ...student,
      ...data,
      updatedAt: Date.now()
    };
    
    await saveStudentToDB(updated);
    studentsCache = null;
    
    if (currentStudent && currentStudent.id === studentId) {
      currentStudent = updated;
    }
    
    return updated;
  }

  async function deleteStudent(studentId) {
    const students = await listStudents();
    
    if (students.length <= 1) {
      throw new Error('至少需要保留一个学生');
    }
    
    const student = students.find(s => s.id === studentId);
    if (!student) {
      throw new Error('学生不存在');
    }
    
    const hasDB = await ensureDB();
    if (hasDB && window.DB.clearStudentData) {
      try {
        await window.DB.clearStudentData(studentId);
      } catch (e) {
        console.error('Failed to clear student data:', e);
      }
    }
    
    await deleteStudentFromDB(studentId);
    studentsCache = null;
    
    if (currentStudent && currentStudent.id === studentId) {
      const remaining = await listStudents();
      const newCurrent = remaining[0];
      currentStudent = newCurrent;
      localStorage.setItem(STORAGE_KEY_CURRENT, newCurrent.id);
      
      if (window.StudentManager.onStudentChange) {
        window.StudentManager.onStudentChange(newCurrent);
      }
    }
    
    return true;
  }

  function showStudentPanel() {
    let panel = document.getElementById('student-panel');
    if (panel) {
      panel.remove();
    }
    
    panel = document.createElement('div');
    panel.id = 'student-panel';
    panel.className = 'student-panel';
    panel.innerHTML = `
      <div class="student-panel-header">
        <h3>学生管理</h3>
        <button class="student-panel-close" id="student-panel-close">&times;</button>
      </div>
      <div class="student-panel-content">
        <div class="student-list" id="student-list"></div>
        <button class="student-add-btn" id="student-add-btn">
          <span class="icon">+</span> 新增学生
        </button>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    loadStudentList();
    
    document.getElementById('student-panel-close').addEventListener('click', closeStudentPanel);
    
    document.getElementById('student-add-btn').addEventListener('click', function() {
      const name = prompt('请输入学生昵称：');
      if (name && name.trim()) {
        addStudent({ name: name.trim() }).then(function() {
          loadStudentList();
        });
      }
    });
    
    panel.addEventListener('click', function(e) {
      if (e.target === panel) {
        closeStudentPanel();
      }
    });
    
    setTimeout(function() {
      panel.classList.add('show');
    }, 10);
  }

  function closeStudentPanel() {
    const panel = document.getElementById('student-panel');
    if (panel) {
      panel.classList.remove('show');
      setTimeout(function() {
        panel.remove();
      }, 200);
    }
  }

  async function loadStudentList() {
    const listEl = document.getElementById('student-list');
    if (!listEl) return;
    
    const students = await listStudents();
    const current = await getCurrentStudent();
    
    listEl.innerHTML = '';
    
    students.forEach(function(student) {
      const item = document.createElement('div');
      item.className = 'student-item' + (student.id === current.id ? ' active' : '');
      item.innerHTML = `
        <div class="student-item-info">
          <span class="student-avatar">${student.avatar}</span>
          <span class="student-name">${escapeHtml(student.name)}</span>
        </div>
        <div class="student-item-actions">
          <button class="student-edit-btn" data-id="${student.id}" title="编辑">✏️</button>
          <button class="student-delete-btn" data-id="${student.id}" title="删除">🗑️</button>
        </div>
      `;
      
      item.addEventListener('click', function(e) {
        if (e.target.closest('.student-edit-btn') || e.target.closest('.student-delete-btn')) {
          return;
        }
        if (student.id !== current.id) {
          setCurrentStudent(student.id).then(function() {
            updateStudentButton();
            loadStudentList();
            setTimeout(function() {
              location.reload();
            }, 300);
          });
        }
      });
      
      item.querySelector('.student-edit-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        const newName = prompt('请输入新的昵称：', student.name);
        if (newName && newName.trim()) {
          updateStudent(student.id, { name: newName.trim() }).then(function() {
            updateStudentButton();
            loadStudentList();
          });
        }
      });
      
      item.querySelector('.student-delete-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        if (students.length <= 1) {
          alert('至少需要保留一个学生');
          return;
        }
        if (confirm('确定要删除这个学生吗？该学生的所有学习数据也将被删除。')) {
          deleteStudent(student.id).then(function() {
            updateStudentButton();
            loadStudentList();
            setTimeout(function() {
              location.reload();
            }, 300);
          });
        }
      });
      
      listEl.appendChild(item);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateStudentButton() {
    const btn = document.getElementById('student-button');
    if (!btn) return;
    
    const currentId = getCurrentStudentIdSync();
    const studentList = studentsCache || [];
    const student = studentList.find(s => s.id === currentId);
    
    if (student) {
      btn.innerHTML = `<span class="student-btn-avatar">${student.avatar}</span><span class="student-btn-name">${escapeHtml(student.name)}</span>`;
    } else {
      btn.innerHTML = '<span class="student-btn-avatar">👤</span><span class="student-btn-name">学生</span>';
    }
  }

  function showWelcomeModal() {
    let modal = document.getElementById('welcome-modal');
    if (modal) {
      modal.remove();
    }
    
    modal = document.createElement('div');
    modal.id = 'welcome-modal';
    modal.className = 'welcome-modal';
    modal.innerHTML = `
      <div class="welcome-modal-content">
        <div class="welcome-icon">👋</div>
        <h2>欢迎使用!</h2>
        <p>请设置你的昵称，让我们开始学习之旅吧！</p>
        <input type="text" id="welcome-name-input" placeholder="请输入你的昵称" maxlength="20">
        <button class="welcome-submit-btn" id="welcome-submit-btn">开始学习</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = document.getElementById('welcome-name-input');
    const submitBtn = document.getElementById('welcome-submit-btn');
    
    input.focus();
    
    function submit() {
      const name = input.value.trim();
      if (name) {
        getCurrentStudent().then(function(student) {
          return updateStudent(student.id, { name: name });
        }).then(function() {
          localStorage.setItem(STORAGE_KEY_NAME_SET, 'true');
          closeWelcomeModal();
          updateStudentButton();
        });
      }
    }
    
    submitBtn.addEventListener('click', submit);
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        submit();
      }
    });
  }

  function closeWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
      modal.classList.add('fade-out');
      setTimeout(function() {
        modal.remove();
      }, 300);
    }
  }

  function createStudentButton() {
    if (document.getElementById('student-button')) {
      return;
    }
    
    const btn = document.createElement('button');
    btn.id = 'student-button';
    btn.className = 'student-button';
    btn.innerHTML = '<span class="student-btn-avatar">👤</span><span class="student-btn-name">学生</span>';
    
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const panel = document.getElementById('student-panel');
      if (panel) {
        closeStudentPanel();
      } else {
        showStudentPanel();
      }
    });
    
    document.body.appendChild(btn);
    
    getCurrentStudent().then(function() {
      updateStudentButton();
    });
    
    document.addEventListener('click', function(e) {
      const panel = document.getElementById('student-panel');
      const btn = document.getElementById('student-button');
      if (panel && !panel.contains(e.target) && !btn.contains(e.target)) {
        closeStudentPanel();
      }
    });
  }

  function injectStyles() {
    if (document.getElementById('student-manager-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'student-manager-styles';
    style.textContent = `
      .student-button {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: var(--bg-secondary, #fff);
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 999px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        font-size: 14px;
      }
      
      .student-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .student-btn-avatar {
        font-size: 18px;
      }
      
      .student-btn-name {
        font-weight: 500;
        color: var(--text-primary, #111827);
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .student-panel {
        position: fixed;
        top: 60px;
        right: 16px;
        z-index: 1001;
        width: 300px;
        background: var(--bg-secondary, #fff);
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
        transition: all 0.2s ease;
        pointer-events: none;
        overflow: hidden;
      }
      
      .student-panel.show {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      
      .student-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }
      
      .student-panel-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary, #111827);
      }
      
      .student-panel-close {
        background: none;
        border: none;
        font-size: 24px;
        color: var(--text-secondary, #6b7280);
        cursor: pointer;
        line-height: 1;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background 0.2s;
      }
      
      .student-panel-close:hover {
        background: var(--bg-tertiary, #f3f4f6);
      }
      
      .student-panel-content {
        padding: 12px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .student-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 12px;
      }
      
      .student-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .student-item:hover {
        background: var(--bg-tertiary, #f3f4f6);
      }
      
      .student-item.active {
        background: var(--primary-light, #dbeafe);
      }
      
      .student-item-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .student-avatar {
        font-size: 24px;
      }
      
      .student-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary, #111827);
      }
      
      .student-item-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .student-item:hover .student-item-actions {
        opacity: 1;
      }
      
      .student-item.active .student-item-actions {
        opacity: 1;
      }
      
      .student-edit-btn,
      .student-delete-btn {
        background: none;
        border: none;
        padding: 6px;
        cursor: pointer;
        border-radius: 6px;
        font-size: 14px;
        transition: background 0.2s;
      }
      
      .student-edit-btn:hover {
        background: var(--bg-secondary, #fff);
      }
      
      .student-delete-btn:hover {
        background: var(--error-light, #fee2e2);
      }
      
      .student-add-btn {
        width: 100%;
        padding: 10px;
        background: var(--primary-color, #3b82f6);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      
      .student-add-btn:hover {
        background: var(--primary-hover, #2563eb);
      }
      
      .student-add-btn .icon {
        font-size: 16px;
        font-weight: bold;
      }
      
      .welcome-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        animation: fadeIn 0.3s ease;
      }
      
      .welcome-modal.fade-out {
        animation: fadeOut 0.3s ease forwards;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      .welcome-modal-content {
        background: var(--bg-secondary, #fff);
        border-radius: 16px;
        padding: 32px;
        text-align: center;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      }
      
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .welcome-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }
      
      .welcome-modal-content h2 {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 600;
        color: var(--text-primary, #111827);
      }
      
      .welcome-modal-content p {
        margin: 0 0 20px 0;
        font-size: 14px;
        color: var(--text-secondary, #6b7280);
      }
      
      #welcome-name-input {
        width: 100%;
        padding: 12px 16px;
        font-size: 16px;
        border: 2px solid var(--border-color, #e5e7eb);
        border-radius: 10px;
        margin-bottom: 16px;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s;
      }
      
      #welcome-name-input:focus {
        border-color: var(--primary-color, #3b82f6);
      }
      
      .welcome-submit-btn {
        width: 100%;
        padding: 12px;
        background: var(--primary-color, #3b82f6);
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        transition: background 0.2s;
      }
      
      .welcome-submit-btn:hover {
        background: var(--primary-hover, #2563eb);
      }
    `;
    
    document.head.appendChild(style);
  }

  function initUI() {
    injectStyles();
    createStudentButton();
    
    const nameSet = localStorage.getItem(STORAGE_KEY_NAME_SET);
    if (!nameSet) {
      setTimeout(function() {
        showWelcomeModal();
      }, 500);
    }
  }

  function init() {
    if (initPromise) {
      return initPromise;
    }
    
    initPromise = (async function() {
      const currentId = getCurrentStudentIdSync();
      localStorage.setItem(STORAGE_KEY_CURRENT, currentId);
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
      } else {
        initUI();
      }
      
      return true;
    })();
    
    return initPromise;
  }

  window.StudentManager = {
    generateUUID,
    getCurrentStudent,
    setCurrentStudent,
    listStudents,
    addStudent,
    updateStudent,
    deleteStudent,
    ensureDefaultStudent,
    showPanel: showStudentPanel,
    closePanel: closeStudentPanel,
    onStudentChange: null,
    initUI
  };

  init();

})();
