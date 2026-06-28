/**
 * Markdown报告解析与结构分析器
 * 纯前端实现，支持Markdown结构解析、特征提取、质量评估
 */

class ReportAnalyzer {
  constructor() {
    this.lastError = null;
  }

  // ==================== Markdown结构解析 ====================

  /**
   * 解析Markdown文本
   * @param {string} text - Markdown文本内容
   * @returns {Object} 结构化解析结果
   */
  parseMarkdown(text) {
    try {
      this.lastError = null;

      if (!text || typeof text !== 'string') {
        return this._errorResult('Markdown内容为空或格式无效', text);
      }

      const rawText = text;
      const lines = text.split(/\r?\n/);

      const headings = this._parseHeadings(lines, text);
      const headingTree = this._buildHeadingTree(headings);
      const paragraphs = this._parseParagraphs(lines, text);
      const tables = this._parseTables(lines, text);
      const lists = this._parseLists(lines, text);
      const images = this._parseImages(text);
      const links = this._parseLinks(text);
      const codeBlocks = this._parseCodeBlocks(lines, text);
      const blockquotes = this._parseBlockquotes(lines, text);
      const wordCount = ReportAnalyzer.countWords(text);
      const charCount = text.length;

      return {
        rawText,
        headings,
        headingTree,
        paragraphs,
        tables,
        lists,
        images,
        links,
        codeBlocks,
        blockquotes,
        wordCount,
        charCount,
        error: null
      };
    } catch (error) {
      return this._errorResult(`Markdown解析失败: ${error.message}`, text);
    }
  }

  /**
   * 解析标题
   */
  _parseHeadings(lines, fullText) {
    const headings = [];
    let currentPos = 0;
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLength = line.length + 1;

      if (/^\s*```/.test(line)) {
        inCodeBlock = !inCodeBlock;
        currentPos += lineLength;
        continue;
      }

      if (inCodeBlock) {
        currentPos += lineLength;
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        headings.push({
          level,
          text: headingText,
          position: currentPos,
          length: line.length,
          lineIndex: i
        });
      }

      const nextLine = lines[i + 1];
      if (nextLine !== undefined && /^=+\s*$/.test(nextLine) && line.trim()) {
        const exists = headings.some(h => h.lineIndex === i);
        if (!exists) {
          headings.push({
            level: 1,
            text: line.trim(),
            position: currentPos,
            length: line.length + nextLine.length + 1,
            lineIndex: i
          });
        }
      }

      if (nextLine !== undefined && /^-+\s*$/.test(nextLine) && line.trim()) {
        const exists = headings.some(h => h.lineIndex === i);
        if (!exists) {
          headings.push({
            level: 2,
            text: line.trim(),
            position: currentPos,
            length: line.length + nextLine.length + 1,
            lineIndex: i
          });
        }
      }

      currentPos += lineLength;
    }

    return headings.sort((a, b) => a.position - b.position);
  }

  /**
   * 构建标题树
   */
  _buildHeadingTree(headings) {
    const tree = [];
    const stack = [];

    headings.forEach(heading => {
      const node = {
        text: heading.text,
        level: heading.level,
        children: []
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        tree.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    return tree;
  }

  /**
   * 解析段落
   */
  _parseParagraphs(lines, fullText) {
    const paragraphs = [];
    let currentPara = [];
    let currentPos = 0;
    let paraStartPos = 0;
    let inCodeBlock = false;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLength = line.length + 1;

      if (/^\s*```/.test(line)) {
        if (currentPara.length > 0) {
          paragraphs.push({
            text: currentPara.join('\n').trim(),
            position: paraStartPos,
            length: currentPos - paraStartPos
          });
          currentPara = [];
        }
        inCodeBlock = !inCodeBlock;
        currentPos += lineLength;
        continue;
      }

      if (inCodeBlock) {
        currentPos += lineLength;
        continue;
      }

      if (/^\s*#{1,6}\s+/.test(line) || /^\s*=+\s*$/.test(line) || /^\s*-+\s*$/.test(line)) {
        if (currentPara.length > 0) {
          paragraphs.push({
            text: currentPara.join('\n').trim(),
            position: paraStartPos,
            length: currentPos - paraStartPos
          });
          currentPara = [];
        }
        currentPos += lineLength;
        continue;
      }

      if (/^\s*\|.+\|\s*$/.test(line)) {
        if (currentPara.length > 0) {
          paragraphs.push({
            text: currentPara.join('\n').trim(),
            position: paraStartPos,
            length: currentPos - paraStartPos
          });
          currentPara = [];
        }
        currentPos += lineLength;
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        if (currentPara.length > 0) {
          paragraphs.push({
            text: currentPara.join('\n').trim(),
            position: paraStartPos,
            length: currentPos - paraStartPos
          });
          currentPara = [];
        }
        currentPos += lineLength;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        if (currentPara.length > 0) {
          paragraphs.push({
            text: currentPara.join('\n').trim(),
            position: paraStartPos,
            length: currentPos - paraStartPos
          });
          currentPara = [];
        }
        currentPos += lineLength;
        continue;
      }

      if (line.trim() === '') {
        if (currentPara.length > 0) {
          paragraphs.push({
            text: currentPara.join('\n').trim(),
            position: paraStartPos,
            length: currentPos - paraStartPos
          });
          currentPara = [];
        }
        currentPos += lineLength;
        continue;
      }

      if (currentPara.length === 0) {
        paraStartPos = currentPos;
      }
      currentPara.push(line);
      currentPos += lineLength;
    }

