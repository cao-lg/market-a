#!/usr/bin/env python3
"""Generate TTS narration for promo video using pyttsx3 with Chinese voice"""

import pyttsx3
import os

engine = pyttsx3.init()
engine.setProperty('rate', 150)
engine.setProperty('volume', 0.9)

voices = engine.getProperty('voices')
chinese_voice = None
for voice in voices:
    if 'cmn' in str(voice.languages).lower() or 'zh' in str(voice.languages).lower():
        chinese_voice = voice
        break

if chinese_voice:
    engine.setProperty('voice', chinese_voice.id)
    print(f"Using Chinese voice: {chinese_voice.name}")
else:
    print("Warning: No Chinese voice found, using default")

output_dir = "/workspace/hyperframes/narrations"
os.makedirs(output_dir, exist_ok=True)

text = """
市场数据分析，AI Agent伴学平台。从零基础到独立完成电商数据分析全流程。

AI智能导师李主管，你的专属数据分析带教导师。苏格拉底式提问，培养独立思考；知识讲解，深入浅出；考核测评，精准反馈。

真实电商项目实战，杭州悦享家居，六大学习阶段，五十四课时精研。从项目启动到综合实战，循序渐进，步步为营。

AI智能评阅，上传数据文件和分析报告，多维度智能评分，精准反馈，帮助你持续进步。

全方位学习画像，六大维度，四十多项指标，自动标签，学习风格识别，让你更了解自己的学习状态。

开启你的数据分析之旅，从零基础到独立分析师，AI伴学全程陪伴。MarketInsight，AI Agent伴学平台。
"""

output_path = os.path.join(output_dir, "promo-narration.mp3")
print(f"\nGenerating: {output_path}")

engine.save_to_file(text, output_path)
engine.runAndWait()

if os.path.exists(output_path):
    size = os.path.getsize(output_path)
    print(f"Generated: {output_path} ({size} bytes)")
else:
    print(f"Failed to generate: {output_path}")

print("\nDone!")
