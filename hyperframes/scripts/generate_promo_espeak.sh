#!/bin/bash
# Generate promo video narration using espeak-ng and ffmpeg

OUTPUT_DIR="/workspace/hyperframes/narrations"
TXT_FILE="$OUTPUT_DIR/promo-text.txt"
WAV_FILE="$OUTPUT_DIR/promo-narration.wav"
MP3_FILE="$OUTPUT_DIR/promo-narration.mp3"

mkdir -p "$OUTPUT_DIR"

cat > "$TXT_FILE" << 'EOF'
市场数据分析，AI Agent伴学平台。从零基础到独立完成电商数据分析全流程。

AI智能导师李主管，你的专属数据分析带教导师。苏格拉底式提问，培养独立思考；知识讲解，深入浅出；考核测评，精准反馈。

真实电商项目实战，杭州悦享家居，六大学习阶段，五十四课时精研。从项目启动到综合实战，循序渐进，步步为营。

AI智能评阅，上传数据文件和分析报告，多维度智能评分，精准反馈，帮助你持续进步。

全方位学习画像，六大维度，四十多项指标，自动标签，学习风格识别，让你更了解自己的学习状态。

开启你的数据分析之旅，从零基础到独立分析师，AI伴学全程陪伴。MarketInsight，AI Agent伴学平台。
EOF

echo "Generating WAV with espeak-ng..."
espeak-ng -v zh -s 140 -p 50 -f "$TXT_FILE" -w "$WAV_FILE"

if [ -f "$WAV_FILE" ]; then
    echo "WAV generated: $(ls -lh $WAV_FILE | awk '{print $5}')"
    echo "Converting to MP3..."
    ffmpeg -y -i "$WAV_FILE" -codec:a libmp3lame -qscale:a 2 "$MP3_FILE" 2>/dev/null
    
    if [ -f "$MP3_FILE" ]; then
        echo "MP3 generated: $(ls -lh $MP3_FILE | awk '{print $5}')"
        echo "Done!"
    else
        echo "Failed to generate MP3"
    fi
else
    echo "Failed to generate WAV"
fi
