# 市场数据分析AI伴学平台 - 技术规格文档

## 1. 项目概述

**项目名称**: Market Data Analysis AI Learning Platform
**项目类型**: 纯前端单页应用（SPA）
**核心功能**: 高职院校《市场数据分析》课程的AI Agent伴学系统，学生通过与内置"李主管"AI Agent进行情景化对话学习
**目标用户**: 高职院校学生（学生端）、教师（教师端）

## 2. 技术栈

| 类别 | 技术选型 |
|------|----------|
| 框架 | 纯HTML/CSS/JavaScript（无框架） |
| UI库 | Tailwind CSS (CDN) + 自定义CSS变量 |
| 数据存储 | IndexedDB (Dexie.js封装) |
| AI对接 | fetch直接调用OpenAI兼容API |
| 表格组件 | Handsontable (CDN) |
| 可视化图表 | ECharts (CDN) |
| 富文本编辑器 | Quill.js (CDN) |
| 演示文稿 | reveal.js (CDN) |
| 样式风格 | 深色科技风（GitHub Dark主题配色） |

## 3. 项目结构

```
/workspace/
├── index.html                  # 学生端首页/登录页
├── pages/
│   ├── dashboard.html         # 学习仪表盘
│   ├── learn.html             # 学习内容页（核心）
│   ├── practice.html          # 实操页
│   ├── test.html              # 测试页
│   └── settings.html          # 设置页
├── teacher/
│   ├── index.html             # 教师视图首页
│   └── viewer.html            # 学习记录查看器
├── js/
│   ├── app.js                 # 主入口、路由管理
│   ├── db.js                  # IndexedDB操作
│   ├── ai.js                  # AI API调用
│   ├── agent.js               # Agent角色管理
│   ├── course-engine.js       # 课程引擎
│   ├── test-engine.js         # 测试引擎
│   ├── data-helper.js         # 数据助手
│   └── export.js              # 数据导出
├── data/
│   ├── course-content.json    # 课程内容
│   ├── questions.json          # 测试题库
│   ├── sample-data/           # 样本数据
│   │   ├── orders-200.json
│   │   ├── orders-full.json
│   │   ├── traffic-full.json
│   │   ├── users-full.json
│   │   ├── competitors.json
│   │   ├── variant-orders.json
│   │   └── trap-data.json
│   └── prompts/               # System Prompts
│       ├── system-manager.txt
│       ├── mode-onboard.txt
│       ├── mode-socratic.txt
│       ├── mode-reviewer.txt
│       ├── mode-examiner.txt
│       └── mode-assistant.txt
└── css/
    └── style.css              # 全局样式
```

## 4. 页面详细规格

### 4.1 首页 (index.html)

**功能**:
- 欢迎界面，课程标题、项目背景简介
- "学生登录" / "教师视图" 两个入口按钮
- 首次访问自动生成UUID存入localStorage

### 4.2 学习仪表盘 (dashboard.html)

**布局**:
- 顶部: 学生匿名ID、总体进度百分比、已用课时/54课时
- 中部: 6个阶段卡片（未开始/进行中/已完成/测试已通过）
- 右上角: 设置按钮、数据导出按钮
- 底部: AI依赖指数、自我纠正率、求助频率等行为指标

### 4.3 学习内容页 (learn.html) - 核心页面

**布局（左右分栏）**:
- 左侧(60%): 课程内容区
  - 顶部: 阶段/课时信息
  - 预制图文内容(Markdown渲染)
  - 根据课时类型显示不同组件
- 右侧(40%): AI对话窗口
  - 顶部: 当前AI模式图标+状态
  - 对话消息列表(气泡样式)
  - 底部: 输入框+发送按钮
  - AI锁定时灰色遮罩

**AI对话窗口行为**:
- 每条对话存入IndexedDB
- 携带完整对话历史(最近20条)+System Prompt+课程上下文
- 苏格拉底模式: 连续3次请求帮助后变为引导提示

### 4.4 实操页 (practice.html)

- 内嵌Handsontable在线表格
- 支持排序、筛选、高亮、条件格式
- Agent作为数据助手执行操作(SheetJS)
- 自动校验核心字段准确率

### 4.5 测试页 (test.html)

