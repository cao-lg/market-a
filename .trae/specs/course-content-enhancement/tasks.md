# 课程内容完善 - 实现计划（分解与优先级排序）

## 总体策略
按阶段顺序推进，每个阶段完成内容完善、题库补充、数据补充三件事。优先完成核心阶段（2、3、4），再完善前后阶段。

---

## [ ] Task 1: 完善阶段1（入职培训与项目启动）6课时内容
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 补充双人协作分工内容
  - 补充Excel/Power BI工具环境准备课时
  - 补充小组项目执行计划制定课时
  - 完善每课时的AI状态标注
  - 完善A/B/C三级验收标准
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-1.1: 阶段1课时数 = 6
  - `programmatic` TR-1.2: 每课时都有aiEnabled字段，且与设计一致（理论课AI禁用，实操课AI可用）
  - `human-judgement` TR-1.3: 验收标准包含A/B/C三级，每级有具体描述
- **Notes**: 阶段1是基础，内容相对简单，优先完成以验证数据结构扩展方式

---

## [ ] Task 2: 完善阶段2（数据采集与标准化清洗）12课时内容
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 将现有10课时扩展为12课时
  - 新增"含陷阱数据集"练习课时
  - 补充变式迁移环节（全新品类数据清洗）
  - 完善每课时的AI状态（跟练环节AI禁用，独立实操AI可用）
  - 完善数据清洗说明文档的提交要求
  - 完善A/B/C三级验收标准，含量化底线（核心字段准确率100%）
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-2.1: 阶段2课时数 = 12
  - `programmatic` TR-2.2: 包含变式迁移课时至少2课时
  - `programmatic` TR-2.3: AI禁用课时（跟练、理论）aiEnabled=false
  - `human-judgement` TR-2.4: 验收标准包含量化底线要求
- **Notes**: 需要新增样本数据：含陷阱数据集(trap-data.json已有，需确认内容)、新科类变式数据(variant-orders.json已有)

---

## [ ] Task 3: 完善阶段3（核心指标核算与异常初判）12课时内容
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 新增"手写口径练习"课时（AI禁用）
  - 新增"含陷阱任务"课时（口径不一致+逻辑矛盾数据集）
  - 补充同比分析内容
  - 完善指标异常判断标准
  - 完善A/B/C三级验收标准，含量化底线（核心指标准确率100%）
  - 补充变式迁移环节
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-3.1: 阶段3课时数 = 12
  - `programmatic` TR-3.2: 包含手写口径练习课时（aiEnabled=false）
  - `programmatic` TR-3.3: 包含含陷阱任务课时
  - `human-judgement` TR-3.4: 指标体系覆盖流量、转化、交易、用户四大类
- **Notes**: 需要补充口径不一致的陷阱数据集

---

## [ ] Task 4: 完善阶段4（核心业务场景专项深度分析）16课时内容
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - 场景A：流量与转化归因分析（4课时）- 理论+跟练+独立实操+变式迁移
  - 场景B：用户价值与复购分析（4课时）- RFM模型理论+跟练+独立实操+变式迁移
  - 场景C：竞品与市场趋势分析（4课时）- 竞品框架+跟练+独立实操+变式迁移
  - 场景D：营销活动效果复盘（4课时）- ROI核算+跟练+独立实操+变式迁移
  - 每个场景都有"先写后对比"的AI使用规范
  - 完善统一验收标准
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: 阶段4课时数 = 16
  - `programmatic` TR-4.2: 包含4个场景，每个场景4课时
  - `programmatic` TR-4.3: 每个场景都有变式迁移课时
  - `human-judgement` TR-4.4: 场景内容有深度，不是浅尝辄止
  - `human-judgement` TR-4.5: 每个场景都有明确的"先独立完成，再用AI对比"要求
- **Notes**: 需要补充样本数据：厨房收纳子品类用户数据、新增竞品数据、双11历史活动数据、8月流量对比数据

---

