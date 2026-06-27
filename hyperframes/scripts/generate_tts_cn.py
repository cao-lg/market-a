#!/usr/bin/env python3
"""Generate TTS narration for HyperFrames animations using pyttsx3 with Chinese voice"""

import pyttsx3
import os

# Initialize TTS engine
engine = pyttsx3.init()

# Set properties
engine.setProperty('rate', 150)  # Speed
engine.setProperty('volume', 0.9)  # Volume

# Find Chinese voice
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

# Output directory
output_dir = "/workspace/hyperframes/narrations"
os.makedirs(output_dir, exist_ok=True)

# Generate data-process narration
text = """
电商数据分析全流程框架，从原始数据到业务洞察的六个核心阶段。

第一阶段，数据采集，获取准确完整的原始数据。

第二阶段，数据清洗，将脏数据变成干净数据。

第三阶段，指标核算，构建核心指标体系。

第四阶段，数据分析，发现问题诊断原因。

第五阶段，报告输出，清晰呈现分析结论。

第六阶段，数据应用，驱动业务增长行动。

总结，发现异常，拆解维度，定位原因，验证假设，提出建议。
"""

output_path = os.path.join(output_dir, "data-process-narration.mp3")
print(f"\nGenerating: {output_path}")

engine.save_to_file(text, output_path)
engine.runAndWait()

if os.path.exists(output_path):
    size = os.path.getsize(output_path)
    print(f"Generated: {output_path} ({size} bytes)")
else:
    print(f"Failed to generate: {output_path}")

print("\nDone!")
