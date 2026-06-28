# AI伴学平台 - 框架迁移文档

> 本文档说明如何将现有的《市场数据分析》AI伴学平台迁移到其他课程。

## 1. 项目架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        用户入口层                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │  index.html │  │pages/learn  │  │  teacher/        │   │
│  │  (学生登录) │  │  (学习中心)  │  │  (教师视图)      │   │
│  └─────────────┘  └─────────────┘  └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                        核心引擎层                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │course-   │ │  ai.js   │ │ test-    │ │ student-     │  │
│  │engine.js │ │ (AI调用) │ │ engine.js│ │ profile.js   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                        数据层                              │
│  ┌─────────────────┐  ┌────────────────────────────────┐ │
│  │ data/           │  │ IndexedDB (本地存储)           │ │
│  │  course-        │  │  - 学习进度                      │ │
│  │  content.json   │  │  - 对话记录                      │ │
│  │  questions.json │  │  - 测试成绩                      │ │
│  └─────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 2. 核心模块说明

### 2.1 课程内容模块 (course-content.json)

**作用**：定义课程的所有学习内容

**结构**：
```json
{
  "stages": [
    {
      "id": "stage-1",
      "title": "阶段标题",
      "totalLessons": 6,
      "totalHours": 6,
      "background": "场景背景介绍",
      "objectives": ["目标1", "目标2"],
      "lessons": [
        {
          "id": "stage-1-lesson-1",
          "title": "课时标题",
          "hours": 1,
          "type": "content-reading | practice | exam",
          "agentMode": "socratic | knowledge | examiner | reviewer",
          "aiEnabled": true | false,
          "content": {
            "markdown": "课时正文（Markdown格式）"
          }
        }
      ]
    }
  ]
}
```

**课时类型 (type)**：
| 类型 | 说明 | AI模式 |
|------|------|--------|
| `content-reading` | 内容阅读 | 通常禁用 |
| `practice` | 实操练习 | 启用 |
| `exam` | 考试测试 | 禁用 |

**AI模式 (agentMode)**：
| 模式 | 说明 | 使用场景 |
|------|------|---------|
| `socratic` | 苏格拉底提问式引导 | 实操练习 |
| `knowledge` | 知识讲解 | 内容阅读 |
| `examiner` | 出题考试 | 测试环节 |
| `reviewer` | 成果审核 | 提交审核 |

### 2.2 AI辅导模块

**文件**：`js/prompts.js`

**核心功能**：
- 定义AI Agent的角色设定
- 封装不同辅导模式的Prompt模板
- 处理对话上下文和历史记录

**核心API**：
```javascript
// js/ai.js
class AIAssistant {
  async send(message, context)  // 发送消息获取回复
  setMode(mode)                 // 切换辅导模式
  interrupt()                   // 中断生成
}
```

### 2.3 测试系统模块

**文件**：`js/test-engine.js` + `data/questions.json`

**题库结构**：
```json
{
  "stages": [
    {
      "stageId": "stage-1",
      "questions": [
        {
          "id": "q1",
          "type": "single-choice | multi-choice | fill-blank | practical",
          "difficulty": "easy | medium | hard",
          "content": "题目内容",
          "options": ["A", "B", "C", "D"],  // 选择题才有
          "answer": "A",                     // 标准答案
          "explanation": "解析"              // 可选
        }
      ]
    }
  ]
}
```

### 2.4 学习追踪模块

**数据存储**：IndexedDB

**追踪内容**：
- 学习进度（完成课时、通过测试）
- 对话记录（AI交互历史）
- 行为指标（AI依赖指数、自我纠正率）
- 学习时长和会话次数

## 3. 迁移清单

### 3.1 必改文件

| 文件 | 修改内容 | 重要性 |
|------|---------|--------|
| `data/course-content.json` | 课程内容 | ⭐⭐⭐ 核心 |
| `data/questions.json` | 测试题库 | ⭐⭐ 重要 |
| `js/prompts.js` | AI角色设定 | ⭐⭐⭐ 核心 |
| `js/agent.js` | Agent角色配置 | ⭐⭐⭐ 核心 |
| `index.html` | 首页标题和介绍 | ⭐ 辅助 |

### 3.2 迁移步骤

```
Step 1: 分析新课程内容
         ├── 确定课程领域和难度
         ├── 梳理知识点结构
         └── 设计学习路径

Step 2: 准备课程内容
         ├── 创建 course-content.json
         ├── 编写课时Markdown内容
         └── 准备示例数据文件

Step 3: 设计AI角色
         ├── 确定角色身份（如：项目经理、客服、工程师）
         ├── 编写角色System Prompt
         └── 调整辅导模式配置

Step 4: 准备测试题库
         ├── 按知识点出题
         ├── 设置难度分布
         └── 编写答案解析

Step 5: 调整界面文案
         ├── 修改首页介绍
         └── 更新页面标题

Step 6: 测试验证
         ├── 功能测试
         ├── AI对话测试
         └── 整体流程测试
```