    if (currentPara.length > 0) {
      paragraphs.push({
        text: currentPara.join('\n').trim(),
        position: paraStartPos,
        length: currentPos - paraStartPos
      });
    }

    return paragraphs.filter(p => p.text && p.text.trim());
  }

  /**
   * 解析表格
   */
  _parseTables(lines, fullText) {
    const tables = [];
    let currentPos = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineLength = line.length + 1;

      if (/^\s*\|.+\|\s*$/.test(line)) {
        const headerLine = line;
        const separatorLine = lines[i + 1];

        if (separatorLine && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(separatorLine)) {
          const tableStartPos = currentPos;
          const headers = headerLine.split('|')
            .map(h => h.trim())
            .filter(h => h !== '');

          let rowCount = 0;
          let j = i + 2;

          while (j < lines.length && /^\s*\|.+\|\s*$/.test(lines[j])) {
            rowCount++;
            j++;
          }

          const tableEndPos = currentPos + lines.slice(i, j).join('\n').length;

          tables.push({
            headers,
            rowCount,
            position: tableStartPos,
            length: tableEndPos - tableStartPos
          });

          i = j;
          currentPos = tableEndPos + 1;
          continue;
        }
      }

      currentPos += lineLength;
      i++;
    }

    return tables;
  }

  /**
   * 解析列表
   */
  _parseLists(lines, fullText) {
    const lists = [];
    let currentPos = 0;
    let i = 0;
    let inCodeBlock = false;

    while (i < lines.length) {
      const line = lines[i];
      const lineLength = line.length + 1;

      if (/^\s*```/.test(line)) {
        inCodeBlock = !inCodeBlock;
        currentPos += lineLength;
        i++;
        continue;
      }

      if (inCodeBlock) {
        currentPos += lineLength;
        i++;
        continue;
      }

      const unorderedMatch = line.match(/^\s*([-*+])\s+(.+)$/);
      const orderedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);

      if (unorderedMatch || orderedMatch) {
        const listType = unorderedMatch ? 'unordered' : 'ordered';
        const listStartPos = currentPos;
        const items = [];
        let j = i;

        while (j < lines.length) {
          const currLine = lines[j];
          const currUnorderedMatch = currLine.match(/^\s*[-*+]\s+(.+)$/);
          const currOrderedMatch = currLine.match(/^\s*\d+\.\s+(.+)$/);
          const isTopLevelItem = /^\s{0,1}[-*+]\s+/.test(currLine) || /^\s{0,1}\d+\.\s+/.test(currLine);
          const isIndented = /^\s{2,}[-*+]\s+/.test(currLine) || /^\s{2,}\d+\.\s+/.test(currLine);
          const isEmpty = currLine.trim() === '';

          if (isEmpty) {
            const nextLine = lines[j + 1];
            if (nextLine) {
              const nextIsListItem = (listType === 'unordered' && /^\s*[-*+]\s+/.test(nextLine)) ||
                (listType === 'ordered' && /^\s*\d+\.\s+/.test(nextLine));
              if (nextIsListItem) {
                j++;
                continue;
              }
            }
            break;
          }

          if (isTopLevelItem) {
            const itemText = (currUnorderedMatch && currUnorderedMatch[1]) ||
              (currOrderedMatch && currOrderedMatch[1]) || '';
            items.push(itemText.trim());
          } else if (!isIndented && currLine.trim()) {
            break;
          }

          j++;
        }

        const listEndPos = currentPos + lines.slice(i, j).join('\n').length;

        lists.push({
          type: listType,
          itemCount: items.length,
          items,
          position: listStartPos,
          length: listEndPos - listStartPos
        });

        i = j;
        currentPos = listEndPos + 1;
        continue;
      }

      currentPos += lineLength;
      i++;
    }

    return lists;
  }

  /**
   * 解析图片
   */
  _parseImages(text) {
    const images = [];
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      images.push({
        alt: match[1] || '',
        src: match[2] || '',
        position: match.index
      });
    }

    return images;
  }

  /**
   * 解析链接
   */
  _parseLinks(text) {
    const links = [];
    const regex = /(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      links.push({
        text: match[1] || '',
        url: match[2] || '',
        position: match.index
      });
    }

    return links;
  }

  /**
   * 解析代码块
   */
  _parseCodeBlocks(lines, fullText) {
    const codeBlocks = [];
    let currentPos = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineLength = line.length + 1;

      const startMatch = line.match(/^\s*```(\w*)\s*$/);
      if (startMatch) {
        const language = startMatch[1] || '';
        const blockStartPos = currentPos;
        const contentLines = [];
        let j = i + 1;

        while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) {
          contentLines.push(lines[j]);
          j++;
        }

        const blockEndLine = j < lines.length ? j : i;
        const blockEndPos = currentPos + lines.slice(i, blockEndLine + 1).join('\n').length;

        codeBlocks.push({
          language,
          content: contentLines.join('\n'),
          position: blockStartPos,
          length: blockEndPos - blockStartPos
        });

        i = j + 1;
        currentPos = blockEndPos + 1;
        continue;
      }

      currentPos += lineLength;
      i++;
    }

    return codeBlocks;
  }

  /**
   * 解析引用
   */
  _parseBlockquotes(lines, fullText) {
    const blockquotes = [];
    let currentPos = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineLength = line.length + 1;

      if (/^\s*>\s?/.test(line)) {
        const quoteStartPos = currentPos;
        const quoteLines = [];
        let j = i;

        while (j < lines.length && /^\s*>\s?/.test(lines[j])) {
          quoteLines.push(lines[j].replace(/^\s*>\s?/, ''));
          j++;
        }

        const quoteEndPos = currentPos + lines.slice(i, j).join('\n').length;

        blockquotes.push({
          text: quoteLines.join('\n').trim(),
          position: quoteStartPos,
          length: quoteEndPos - quoteStartPos
        });

        i = j;
        currentPos = quoteEndPos + 1;
        continue;
      }

      currentPos += lineLength;
      i++;
    }

    return blockquotes;
  }

  // ==================== 结构特征提取 ====================

  /**
   * 提取结构特征
   * @param {Object} parsed - parseMarkdown返回的解析结果
   * @returns {Object} 结构特征
   */
  extractStructureFeatures(parsed) {
    try {
      if (!parsed || parsed.error) {
        return {
          error: parsed ? parsed.error : '解析结果无效'
        };
      }

      const { headings, paragraphs, tables, lists, images, codeBlocks, wordCount } = parsed;

      const headingCount = headings.length;
      const headingLevelDistribution = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
      headings.forEach(h => {
        const key = `h${h.level}`;
        if (headingLevelDistribution.hasOwnProperty(key)) {
          headingLevelDistribution[key]++;
        }
      });

      let structureCompleteness = 0;
      if (headingCount > 0) {
        let score = 0;
        const maxLevel = Math.max(...headings.map(h => h.level));

        if (headingLevelDistribution.h1 > 0) score += 20;
        if (headingLevelDistribution.h2 > 0) score += 20;
        if (headingLevelDistribution.h3 > 0) score += 15;
        if (headingLevelDistribution.h4 > 0) score += 10;

        if (headingCount >= 3) score += 15;
        if (headingCount >= 6) score += 10;
        if (headingCount >= 10) score += 10;

        structureCompleteness = Math.min(100, score);
      }

      const summaryKeywords = ['总结', '结论', '结语', '概要', '综述', '总览'];
      const hasSummary = ReportAnalyzer.detectSection(headings, summaryKeywords);

      const analysisKeywords = ['分析', '诊断', '洞察', '发现', '研究', '评估', '数据洞察'];
      const hasAnalysis = ReportAnalyzer.detectSection(headings, analysisKeywords);

      const suggestionKeywords = ['建议', '优化', '改进', '方案', '对策', '措施', '行动计划'];
      const hasSuggestions = ReportAnalyzer.detectSection(headings, suggestionKeywords);

      const hasData = tables.length > 0 || codeBlocks.length > 0;

      const totalWordCount = wordCount;
      const avgParagraphLength = paragraphs.length > 0
        ? Math.round(totalWordCount / paragraphs.length)
        : 0;

      const tableCount = tables.length;
      const listCount = lists.length;
      const imageCount = images.length;
      const codeBlockCount = codeBlocks.length;

      let structureScore = structureCompleteness;

      let dataSupportScore = 0;
      if (tableCount > 0) dataSupportScore += 40;
      if (codeBlockCount > 0) dataSupportScore += 20;
      if (hasAnalysis) dataSupportScore += 20;
      if (imageCount > 0) dataSupportScore += 10;
      if (listCount > 0) dataSupportScore += 10;
      dataSupportScore = Math.min(100, dataSupportScore);

      let richnessScore = 0;
      if (totalWordCount > 100) richnessScore += 15;
      if (totalWordCount > 500) richnessScore += 15;
      if (totalWordCount > 1000) richnessScore += 10;
      if (tableCount > 0) richnessScore += 15;
      if (listCount > 0) richnessScore += 10;
      if (imageCount > 0) richnessScore += 10;
      if (codeBlockCount > 0) richnessScore += 10;
      if (paragraphs.length > 3) richnessScore += 10;
      if (headingCount > 3) richnessScore += 5;
      richnessScore = Math.min(100, richnessScore);

      return {
        structureCompleteness,
        headingCount,
        headingLevelDistribution,
        hasSummary,
        hasAnalysis,
        hasSuggestions,
        hasData,
        totalWordCount,
        avgParagraphLength,
        tableCount,
        listCount,
        imageCount,
        codeBlockCount,
        structureScore,
        dataSupportScore,
        richnessScore
      };
    } catch (error) {
      return {
        error: `特征提取失败: ${error.message}`
      };
    }
  }

  // ==================== 内容质量初判 ====================

  /**
   * 内容质量初判
   * @param {Object} parsed - parseMarkdown返回的解析结果
   * @param {Object} options - 配置选项
   * @returns {Object} 质量评估结果
   */
  analyzeContentQuality(parsed, options = {}) {
    try {
      if (!parsed || parsed.error) {
        return {
          error: parsed ? parsed.error : '解析结果无效'
        };
      }

      const { rawText, paragraphs, lists } = parsed;
      const cleanText = this._stripMarkdown(rawText);

      const words = this._tokenize(cleanText);
      const totalWords = words.length;
      const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
      const vocabularyRichness = totalWords > 0 ? uniqueWords / totalWords : 0;

      const domainTerms = options.domainTerms || this._getDefaultDomainTerms();
      let termCount = 0;
      const lowerText = cleanText.toLowerCase();
      domainTerms.forEach(term => {
        const termLower = term.toLowerCase();
        const regex = new RegExp(this._escapeRegex(termLower), 'g');
        const matches = lowerText.match(regex);
        if (matches) {
          termCount += matches.length;
        }
      });
      const termDensity = totalWords > 0 ? termCount / totalWords : 0;

      const dataReferences = ReportAnalyzer.findDataReferences(rawText);

      const suggestions = ReportAnalyzer.extractSuggestions(parsed);
      const suggestionCount = suggestions.length;

      let overallQualityScore = 0;
      overallQualityScore += Math.min(25, vocabularyRichness * 100);
      overallQualityScore += Math.min(25, termDensity * 200);
      overallQualityScore += Math.min(25, dataReferences.length * 5);
      overallQualityScore += Math.min(25, suggestionCount * 5);
      overallQualityScore = Math.min(100, Math.round(overallQualityScore));

      return {
        vocabularyRichness: Math.round(vocabularyRichness * 1000) / 1000,
        termDensity: Math.round(termDensity * 1000) / 1000,
        dataReferences: dataReferences.length,
        dataReferenceDetails: dataReferences,
        suggestionCount,
        suggestions,
        overallQualityScore
      };
    } catch (error) {
      return {
        error: `质量评估失败: ${error.message}`
      };
    }
  }

  /**
   * 去除Markdown标记
   */
  _stripMarkdown(text) {
    let clean = text;
    clean = clean.replace(/```[\s\S]*?```/g, ' ');
    clean = clean.replace(/`[^`]*`/g, ' ');
    clean = clean.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    clean = clean.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    clean = clean.replace(/^#{1,6}\s+/gm, '');
    clean = clean.replace(/^\s*[-*+]\s+/gm, '');
    clean = clean.replace(/^\s*\d+\.\s+/gm, '');
    clean = clean.replace(/^\s*>\s?/gm, '');
    clean = clean.replace(/\|/g, ' ');
    clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
    clean = clean.replace(/\*([^*]+)\*/g, '$1');
    clean = clean.replace(/__([^_]+)__/g, '$1');
    clean = clean.replace(/_([^_]+)_/g, '$1');
    clean = clean.replace(/\n{3,}/g, '\n\n');
    return clean;
  }

  /**
   * 分词（支持中英文）
   */
  _tokenize(text) {
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    return [...englishWords, ...chineseChars];
  }

  /**
   * 获取默认领域术语
   */
  _getDefaultDomainTerms() {
    return [
      'GMV', '转化率', '客单价', '复购率', '留存率', '活跃用户',
      '流量', '访客', '页面浏览量', '跳出率', '平均停留时长',
      'ROI', 'ROAS', '点击率', 'CTR', 'CVR', 'CPA',
      '漏斗', '转化漏斗', 'A/B测试', '用户画像', '用户分层',
      '销售额', '订单量', '退款率', '毛利率', '净利率',
      '数据分析', '数据洞察', '数据驱动', '指标体系',
      '环比', '同比', '增长率', '下降率', '市场份额',
      '竞品分析', '竞争对手', '优势', '劣势', '机会', '威胁',
      'SWOT', '用户旅程', '用户体验', 'UX', 'UI',
      '获客', '激活', '留存', '收入', '推荐',
      'AARRR', 'RFM', 'LTV', 'CAC', '用户生命周期价值'
    ];
  }

  /**
   * 转义正则特殊字符
   */
  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ==================== 课程上下文关联 ====================

  /**
   * 课程上下文关联匹配
   * @param {Object} features - 结构特征
   * @param {Object} context - 课程上下文
   * @param {string} context.stageTitle - 阶段标题
   * @param {string} context.lessonTitle - 课程标题
   * @param {Array<string>} context.keywords - 关键词列表
   * @returns {Object} 匹配结果
   */
  matchWithContext(features, context) {
    try {
      if (!features || !context) {
        return {
          error: '特征或上下文无效'
        };
      }

      const { stageTitle = '', lessonTitle = '', keywords = [] } = context;
      const matchedKeywords = [];
      const missingKeywords = [];

      const textToSearch = this._buildSearchText(features);
      const lowerText = textToSearch.toLowerCase();

      keywords.forEach(keyword => {
        if (!keyword) return;
        const keywordLower = keyword.toLowerCase();
        if (lowerText.includes(keywordLower)) {
          matchedKeywords.push(keyword);
        } else {
          missingKeywords.push(keyword);
        }
      });

      if (stageTitle) {
        const stageLower = stageTitle.toLowerCase();
        if (lowerText.includes(stageLower)) {
          matchedKeywords.push(stageTitle);
        } else {
          missingKeywords.push(stageTitle);
        }
      }

      if (lessonTitle) {
        const lessonLower = lessonTitle.toLowerCase();
        if (lowerText.includes(lessonLower)) {
          matchedKeywords.push(lessonTitle);
        } else {
          missingKeywords.push(lessonTitle);
        }
      }

      const totalKeywords = keywords.length +
        (stageTitle ? 1 : 0) +
        (lessonTitle ? 1 : 0);

      const matchScore = totalKeywords > 0
        ? Math.round((matchedKeywords.length / totalKeywords) * 100)
        : 0;

      return {
        matchScore,
        matchedKeywords,
        missingKeywords
      };
    } catch (error) {
      return {
        error: `上下文匹配失败: ${error.message}`
      };
    }
  }

  /**
   * 构建搜索文本
   */
  _buildSearchText(features) {
    const parts = [];

    if (features.headings) {
      features.headings.forEach(h => parts.push(h.text));
    }

    if (features.paragraphs) {
      features.paragraphs.forEach(p => parts.push(p.text));
    }

    if (features.tables) {
      features.tables.forEach(t => {
        parts.push(...t.headers);
      });
    }

    if (features.lists) {
      features.lists.forEach(l => {
        if (l.items) {
          parts.push(...l.items);
        }
      });
    }

    if (features.blockquotes) {
      features.blockquotes.forEach(b => parts.push(b.text));
    }

    return parts.join(' ');
  }

  // ==================== 工具方法 ====================

  _errorResult(message, rawText = '') {
    this.lastError = message;
    return {
      rawText,
      headings: [],
      headingTree: [],
      paragraphs: [],
      tables: [],
      lists: [],
      images: [],
      links: [],
      codeBlocks: [],
      blockquotes: [],
      wordCount: 0,
      charCount: 0,
      error: message
    };
  }

  // ==================== 静态方法 ====================

  /**
   * 统计字数
   * @param {string} text - 文本内容
   * @returns {number} 字数
   */
  static countWords(text) {
    if (!text || typeof text !== 'string') return 0;

    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const numbers = text.match(/\d+/g) || [];

    return englishWords.length + chineseChars.length + numbers.length;
  }

  /**
   * 检测是否包含某部分
   * @param {Array} headings - 标题数组
   * @param {Array<string>} keywords - 关键词列表
   * @returns {boolean} 是否包含
   */
  static detectSection(headings, keywords) {
    if (!headings || !keywords || headings.length === 0 || keywords.length === 0) {
      return false;
    }

    return headings.some(heading => {
      const headingText = heading.text || '';
      const lowerText = headingText.toLowerCase();
      return keywords.some(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        return lowerText.includes(lowerKeyword);
      });
    });
  }

  /**
   * 查找数据引用
   * @param {string} text - 文本内容
   * @returns {Array<Object>} 数据引用列表
   */
  static findDataReferences(text) {
    if (!text || typeof text !== 'string') return [];

    const references = [];
    const patterns = [
      { regex: /\d+(?:\.\d+)?%/g, type: 'percentage' },
      { regex: /\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, type: 'number' },
      { regex: /\d+(?:\.\d+)?/g, type: 'number' },
      { regex: /(?:增长|下降|增加|减少|提升|降低)\s*\d+(?:\.\d+)?%?/g, type: 'trend' },
      { regex: /(?:同比|环比)\s*(?:增长|下降|增加|减少|提升|降低)?\s*\d+(?:\.\d+)?%?/g, type: 'comparison' }
    ];

    const seen = new Set();

    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      while ((match = regex.exec(text)) !== null) {
        const value = match[0].trim();
        if (!seen.has(value) && value.length > 0) {
          seen.add(value);
          references.push({
            value,
            type: pattern.type,
            position: match.index
          });
        }
      }
    });

    return references.sort((a, b) => a.position - b.position);
  }

  /**
   * 提取建议条目
   * @param {Object} parsed - parseMarkdown返回的解析结果
   * @returns {Array<string>} 建议列表
   */
  static extractSuggestions(parsed) {
    if (!parsed || parsed.error) return [];

    const suggestions = [];
    const { headings, lists, paragraphs } = parsed;

    const suggestionKeywords = ['建议', '优化', '改进', '方案', '对策', '措施', '应该', '可以', '需要'];

    let inSuggestionSection = false;
    if (headings && headings.length > 0) {
      inSuggestionSection = ReportAnalyzer.detectSection(headings, suggestionKeywords);
    }

    if (lists && lists.length > 0) {
      lists.forEach(list => {
        if (list.items && list.items.length > 0) {
          list.items.forEach(item => {
            const lowerItem = item.toLowerCase();
            const isSuggestion = suggestionKeywords.some(kw =>
              lowerItem.includes(kw.toLowerCase())
            );
            if (isSuggestion || inSuggestionSection) {
              suggestions.push(item);
            }
          });
        }
      });
    }

    if (paragraphs && paragraphs.length > 0) {
      paragraphs.forEach(para => {
        const text = para.text || '';
        const lowerText = text.toLowerCase();
        if (suggestionKeywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
          const sentences = text.split(/[。！？.!?\n]+/).filter(s => s.trim());
          sentences.forEach(sentence => {
            const trimmed = sentence.trim();
            if (trimmed && suggestionKeywords.some(kw =>
              trimmed.toLowerCase().includes(kw.toLowerCase())
            )) {
              if (!suggestions.includes(trimmed)) {
                suggestions.push(trimmed);
              }
            }
          });
        }
      });
    }

    return suggestions;
  }
}

window.ReportAnalyzer = ReportAnalyzer;
