#!/usr/bin/env python3
"""Generate TTS narration for HyperFrames animations using pyttsx3"""

import pyttsx3
import os

# Initialize TTS engine
engine = pyttsx3.init()

# Set properties for Chinese speech
engine.setProperty('rate', 150)  # Speed (words per minute)
engine.setProperty('volume', 0.9)  # Volume (0.0 to 1.0)

# Get available voices
voices = engine.getProperty('voices')
print(f"Available voices: {len(voices)}")

# Try to find a Chinese voice
chinese_voice = None
for voice in voices:
    lang = str(voice.languages)
    if 'zh' in lang.lower() or 'CN' in lang:
        chinese_voice = voice.id
        print(f"Found Chinese voice: {voice.name}, languages: {lang}")
        break

# If no Chinese voice found, try to set a default one
if not chinese_voice and voices:
    # Try each voice to see which supports Chinese
    for voice in voices:
        print(f"Testing voice: {voice.name}, languages: {voice.languages}")
        if 'zh' in str(voice.languages).lower():
            chinese_voice = voice.id
            break

if not chinese_voice:
    print("No Chinese voice found, using default")
    if voices:
        engine.setProperty('voice', voices[0].id)

# Output directory
output_dir = "/workspace/hyperframes/narrations"
os.makedirs(output_dir, exist_ok=True)

# Narrations for each animation
narrations = {
    "data-process-narration": """
    电商数据分析全流程框架，从原始数据到业务洞察的六个核心阶段。

    第一阶段，数据采集，获取准确完整的原始数据。

    第二阶段，数据清洗，将脏数据变成干净数据。

    第三阶段，指标核算，构建核心指标体系。

    第四阶段，数据分析，发现问题诊断原因。

    第五阶段，报告输出，清晰呈现分析结论。

    第六阶段，数据应用，驱动业务增长行动。

    总结，发现异常，拆解维度，定位原因，验证假设，提出建议。
    """,
    "metrics-narration": """
    电商四大核心指标体系。

    流量指标，反映用户规模和获取能力。包括展现量、点击量、独立访客数和访问深度。

    转化指标，衡量流量变现效率。包括点击率、转化率、跳失率和成交率。

    客单指标，展示用户消费能力。包括件单价、客单价、笔数和连带率。

    复购指标，评估用户忠诚度。包括复购率、回购率和会员活跃度。

    掌握这四大指标体系，就掌握了电商数据分析的核心框架。
    """,
    "conversion-funnel-narration": """
    电商用户转化漏斗，从曝光到支付成功的完整路径。

    第一步，曝光。用户看到商品页面或广告，展现量代表触达规模。

    第二步，点击。用户被吸引后点击进入，通过点击率可以评估素材吸引力。

    第三步，加购。用户产生购买意向，将商品加入购物车。

    第四步，下单。用户确认购买意向并提交订单。

    第五步，支付。用户完成付款，这是最终成交的关键一步。

    每一层漏斗都有用户流失，优化每个环节的转化率，才能提升整体GMV。
    """,
    "gmv-diagnosis-narration": """
    GMV下滑诊断四步法。

    第一步，看指标。分析GMV整体趋势，识别下滑的时间节点和幅度。

    第二步，拆维度。从渠道、品类、时间、地域等多个维度拆解GMV构成。

    第三步，找原因。结合业务背景和数据分析，定位问题根源。

    第四步，提建议。基于诊断结论，制定可落地的优化方案。

    发现问题是能力，解决问题是价值。
    """
}

# Generate each narration
for filename, text in narrations.items():
    output_path = os.path.join(output_dir, f"{filename}.mp3")
    print(f"\nGenerating: {output_path}")

    # Save to file
    engine.save_to_file(text, output_path)
    engine.runAndWait()

    # Check file size
    if os.path.exists(output_path):
        size = os.path.getsize(output_path)
        print(f"Generated: {output_path} ({size} bytes)")
    else:
        print(f"Failed to generate: {output_path}")

print("\nAll narrations generated successfully!")