## 4. AI角色设计指南

### 4.1 角色设定要素

```javascript
// js/prompts.js 模板
const RoleTemplate = {
  identity: "角色身份描述",
  background: "业务背景信息",
  teachingStyle: "教学风格描述",
  constraints: "交互约束规则",
  welcome: "欢迎语模板"
};
```

### 4.2 示例：课程顾问角色

```javascript
course_consultant: `你是课程顾问，拥有10年教育培训经验。
你的职责是帮助学员规划学习路径，解答课程相关问题。

交互规范：
1. 先了解学员的基础和目标
2. 根据学员情况推荐合适的学习顺序
3. 解答关于课程内容的疑问
4. 提供学习方法和技巧建议
5. 鼓励学员坚持学习

欢迎语：
"你好！我是课程顾问，很高兴认识你。在开始学习之前，我想先了解一下你的情况，这样可以为你制定更合适的学习计划。"`,
```

### 4.3 多角色切换

如果课程需要多个AI角色（如：项目经理、技术专家、客户），可以在 `agent.js` 中配置：

```javascript
// js/agent.js
const Agents = {
  project_manager: {
    name: "张经理",
    prompt: "...",
    avatar: "👔"
  },
  technical_expert: {
    name: "李工",
    prompt: "...",
    avatar: "💻"
  },
  customer: {
    name: "王总",
    prompt: "...",
    avatar: "👨‍💼"
  }
};
```

## 5. 课程内容编写规范

### 5.1 Markdown格式建议

```markdown
# 一级标题：章节名

## 二级标题：小节名

### 三级标题：知识点

**重点内容** 用加粗标注

| 表格 | 用于 | 结构化展示 |
| ---- | ---- | ---------- |

```code``` 代码块用于示例

> 引言块用于提示和强调
```

### 5.2 课时内容模板

```json
{
  "id": "lesson-id",
  "title": "课时标题",
  "hours": 1,
  "type": "content-reading",
  "agentMode": "knowledge",
  "aiEnabled": false,
  "content": {
    "markdown": "# 课时标题\n\n## 学习目标\n- 目标1\n- 目标2\n\n## 正文内容\n..."
  }
}
```

## 6. 示例数据文件

如果课程需要真实数据练习，在 `data/sample-data/` 目录添加：

```
data/sample-data/
├── orders.json      # 业务数据（订单、交易）
├── traffic.json     # 流量数据
├── users.json      # 用户数据
├── products.json   # 产品数据
└── 其他业务相关数据
```

## 7. 快速启动模板

### 7.1 最小迁移配置

只需修改3个文件即可启动新课程：

1. **`data/course-content.json`** - 课程内容
2. **`js/prompts.js`** - AI角色
3. **`index.html`** - 首页文案

### 7.2 配置检查清单

- [ ] 课程ID唯一性检查
- [ ] 课时类型配置正确
- [ ] AI模式与课时类型匹配
- [ ] 题库与课程内容对应
- [ ] 示例数据文件路径正确

## 8. 常见问题

### Q1: 如何添加新的AI辅导模式？
在 `js/prompts.js` 中添加新的prompt模板，并在 `agent.js` 中注册模式。

### Q2: 如何禁用AI对话？
设置课时 `aiEnabled: false`，对话窗口将显示禁用状态。

### Q3: 如何添加自定义页面？
在 `pages/` 目录创建新HTML文件，在 `index.html` 中添加入口。

### Q4: 如何导出学习数据？
使用 `js/export.js` 中的导出功能，生成JSON或CSV文件。

---

## 附录：文件清单

```
/workspace/
├── index.html                    # 学生端首页
├── pages/
│   ├── dashboard.html          # 学习仪表盘
│   ├── learn.html              # 学习内容页（核心）
│   ├── practice.html           # 实操页
│   ├── test.html               # 测试页
│   ├── profile.html            # 学习画像
│   └── settings.html           # 设置页
├── teacher/
│   ├── index.html              # 教师入口
│   └── viewer.html             # 数据查看器
├── js/
│   ├── db.js                   # 数据库操作
│   ├── ai.js                   # AI调用
│   ├── agent.js                # Agent管理
│   ├── course-engine.js        # 课程引擎
│   ├── test-engine.js         # 测试引擎
│   ├── prompts.js              # AI提示词
│   ├── student-profile*.js     # 学习追踪
│   └── ...                     # 其他工具模块
├── data/
│   ├── course-content.json     # 课程内容（需迁移）
│   ├── questions.json          # 题库（需迁移）
│   └── sample-data/            # 示例数据（可选）
└── hyperframes/               # 演示动画页面
```