## [ ] Task 5: 完善阶段5（数据看板搭建与分析报告撰写）12课时内容
- **Priority**: medium
- **Depends On**: Task 4
- **Description**:
  - 补充数据看板设计原则内容
  - 补充Power BI基础操作教学内容（说明：平台内嵌ECharts实现）
  - 补充报告逻辑骨架搭建环节（AI禁用）
  - 补充AI润色优化环节
  - 补充交叉评审环节
  - 补充汇报PPT制作内容
  - 完善A/B/C三级验收标准（看板+报告+PPT三个交付物）
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-5.1: 阶段5课时数 = 12
  - `programmatic` TR-5.2: 包含看板设计、报告撰写、PPT制作三类内容
  - `human-judgement` TR-5.3: 有明确的"先独立搭骨架，再用AI润色"流程要求
- **Notes**: 平台使用ECharts而非Power BI，需调整表述为"在线数据看板（ECharts实现）"

---

## [ ] Task 6: 完善阶段6（项目汇报与转正考核）6课时内容
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - 补充项目路演环节说明
  - 补充路演评分标准（5个维度）
  - 补充整体点评与知识复盘内容
  - 补充转正终结考核说明（限时全新数据集）
  - 补充考核反馈与职业发展建议
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-6.1: 阶段6课时数 = 6
  - `human-judgement` TR-6.2: 考核评分标准清晰，5个维度权重明确
- **Notes**: 终结考核使用现有测试+实操功能组合实现

---

## [ ] Task 7: 完善题库（每个阶段至少15道题）
- **Priority**: medium
- **Depends On**: Task 1（可与Task 2-6并行）
- **Description**:
  - 阶段1：从现有约10题扩充到15题，覆盖入职、流程、报告等知识点
  - 阶段2：新增15道题，覆盖数据清洗理论、业务判断、Excel操作等
  - 阶段3：新增15道题，覆盖指标体系、计算公式、异常判断等
  - 阶段4：新增20道题（4个场景各5题），覆盖各场景核心分析方法
  - 阶段5：新增15道题，覆盖看板设计、报告写作、PPT制作等
  - 阶段6：新增10道题（综合应用）
  - 题型包含：单选、多选、填空、判断
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-7.1: 每个阶段测试题数 >= 15
  - `programmatic` TR-7.2: 题型分布：单选60%、多选25%、填空15%
  - `human-judgement` TR-7.3: 题目质量：不超出知识点范围，有实际业务意义
- **Notes**: 题目难度分布：基础60%、中等30%、提高10%

---

## [ ] Task 8: 补充样本数据文件
- **Priority**: medium
- **Depends On**: Task 1（可与其他任务并行）
- **Description**:
  - 8月订单对比数据（用于环比分析）
  - 厨房收纳子品类订单/用户数据（用于变式迁移）
  - 新增竞品数据（用于竞品分析变式迁移）
  - 双11历史活动数据（用于活动复盘变式迁移）
  - 8月流量对比数据（用于流量分析变式迁移）
  - 口径不一致陷阱数据集（用于阶段3含陷阱任务）
  - 确保所有数据业务口径统一（客单价80-150元、22个SKU等）
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-8.1: 新增数据文件数 >= 6
  - `programmatic` TR-8.2: 所有JSON文件格式正确可解析
  - `human-judgement` TR-8.3: 数据业务逻辑自洽，口径统一
- **Notes**: 数据生成保持与现有数据一致的字段结构和风格

---

## [ ] Task 9: 整体验证与回归测试
- **Priority**: high
- **Depends On**: Task 1-8全部完成
- **Description**:
  - 验证course-content.json总课时=54
  - 验证所有页面正常加载无JS错误
  - 验证学习页面能正常切换各阶段各课时
  - 验证测试页面能正常加载各阶段题目
  - 验证实操页面能正常加载各数据集
  - 验证AI对话功能正常
  - 从学生视角走一遍完整学习流程
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `programmatic` TR-9.1: course-content.json可正常解析，总课时=54
  - `programmatic` TR-9.2: questions.json可正常解析
  - `programmatic` TR-9.3: 浏览器访问无控制台错误
  - `human-judgement` TR-9.4: 内容逻辑通顺，前后阶段数据可复用
- **Notes**: 使用浏览器MCP工具进行端到端验证

---

## 依赖关系图
```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 9
                    Task 7 ──────────────────────────────┘
                    Task 8 ──────────────────────────────┘
```
Task 7（题库）和 Task 8（样本数据）可与 Task 2-6 并行进行，但需在 Task 9（整体验证）前完成。
