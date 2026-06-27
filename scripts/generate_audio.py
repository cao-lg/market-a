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

def process_markdown_to_script(markdown, lesson_title):
    """
    将Markdown内容转换为口语化的讲稿
    适合语音朗读，生动、悦耳、简洁
    """
    import re
    
    # 提取标题
    title_match = re.search(r'^#\s+(.+?)(?:\n|$)', markdown, re.MULTILINE)
    main_title = title_match.group(1).strip() if title_match else lesson_title
    
    text = markdown
    
    # ====== 第一步：移除所有代码块 ======
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    
    # ====== 第二步：处理分隔线 ======
    # 把 --- 转换成自然的段落过渡
    text = re.sub(r'\n-{3,}\n+', '\n\n---新话题---\n\n', text)
    text = re.sub(r'\n-{3,}$', '\n\n---新话题---', text, flags=re.MULTILINE)
    
    # ====== 第三步：处理表格 ======
    lines = text.split('\n')
    result_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        # 跳过表格分隔线
        if re.match(r'^[\|:\-\s]+$', line) or re.match(r'^\|[-:]+\|', line):
            i += 1
            continue
        
        # 处理表格行
        if line.startswith('|') or '|' in line:
            cells = [c.strip() for c in line.split('|') if c.strip()]
            if len(cells) >= 2:
                # 表格转成自然语言
                if len(cells) == 2:
                    result_lines.append(f"{cells[0]}是{cells[1]}。")
                elif len(cells) == 3:
                    result_lines.append(f"{cells[0]}，{cells[1]}是{cells[2]}。")
                elif len(cells) == 4:
                    result_lines.append(f"{cells[0]}，{cells[1]}是{cells[2]}，{cells[3]}。")
                else:
                    # 多列表格：列出关键信息
                    result_lines.append('，'.join(cells) + '。')
            i += 1
            continue
        
        result_lines.append(line)
        i += 1
    
    text = '\n'.join(result_lines)
    
    # ====== 第四步：处理标题 ======
    # 主标题只保留一次
    text = re.sub(r'^#\s+.+?(?:\n|$)', '', text, flags=re.MULTILINE)
    
    # 二级标题 -> 强调词
    def replace_h2(m):
        return f"\n\n{m.group(1).strip()}\n"
    text = re.sub(r'^##\s+(.+?)(?:\n|$)', replace_h2, text, flags=re.MULTILINE)
    
    # 三级标题 -> 段落引导
    def replace_h3(m):
        return f"我们来看{m.group(1).strip()}："
    text = re.sub(r'^###\s+(.+?)(?:\n|$)', replace_h3, text, flags=re.MULTILINE)
    
    # 四级及以上标题 -> 简短过渡
    def replace_h4(m):
        return f"另外，{m.group(1).strip()}："
    text = re.sub(r'^#{4,}\s+(.+?)(?:\n|$)', replace_h4, text, flags=re.MULTILINE)
    
    # ====== 第五步：处理列表 ======
    # 有序列表：直接读出
    def replace_ol(m):
        return f"第一，{m.group(1).strip()}。" if m.group(1).strip() else ""
    text = re.sub(r'^\d+\.\s+(.+?)(?:\n|$)', replace_ol, text, flags=re.MULTILINE)
    
    # 无序列表：转为逗号分隔的句子
    def replace_ul(m):
        content = m.group(1).strip()
        if content:
            return f"包括{content}。"
        return ""
    text = re.sub(r'^[-*]\s+(.+?)(?:\n|$)', replace_ul, text, flags=re.MULTILINE)
    
    # ====== 第六步：处理格式标记 ======
    # 粗体 -> 直接读出
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    
    # 斜体 -> 直接读出
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    
    # 链接 -> 保留文字
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    
    # 引用 -> 直接读出
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)
    
    # ====== 第七步：处理技术符号 ======
    # 箭头转换
    text = re.sub(r'→', '，然后', text)
    text = re.sub(r'<-', '，由', text)
    text = re.sub(r'<=', '小于等于', text)
    text = re.sub(r'=>', '大于等于', text)
    text = re.sub(r'>=', '大于等于', text)
    text = re.sub(r'!=', '不等于', text)
    
    # 百分号
    text = re.sub(r'(\d+)%', r'\1百分之', text)
    
    # ====== 第八步：处理特殊分隔符 ======
    # ---新话题--- 转换为自然过渡
    text = re.sub(r'---新话题---', '\n\n好，接下来我们看下一个内容。\n\n', text)
    
    # ====== 第九步：清理和优化 ======
    # 移除多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # 清理行内多余空格
    text = re.sub(r'  +', ' ', text)
    
    # 处理一些口语化表达
    text = re.sub(r'等等\.', '等等。', text)
    
    # 移除行首行尾空白
    text = re.sub(r'^[ \t]+|[ \t]+$', '', text, flags=re.MULTILINE)
    
    # ====== 第十步：添加开头和结尾 ======
    opening = f"大家好，欢迎学习{main_title}。\n\n"
    ending = "\n\n好，今天的内容就到这里。希望对大家有帮助，下次课再见！"
    
    return opening + text.strip() + ending


def clean_text(markdown):
    """兼容旧函数名"""
    return process_markdown_to_script(markdown, "")

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
            
            # 处理文本：转换为口语化讲稿
            raw_text = lesson['content']['markdown']
            script = process_markdown_to_script(raw_text, lesson_title)
            
            # 生成文件名
            output_file = os.path.join(OUTPUT_DIR, f"{lesson_id}.mp3")
            
            # 强制重新生成（使用新的讲稿处理）
            print(f"生成 {lesson_id}: {lesson_title}...")
            print(f"  文本长度: {len(script)} 字符")
            
            success, result = text_to_speech(script, output_file)
            
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