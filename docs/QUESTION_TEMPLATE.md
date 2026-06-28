# 题库模板

> 使用此模板快速创建课程测试题库。

---

## 模板结构

```json
{
  "stages": [
    {
      "stageId": "stage-1",
      "questions": [
        {
          "id": "q1",
          "type": "single-choice",
          "difficulty": "easy",
          "content": "题目内容",
          "options": ["A", "B", "C", "D"],
          "answer": "A",
          "explanation": "答案解析"
        }
      ]
    }
  ]
}
```

---

## 题型说明

| type值 | 说明 | 需要options | 需要answer |
|--------|------|------------|------------|
| `single-choice` | 单选题 | ✅ | ✅ |
| `multi-choice` | 多选题 | ✅ | ✅ (逗号分隔如"A,C") |
| `fill-blank` | 填空题 | ❌ | ✅ |
| `true-false` | 判断题 | ❌ | ✅ (true/false) |
| `practical` | 实操题 | ❌ | ✅ (评分要点) |

---

## 完整示例

```json
{
  "stages": [
    {
      "stageId": "stage-1",
      "questions": [
        {
          "id": "s1-q1",
          "type": "single-choice",
          "difficulty": "easy",
          "content": "计算机的核心部件是？",
          "options": [
            "A. 显示器",
            "B. 键盘",
            "C. CPU（中央处理器）",
            "D. 鼠标"
          ],
          "answer": "C",
          "explanation": "CPU是计算机的大脑，负责执行指令和处理数据。"
        },
        {
          "id": "s1-q2",
          "type": "multi-choice",
          "difficulty": "medium",
          "content": "以下哪些是计算机的输出设备？（多选）",
          "options": [
            "A. 显示器",
            "B. 键盘",
            "C. 打印机",
            "D. 音箱"
          ],
          "answer": "A,C,D",
          "explanation": "输入设备负责向计算机输入信息，输出设备负责从计算机输出信息。键盘是输入设备，显示器、打印机、音箱都是输出设备。"
        },
        {
          "id": "s1-q3",
          "type": "fill-blank",
          "difficulty": "easy",
          "content": "操作系统的英文缩写是____。",
          "answer": "OS",
          "explanation": "OS = Operating System（操作系统）"
        },
        {
          "id": "s1-q4",
          "type": "true-false",
          "difficulty": "easy",
          "content": "计算机只能处理数字信息。",
          "answer": "false",
          "explanation": "计算机本质上是处理二进制数字的机器，所有信息最终都会转换为数字形式处理。"
        },
        {
          "id": "s1-q5",
          "type": "practical",
          "difficulty": "medium",
          "content": "请演示如何在Windows系统中创建一个文件夹，并将其重命名为「学习资料」。",
          "answer": "评分要点：1. 右键新建文件夹 2. 输入名称「学习资料」 3. 按回车确认",
          "explanation": "实操题需要学员实际动手操作，重点考核操作步骤是否正确完整。"
        }
      ]
    },
    {
      "stageId": "stage-2",
      "questions": [
        {
          "id": "s2-q1",
          "type": "single-choice",
          "difficulty": "hard",
          "content": "当计算机运行变慢时，以下哪种方法最有效？",
          "options": [
            "A. 关闭不必要的启动程序",
            "B. 购买新电脑",
            "C. 减少使用时间",
            "D. 调低屏幕亮度"
          ],
          "answer": "A",
          "explanation": "启动程序过多会占用系统资源，导致运行变慢。禁用不必要的启动程序可以有效提升运行速度。"
        }
      ]
    }
  ]
}
```

---

## 难度分布建议

| 难度 | 占比建议 | 适用场景 |
|------|----------|----------|
| `easy` | 40-50% | 基础知识检测 |
| `medium` | 30-40% | 理解应用考察 |
| `hard` | 10-20% | 能力拔高测试 |

---

## 出题技巧

### 1. 单选题
- 确保只有一个正确答案
- 干扰项要有一定迷惑性但不能太离谱
- 选项长度尽量相近

### 2. 多选题
- 明确告知是多选题
- 正确答案2-4个为宜
- 解析中说明每个选项的对错原因

### 3. 填空题
- 空缺位置要明确
- 标准答案要唯一
- 可以设置多个可接受的答案

### 4. 判断题
- 避免绝对化的表述（如"一定"、"绝对"）
- 题目要明确，不产生歧义

### 5. 实操题
- 给出清晰的评分要点
- 分步骤给分
- 允许有多种完成方式