- 从questions.json加载题目
- 支持: 单选题、多选题、填空题、实操题
- 顶部倒计时器
- AI对话窗口完全锁定
- 自动评分存入IndexedDB

### 4.6 设置页 (settings.html)

**API Key配置区**:
- 最多3个API Key配置
- 智谱AI / Gemini / 硅基流动
- 测试连接按钮
- 主Key+备用Key自动切换

**数据管理区**:
- 导出学习记录(JSON)
- 导出成绩汇总(CSV)
- 清除所有数据(二次确认)
- 存储用量显示

### 4.7 教师视图 (teacher/)

**index.html**: 上传JSON文件入口(拖拽/选择)

**viewer.html**:
- 学生ID、总评成绩、学习总时长
- 时间线视图(按阶段)
- 成绩看板(柱状图)
- AI依赖分析面板
- 原创vs AI参考对比(diff)
- 异常预警

## 5. AI API对接规格

### 5.1 请求格式(OpenAI兼容)

```javascript
POST {baseURL}/v1/chat/completions
Headers: Authorization: Bearer {apiKey}, Content-Type: application/json
Body: {
  "model": "glm-4-flash",
  "messages": [
    {"role": "system", "content": "{systemPrompt}"},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "temperature": 0.7,
  "max_tokens": 2000
}
```

### 5.2 三个API提供商

| 提供商 | baseURL | model | 免费额度 |
|--------|---------|-------|----------|
| 智谱AI | `https://open.bigmodel.cn/api/paas` | glm-4-flash | 永久免费30并发 |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | gemini-2.0-flash-lite | 永久免费1000RPD |
| 硅基流动 | `https://api.siliconflow.cn/v1` | Qwen/Qwen2.5-7B-Instruct | 永久免费 |

### 5.3 流式响应处理
- 使用fetch的ReadableStream处理SSE
- 逐字显示Agent回复
- 支持中断生成

### 5.4 错误处理
- 429(限流): 自动切换备用Key
- 401(Key无效): 提示检查配置
- 网络超时: 10秒超时提示
- 无可用Key: 显示配置提示

## 6. Agent角色规格

### 6.1 李主管System Prompt

```
你叫李主管，是杭州悦享家居用品有限公司电商运营部的主管，管理一个6人的电商团队。
公司主营家居收纳类产品（天猫+抖音），22个SKU，客单价80-150元。

现在有一个新入职的试用期数据分析助理（学生），你正在带他/她完成9月月度数据分析项目。
项目背景：9月GMV环比下滑12%，转化率连续3个月低于类目均值，99大促ROI未达预期。

你的沟通风格：
- 直接务实，偶尔严厉但关心下属成长
- 用电商业务真实语言交流，不用空洞的套话
- 不会直接给答案，通过提问引导学生自己思考
- 审核成果时会具体指出"哪里对、哪里错、为什么错、怎么改"
- 记住学生是新手，专业术语会简单解释
```

### 6.2 六种模式切换

| 课时类型 | Agent模式 | System Prompt追加 |
|----------|-----------|-------------------|
| 阶段开始课时 | 情景导入 | "以入职谈话方式布置任务，要求学生用自己的话复述理解" |
| 自主学习课时 | 知识讲解 | "仅在学生主动提问时才回复，不要主动打扰" |
| 练习课时 | 苏格拉底 | "不要给直接答案，通过提问引导。连续3次请求后才给步骤提示" |
| 提交审核 | 主管审稿 | "按评分规则审核，指出具体问题并给出修改建议" |
| 阶段测试 | 考核官 | "AI对话锁定，不参与交互" |
| 数据处理 | 数据助手 | "用SheetJS执行数据处理操作，解释简洁" |

## 7. IndexedDB数据结构

```javascript
const db = new Dexie('MarketDataAnalysisDB');
db.version(1).stores({
  settings: 'key',
  learning_progress: '++id, stageId, lessonId',
  ai_conversations: '++id, sessionId, role, timestamp',
  submissions: '++id, stageId, lessonId, timestamp',
  assessments: '++id, testId, timestamp',
  behavior_metrics: 'key'
});
```

## 8. 课程内容结构 (course-content.json)

