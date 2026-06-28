/**
 * 数据解析器
 * 纯前端实现，支持 CSV/JSON 数据文件解析与特征提取
 */

class DataParser {
  constructor() {
    this.lastError = null;
  }

  // ==================== CSV 解析 ====================

  /**
   * 解析CSV文本
   * @param {string} text - CSV文本内容
   * @param {Object} options - 解析选项
   * @param {string} [options.delimiter] - 分隔符，不传则自动检测
   * @param {boolean} [options.hasHeader=true] - 是否有表头
   * @param {string} [options.encoding] - 编码，不传则自动检测
   * @returns {Object} { headers, rows, rawText, error }
   */
  parseCSV(text, options = {}) {
    try {
      this.lastError = null;

      if (!text || typeof text !== 'string') {
        return this._errorResult('CSV内容为空或格式无效', text);
      }

      const rawText = text;

      let delimiter = options.delimiter;
      if (!delimiter) {
        delimiter = DataParser.detectDelimiter(text);
      }

      const hasHeader = options.hasHeader !== false;

      const lines = this._parseCSVLines(text, delimiter);

      if (lines.length === 0) {
        return this._errorResult('CSV文件没有数据行', rawText);
      }

      let headers = [];
      let rows = [];

      if (hasHeader) {
        headers = lines[0].map(h => String(h || '').trim());
        rows = lines.slice(1).map(line => {
          const row = {};
          headers.forEach((header, i) => {
            row[header] = line[i] !== undefined ? line[i] : '';
          });
          return row;
        });
      } else {
        const maxCols = Math.max(...lines.map(l => l.length));
        headers = Array.from({ length: maxCols }, (_, i) => `列${i + 1}`);
        rows = lines.map(line => {
          const row = {};
          headers.forEach((header, i) => {
            row[header] = line[i] !== undefined ? line[i] : '';
          });
          return row;
        });
      }

      return {
        headers,
        rows,
        rawText,
        delimiter,
        encoding: options.encoding || 'UTF-8',
        error: null
      };
    } catch (error) {
      return this._errorResult(`CSV解析失败: ${error.message}`, text);
    }
  }

