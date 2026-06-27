#!/usr/bin/env python3
"""
批量生成课程语音文件
使用硅基流动 CosyVoice2 API
"""

import json
import os
import requests
import time
import hashlib

API_KEY = "sk-tbppcdrmrmnristmzjinynuqvflifmernybuupqardjwgcgn"
API_URL = "https://api.siliconflow.cn/v1/audio/speech"
VOICE = "FunAudioLLM/CosyVoice2-0.5B:anna"  # 温柔女声
OUTPUT_DIR = "/workspace/audio/anna"

def get_course_content():
    """读取课程内容"""
    with open('/workspace/data/course-content.json') as f:
        return json.load(f)

def text_to_speech(text, output_file):
    """调用API生成语音"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "FunAudioLLM/CosyVoice2-0.5B",
        "input": text,
        "voice": VOICE,
        "response_format": "mp3",
        "speed": 1.0
    }
    
    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
        
        if response.status_code == 200:
            with open(output_file, 'wb') as f:
                f.write(response.content)
            return True, len(response.content)
        else:
            return False, f"HTTP {response.status_code}: {response.text[:100]}"
    except Exception as e:
        return False, str(e)

def clean_text(markdown):
    """清理Markdown文本，转换为纯文本用于语音合成"""
    import re
    
    # 移除Markdown标记
    text = markdown
    
    # 移除标题标记
    text = re.sub(r'^#+\s+', '', text)
    
    # 移除粗体/斜体标记
    text = re.sub(r'\*+([^*]+)\*+', r'\1', text)
    text = re.sub(r'_+([^_]+)_+', r'\1', text)
    
    # 移除链接，保留文本
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    
    # 移除代码块
    text = re.sub(r'```[\s\S]*?```', '', text)
    
    # 移除行内代码
    text = re.sub(r'`([^`]+)`', r'\1', text)
    
    # 移除表格分隔线
    text = re.sub(r'\|[-:]+\|', '', text)
    
    # 处理表格：转换为简单文本
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        if '|' in line:
            # 表格行：提取内容
            cells = [c.strip() for c in line.split('|') if c.strip()]
            if cells:
                cleaned_lines.append('，'.join(cells))
        else:
            cleaned_lines.append(line)
    
    text = '\n'.join(cleaned_lines)
    
    # 移除列表标记
    text = re.sub(r'^\s*[-*+]\s+', '', text)
    text = re.sub(r'^\s*\d+\.\s+', '', text)
    
    # 移除引用标记
    text = re.sub(r'^>\s*', '', text)
    
    # 移除HTML标记
    text = re.sub(r'<[^>]+>', '', text)
    
    # 移除多余空白
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'  +', ' ', text)
    
    # 添加自然停顿
    text = re.sub(r'\n\n', '。\n\n', text)  # 段落结尾加句号
    
    return text.strip()

def main():
    print("开始批量生成语音文件...")
    print(f"输出目录: {OUTPUT_DIR}")
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    course = get_course_content()
    
    total_lessons = 0
    success_count = 0
    failed_count = 0
    total_size = 0
    
    for stage in course['stages']:
        stage_id = stage['id']
        print(f"\n=== 阶段 {stage_id}: {stage['title']} ===")
        
        for lesson in stage['lessons']:
            lesson_id = lesson['id']
            lesson_title = lesson['title']
            
            if 'content' not in lesson or 'markdown' not in lesson['content']:
                print(f"跳过 {lesson_id}: 无内容")
                continue
            
            total_lessons += 1
            
            # 清理文本
            raw_text = lesson['content']['markdown']
            clean_text_content = clean_text(raw_text)
            
            # 生成文件名
            output_file = os.path.join(OUTPUT_DIR, f"{lesson_id}.mp3")
            
            # 检查是否已存在
            if os.path.exists(output_file):
                file_size = os.path.getsize(output_file)
                print(f"✓ {lesson_id}: 已存在 ({file_size//1024}KB)")
                success_count += 1
                total_size += file_size
                continue
            
            print(f"生成 {lesson_id}: {lesson_title}...")
            print(f"  文本长度: {len(clean_text_content)} 字符")
            
            success, result = text_to_speech(clean_text_content, output_file)
            
            if success:
                file_size = result
                print(f"  ✓ 成功! 文件大小: {file_size//1024}KB")
                success_count += 1
                total_size += file_size
            else:
                print(f"  ✗ 失败: {result}")
                failed_count += 1
            
            # 避免API限流
            time.sleep(1)
    
    print("\n=== 生成完成 ===")
    print(f"总课时数: {total_lessons}")
    print(f"成功: {success_count}")
    print(f"失败: {failed_count}")
    print(f"总文件大小: {total_size//1024//1024}MB")
    
    # 生成元数据文件
    metadata = {
        "voice": VOICE,
        "voice_name": "Anna（温柔女声）",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_lessons": total_lessons,
        "success_count": success_count,
        "files": {}
    }
    
    for stage in course['stages']:
        for lesson in stage['lessons']:
            lesson_id = lesson['id']
            output_file = os.path.join(OUTPUT_DIR, f"{lesson_id}.mp3")
            if os.path.exists(output_file):
                metadata["files"][lesson_id] = {
                    "title": lesson['title'],
                    "file": f"audio/anna/{lesson_id}.mp3",
                    "size": os.path.getsize(output_file)
                }
    
    with open(os.path.join(OUTPUT_DIR, "metadata.json"), 'w') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    print(f"元数据已保存: {OUTPUT_DIR}/metadata.json")

if __name__ == "__main__":
    main()