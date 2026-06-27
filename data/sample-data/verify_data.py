import json
import os

data_dir = "/workspace/data/sample-data"

files_to_verify = [
    "orders-august.json",
    "users-kitchen.json",
    "competitors-new.json",
    "promotion-double11.json",
    "traffic-august.json",
    "indicator-trap.json"
]

print("=" * 60)
print("JSON 文件验证报告")
print("=" * 60)

all_valid = True

for filename in files_to_verify:
    filepath = os.path.join(data_dir, filename)
    print(f"\n📄 {filename}")

    if not os.path.exists(filepath):
        print(f"   ❌ 文件不存在")
        all_valid = False
        continue

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        print(f"   ✅ JSON 语法正确")
        print(f"   📊 数据条目数: {len(data)}")

        if filename == "orders-august.json":
            paid_orders = [o for o in data if o["status"] in ["已完成", "已发货"]]
            gmv = sum(o["amount"] for o in paid_orders)
            conversion_rate = len(paid_orders) / len(data) * 100
            avg_order_value = gmv / len(paid_orders) if paid_orders else 0

            categories = set(o["category"] for o in data)
            sources = set(o["source"] for o in data)

            print(f"   💰 GMV: {gmv:.2f} 元")
            print(f"   📈 有效订单数: {len(paid_orders)}")
            print(f"   💹 转化率: {conversion_rate:.1f}%")
            print(f"   🛒 客单价: {avg_order_value:.2f} 元")
            print(f"   📦 品类: {categories}")
            print(f"   📱 来源渠道: {sources}")

            if 800000 <= gmv <= 900000:
                print(f"   ✅ GMV符合要求（约85万）")
            else:
                print(f"   ⚠️  GMV偏离目标")
                all_valid = False

        elif filename == "users-kitchen.json":
            total_amount = sum(u["total_amount"] for u in data)
            avg_orders = sum(u["total_orders"] for u in data) / len(data)
            customer_types = set(u["customer_type"] for u in data)

            print(f"   💰 总消费金额: {total_amount:.2f} 元")
            print(f"   📊 平均订单数: {avg_orders:.2f}")
            print(f"   👥 客户类型: {customer_types}")
            print(f"   🏷️  首选品类: {set(u.get('preferred_category', 'N/A') for u in data)}")

        elif filename == "competitors-new.json":
            for comp in data:
                print(f"   - {comp['competitor_name']} ({comp['platform']}平台)")
                print(f"     SKU: {comp['sku_count']}, 均价: {comp['avg_price']}元")
                print(f"     月销: {comp['monthly_sales']}, 月GMV: {comp['monthly_gmv']}元")

        elif filename == "promotion-double11.json":
            total_cost = sum(p["cost"] for p in data)
            total_gmv = sum(p["gmv"] for p in data)
            total_roi = total_gmv / total_cost if total_cost > 0 else 0
            channels = set(p["channel"] for p in data)
            dates = set(p["date"] for p in data)

            print(f"   💰 总投入: {total_cost:.2f} 元")
            print(f"   📈 总GMV: {total_gmv:.2f} 元")
            print(f"   💹 整体ROI: {total_roi:.2f}")
            print(f"   📱 渠道数: {len(channels)}")
            print(f"   📅 天数: {len(dates)}")

            if 3.0 <= total_roi <= 4.0:
                print(f"   ✅ ROI符合要求（约1:3.5）")
            else:
                print(f"   ⚠️  ROI偏离目标")
                all_valid = False

        elif filename == "traffic-august.json":
            unique_visitors = len(set(s["visitor_id"] for s in data))
            avg_duration = sum(s["duration"] for s in data) / len(data)
            avg_page_views = sum(s["page_views"] for s in data) / len(data)
            bounce_rate = sum(s["bounce"] for s in data) / len(data) * 100
            sources = set(s["source"] for s in data)

            print(f"   👥 独立访客数(UV): {unique_visitors}")
            print(f"   ⏱️  平均停留时长: {avg_duration:.1f} 秒")
            print(f"   📄 平均浏览页数: {avg_page_views:.2f}")
            print(f"   🚪 跳出率: {bounce_rate:.1f}%")
            print(f"   📱 流量来源: {sources}")

        elif filename == "indicator-trap.json":
            trap_types = [g["trap_type"] for g in data]
            print(f"   🎯 陷阱组数: {len(data)}")
            for i, trap in enumerate(trap_types, 1):
                print(f"     {i}. {trap}")

            if len(data) >= 5:
                print(f"   ✅ 陷阱类型数量符合要求（5种以上）")
            else:
                print(f"   ⚠️  陷阱类型数量不足")
                all_valid = False

    except json.JSONDecodeError as e:
        print(f"   ❌ JSON 语法错误: {e}")
        all_valid = False
    except Exception as e:
        print(f"   ❌ 验证错误: {e}")
        all_valid = False

print("\n" + "=" * 60)
if all_valid:
    print("✅ 所有文件验证通过！")
else:
    print("⚠️  部分文件存在问题，请检查")
print("=" * 60)
