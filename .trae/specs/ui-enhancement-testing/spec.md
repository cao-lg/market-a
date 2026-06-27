# AI伴学平台界面升级与全面测试 - Product Requirement Document

## Overview
- **Summary**: 对市场数据分析AI伴学平台进行全面测试，同时使用frontend-design技能提升关键学习界面的视觉品质，并探索HyperFrames在课程引入/导览场景的应用。
- **Purpose**: 解决当前界面偏工程化（GitHub Dark风格）、学习沉浸感不足的问题，通过专业设计提升学习体验，同时通过全面测试确保功能稳定性。
- **Target Users**: 高职院校《市场数据分析》课程学生、授课教师

## Goals
- **G1**: 完成平台全功能端到端测试，发现并修复所有可见bug
- **G2**: 升级核心学习界面（learn.html）的视觉设计，从工程化风格转向更具沉浸感的学习体验
- **G3**: 优化首页和仪表盘的视觉表现，提升首次使用的吸引力
- **G4**: 探索HyperFrames在课程引入动画中的应用，制作1-2个场景演示

## Non-Goals (Out of Scope)
- 不修改核心业务逻辑（AI对话、课程引擎、测试引擎的核心算法）
- 不改变数据结构和IndexedDB schema
- 不添加新的功能模块（只优化现有界面和修复bug）
- 不进行后端开发（保持纯前端架构）
- 不添加用户系统（保持本地存储）

## Background & Context
当前平台基于GitHub Dark主题构建，使用Inter字体和Tailwind CSS，风格偏技术/工程化。问题包括：
- 学习界面左侧内容区与右侧AI对话区割裂感强，缺乏整体设计感
- 缺少精心设计的微交互和过渡动画
- 首页和仪表盘视觉层次较平，品牌辨识度不足
- 课程内容排版单调，阅读体验一般
- 测试通过静态代码验证，但缺乏真实浏览器端到端测试

技术约束：
- 纯前端（HTML/CSS/JS），无构建工具
- 使用Tailwind CSS（CDN）+ 自定义CSS变量
- 数据存储在IndexedDB（Dexie.js）
- AI API支持多Provider切换

## Functional Requirements

### FR-1: 全面端到端测试
- 测试首页登录流程
- 测试仪表盘功能（进度展示、阶段导航）
- 测试学习页面（内容加载、AI对话、模式切换）
- 测试设置页面（API配置、连接测试）
- 测试页面（答题、提交、结果展示、AI答疑）
- 测试数据导出功能
- 发现的bug全部修复

### FR-2: 学习页面视觉升级
- 重新设计learn.html的左右分栏布局
- 优化课程内容区的排版（字体、间距、层级）
- 优化AI对话区的视觉表现（气泡、头像、状态指示）
- 添加精心设计的微交互（悬停效果、过渡动画）
- 优化暗色主题的对比度和可读性

### FR-3: 首页与仪表盘视觉升级
- 升级index.html首页的视觉冲击力
- 优化dashboard.html的卡片设计和数据展示
- 改善进度指示器的视觉表现
- 统一全站的设计语言和组件风格

### FR-4: HyperFrames课程引入动画
- 创建1-2个HyperFrames动画场景
- 场景1：课程引入/欢迎动画
- 场景2：阶段过渡/成就解锁动画
- 可嵌入到学习页面中作为引导

## Non-Functional Requirements

- **NFR-1**: 页面加载性能不下降（首屏<3s，3G网络）
- **NFR-2**: 所有交互响应时间<100ms（视觉反馈）
- **NFR-3**: 保持移动端响应式布局
- **NFR-4**: 对比度符合WCAG AA标准（4.5:1普通文本）
- **NFR-5**: CSS改动不破坏现有功能（渐进式增强）
- **NFR-6**: 动画流畅度60fps（使用transform/opacity）

## Constraints
- **Technical**: 纯HTML/CSS/JS，无构建工具，使用Tailwind CDN
- **Business**: 保持现有功能不变，仅优化视觉和修复bug
- **Dependencies**: 
  - Tailwind CSS 2.x (CDN)
  - Dexie.js (IndexedDB)
  - 现有的5个AI API Provider

## Assumptions
- 用户主要在桌面端使用（学习场景）
- 暗色主题是主要使用模式
- 学生有基础的电脑操作能力
- AI API连接稳定（如不稳定有错误处理）

## Acceptance Criteria

### AC-1: 全功能测试通过
- **Given**: 平台部署在本地HTTP服务器
- **When**: 执行完整的端到端测试流程
- **Then**: 所有核心功能正常工作，无控制台错误
- **Verification**: `programmatic`
- **Notes**: 包括首页、仪表盘、学习、测试、设置、导出

### AC-2: 学习页面视觉升级
- **Given**: 用户访问学习页面
- **When**: 浏览课程内容和与AI对话
- **Then**: 界面具有专业设计感，布局协调，微交互流畅
- **Verification**: `human-judgment`
- **Notes**: 评估标准：排版层次、色彩协调、动效品质、沉浸感

### AC-3: 首页吸引力提升
- **Given**: 新用户首次访问首页
- **When**: 浏览首页内容
- **Then**: 视觉上有吸引力，清晰传达产品价值
- **Verification**: `human-judgment`

### AC-4: HyperFrames动画可用
- **Given**: 访问包含HyperFrames动画的页面
- **When**: 动画播放
- **Then**: 动画流畅播放，内容与课程主题相关
- **Verification**: `human-judgment`

### AC-5: 无功能回归
- **Given**: 界面升级完成后
- **When**: 执行原有功能测试
- **Then**: 所有原有功能正常工作
- **Verification**: `programmatic`

### AC-6: 响应式布局
- **Given**: 在不同屏幕尺寸下访问
- **When**: 调整窗口大小
- **Then**: 布局自适应，内容不溢出
- **Verification**: `programmatic`

## Open Questions
- [ ] HyperFrames动画嵌入到哪个页面最合适？（首页vs学习页）
- [ ] 是否需要亮色主题切换？
- [ ] 学习界面的AI对话区是否需要支持收起/展开？