```json
{
  "stages": [
    {
      "id": "stage-1",
      "title": "入职培训与项目启动",
      "totalLessons": 6,
      "lessons": [
        {
          "id": "stage-1-lesson-1",
          "title": "入职谈话",
          "hours": 1,
          "type": "ai-dialog",
          "agentMode": "onboard",
          "aiEnabled": true,
          "content": { ... }
        }
      ]
    }
  ]
}
```

### 课时type取值
- `ai-dialog`: AI对话为主
- `content-reading`: 阅读预制内容
- `practice`: 练习(含提交框)
- `hands-on`: 在线工具实操
- `test`: 自动测评
- `variant`: 变式迁移

## 9. 测试题库结构 (questions.json)

```json
{
  "tests": {
    "stage-1-test": {
      "title": "阶段1测试",
      "timeLimitMinutes": 15,
      "questions": [
        {
          "id": "s1q1",
          "type": "single-choice",
          "question": "...",
          "options": ["A", "B", "C", "D"],
          "answer": 1,
          "score": 10
        }
      ]
    }
  }
}
```

### question type取值
- `single-choice`: 单选题
- `multi-choice`: 多选题
- `fill-blank`: 填空题
- `hands-on`: 实操题

## 10. 导出JSON结构

```json
{
  "exportVersion": "1.0",
  "studentId": "uuid",
  "exportDate": "2026-06-26T10:30:00Z",
  "courseInfo": {
    "totalHours": 54,
    "completedHours": 32,
    "overallScore": 78.5
  },
  "stages": [...],
  "learning_behaviors": {
    "avgSessionMinutes": 42,
    "ai_dependency_index": 0.32,
    "self_correction_rate": 0.58,
    "retry_rate": 0.25
  },
  "final_exam": {...}
}
```

## 11. 关键交互逻辑

### 11.1 AI防依赖机制
- 苏格拉底模式: 连续≥3次请求帮助后切换为引导模式
- 提交框三步流程: "先写自己的" → "提交" → "查看AI参考"
- 测试课时: AI对话窗口添加pointer-events:none遮罩

### 11.2 进度管理
- 阅读型: 停留时间≥规定阅读时间60%
- 练习型: 已提交且获得Agent审核反馈
- 测试型: 成绩≥及格线
- AI禁用型: 已提交

### 11.3 自动保存
- AI对话实时存储
- 编辑器内容每30秒自动保存草稿

## 12. 样式规格

### 12.1 颜色变量(GitHub Dark)
```css
--bg-primary: #0d1117;
--bg-secondary: #161b22;
--bg-tertiary: #21262d;
--border-color: #30363d;
--text-primary: #e6edf3;
--text-secondary: #8b949e;
--accent-blue: #58a6ff;
--accent-green: #3fb950;
--accent-orange: #d29922;
--accent-red: #f85149;
```

### 12.2 字体
- 主字体: Inter, -apple-system, sans-serif
- 代码字体: JetBrains Mono, monospace

## 13. 开发优先级

### 第一批（核心骨架）
1. 项目初始化(HTML骨架、CSS变量、Tailwind配置)
2. 首页(index.html)
3. IndexedDB初始化(db.js)
4. AI API调用模块(ai.js)
5. 设置页(settings.html)

### 第二批（核心学习功能）
6. Agent角色模块(agent.js)
7. 课程引擎(course-engine.js)
8. 学习内容页(learn.html)
9. dashboard.html

### 第三批（实操与测试）
10. 实操页集成(Handsontable)
11. 测试引擎(test-engine.js)
12. test.html

### 第四批（数据与教师端）
13. 数据导出模块(export.js)
14. course-content.json (阶段1-2)
15. questions.json (阶段1-2)
16. sample-data/ (7份样本数据)
17. 教师视图(teacher/)

### 第五批（完善）
18. report功能(Quill.js)
19. dashboard功能(ECharts)
20. PPT功能(reveal.js)
21. 完善阶段3-6全部课程内容

## 14. 重要约束

- 不使用任何后端服务
- API Key仅存于用户本地浏览器
- 离线兼容: 课程内容阅读、已保存练习结果不依赖AI
- 性能: 页面切换使用display:none/block保持状态
- CORS: Gemini可能需要CORS代理
