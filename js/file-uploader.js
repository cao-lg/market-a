/**
 * 文件上传组件
 * 纯前端实现，支持拖拽上传、点击选择、多文件批量上传
 * 文件存储到 IndexedDB
 */

const ALLOWED_FILE_TYPES = ['.csv', '.json', '.md', '.txt', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_SIZE = 50 * 1024 * 1024;
const PREVIEW_CHAR_LIMIT = 500;

class FileUploader {
  constructor(options = {}) {
    this.container = options.container || null;
    this.stageId = options.stageId || null;
    this.lessonId = options.lessonId || null;
    this.submissionId = options.submissionId || null;
    this.allowedTypes = options.allowedTypes || ALLOWED_FILE_TYPES;
    this.maxFileSize = options.maxFileSize || MAX_FILE_SIZE;
    this.maxBatchSize = options.maxBatchSize || MAX_BATCH_SIZE;
    this.previewCharLimit = options.previewCharLimit || PREVIEW_CHAR_LIMIT;
    
    this.uploadedFiles = [];
    this.pendingFiles = [];
    
    this.callbacks = {
      onFileSelected: options.onFileSelected || null,
      onUploadStart: options.onUploadStart || null,
      onUploadProgress: options.onUploadProgress || null,
      onUploadComplete: options.onUploadComplete || null,
      onUploadError: options.onUploadError || null,
      onFileRemoved: options.onFileRemoved || null
    };
    
    if (this.container) {
      this.init();
    }
  }
  
  init() {
    if (!this.container) return;
    
    this.render();
    this.bindEvents();
    this.loadHistory();
  }
  
  render() {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="file-uploader">
        <div class="upload-zone" id="uploadZone">
          <div class="upload-icon">📁</div>
          <div class="upload-text">拖拽文件到此处，或点击选择文件</div>
          <div class="upload-hint">支持 ${this.allowedTypes.join(', ')} 格式</div>
          <div class="upload-hint">单文件不超过 ${FileUploader.formatFileSize(this.maxFileSize)}，批量不超过 ${FileUploader.formatFileSize(this.maxBatchSize)}</div>
          <input type="file" id="fileInput" multiple accept="${this.allowedTypes.join(',')}" style="display: none;">
        </div>
        <div class="pending-files" id="pendingFiles" style="display: none;"></div>
        <div class="uploaded-files" id="uploadedFiles"></div>
      </div>
    `;
    
    this.uploadZone = this.container.querySelector('#uploadZone');
    this.fileInput = this.container.querySelector('#fileInput');
    this.pendingFilesEl = this.container.querySelector('#pendingFiles');
    this.uploadedFilesEl = this.container.querySelector('#uploadedFiles');
  }
  
  bindEvents() {
    if (!this.uploadZone || !this.fileInput) return;
    
    this.uploadZone.addEventListener('click', () => {
      this.fileInput.click();
    });
    
    this.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
      this.fileInput.value = '';
    });
    
    this.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadZone.classList.add('drag-over');
    });
    
    this.uploadZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.uploadZone.classList.remove('drag-over');
    });
    
    this.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadZone.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });
  }
  
  handleFiles(fileList) {
    const files = Array.from(fileList);
    const validFiles = [];
    const errors = [];
    
    let totalSize = 0;
    
    for (const file of files) {
      const validation = FileUploader.validateFile(file, this.allowedTypes, this.maxFileSize);
      if (!validation.valid) {
        errors.push({ file, error: validation.message });
      } else {
        totalSize += file.size;
        validFiles.push(file);
      }
    }
    
    if (totalSize > this.maxBatchSize) {
      this.triggerCallback('onUploadError', {
        message: `批量文件总大小超过限制，最大允许 ${FileUploader.formatFileSize(this.maxBatchSize)}`
      });
      return;
    }
    
    if (errors.length > 0) {
      errors.forEach(err => {
        this.triggerCallback('onUploadError', { file: err.file, message: err.error });
      });
    }
    
    if (validFiles.length > 0) {
      this.triggerCallback('onFileSelected', validFiles);
      this.addPendingFiles(validFiles);
    }
  }
  
  addPendingFiles(files) {
    const pendingList = files.map(file => ({
      file,
      progress: 0,
      status: 'pending'
    }));
    
    this.pendingFiles = [...this.pendingFiles, ...pendingList];
    this.renderPendingFiles();
    this.uploadPendingFiles();
  }
  
  renderPendingFiles() {
    if (!this.pendingFilesEl) return;
    
    if (this.pendingFiles.length === 0) {
      this.pendingFilesEl.style.display = 'none';
      return;
    }
    
    this.pendingFilesEl.style.display = 'block';
    this.pendingFilesEl.innerHTML = `
      <div class="pending-header">待上传文件 (${this.pendingFiles.length})</div>
      ${this.pendingFiles.map((item, index) => `
        <div class="pending-file" data-index="${index}">
          <div class="file-info">
            <span class="file-name">${item.file.name}</span>
            <span class="file-size">${FileUploader.formatFileSize(item.file.size)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${item.progress}%"></div>
          </div>
          <div class="file-status">${this.getStatusText(item.status)}</div>
        </div>
      `).join('')}
    `;
  }
  
  getStatusText(status) {
    const statusMap = {
      'pending': '等待上传',
      'uploading': '上传中',
      'completed': '上传完成',
      'error': '上传失败'
    };
    return statusMap[status] || status;
  }
  
  async uploadPendingFiles() {
    for (let i = 0; i < this.pendingFiles.length; i++) {
      const item = this.pendingFiles[i];
      if (item.status === 'pending') {
        await this.uploadSingleFile(item, i);
      }
    }
  }
  
  async uploadSingleFile(item, index) {
    item.status = 'uploading';
    this.renderPendingFiles();
    this.triggerCallback('onUploadStart', item.file);
    
    try {
      await this.simulateProgress(item, index);
      
      const fileContent = await FileUploader.readFileAsDataURL(item.file);
      
      const studentId = this.getCurrentStudentId();
      
      const fileData = {
        fileName: item.file.name,
        fileType: item.file.type,
        fileSize: item.file.size,
        fileContent: fileContent,
        studentId: studentId,
        stageId: this.stageId,
        lessonId: this.lessonId,
        submissionId: this.submissionId
      };
      
      let savedFile = null;
      if (window.DB && window.DB.files) {
        savedFile = await window.DB.files.save(fileData);
      } else {
        savedFile = {
          ...fileData,
          id: Date.now() + Math.random(),
          fileId: FileUploader.generateUUID(),
          createdAt: Date.now()
        };
      }
      
      item.progress = 100;
      item.status = 'completed';
      item.savedFile = savedFile;
      
      this.uploadedFiles.unshift(savedFile);
      
      this.renderPendingFiles();
      this.renderUploadedFiles();
      
      this.triggerCallback('onUploadComplete', savedFile);
      
      setTimeout(() => {
        this.pendingFiles = this.pendingFiles.filter((_, i) => i !== index);
        this.renderPendingFiles();
      }, 500);
      
    } catch (error) {
      item.status = 'error';
      item.error = error.message;
      this.renderPendingFiles();
      this.triggerCallback('onUploadError', { file: item.file, message: error.message });
    }
  }
  
  simulateProgress(item, index) {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20 + 5;
        if (progress >= 95) {
          progress = 95;
          clearInterval(interval);
          resolve();
        }
        item.progress = Math.floor(progress);
        this.renderPendingFiles();
        this.triggerCallback('onUploadProgress', {
          file: item.file,
          progress: item.progress
        });
      }, 100);
    });
  }
  
  getCurrentStudentId() {
    let id = localStorage.getItem('current_student_id');
    if (id) return id;
    
    id = localStorage.getItem('default_student_id');
    if (id) return id;
    
    return null;
  }
  
  renderUploadedFiles() {
    if (!this.uploadedFilesEl) return;
    
    if (this.uploadedFiles.length === 0) {
      this.uploadedFilesEl.innerHTML = '<div class="no-files">暂无上传记录</div>';
      return;
    }
    
    this.uploadedFilesEl.innerHTML = `
      <div class="uploaded-header">已上传文件 (${this.uploadedFiles.length})</div>
      ${this.uploadedFiles.map((file, index) => `
        <div class="uploaded-file" data-index="${index}" data-file-id="${file.fileId}">
          <div class="file-icon">${this.getFileIcon(file.fileName)}</div>
          <div class="file-details">
            <div class="file-name">${file.fileName}</div>
            <div class="file-meta">
              <span>${FileUploader.formatFileSize(file.fileSize)}</span>
              <span>${new Date(file.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div class="file-actions">
            <button class="preview-btn" data-action="preview">预览</button>
            <button class="delete-btn" data-action="delete">删除</button>
          </div>
        </div>
        <div class="file-preview" id="preview-${file.fileId}" style="display: none;"></div>
      `).join('')}
    `;
    
    this.bindUploadedFileEvents();
  }
  
  bindUploadedFileEvents() {
    if (!this.uploadedFilesEl) return;
    
    const previewBtns = this.uploadedFilesEl.querySelectorAll('.preview-btn');
    previewBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileEl = e.target.closest('.uploaded-file');
        const fileId = fileEl.dataset.fileId;
        this.togglePreview(fileId);
      });
    });
    
    const deleteBtns = this.uploadedFilesEl.querySelectorAll('.delete-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileEl = e.target.closest('.uploaded-file');
        const index = parseInt(fileEl.dataset.index);
        this.removeFile(index);
      });
    });
  }
  
  getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      'csv': '📊',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'xlsx': '📈',
      'xls': '📈'
    };
    return iconMap[ext] || '📁';
  }
  
  async togglePreview(fileId) {
    const previewEl = this.container.querySelector(`#preview-${fileId}`);
    const file = this.uploadedFiles.find(f => f.fileId === fileId);
    
    if (!previewEl || !file) return;
    
    if (previewEl.style.display === 'none') {
      previewEl.style.display = 'block';
      await this.showPreview(previewEl, file);
    } else {
      previewEl.style.display = 'none';
    }
  }
  
  async showPreview(previewEl, file) {
    try {
      const ext = file.fileName.split('.').pop().toLowerCase();
      const textExts = ['csv', 'json', 'md', 'txt'];
      
      if (textExts.includes(ext) && file.fileContent) {
        const textContent = this.base64ToText(file.fileContent);
        const previewText = textContent.substring(0, this.previewCharLimit);
        const hasMore = textContent.length > this.previewCharLimit;
        
        previewEl.innerHTML = `
          <div class="preview-content">
            <pre>${this.escapeHtml(previewText)}</pre>
            ${hasMore ? `<div class="preview-more">... (共 ${textContent.length} 字符，仅显示前 ${this.previewCharLimit} 字符)</div>` : ''}
          </div>
        `;
      } else if (ext === 'xlsx' || ext === 'xls') {
        previewEl.innerHTML = `
          <div class="preview-content">
            <div class="preview-notice">Excel 文件预览暂不支持，请下载后查看</div>
          </div>
        `;
      } else {
        previewEl.innerHTML = `
          <div class="preview-content">
            <div class="preview-notice">该文件类型不支持预览</div>
          </div>
        `;
      }
    } catch (error) {
      previewEl.innerHTML = `
        <div class="preview-content">
          <div class="preview-error">预览失败: ${error.message}</div>
        </div>
      `;
    }
  }
  
  base64ToText(base64) {
    const base64Data = base64.split(',')[1] || base64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  async removeFile(index) {
    const file = this.uploadedFiles[index];
    if (!file) return;
    
    if (!confirm(`确定要删除文件 "${file.fileName}" 吗？`)) {
      return;
    }
    
    try {
      if (window.DB && window.DB.files && file.id) {
        await window.DB.files.delete(file.id);
      }
      
      this.uploadedFiles.splice(index, 1);
      this.renderUploadedFiles();
      
      this.triggerCallback('onFileRemoved', file);
    } catch (error) {
      this.triggerCallback('onUploadError', { file, message: error.message });
    }
  }
  
  async loadHistory() {
    try {
      if (window.DB && window.DB.files) {
        let files = [];
        if (this.submissionId) {
          files = await window.DB.files.getBySubmission(this.submissionId);
        } else if (this.lessonId) {
          files = await window.DB.files.getByLesson(this.lessonId);
        }
        this.uploadedFiles = files.sort((a, b) => b.createdAt - a.createdAt);
        this.renderUploadedFiles();
      }
    } catch (error) {
      console.warn('加载上传历史失败:', error);
    }
  }
  
  triggerCallback(callbackName, data) {
    const callback = this.callbacks[callbackName];
    if (typeof callback === 'function') {
      callback(data);
    }
  }
  
  getUploadedFiles() {
    return [...this.uploadedFiles];
  }
  
  static validateFile(file, allowedTypes = ALLOWED_FILE_TYPES, maxFileSize = MAX_FILE_SIZE) {
    const fileName = file.name.toLowerCase();
    const ext = '.' + fileName.split('.').pop();
    
    if (!allowedTypes.some(type => fileName.endsWith(type.toLowerCase()))) {
      return {
        valid: false,
        message: `不支持的文件类型: ${ext}，仅支持 ${allowedTypes.join(', ')}`
      };
    }
    
    if (file.size > maxFileSize) {
      return {
        valid: false,
        message: `文件大小超过限制，最大允许 ${FileUploader.formatFileSize(maxFileSize)}`
      };
    }
    
    return { valid: true };
  }
  
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  static readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
  
  static readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

window.FileUploader = FileUploader;
