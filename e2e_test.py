#!/usr/bin/env python3
"""
市场数据分析AI伴学平台 - 端到端测试脚本
"""

import asyncio
import os
import json
import sys
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = "http://localhost:8080"
SCREENSHOT_DIR = "/tmp"
RESULTS = {
    "passed": [],
    "failed": [],
    "bugs": [],
    "js_errors": [],
    "screenshots": []
}

def log_result(test_name, passed, message="", bug_info=None):
    timestamp = datetime.now().strftime("%H:%M:%S")
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"[{timestamp}] {status} - {test_name}")
    if message:
        print(f"        {message}")
    
    if passed:
        RESULTS["passed"].append({"name": test_name, "message": message})
    else:
        RESULTS["failed"].append({"name": test_name, "message": message})
        if bug_info:
            RESULTS["bugs"].append(bug_info)

async def take_screenshot(page, name):
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    try:
        await page.screenshot(path=path, full_page=True)
        RESULTS["screenshots"].append(path)
        print(f"        📸 截图已保存: {path}")
        return path
    except Exception as e:
        print(f"        ⚠️  截图失败: {e}")
        return None

async def check_js_errors(page):
    js_errors = []
    page.on("pageerror", lambda err: js_errors.append(str(err)))
    return js_errors

async def test_homepage(page):
    """测试首页功能"""
    print("\n" + "="*60)
    print("📄 测试首页 (index.html)")
    print("="*60)
    
    js_errors = await check_js_errors(page)
    
    try:
        await page.goto(f"{BASE_URL}/index.html", wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(1000)
        log_result("首页加载", True)
    except Exception as e:
        log_result("首页加载", False, str(e), {"page": "index.html", "type": "load_error", "detail": str(e)})
        await take_screenshot(page, "homepage_load_error")
        return
    
    await take_screenshot(page, "homepage_initial")
    
    title = await page.title()
    if "市场数据分析" in title:
        log_result("首页标题", True, f"标题: {title}")
    else:
        log_result("首页标题", False, f"期望包含'市场数据分析', 实际: {title}",
                   {"page": "index.html", "type": "title_error", "detail": f"标题不正确: {title}"})
    
    stats_items = await page.query_selector_all(".text-2xl.font-bold")
    if len(stats_items) >= 1:
        first_stat = await stats_items[0].inner_text()
        if "64" in first_stat:
            log_result("首页总课时数验证", True, f"总课时: {first_stat}")
        else:
            log_result("首页总课时数验证", False, f"期望64课时，实际: {first_stat}",
                       {"page": "index.html", "type": "data_error", 
                        "detail": f"首页总课时数不一致: {first_stat}"})
    
    try:
        student_entry = await page.wait_for_selector("#student-entry", timeout=5000)
        if student_entry:
            log_result("学生登录按钮存在", True)
        else:
            log_result("学生登录按钮存在", False, "未找到#student-entry",
                       {"page": "index.html", "type": "element_missing", "detail": "#student-entry 不存在"})
    except Exception as e:
        log_result("学生登录按钮存在", False, str(e),
                   {"page": "index.html", "type": "element_missing", "detail": str(e)})
    
    try:
        await page.click("#student-entry")
        await page.wait_for_timeout(2000)
        current_url = page.url
        if "dashboard.html" in current_url:
            log_result("点击学生登录跳转", True, f"跳转到: {current_url}")
        else:
            log_result("点击学生登录跳转", False, f"期望跳转到dashboard, 实际: {current_url}",
                       {"page": "index.html", "type": "navigation_error", "detail": f"跳转失败: {current_url}"})
    except Exception as e:
        log_result("点击学生登录跳转", False, str(e),
                   {"page": "index.html", "type": "click_error", "detail": str(e)})
    
    for err in js_errors:
        RESULTS["js_errors"].append({"page": "index.html", "error": err})
        log_result("首页JS错误", False, err,
                   {"page": "index.html", "type": "js_error", "detail": err})
    
    if not js_errors:
        log_result("首页JS错误检查", True, "无控制台错误")

async def test_dashboard(page):
    """测试仪表盘页面"""
    print("\n" + "="*60)
    print("📊 测试仪表盘 (dashboard.html)")
    print("="*60)
    
    js_errors = await check_js_errors(page)
    
    try:
        await page.goto(f"{BASE_URL}/pages/dashboard.html", wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(2000)
        log_result("仪表盘加载", True)
    except Exception as e:
        log_result("仪表盘加载", False, str(e),
                   {"page": "dashboard.html", "type": "load_error", "detail": str(e)})
        await take_screenshot(page, "dashboard_load_error")
        return
    
    await take_screenshot(page, "dashboard_initial")
    
    title = await page.title()
    if "仪表盘" in title:
        log_result("仪表盘标题", True, f"标题: {title}")
    else:
        log_result("仪表盘标题", False, f"标题: {title}",
                   {"page": "dashboard.html", "type": "title_error", "detail": f"标题不正确: {title}"})
    
    try:
        student_id = await page.wait_for_selector("#student-id", timeout=5000)
        if student_id:
            text = await student_id.inner_text()
            log_result("学生ID显示", True, f"ID: {text}")
    except Exception as e:
        log_result("学生ID显示", False, str(e),
                   {"page": "dashboard.html", "type": "element_missing", "detail": str(e)})
    
    try:
        overall_progress = await page.wait_for_selector("#overall-progress", timeout=5000)
        if overall_progress:
            text = await overall_progress.inner_text()
            log_result("总体进度显示", True, f"进度: {text}")
    except Exception as e:
        log_result("总体进度显示", False, str(e),
                   {"page": "dashboard.html", "type": "element_missing", "detail": str(e)})
    
    try:
        completed_hours = await page.wait_for_selector("#completed-hours", timeout=5000)
        if completed_hours:
            text = await completed_hours.inner_text()
            log_result("已完成课时显示", True, f"课时: {text}")
            if "64" in text:
                log_result("课时总数正确性验证", True, "课时总数为64，与课程数据一致")
            else:
                log_result("课时总数正确性验证", False, f"期望64课时，实际: {text}",
                           {"page": "dashboard.html", "type": "data_error", 
                            "detail": f"课时总数不一致: {text}"})
    except Exception as e:
        log_result("已完成课时显示", False, str(e),
                   {"page": "dashboard.html", "type": "element_missing", "detail": str(e)})
    
    try:
        stage_grid = await page.wait_for_selector("#stage-grid", timeout=5000)
        if stage_grid:
            cards = await stage_grid.query_selector_all(".stage-card")
            log_result("阶段卡片", True, f"找到 {len(cards)} 个阶段卡片")
    except Exception as e:
        log_result("阶段卡片", False, str(e),
                   {"page": "dashboard.html", "type": "element_missing", "detail": str(e)})
    
    try:
        continue_btn = await page.wait_for_selector("#continue-btn", timeout=5000)
        if continue_btn:
            log_result("继续学习按钮", True)
    except Exception as e:
        log_result("继续学习按钮", False, str(e),
                   {"page": "dashboard.html", "type": "element_missing", "detail": str(e)})
    
    for err in js_errors:
        RESULTS["js_errors"].append({"page": "dashboard.html", "error": err})
        log_result("仪表盘JS错误", False, err,
                   {"page": "dashboard.html", "type": "js_error", "detail": err})
    
    if not js_errors:
        log_result("仪表盘JS错误检查", True, "无控制台错误")

async def test_learn_page(page):
    """测试学习页面"""
    print("\n" + "="*60)
    print("📚 测试学习页面 (learn.html)")
    print("="*60)
    
    js_errors = await check_js_errors(page)
    
    try:
        await page.goto(f"{BASE_URL}/pages/learn.html", wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(3000)
        log_result("学习页面加载", True)
    except Exception as e:
        log_result("学习页面加载", False, str(e),
                   {"page": "learn.html", "type": "load_error", "detail": str(e)})
        await take_screenshot(page, "learn_load_error")
        return
    
    await take_screenshot(page, "learn_initial")
    
    title = await page.title()
    if "学习中心" in title:
        log_result("学习页面标题", True, f"标题: {title}")
    else:
        log_result("学习页面标题", False, f"标题: {title}",
                   {"page": "learn.html", "type": "title_error", "detail": f"标题不正确: {title}"})
    
    try:
        stage_title = await page.wait_for_selector("#stage-title", timeout=5000)
        if stage_title:
            text = await stage_title.inner_text()
            log_result("阶段标题显示", True, f"阶段: {text}")
    except Exception as e:
        log_result("阶段标题显示", False, str(e),
                   {"page": "learn.html", "type": "element_missing", "detail": str(e)})
    
    try:
        content_area = await page.wait_for_selector("#content-area", timeout=5000)
        if content_area:
            has_content = await content_area.evaluate("el => el.innerText.length > 50")
            log_result("课程内容加载", True if has_content else False, 
                       "内容已加载" if has_content else "内容可能未正确加载",
                       None if has_content else {"page": "learn.html", "type": "content_error", "detail": "内容区域内容过少"})
    except Exception as e:
        log_result("课程内容加载", False, str(e),
                   {"page": "learn.html", "type": "element_missing", "detail": str(e)})
    
    try:
        chat_messages = await page.wait_for_selector("#chat-messages", timeout=5000)
        if chat_messages:
            messages = await chat_messages.query_selector_all(".message")
            log_result("AI对话区域", True, f"初始消息数: {len(messages)}")
    except Exception as e:
        log_result("AI对话区域", False, str(e),
                   {"page": "learn.html", "type": "element_missing", "detail": str(e)})
    
    try:
        chat_input = await page.wait_for_selector("#chat-input", timeout=5000)
        send_btn = await page.wait_for_selector("#send-btn", timeout=5000)
        if chat_input and send_btn:
            log_result("聊天输入框和发送按钮", True)
    except Exception as e:
        log_result("聊天输入框和发送按钮", False, str(e),
                   {"page": "learn.html", "type": "element_missing", "detail": str(e)})
    
    try:
        complete_btn = await page.wait_for_selector("#complete-btn", timeout=5000)
        if complete_btn:
            log_result("完成课时按钮", True)
    except Exception as e:
        log_result("完成课时按钮", False, str(e),
                   {"page": "learn.html", "type": "element_missing", "detail": str(e)})
    
    try:
        prev_btn = await page.wait_for_selector("#prev-btn", timeout=5000)
        next_btn = await page.wait_for_selector("#next-btn", timeout=5000)
        lesson_info = await page.wait_for_selector("#lesson-nav-info", timeout=5000)
        if prev_btn and next_btn and lesson_info:
            info_text = await lesson_info.inner_text()
            log_result("课时导航", True, f"导航信息: {info_text}")
    except Exception as e:
        log_result("课时导航", False, str(e),
                   {"page": "learn.html", "type": "element_missing", "detail": str(e)})
    
    try:
        mode_badge = await page.wait_for_selector("#mode-badge", timeout=5000)
        if mode_badge:
            text = await mode_badge.inner_text()
            log_result("AI模式指示", True, f"当前模式: {text}")
    except Exception as e:
        log_result("AI模式指示", False, str(e),
                   {"page": "learn.html", "type": "element_missing", "detail": str(e)})
    
    for err in js_errors:
        RESULTS["js_errors"].append({"page": "learn.html", "error": err})
        log_result("学习页面JS错误", False, err,
                   {"page": "learn.html", "type": "js_error", "detail": err})
    
    if not js_errors:
        log_result("学习页面JS错误检查", True, "无控制台错误")
    
    await take_screenshot(page, "learn_loaded")

async def test_test_page(page):
    """测试测试页面"""
    print("\n" + "="*60)
    print("📝 测试测试页面 (test.html)")
    print("="*60)
    
    js_errors = await check_js_errors(page)
    
    try:
        await page.goto(f"{BASE_URL}/pages/test.html?stage=stage-1", wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(3000)
        log_result("测试页面加载", True)
    except Exception as e:
        log_result("测试页面加载", False, str(e),
                   {"page": "test.html", "type": "load_error", "detail": str(e)})
        await take_screenshot(page, "test_load_error")
        return
    
    await take_screenshot(page, "test_initial")
    
    title = await page.title()
    if "测试" in title:
        log_result("测试页面标题", True, f"标题: {title}")
    else:
        log_result("测试页面标题", False, f"标题: {title}",
                   {"page": "test.html", "type": "title_error", "detail": f"标题不正确: {title}"})
    
    try:
        test_container = await page.wait_for_selector("#test-container", timeout=5000)
        if test_container:
            has_questions = await test_container.evaluate("el => el.querySelectorAll('.quiz-question').length > 0")
            log_result("测试题目加载", True if has_questions else False,
                       "题目已加载" if has_questions else "未找到题目",
                       None if has_questions else {"page": "test.html", "type": "content_error", "detail": "未加载出题目"})
    except Exception as e:
        log_result("测试题目加载", False, str(e),
                   {"page": "test.html", "type": "element_missing", "detail": str(e)})
    
    for err in js_errors:
        RESULTS["js_errors"].append({"page": "test.html", "error": err})
        log_result("测试页面JS错误", False, err,
                   {"page": "test.html", "type": "js_error", "detail": err})
    
    if not js_errors:
        log_result("测试页面JS错误检查", True, "无控制台错误")

async def test_settings_page(page):
    """测试设置页面"""
    print("\n" + "="*60)
    print("⚙️  测试设置页面 (settings.html)")
    print("="*60)
    
    js_errors = await check_js_errors(page)
    
    try:
        await page.goto(f"{BASE_URL}/pages/settings.html", wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(2000)
        log_result("设置页面加载", True)
    except Exception as e:
        log_result("设置页面加载", False, str(e),
                   {"page": "settings.html", "type": "load_error", "detail": str(e)})
        await take_screenshot(page, "settings_load_error")
        return
    
    await take_screenshot(page, "settings_initial")
    
    title = await page.title()
    if "设置" in title:
        log_result("设置页面标题", True, f"标题: {title}")
    else:
        log_result("设置页面标题", False, f"标题: {title}",
                   {"page": "settings.html", "type": "title_error", "detail": f"标题不正确: {title}"})
    
    providers = ['zhipu', 'siliconflow', 'moark', 'agens', 'gemini']
    provider_names = {
        'zhipu': '智谱AI',
        'siliconflow': '硅基流动', 
        'moark': 'Moark',
        'agens': 'Agens阿贡',
        'gemini': 'Google Gemini'
    }
    
    for provider in providers:
        try:
            api_input = await page.wait_for_selector(f"#api-key-{provider}", timeout=3000)
            test_btn = await page.query_selector(f"button[onclick=\"testConnection('{provider}')\"]")
            save_btn = await page.query_selector(f"button[onclick=\"saveAPIKey('{provider}')\"]")
            
            if api_input:
                log_result(f"{provider_names[provider]} API配置区域", True)
            else:
                log_result(f"{provider_names[provider]} API配置区域", False, "未找到输入框",
                           {"page": "settings.html", "type": "element_missing", 
                            "detail": f"未找到 {provider} API输入框"})
        except Exception as e:
            log_result(f"{provider_names[provider]} API配置区域", False, str(e),
                       {"page": "settings.html", "type": "element_missing", "detail": str(e)})
    
    try:
        preferred_select = await page.wait_for_selector("#preferred-provider", timeout=3000)
        if preferred_select:
            log_result("优先通道选择", True)
    except Exception as e:
        log_result("优先通道选择", False, str(e),
                   {"page": "settings.html", "type": "element_missing", "detail": str(e)})
    
    try:
        storage_usage = await page.wait_for_selector("#storage-usage", timeout=3000)
        if storage_usage:
            text = await storage_usage.inner_text()
            log_result("存储使用显示", True, f"存储: {text}")
    except Exception as e:
        log_result("存储使用显示", False, str(e),
                   {"page": "settings.html", "type": "element_missing", "detail": str(e)})
    
    try:
        clear_data_btn = await page.query_selector("button.btn-danger")
        if clear_data_btn:
            log_result("清除数据按钮", True)
    except Exception as e:
        log_result("清除数据按钮", False, str(e),
                   {"page": "settings.html", "type": "element_missing", "detail": str(e)})
    
    for err in js_errors:
        RESULTS["js_errors"].append({"page": "settings.html", "error": err})
        log_result("设置页面JS错误", False, err,
                   {"page": "settings.html", "type": "js_error", "detail": err})
    
    if not js_errors:
        log_result("设置页面JS错误检查", True, "无控制台错误")

async def test_page_navigation(page):
    """测试页面间导航"""
    print("\n" + "="*60)
    print("🔗 测试页面间导航")
    print("="*60)
    
    try:
        await page.goto(f"{BASE_URL}/index.html", wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(1000)
        
        await page.click("#student-entry")
        await page.wait_for_timeout(2000)
        
        if "dashboard.html" in page.url:
            log_result("首页→仪表盘导航", True)
        else:
            log_result("首页→仪表盘导航", False, f"实际URL: {page.url}",
                       {"page": "navigation", "type": "nav_error", 
                        "detail": f"首页到仪表盘导航失败: {page.url}"})
    except Exception as e:
        log_result("首页→仪表盘导航", False, str(e),
                   {"page": "navigation", "type": "nav_error", "detail": str(e)})
    
    try:
        await page.goto(f"{BASE_URL}/pages/dashboard.html", wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(2000)
        
        continue_btn = await page.wait_for_selector("#continue-btn", timeout=5000)
        if continue_btn:
            await continue_btn.click()
            await page.wait_for_timeout(2000)
            
            if "learn.html" in page.url:
                log_result("仪表盘→学习页面导航", True)
            else:
                log_result("仪表盘→学习页面导航", False, f"实际URL: {page.url}",
                           {"page": "navigation", "type": "nav_error",
                            "detail": f"仪表盘到学习页面导航失败: {page.url}"})
    except Exception as e:
        log_result("仪表盘→学习页面导航", False, str(e),
                   {"page": "navigation", "type": "nav_error", "detail": str(e)})
    
    try:
        await page.goto(f"{BASE_URL}/pages/learn.html", wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(2000)
        
        back_btn = await page.wait_for_selector("button.btn-ghost", timeout=5000)
        if back_btn:
            await back_btn.click()
            await page.wait_for_timeout(2000)
            
            if "dashboard.html" in page.url:
                log_result("学习页面→仪表盘返回", True)
            else:
                log_result("学习页面→仪表盘返回", False, f"实际URL: {page.url}",
                           {"page": "navigation", "type": "nav_error",
                            "detail": f"学习页面返回仪表盘失败: {page.url}"})
    except Exception as e:
        log_result("学习页面→仪表盘返回", False, str(e),
                   {"page": "navigation", "type": "nav_error", "detail": str(e)})

async def main():
    print("🚀 开始市场数据分析AI伴学平台端到端测试")
    print(f"📅 测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 测试地址: {BASE_URL}")
    print(f"📸 截图目录: {SCREENSHOT_DIR}")
    
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="zh-CN"
        )
        
        page = await context.new_page()
        
        await test_homepage(page)
        await test_dashboard(page)
        await test_learn_page(page)
        await test_test_page(page)
        await test_settings_page(page)
        await test_page_navigation(page)
        
        await browser.close()
    
    print("\n" + "="*60)
    print("📋 测试报告摘要")
    print("="*60)
    
    total = len(RESULTS["passed"]) + len(RESULTS["failed"])
    passed = len(RESULTS["passed"])
    failed = len(RESULTS["failed"])
    
    print(f"\n总测试项: {total}")
    print(f"✅ 通过: {passed}")
    print(f"❌ 失败: {failed}")
    print(f"🐛 Bug数: {len(RESULTS['bugs'])}")
    print(f"💥 JS错误: {len(RESULTS['js_errors'])}")
    print(f"📸 截图数: {len(RESULTS['screenshots'])}")
    
    if RESULTS["bugs"]:
        print("\n" + "="*60)
        print("🐛 发现的Bug列表")
        print("="*60)
        for i, bug in enumerate(RESULTS["bugs"], 1):
            print(f"\n{i}. [{bug.get('page', 'unknown')}] {bug.get('type', 'unknown')}")
            print(f"   详情: {bug.get('detail', 'N/A')}")
    
    if RESULTS["js_errors"]:
        print("\n" + "="*60)
        print("💥 JS控制台错误")
        print("="*60)
        for i, err in enumerate(RESULTS["js_errors"], 1):
            print(f"\n{i}. [{err.get('page', 'unknown')}]")
            print(f"   错误: {err.get('error', 'N/A')}")
    
    if RESULTS["screenshots"]:
        print("\n" + "="*60)
        print("📸 关键截图路径")
        print("="*60)
        for i, path in enumerate(RESULTS["screenshots"], 1):
            print(f"{i}. {path}")
    
    report_path = os.path.join(SCREENSHOT_DIR, "test_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)
    print(f"\n📄 详细报告已保存至: {report_path}")
    
    print("\n" + "="*60)
    print("测试完成!")
    print("="*60)
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