  /**
   * 内部方法：解析CSV行，处理引号包裹的字段
   */
  _parseCSVLines(text, delimiter) {
    const lines = [];
    let currentField = '';
    let currentRow = [];
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i += 2;
        } else if (char === '"') {
          inQuotes = false;
          i++;
        } else {
          currentField += char;
          i++;
        }
      } else {
        if (char === '"' && currentField === '') {
          inQuotes = true;
          i++;
        } else if (char === delimiter) {
          currentRow.push(currentField);
          currentField = '';
          i++;
        } else if (char === '\r' && nextChar === '\n') {
          currentRow.push(currentField);
          lines.push(currentRow);
          currentRow = [];
          currentField = '';
          i += 2;
        } else if (char === '\n') {
          currentRow.push(currentField);
          lines.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
        } else if (char === '\r') {
          currentRow.push(currentField);
          lines.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
        } else {
          currentField += char;
          i++;
        }
      }
    }

    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField);
      lines.push(currentRow);
    }

    return lines.filter(row => row.length > 0 && row.some(cell => cell !== ''));
  }

  // ==================== JSON 解析 ====================

  /**
   * 解析JSON文本
   * @param {string} text - JSON文本内容
   * @returns {Object} { headers, rows, rawText, error }
   */
  parseJSON(text) {
    try {
      this.lastError = null;

      if (!text || typeof text !== 'string') {
        return this._errorResult('JSON内容为空或格式无效', text);
      }

      const rawText = text;
      const data = JSON.parse(text);

      let dataArray = this._extractDataArray(data);

      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        return this._errorResult('JSON中未找到数据数组', rawText);
      }

      const rows = dataArray.map(item => this._flattenObject(item));

      const headers = this._collectHeaders(rows);

      const normalizedRows = rows.map(row => {
        const normalized = {};
        headers.forEach(h => {
          normalized[h] = row.hasOwnProperty(h) ? row[h] : '';
        });
        return normalized;
      });

      return {
        headers,
        rows: normalizedRows,
        rawText,
        error: null
      };
    } catch (error) {
      return this._errorResult(`JSON解析失败: ${error.message}`, text);
    }
  }

  /**
   * 从JSON数据中提取数据数组
   */
  _extractDataArray(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      const commonKeys = ['data', 'items', 'records', 'list', 'result', 'results', 'rows', 'datas'];
      for (const key of commonKeys) {
        if (data.hasOwnProperty(key) && Array.isArray(data[key])) {
          return data[key];
        }
      }

      const arrayKeys = Object.keys(data).filter(k => Array.isArray(data[k]));
      if (arrayKeys.length > 0) {
        return data[arrayKeys[0]];
      }
    }

    return null;
  }

  /**
   * 展平对象（第一层）
   */
  _flattenObject(obj, prefix = '') {
    const result = {};

    if (!obj || typeof obj !== 'object') {
      return result;
    }

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const flattened = this._flattenObject(value, newKey);
        Object.assign(result, flattened);
      } else if (Array.isArray(value)) {
        result[newKey] = JSON.stringify(value);
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * 收集所有表头
   */
  _collectHeaders(rows) {
    const headerSet = new Set();
    rows.forEach(row => {
      Object.keys(row).forEach(key => headerSet.add(key));
    });
    return Array.from(headerSet);
  }

  // ==================== 数据特征提取 ====================

  /**
   * 从解析后的数据提取特征
   * @param {Object} data - { headers, rows, rawText }
   * @returns {Object} 特征信息
   */
  extractFeatures(data) {
    try {
      const { headers, rows, rawText = '' } = data;
      const rowCount = rows.length;
      const columnCount = headers.length;
      const totalCells = rowCount * columnCount;
      const fileSize = new Blob([rawText]).size;

      const missingByColumn = {};
      let totalMissing = 0;

      headers.forEach(col => {
        let missing = 0;
        rows.forEach(row => {
          if (this._isEmptyValue(row[col])) {
            missing++;
          }
        });
        missingByColumn[col] = rowCount > 0 ? missing / rowCount : 0;
        totalMissing += missing;
      });

      const missingRate = totalCells > 0 ? totalMissing / totalCells : 0;

      const { duplicateCount, duplicateRate } = this._calcDuplicateRows(rows);

      const { emptyColumnCount, singleValueColumnCount } = this._calcColumnStats(headers, rows);

      const columnTypes = {};
      const numericColumns = [];
      const dateColumns = [];
      const stringColumns = [];

      headers.forEach(col => {
        const values = rows.map(r => r[col]).filter(v => !this._isEmptyValue(v));
        const type = this._inferColumnType(values);
        columnTypes[col] = type;

        if (type === 'number') numericColumns.push(col);
        else if (type === 'date') dateColumns.push(col);
        else stringColumns.push(col);
      });

      const numericStats = {};
      numericColumns.forEach(col => {
        const values = rows.map(r => r[col])
          .filter(v => !this._isEmptyValue(v))
          .map(v => parseFloat(v))
          .filter(v => !isNaN(v));

        if (values.length > 0) {
          const sorted = [...values].sort((a, b) => a - b);
          const min = sorted[0];
          const max = sorted[sorted.length - 1];
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const median = DataParser.median(values);
          const stdDev = DataParser.stdDev(values);
          const zeros = values.filter(v => v === 0).length;
          const negatives = values.filter(v => v < 0).length;
          const outliers = DataParser.calcOutliers(values);

          numericStats[col] = {
            min,
            max,
            avg,
            median,
            stdDev,
            zeros,
            negatives,
            outliers: outliers.length,
            outlierValues: outliers
          };
        }
      });

      const namingScore = this._calcNamingScore(headers);
      const formatConsistency = this._calcFormatConsistency(headers, rows, columnTypes);
      const dateFormat = this._detectDateFormat(rows, dateColumns);

      return {
        basicStats: {
          rowCount,
          columnCount,
          fileSize,
          totalCells
        },
        qualityMetrics: {
          missingRate,
          missingByColumn,
          duplicateRowRate: duplicateRate,
          duplicateRowCount: duplicateCount,
          emptyColumnCount,
          singleValueColumnCount
        },
        fieldAnalysis: {
          columnTypes,
          numericColumns,
          dateColumns,
          stringColumns
        },
        numericStats,
        normalization: {
          namingScore,
          formatConsistency,
          dateFormat
        }
      };
    } catch (error) {
      return {
        error: `特征提取失败: ${error.message}`
      };
    }
  }

  /**
   * 判断空值
   */
  _isEmptyValue(value) {
    return value === null || value === undefined || value === '' ||
      (typeof value === 'string' && value.trim() === '');
  }

  /**
   * 计算重复行
   */
  _calcDuplicateRows(rows) {
    if (rows.length === 0) {
      return { duplicateCount: 0, duplicateRate: 0 };
    }

    const seen = new Map();
    let duplicateCount = 0;

    rows.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        duplicateCount++;
      } else {
        seen.set(key, true);
      }
    });

    return {
      duplicateCount,
      duplicateRate: rows.length > 0 ? duplicateCount / rows.length : 0
    };
  }

  /**
   * 计算列统计
   */
  _calcColumnStats(headers, rows) {
    let emptyColumnCount = 0;
    let singleValueColumnCount = 0;

    headers.forEach(col => {
      const values = new Set();
      let hasValue = false;

      rows.forEach(row => {
        const val = row[col];
        if (!this._isEmptyValue(val)) {
          hasValue = true;
          values.add(String(val));
        }
      });

      if (!hasValue) {
        emptyColumnCount++;
      } else if (values.size === 1) {
        singleValueColumnCount++;
      }
    });

    return { emptyColumnCount, singleValueColumnCount };
  }

  /**
   * 推断列类型
   */
  _inferColumnType(values) {
    if (values.length === 0) return 'string';

    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;

    values.forEach(v => {
      if (DataParser.isNumeric(v)) numericCount++;
      if (DataParser.isDate(v)) dateCount++;
      if (DataParser.isBoolean(v)) booleanCount++;
    });

    const threshold = 0.7;
    const total = values.length;

    if (numericCount / total >= threshold) return 'number';
    if (dateCount / total >= threshold) return 'date';
    if (booleanCount / total >= threshold) return 'boolean';
    if (numericCount > 0 || dateCount > 0) return 'mixed';

    return 'string';
  }

  /**
   * 计算字段命名规范性得分
   */
  _calcNamingScore(headers) {
    if (headers.length === 0) return 0;

    let totalScore = 0;

    headers.forEach(name => {
      let score = 0;

      if (!name || name.trim() === '') {
        score = 0;
      } else if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
        score = 100;
      } else if (/^[a-z][a-z0-9_]*$/.test(name)) {
        score = 90;
      } else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        score = 80;
      } else if (/^[\u4e00-\u9fa5]+$/.test(name)) {
        score = 70;
      } else if (/[a-zA-Z]/.test(name) && /[\u4e00-\u9fa5]/.test(name)) {
        score = 50;
      } else if (/^\d/.test(name)) {
        score = 40;
      } else if (/\s/.test(name)) {
        score = 30;
      } else {
        score = 60;
      }

      totalScore += score;
    });

    return Math.round(totalScore / headers.length);
  }

  /**
   * 计算格式一致性得分
   */
  _calcFormatConsistency(headers, rows, columnTypes) {
    if (rows.length === 0) return 100;

    let totalScore = 0;
    let colCount = 0;

    headers.forEach(col => {
      const type = columnTypes[col];
      const values = rows.map(r => r[col]).filter(v => !this._isEmptyValue(v));

      if (values.length === 0) {
        totalScore += 100;
        colCount++;
        return;
      }

      let consistentCount = 0;
      values.forEach(v => {
        if (type === 'number' && DataParser.isNumeric(v)) consistentCount++;
        else if (type === 'date' && DataParser.isDate(v)) consistentCount++;
        else if (type === 'boolean' && DataParser.isBoolean(v)) consistentCount++;
        else if (type === 'string') consistentCount++;
        else if (type === 'mixed') consistentCount++;
      });

      const consistency = values.length > 0 ? consistentCount / values.length : 1;
      totalScore += consistency * 100;
      colCount++;
    });

    return colCount > 0 ? Math.round(totalScore / colCount) : 100;
  }

  /**
   * 检测日期格式
   */
  _detectDateFormat(rows, dateColumns) {
    if (dateColumns.length === 0) return null;

    const formats = {
      'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
      'YYYY/MM/DD': /^\d{4}\/\d{2}\/\d{2}$/,
      'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
      'DD/MM/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
      'YYYY-MM-DD HH:mm:ss': /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/,
      'YYYY/MM/DD HH:mm:ss': /^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}$/,
      'ISO8601': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      '时间戳(秒)': /^\d{10}$/,
      '时间戳(毫秒)': /^\d{13}$/
    };

    const result = {};

    dateColumns.forEach(col => {
      const values = rows.map(r => r[col]).filter(v => !this._isEmptyValue(v));
      if (values.length === 0) return;

      const formatCounts = {};

      for (const [fmt, regex] of Object.entries(formats)) {
        let count = 0;
        values.forEach(v => {
          if (regex.test(String(v))) count++;
        });
        formatCounts[fmt] = count;
      }

      let bestFormat = null;
      let bestCount = 0;

      for (const [fmt, count] of Object.entries(formatCounts)) {
        if (count > bestCount) {
          bestCount = count;
          bestFormat = fmt;
        }
      }

      result[col] = {
        format: bestFormat,
        matchRate: values.length > 0 ? bestCount / values.length : 0
      };
    });

    return result;
  }

  // ==================== 数据预览 ====================

  /**
   * 获取数据预览
   * @param {Object} data - { headers, rows }
   * @param {number} [limit=20] - 预览行数
   * @param {string} [format='array'] - 返回格式: 'array' 或 'html'
   * @returns {string|Array}
   */
  getPreview(data, limit = 20, format = 'array') {
    try {
      const { headers, rows } = data;
      const previewRows = rows.slice(0, limit);

      if (format === 'html') {
        return this._generateHtmlTable(headers, previewRows, rows.length > limit);
      }

      return {
        headers,
        rows: previewRows,
        totalRows: rows.length,
        hasMore: rows.length > limit
      };
    } catch (error) {
      return { error: `预览生成失败: ${error.message}` };
    }
  }

  /**
   * 生成HTML表格
   */
  _generateHtmlTable(headers, rows, hasMore) {
    let html = '<table class="data-preview-table" style="width:100%;border-collapse:collapse;font-size:13px;">';

    html += '<thead><tr style="background:#f5f5f5;">';
    headers.forEach(h => {
      html += `<th style="padding:8px 12px;border:1px solid #ddd;text-align:left;font-weight:600;">${this._escapeHtml(h)}</th>`;
    });
    html += '</tr></thead>';

    html += '<tbody>';
    rows.forEach((row, i) => {
      html += `<tr style="${i % 2 === 0 ? 'background:#fff;' : 'background:#fafafa;'}">`;
      headers.forEach(h => {
        const val = row[h];
        const displayVal = val !== undefined && val !== null ? String(val) : '';
        html += `<td style="padding:6px 12px;border:1px solid #ddd;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this._escapeHtml(displayVal)}">${this._escapeHtml(displayVal)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    if (hasMore) {
      html += `<div style="margin-top:8px;color:#999;font-size:12px;">仅显示前 ${rows.length} 行，共更多数据...</div>`;
    }

    return html;
  }

  /**
   * HTML转义
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== 工具方法 ====================

  _errorResult(message, rawText = '') {
    this.lastError = message;
    return {
      headers: [],
      rows: [],
      rawText,
      error: message
    };
  }

  // ==================== 静态方法 ====================

  /**
   * 检测CSV分隔符
   * @param {string} text - CSV文本
   * @returns {string} 分隔符
   */
  static detectDelimiter(text) {
    if (!text) return ',';

    const candidates = [',', ';', '\t', '|'];
    const firstLines = text.split(/\r?\n/).slice(0, 10).filter(l => l.trim());

    if (firstLines.length === 0) return ',';

    let bestDelimiter = ',';
    let bestScore = 0;

    for (const delimiter of candidates) {
      let totalCount = 0;
      let consistent = true;
      let firstCount = -1;

      for (const line of firstLines) {
        let count = 0;
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (!inQuotes && char === delimiter) {
            count++;
          }
        }

        totalCount += count;

        if (firstCount === -1) {
          firstCount = count;
        } else if (count !== firstCount && count > 0) {
          consistent = false;
        }
      }

      if (totalCount > 0) {
        let score = totalCount;
        if (consistent) score *= 2;

        if (score > bestScore) {
          bestScore = score;
          bestDelimiter = delimiter;
        }
      }
    }

    return bestDelimiter;
  }

  /**
   * 检测单个值的类型
   * @param {*} value - 要检测的值
   * @returns {string} 'number' | 'date' | 'boolean' | 'string'
   */
  static detectType(value) {
    if (value === null || value === undefined || value === '') {
      return 'string';
    }

    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';

    const str = String(value).trim();

    if (DataParser.isNumeric(str)) return 'number';
    if (DataParser.isDate(str)) return 'date';
    if (DataParser.isBoolean(str)) return 'boolean';

    return 'string';
  }

  /**
   * 判断是否为数值
   * @param {*} value
   * @returns {boolean}
   */
  static isNumeric(value) {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return !isNaN(value);

    const str = String(value).trim();

    if (str === '') return false;

    const numRegex = /^-?\d+(\.\d+)?$/;
    const sciRegex = /^-?\d+(\.\d+)?[eE][+-]?\d+$/;
    const percentRegex = /^-?\d+(\.\d+)?%$/;
    const commaRegex = /^-?\d{1,3}(,\d{3})*(\.\d+)?$/;

    if (numRegex.test(str)) return true;
    if (sciRegex.test(str)) return true;
    if (percentRegex.test(str)) return true;
    if (commaRegex.test(str)) return true;

    const cleanStr = str.replace(/,/g, '').replace(/%$/, '');
    if (cleanStr === '' || cleanStr === '-') return false;

    const num = Number(cleanStr);
    return !isNaN(num) && isFinite(num);
  }

  /**
   * 判断是否为日期
   * @param {*} value
   * @returns {boolean}
   */
  static isDate(value) {
    if (value === null || value === undefined || value === '') return false;
    if (value instanceof Date) return !isNaN(value.getTime());

    const str = String(value).trim();

    if (str === '') return false;

    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{4}\/\d{2}\/\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{2}-\d{2}-\d{4}$/,
      /^\d{4}年\d{1,2}月\d{1,2}日?$/,
      /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/,
      /^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}(:\d{2})?$/,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /^\d{10}$/,
      /^\d{13}$/
    ];

    let matchesPattern = false;
    for (const pattern of datePatterns) {
      if (pattern.test(str)) {
        matchesPattern = true;
        break;
      }
    }

    if (!matchesPattern) return false;

    const date = new Date(str);
    return !isNaN(date.getTime());
  }

  /**
   * 判断是否为布尔值
   * @param {*} value
   * @returns {boolean}
   */
  static isBoolean(value) {
    if (typeof value === 'boolean') return true;
    if (value === null || value === undefined) return false;

    const str = String(value).trim().toLowerCase();
    const booleanValues = ['true', 'false', 'yes', 'no', '是', '否', '1', '0', 'y', 'n'];

    return booleanValues.includes(str);
  }

  /**
   * 计算异常值（IQR方法）
   * @param {Array<number>} values - 数值数组
   * @returns {Array<number>} 异常值数组
   */
  static calcOutliers(values) {
    if (!Array.isArray(values) || values.length < 4) return [];

    const sorted = [...values].filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (sorted.length < 4) return [];

    const q1 = DataParser._quantile(sorted, 0.25);
    const q3 = DataParser._quantile(sorted, 0.75);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return sorted.filter(v => v < lowerBound || v > upperBound);
  }

  /**
   * 计算分位数
   */
  static _quantile(sorted, q) {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
      return sorted[base];
    }
  }

  /**
   * 计算中位数
   * @param {Array<number>} values - 数值数组
   * @returns {number}
   */
  static median(values) {
    if (!Array.isArray(values) || values.length === 0) return NaN;

    const sorted = [...values].filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return NaN;

    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * 计算标准差
   * @param {Array<number>} values - 数值数组
   * @returns {number}
   */
  static stdDev(values) {
    if (!Array.isArray(values) || values.length < 2) return NaN;

    const validValues = values.filter(v => !isNaN(v));
    if (validValues.length < 2) return NaN;

    const n = validValues.length;
    const mean = validValues.reduce((a, b) => a + b, 0) / n;
    const squaredDiffs = validValues.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (n - 1);

    return Math.sqrt(variance);
  }

  // ==================== Excel 解析 ====================

  /**
   * 动态加载 SheetJS (xlsx.js) 库
   * @returns {Promise<boolean>} 是否加载成功
   */
  static async loadXLSXLibrary() {
    if (typeof window !== 'undefined' && window.XLSX) {
      return true;
    }

    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('当前环境不支持加载外部库'));
        return;
      }

      const existingScript = document.querySelector('script[data-xlsx-library]');
      if (existingScript) {
        if (window.XLSX) {
          resolve(true);
        } else {
          existingScript.addEventListener('load', () => resolve(true));
          existingScript.addEventListener('error', () => reject(new Error('xlsx库加载失败')));
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.setAttribute('data-xlsx-library', 'true');
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('xlsx库加载失败，请检查网络连接'));
      document.head.appendChild(script);
    });
  }

  /**
   * 判断是否为Excel文件
   * @param {string} fileName - 文件名
   * @returns {boolean}
   */
  static isExcelFile(fileName) {
    if (!fileName || typeof fileName !== 'string') return false;
    const lowerName = fileName.toLowerCase();
    const excelExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.xltx', '.xltm', '.xlt', '.xlam', '.xla'];
    return excelExtensions.some(ext => lowerName.endsWith(ext));
  }

  /**
   * 解析Excel文件
   * @param {File|ArrayBuffer|Uint8Array} file - 文件对象或Buffer
   * @param {Object} options - 解析选项
   * @param {string} [options.sheetName] - 指定工作表名称，不传则返回所有工作表
   * @param {boolean} [options.hasHeader=true] - 是否有表头
   * @returns {Promise<Object>} { headers, rows, sheets, sheetNames, formulas, cellFormats, error }
   */
  async parseExcel(file, options = {}) {
    try {
      this.lastError = null;

      await DataParser.loadXLSXLibrary();

      if (!window.XLSX) {
        return this._excelErrorResult('xlsx库未加载成功');
      }

      const workbook = await this._readExcelWorkbook(file);
      if (!workbook) {
        return this._excelErrorResult('Excel文件读取失败');
      }

      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        return this._excelErrorResult('Excel文件中没有工作表');
      }

      const sheets = {};
      let mainSheetName = options.sheetName || sheetNames[0];

      if (!sheetNames.includes(mainSheetName)) {
        mainSheetName = sheetNames[0];
      }

      for (const name of sheetNames) {
        const worksheet = workbook.Sheets[name];
        const sheetData = this._parseWorksheet(worksheet, options);
        sheets[name] = sheetData;
      }

      const mainSheet = sheets[mainSheetName];
      const formulas = this._extractFormulas(workbook, sheetNames);
      const cellFormats = this._extractCellFormats(workbook, sheetNames);
      const excelFeatures = this._extractExcelFeatures(workbook, sheets, formulas, cellFormats);

      return {
        headers: mainSheet.headers,
        rows: mainSheet.rows,
        sheetNames,
        sheets,
        activeSheet: mainSheetName,
        formulas,
        cellFormats,
        excelFeatures,
        workbookInfo: {
          sheetCount: sheetNames.length,
          sheetNames
        },
        error: null
      };
    } catch (error) {
      return this._excelErrorResult(`Excel解析失败: ${error.message}`);
    }
  }

  /**
   * 读取Excel工作簿
   */
  async _readExcelWorkbook(file) {
    return new Promise((resolve, reject) => {
      try {
        if (file instanceof File || (typeof Blob !== 'undefined' && file instanceof Blob)) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = window.XLSX.read(data, { type: 'array', cellFormula: true, cellStyles: true });
              resolve(workbook);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsArrayBuffer(file);
        } else if (file instanceof ArrayBuffer || file instanceof Uint8Array) {
          const data = file instanceof ArrayBuffer ? new Uint8Array(file) : file;
          const workbook = window.XLSX.read(data, { type: 'array', cellFormula: true, cellStyles: true });
          resolve(workbook);
        } else if (typeof file === 'string') {
          const workbook = window.XLSX.read(file, { type: 'base64', cellFormula: true, cellStyles: true });
          resolve(workbook);
        } else {
          reject(new Error('不支持的文件类型'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 解析单个工作表
   */
  _parseWorksheet(worksheet, options = {}) {
    const hasHeader = options.hasHeader !== false;

    const jsonData = window.XLSX.utils.sheet_to_json(worksheet, {
      header: hasHeader ? 1 : 'A',
      defval: ''
    });

    let headers = [];
    let rows = [];

    if (jsonData.length === 0) {
      return { headers: [], rows: [], rowCount: 0, columnCount: 0 };
    }

    if (hasHeader) {
      headers = (jsonData[0] || []).map(h => String(h || '').trim());
      const dataRows = jsonData.slice(1);
      rows = dataRows.map(row => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
      });
    } else {
      const maxCols = Math.max(...jsonData.map(row => (row && row.length) || 0));
      headers = Array.from({ length: maxCols }, (_, i) => `列${i + 1}`);
      rows = jsonData.map(row => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
      });
    }

    const range = window.XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const rowCount = range.e.r + 1;
    const columnCount = range.e.c + 1;

    return {
      headers,
      rows,
      rowCount,
      columnCount
    };
  }

  /**
   * 提取公式
   */
  _extractFormulas(workbook, sheetNames) {
    const allFormulas = {};

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetFormulas = [];

      if (worksheet) {
        for (const cellRef of Object.keys(worksheet)) {
          if (cellRef.startsWith('!')) continue;
          const cell = worksheet[cellRef];
          if (cell && cell.f) {
            sheetFormulas.push({
              cell: cellRef,
              formula: cell.f,
              value: cell.v !== undefined ? cell.v : null
            });
          }
        }
      }

      allFormulas[sheetName] = sheetFormulas;
    }

    return allFormulas;
  }

  /**
   * 提取单元格格式信息
   */
  _extractCellFormats(workbook, sheetNames) {
    const formats = {};

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetFormats = {
        boldCells: 0,
        italicCells: 0,
        coloredCells: 0,
        dateFormatCells: 0,
        numberFormatCells: 0,
        currencyFormatCells: 0,
        percentFormatCells: 0,
        mergedCells: worksheet['!merges'] ? worksheet['!merges'].length : 0
      };

      if (worksheet) {
        for (const cellRef of Object.keys(worksheet)) {
          if (cellRef.startsWith('!')) continue;
          const cell = worksheet[cellRef];
          if (!cell) continue;

          if (cell.s) {
            const style = cell.s;
            if (style.font?.bold) sheetFormats.boldCells++;
            if (style.font?.italic) sheetFormats.italicCells++;
            if (style.font?.color || style.fill?.fgColor) sheetFormats.coloredCells++;
            if (style.numFmt) {
              const fmt = String(style.numFmt).toLowerCase();
              if (fmt.includes('y') || fmt.includes('m') || fmt.includes('d') || fmt.includes('年') || fmt.includes('月') || fmt.includes('日')) {
                sheetFormats.dateFormatCells++;
              }
              if (fmt.includes('0') || fmt.includes('#')) {
                sheetFormats.numberFormatCells++;
              }
              if (fmt.includes('¥') || fmt.includes('$') || fmt.includes('￥') || fmt.includes('€') || fmt.includes('£')) {
                sheetFormats.currencyFormatCells++;
              }
              if (fmt.includes('%')) {
                sheetFormats.percentFormatCells++;
              }
            }
          }
        }
      }

      formats[sheetName] = sheetFormats;
    }

    return formats;
  }

  /**
   * 提取Excel文件特征
   */
  _extractExcelFeatures(workbook, sheets, formulas, cellFormats) {
    const sheetNames = Object.keys(sheets);
    const sheetCount = sheetNames.length;

    let totalRows = 0;
    let totalColumns = 0;
    let totalCells = 0;
    let totalFormulas = 0;
    let hasMergedCells = false;
    let hasConditionalFormatting = false;

    for (const name of sheetNames) {
      const sheet = sheets[name];
      totalRows += sheet.rowCount || 0;
      totalColumns = Math.max(totalColumns, sheet.columnCount || 0);
      totalCells += (sheet.rowCount || 0) * (sheet.columnCount || 0);

      const sheetFormulas = formulas[name] || [];
      totalFormulas += sheetFormulas.length;

      const fmt = cellFormats[name] || {};
      if (fmt.mergedCells > 0) hasMergedCells = true;
    }

    const formulaComplexity = this._calcFormulaComplexity(formulas);
    const structureScore = this._calcExcelStructureScore(sheets, cellFormats);
    const namingScore = this._calcExcelNamingScore(sheetNames, sheets);

    return {
      basicStats: {
        sheetCount,
        sheetNames,
        totalRows,
        totalColumns,
        totalCells,
        totalFormulas
      },
      structure: {
        hasMergedCells,
        hasMultipleSheets: sheetCount > 1,
        hasFormulas: totalFormulas > 0,
        formulaComplexity
      },
      formatting: cellFormats,
      quality: {
        structureScore,
        namingScore
      }
    };
  }

  /**
   * 计算公式复杂度
   */
  _calcFormulaComplexity(formulas) {
    let totalComplexity = 0;
    let formulaCount = 0;

    for (const sheetFormulas of Object.values(formulas)) {
      if (!Array.isArray(sheetFormulas)) continue;
      for (const f of sheetFormulas) {
        formulaCount++;
        const formula = f.formula || '';
        let complexity = 1;
        const functionCount = (formula.match(/[A-Z_]+\(/g) || []).length;
        const nestedParens = (formula.match(/\(/g) || []).length;
        complexity += functionCount * 0.5;
        complexity += Math.max(0, nestedParens - 2) * 0.3;
        if (formula.includes('IF') || formula.includes('VLOOKUP') || formula.includes('INDEX')) {
          complexity += 1;
        }
        if (formula.includes('$')) {
          complexity += 0.3;
        }
        totalComplexity += complexity;
      }
    }

    return {
      formulaCount,
      avgComplexity: formulaCount > 0 ? totalComplexity / formulaCount : 0,
      totalComplexity
    };
  }

  /**
   * 计算Excel结构得分
   */
  _calcExcelStructureScore(sheets, cellFormats) {
    let score = 50;
    const sheetNames = Object.keys(sheets);

    if (sheetNames.length >= 1) score += 10;
    if (sheetNames.length >= 3) score += 10;
    if (sheetNames.length >= 5) score += 5;

    for (const name of sheetNames) {
      const sheet = sheets[name];
      const fmt = cellFormats[name] || {};

      if (sheet.headers && sheet.headers.length > 0) score += 5;
      if (fmt.boldCells > 0) score += 3;
      if (fmt.mergedCells > 0) score -= 5;

      break;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 计算Excel命名得分
   */
  _calcExcelNamingScore(sheetNames, sheets) {
    let totalScore = 0;
    let count = 0;

    sheetNames.forEach(name => {
      let score = 0;
      if (!name || name.trim() === '') {
        score = 0;
      } else if (/^Sheet\d+$/i.test(name)) {
        score = 30;
      } else if (/^[a-zA-Z\u4e00-\u9fa5]+/.test(name)) {
        score = 80;
      } else {
        score = 60;
      }
      totalScore += score;
      count++;
    });

    for (const sheet of Object.values(sheets)) {
      if (sheet.headers && sheet.headers.length > 0) {
        const headerScore = this._calcNamingScore(sheet.headers);
        totalScore += headerScore;
        count++;
      }
    }

    return count > 0 ? Math.round(totalScore / count) : 0;
  }

  /**
   * Excel错误结果
   */
  _excelErrorResult(message) {
    this.lastError = message;
    return {
      headers: [],
      rows: [],
      sheetNames: [],
      sheets: {},
      activeSheet: '',
      formulas: {},
      cellFormats: {},
      excelFeatures: null,
      workbookInfo: { sheetCount: 0, sheetNames: [] },
      error: message
    };
  }
}

window.DataParser = DataParser;
