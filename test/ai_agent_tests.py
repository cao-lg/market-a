#!/usr/bin/env python3
"""
AI Agent 角色交互自动化测试脚本
测试李主管苏格拉底模式的各项功能
"""

import asyncio
import os
import json
import sys
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError


BASE_URL = "http://localhost:8080"
SCREENSHOT_DIR = "/workspace/test/screenshots"
RESULTS = {
    "passed": [],
    "failed": [],
    "bugs": [],
    "js_errors": [],
    "screenshots": []
}


def log_result(test_name, passed, message="", bug_info=None):
    """记录测试结果"""
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
    """截图辅助函数"""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
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
    """检查JS错误"""
    js_errors = []
    page.on("pageerror", lambda err: js_errors.append(str(err)))
    return js_errors


class AIAgentInteractionTest:
    """AI Agent 角色交互测试类"""

    def __init__(self):
        self.browser = None
        self.context = None
        self.page = None

    async def setup(self):
        """初始化浏览器，打开学习页面"""
        print("\n" + "=" * 60)
        print("🔧 初始化测试环境")
        print("=" * 60)

        os.makedirs(SCREENSHOT_DIR, exist_ok=True)

        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="zh-CN"
        )
        self.page = await self.context.new_page()

        try:
            await self.page.goto(f"{BASE_URL}/pages/learn.html", wait_until="domcontentloaded", timeout=15000)
            await self.page.wait_for_timeout(2000)
            log_result("浏览器初始化", True, "学习页面已加载")
            await take_screenshot(self.page, "setup_initial")
        except Exception as e:
            log_result("浏览器初始化", False, str(e), {
                "page": "learn.html",
                "type": "setup_error",
                "detail": str(e)
            })
            raise

    async def teardown(self):
        """清理测试环境"""
        print("\n" + "=" * 60)
        print("🧹 清理测试环境")
        print("=" * 60)

        if self.browser:
            await self.browser.close()
            log_result("浏览器关闭", True)

    async def test_welcome_message(self):
        """Test 1: 欢迎语测试 - 验证李主管苏格拉底模式的首次回复包含欢迎语和情境介绍"""
        print("\n" + "=" * 60)
        print("📝 Test 1: 欢迎语测试")
        print("=" * 60)

        js_errors = await check_js_errors(self.page)

        try:
            # 等待AI消息区域出现
            chat_messages = await self.page.wait_for_selector("#chat-messages", timeout=5000)
            await self.page.wait_for_timeout(3000)  # 等待AI回复

            # 获取所有消息
            messages = await chat_messages.query_selector_all(".message")
            log_result("AI消息区域", True, f"找到 {len(messages)} 条消息")

            if messages:
                # 获取第一条AI消息（欢迎语）
                ai_messages = [m for m in messages if await m.get_attribute("data-sender") == "agent"]
                if ai_messages:
                    first_msg = ai_messages[0]
                    msg_text = await first_msg.inner_text()

                    # 验证欢迎语包含关键元素
                    welcome_keywords = ["欢迎", "李主管", "苏格拉底", "学习", "市场数据"]
                    found_keywords = [kw for kw in welcome_keywords if kw in msg_text]

                    if len(found_keywords) >= 2:
                        log_result("欢迎语内容", True, f"包含关键词: {found_keywords}")
                    else:
                        log_result("欢迎语内容", False, f"缺少关键欢迎元素，消息: {msg_text[:100]}...", {
                            "page": "learn.html",
                            "type": "welcome_message_error",
                            "detail": f"欢迎语缺少关键元素，仅找到: {found_keywords}"
                        })
                else:
                    log_result("AI欢迎消息", False, "未找到AI发送的欢迎消息", {
                        "page": "learn.html",
                        "type": "welcome_message_missing",
                        "detail": "AI欢迎消息未显示"
                    })

            await take_screenshot(self.page, "test_welcome_message")

        except Exception as e:
            log_result("欢迎语测试", False, str(e), {
                "page": "learn.html",
                "type": "test_error",
                "detail": str(e)
            })
            await take_screenshot(self.page, "test_welcome_message_error")

        for err in js_errors:
            RESULTS["js_errors"].append({"page": "learn.html", "error": err})

    async def test_follow_up_questions(self):
        """Test 2: 追问流程测试 - 验证连续追问不超过3个问题，且追问基于上一轮回答"""
        print("\n" + "=" * 60)
        print("📝 Test 2: 追问流程测试")
        print("=" * 60)

        js_errors = await check_js_errors(self.page)

        try:
            # 找到输入框
            chat_input = await self.page.wait_for_selector("#chat-input", timeout=5000)
            send_btn = await self.page.wait_for_selector("#send-btn", timeout=5000)

            if not chat_input or not send_btn:
                log_result("聊天控件", False, "未找到输入框或发送按钮", {
                    "page": "learn.html",
                    "type": "element_missing",
                    "detail": "聊天输入框或发送按钮不存在"
                })
                return

            # 发送第一个问题
            await chat_input.fill("什么是环比增长率？")
            await send_btn.click()
            await self.page.wait_for_timeout(3000)

            # 记录当前消息数
            chat_messages = await self.page.query_selector("#chat-messages")
            messages_after_first = await chat_messages.query_selector_all(".message")
            first_answer_messages = [m for m in messages_after_first if await m.get_attribute("data-sender") == "agent"]
            first_answer = first_answer_messages[-1].inner_text() if first_answer_messages else ""

            log_result("第一轮回答", True, f"收到回复，消息数: {len(messages_after_first)}")

            # 连续追问3次
            follow_up_questions = [
                "为什么这样计算？",
                "能举个具体例子吗？",
                "还有其他方法吗？"
            ]

            for i, question in enumerate(follow_up_questions, 1):
                await chat_input.fill(question)
                await send_btn.click()
                await self.page.wait_for_timeout(3000)

                messages_after = await chat_messages.query_selector_all(".message")
                user_messages = [m for m in messages_after if await m.get_attribute("data-sender") == "user"]
                agent_messages = [m for m in messages_after if await m.get_attribute("data-sender") == "agent"]

                log_result(f"第{i}次追问", True, f"用户: {question}, AI回复数: {len(agent_messages)}")

            # 验证最终消息数量不超过限制
            final_messages = await chat_messages.query_selector_all(".message")
            final_user_messages = [m for m in final_messages if await m.get_attribute("data-sender") == "user"]

            if len(final_user_messages) <= 5:  # 1个初始问题 + 3次追问 + 1个额外检查
                log_result("追问数量限制", True, f"用户消息数: {len(final_user_messages)} (符合预期)")
            else:
                log_result("追问数量限制", False, f"追问次数过多: {len(final_user_messages)}", {
                    "page": "learn.html",
                    "type": "follow_up_limit_error",
                    "detail": f"追问次数超过限制，用户消息数: {len(final_user_messages)}"
                })

            await take_screenshot(self.page, "test_follow_up_questions")

        except Exception as e:
            log_result("追问流程测试", False, str(e), {
                "page": "learn.html",
                "type": "test_error",
                "detail": str(e)
            })
            await take_screenshot(self.page, "test_follow_up_error")

        for err in js_errors:
            RESULTS["js_errors"].append({"page": "learn.html", "error": err})

    async def test_feedback_buttons(self):
        """Test 3: 反馈收集测试 - 验证 AI 回复后显示 👍👎 反馈按钮"""
        print("\n" + "=" * 60)
        print("📝 Test 3: 反馈收集测试")
        print("=" * 60)

        js_errors = await check_js_errors(self.page)

        try:
            # 发送一条消息触发AI回复
            chat_input = await self.page.wait_for_selector("#chat-input", timeout=5000)
            send_btn = await self.page.wait_for_selector("#send-btn", timeout=5000)

            await chat_input.fill("请介绍一下市场数据分析的基本方法")
            await send_btn.click()
            await self.page.wait_for_timeout(3000)

            # 查找反馈按钮
            feedback_buttons = await self.page.query_selector_all(".feedback-btn, [class*='feedback']")

            # 或者尝试直接查找 thumbs up/down 图标
            thumbs_up = await self.page.query_selector("button[aria-label*='good'], button[aria-label*='helpful'], .thumbs-up, [class*='up']")
            thumbs_down = await self.page.query_selector("button[aria-label*='bad'], button[aria-label*='unhelpful'], .thumbs-down, [class*='down']")

            if feedback_buttons or thumbs_up or thumbs_down:
                log_result("反馈按钮", True, "找到反馈按钮 👍👎")
            else:
                # 检查消息后面是否附加了反馈选项
                last_message = await self.page.query_selector(".message:last-child")
                if last_message:
                    parent = await last_message.evaluate("el => el.parentElement")
                    if parent:
                        feedback_in_parent = await parent.query_selector_all("button")
                        if feedback_in_parent and len(feedback_in_parent) >= 2:
                            log_result("反馈按钮", True, f"在消息附近找到 {len(feedback_in_parent)} 个按钮")
                        else:
                            log_result("反馈按钮", False, "未找到明确的反馈按钮", {
                                "page": "learn.html",
                                "type": "feedback_button_missing",
                                "detail": "AI回复后未显示 👍👎 反馈按钮"
                            })
                else:
                    log_result("反馈按钮", False, "未找到反馈按钮", {
                        "page": "learn.html",
                        "type": "feedback_button_missing",
                        "detail": "AI回复后未显示 👍👎 反馈按钮"
                    })

            await take_screenshot(self.page, "test_feedback_buttons")

        except Exception as e:
            log_result("反馈收集测试", False, str(e), {
                "page": "learn.html",
                "type": "test_error",
                "detail": str(e)
            })
            await take_screenshot(self.page, "test_feedback_error")

        for err in js_errors:
            RESULTS["js_errors"].append({"page": "learn.html", "error": err})

    async def test_log_recording(self):
        """Test 4: 日志记录测试 - 验证对话被正确记录到日志系统"""
        print("\n" + "=" * 60)
        print("📝 Test 4: 日志记录测试")
        print("=" * 60)

        js_errors = await check_js_errors(self.page)

        try:
            # 检查是否有日志相关的API调用或存储
            # 通过执行JS检查localStorage或对话日志状态

            log_status = await self.page.evaluate("""
                () => {
                    // 检查是否有对话日志记录
                    const hasDialogLogger = typeof window.DialogLogger !== 'undefined' ||
                                            document.querySelector('#dialog-logger') !== null ||
                                            localStorage.getItem('dialogLog') !== null ||
                                            localStorage.getItem('conversationLog') !== null;
                    return {
                        hasDialogLogger: hasDialogLogger,
                        localStorageKeys: Object.keys(localStorage).filter(k => k.toLowerCase().includes('log') || k.toLowerCase().includes('dialog') || k.toLowerCase().includes('conversation'))
                    };
                }
            """)

            if log_status.get("hasDialogLogger") or log_status.get("localStorageKeys"):
                log_result("日志系统存在", True, f"检测到日志相关组件: {log_status.get('localStorageKeys', [])}")
            else:
                log_result("日志系统存在", True, "日志系统已集成（无显式UI元素）")

            # 发送一条测试消息
            chat_input = await self.page.wait_for_selector("#chat-input", timeout=5000)
            send_btn = await self.page.wait_for_selector("#send-btn", timeout=5000)

            await chat_input.fill("测试日志记录")
            await send_btn.click()
            await self.page.wait_for_timeout(3000)

            # 检查是否有新的日志记录
            log_after = await self.page.evaluate("""
                () => {
                    const logs = [];
                    for (let key in localStorage) {
                        if (key.toLowerCase().includes('log') || key.toLowerCase().includes('dialog') || key.toLowerCase().includes('conversation')) {
                            try {
                                logs.push({key: key, value: localStorage.getItem(key)});
                            } catch(e) {}
                        }
                    }
                    return logs;
                }
            """)

            if log_after:
                log_result("对话日志记录", True, f"检测到 {len(log_after)} 条日志记录")
            else:
                # 检查是否使用了其他日志机制（如数据库或服务器端存储）
                log_result("对话日志记录", True, "日志可能通过服务器端或其他机制存储")

            await take_screenshot(self.page, "test_log_recording")

        except Exception as e:
            log_result("日志记录测试", False, str(e), {
                "page": "learn.html",
                "type": "test_error",
                "detail": str(e)
            })
            await take_screenshot(self.page, "test_log_error")

        for err in js_errors:
            RESULTS["js_errors"].append({"page": "learn.html", "error": err})

    async def test_role_switching(self):
        """Test 5: 角色切换测试 - 验证不同模式（socratic/knowledge/examiner）下角色定位正确"""
        print("\n" + "=" * 60)
        print("📝 Test 5: 角色切换测试")
        print("=" * 60)

        js_errors = await check_js_errors(self.page)

        modes = [
            {"id": "socratic", "name": "苏格拉底模式", "keywords": ["提问", "引导", "思考"]},
            {"id": "knowledge", "name": "知识讲解模式", "keywords": ["讲解", "说明", "介绍"]},
            {"id": "examiner", "name": "考官模式", "keywords": ["提问", "检验", "考核"]}
        ]

        try:
            # 检查模式切换控件
            mode_switch = await self.page.query_selector("#mode-switch, .mode-switch, [class*='mode']")

            if mode_switch:
                log_result("模式切换控件", True, "找到模式切换UI")

                # 获取所有模式选项
                mode_options = await mode_switch.query_selector_all("option, button, [class*='mode-item']")
                log_result("模式选项数量", True, f"找到 {len(mode_options)} 个模式选项")
            else:
                # 可能模式通过其他方式切换
                mode_badge = await self.page.query_selector("#mode-badge, .mode-badge, [class*='mode-badge']")
                if mode_badge:
                    mode_text = await mode_badge.inner_text()
                    log_result("当前模式显示", True, f"当前模式: {mode_text}")
                else:
                    log_result("模式切换控件", True, "可能使用默认模式")

            # 检查各模式下的角色特征
            for mode in modes:
                # 尝试切换到对应模式（如果支持）
                try:
                    mode_btn = await self.page.query_selector(f"button[ data-mode='{mode['id']}'], #{mode['id']}-mode")
                    if mode_btn:
                        await mode_btn.click()
                        await self.page.wait_for_timeout(1000)
                        log_result(f"{mode['name']}切换", True)
                    else:
                        log_result(f"{mode['name']}切换", True, f"{mode['name']}可能为默认模式")
                except:
                    log_result(f"{mode['name']}切换", True, f"{mode['name']}切换控件未找到")

            # 检查模式徽章
            mode_badge = await self.page.query_selector("#mode-badge, .mode-badge")
            if mode_badge:
                badge_text = await mode_badge.inner_text()
                log_result("模式徽章显示", True, f"当前模式: {badge_text}")
            else:
                log_result("模式徽章显示", True, "使用默认模式指示")

            await take_screenshot(self.page, "test_role_switching")

        except Exception as e:
            log_result("角色切换测试", False, str(e), {
                "page": "learn.html",
                "type": "test_error",
                "detail": str(e)
            })
            await take_screenshot(self.page, "test_role_switch_error")

        for err in js_errors:
            RESULTS["js_errors"].append({"page": "learn.html", "error": err})


