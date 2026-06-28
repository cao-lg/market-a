#!/usr/bin/env python3
"""Generate TTS narration for promo video using edge-tts"""

import asyncio
import edge_tts
import os

OUTPUT_DIR = "/workspace/hyperframes/narrations"
os.makedirs(OUTPUT_DIR, exist_ok=True)

VOICE = "zh-CN-XiaoxiaoNeural"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "promo-narration.mp3")

TEXT = """市场数据分析，AI Agent伴学平台。从零基础到独立完成电商数据分析全流程。大家好，我是MarketInsight，你的AI数据分析伴学伙伴。

AI智能导师李主管，你的专属数据分析带教导师。苏格拉底式提问，通过问题引导思考，培养你的独立分析能力；知识讲解模式，系统讲解数据分析知识点，结合真实案例深入浅出；考核测评模式，智能出题、自动判分，错题精准答疑，让你学得更扎实。

真实电商项目实战，杭州悦享家居，六大学习阶段，五十四课时精研。从项目启动、数据处理、指标体系，到GMV诊断、转化漏斗分析，再到综合实战演练，循序渐进，步步为营，让你在真实项目中快速成长。

AI智能评阅系统，支持上传CSV、JSON、Excel等多种数据文件，以及Markdown分析报告。从完整性、规范性、洞察深度、建议可行性等多个维度进行智能评分，给出精准反馈，帮助你持续进步，不断提升分析能力。

全方位学习画像，六大维度，四十多项指标，自动标签生成，学习风格智能识别。无论是视觉型学习者还是听觉型学习者，无论是主动探索还是按部就班，系统都能精准刻画你的学习状态，让你更了解自己，也让学习更高效。

开启你的数据分析之旅吧！从零基础到独立分析师，AI伴学全程陪伴。MarketInsight，AI Agent伴学平台，等你来学！"""

async def generate():
    PROXY = "http://127.0.0.1:18080"
    communicate = edge_tts.Communicate(TEXT, VOICE, rate="+0%", volume="+0%", proxy=PROXY)
    await communicate.save(OUTPUT_FILE)
    print(f"Generated: {OUTPUT_FILE}")
    size = os.path.getsize(OUTPUT_FILE)
    print(f"Size: {size} bytes ({size/1024:.1f} KB)")

if __name__ == "__main__":
    asyncio.run(generate())