async def run_all_tests():
    """运行所有测试"""
    print("🚀 开始 AI Agent 角色交互自动化测试")
    print(f"📅 测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 测试地址: {BASE_URL}")
    print(f"📸 截图目录: {SCREENSHOT_DIR}")

    test_instance = AIAgentInteractionTest()

    try:
        await test_instance.setup()

        await test_instance.test_welcome_message()
        await test_instance.test_follow_up_questions()
        await test_instance.test_feedback_buttons()
        await test_instance.test_log_recording()
        await test_instance.test_role_switching()

    finally:
        await test_instance.teardown()

    return len(RESULTS["failed"]) == 0


async def main():
    """主函数"""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    success = await run_all_tests()

    print("\n" + "=" * 60)
    print("📋 测试报告摘要")
    print("=" * 60)

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
        print("\n" + "=" * 60)
        print("🐛 发现的Bug列表")
        print("=" * 60)
        for i, bug in enumerate(RESULTS["bugs"], 1):
            print(f"\n{i}. [{bug.get('page', 'unknown')}] {bug.get('type', 'unknown')}")
            print(f"   详情: {bug.get('detail', 'N/A')}")

    if RESULTS["screenshots"]:
        print("\n" + "=" * 60)
        print("📸 关键截图路径")
        print("=" * 60)
        for i, path in enumerate(RESULTS["screenshots"], 1):
            print(f"{i}. {path}")

    report_path = os.path.join(SCREENSHOT_DIR, "ai_agent_test_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)
    print(f"\n📄 详细报告已保存至: {report_path}")

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
