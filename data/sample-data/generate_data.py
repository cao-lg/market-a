import json
import random
from datetime import datetime, timedelta

random.seed(42)

PROVINCES_CITIES = [
    ("浙江省", "杭州市"), ("浙江省", "宁波市"), ("浙江省", "温州市"),
    ("江苏省", "南京市"), ("江苏省", "苏州市"), ("江苏省", "无锡市"),
    ("广东省", "广州市"), ("广东省", "深圳市"), ("广东省", "东莞市"),
    ("上海市", "上海市"), ("北京市", "北京市"),
    ("四川省", "成都市"), ("湖北省", "武汉市"), ("山东省", "青岛市"),
    ("山东省", "济南市"), ("福建省", "福州市"), ("福建省", "厦门市"),
    ("辽宁省", "大连市"), ("陕西省", "西安市"), ("河南省", "郑州市"),
    ("湖南省", "长沙市"), ("安徽省", "合肥市"), ("江西省", "南昌市"),
    ("重庆市", "重庆市"), ("天津市", "天津市"), ("云南省", "昆明市"),
    ("广西壮族自治区", "南宁市"), ("河北省", "石家庄市"), ("山西省", "太原市"),
    ("黑龙江省", "哈尔滨市"), ("吉林省", "长春市"), ("贵州省", "贵阳市"),
    ("甘肃省", "兰州市"), ("新疆维吾尔自治区", "乌鲁木齐市"), ("内蒙古自治区", "呼和浩特市"),
]

WARDROBE_PRODUCTS = [
    ("衣物收纳盒升级版", 89, "衣柜收纳"),
    ("衣物收纳盒基础版", 49, "衣柜收纳"),
    ("衣柜分层架", 129, "衣柜收纳"),
    ("真空压缩袋套装", 59, "衣柜收纳"),
    ("化妆品收纳盒", 79, "衣柜收纳"),
    ("布艺收纳柜", 159, "衣柜收纳"),
    ("被子收纳袋", 39, "衣柜收纳"),
    ("塑料收纳柜", 189, "衣柜收纳"),
    ("衣柜收纳箱", 69, "衣柜收纳"),
    ("内衣收纳盒", 29, "衣柜收纳"),
    ("袜子收纳格", 35, "衣柜收纳"),
    ("领带收纳盒", 45, "衣柜收纳"),
]

KITCHEN_PRODUCTS = [
    ("厨房置物架", 99, "厨房收纳"),
    ("食品保鲜盒套装", 89, "厨房收纳"),
    ("厨房调料盒", 45, "厨房收纳"),
    ("冰箱收纳盒", 69, "厨房收纳"),
    ("碗碟收纳架", 79, "厨房收纳"),
    ("锅具收纳架", 129, "厨房收纳"),
    ("蔬菜收纳篮", 59, "厨房收纳"),
    ("五谷杂粮收纳罐", 39, "厨房收纳"),
    ("餐具收纳盒", 55, "厨房收纳"),
    ("刀具收纳架", 65, "厨房收纳"),
]

ALL_PRODUCTS = WARDROBE_PRODUCTS + KITCHEN_PRODUCTS

SOURCES = ["直通车", "超级推荐", "自然搜索", "抖音", "自主访问", "直播", "淘宝客", "聚划算"]
STATUSES = ["已完成", "已发货", "已取消", "已退款"]
STATUS_WEIGHTS = [0.6, 0.25, 0.1, 0.05]


def generate_order_id(date_str, seq):
    return f"DD{date_str.replace('-', '')}{seq:03d}"


def generate_customer_id(seq):
    return f"KH{seq:05d}"


def random_time(date, start_hour=8, end_hour=22):
    hour = random.randint(start_hour, end_hour)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return f"{date} {hour:02d}:{minute:02d}:{second:02d}"


def generate_orders_august():
    orders = []
    target_orders = 800
    order_seq = 0
    customer_seq = 1
    customers = {}

    start_date = datetime(2023, 8, 1)
    end_date = datetime(2023, 8, 31)
    days = (end_date - start_date).days + 1

    daily_orders = []
    base_orders = target_orders // days
    for i in range(days):
        day_factor = 0.8 + random.random() * 0.4
        if (start_date + timedelta(days=i)).weekday() >= 5:
            day_factor *= 1.3
        daily_orders.append(max(1, int(base_orders * day_factor)))

    total_daily = sum(daily_orders)
    scale = target_orders / total_daily
    daily_orders = [int(x * scale) for x in daily_orders]

    for day_idx in range(days):
        date = start_date + timedelta(days=day_idx)
        date_str = date.strftime("%Y-%m-%d")
        num_orders = daily_orders[day_idx]

        for _ in range(num_orders):
            order_seq += 1
            order_id = generate_order_id(date_str, order_seq)

            if random.random() < 0.3 and customers:
                cust_id = random.choice(list(customers.keys()))
            else:
                cust_id = generate_customer_id(customer_seq)
                customer_seq += 1
                customers[cust_id] = {"orders": 0, "amount": 0}

            product_name, price, category = random.choice(ALL_PRODUCTS)
            quantity = random.choices([1, 2, 3], weights=[0.65, 0.25, 0.1])[0]
            amount = price * quantity

            status = random.choices(STATUSES, weights=STATUS_WEIGHTS)[0]
            province, city = random.choice(PROVINCES_CITIES)

            create_time = random_time(date_str)
            if status in ["已完成", "已发货", "已退款"]:
                pay_dt = datetime.strptime(create_time, "%Y-%m-%d %H:%M:%S") + timedelta(minutes=random.randint(1, 30))
                pay_time = pay_dt.strftime("%Y-%m-%d %H:%M:%S")
            else:
                pay_time = ""

            source = random.choice(SOURCES)

            order = {
                "order_id": order_id,
                "customer_id": cust_id,
                "product_name": product_name,
                "category": category,
                "amount": amount,
                "quantity": quantity,
                "status": status,
                "province": province,
                "city": city,
                "create_time": create_time,
                "pay_time": pay_time,
                "source": source
            }
            orders.append(order)

    paid_orders = [o for o in orders if o["status"] in ["已完成", "已发货"]]
    actual_gmv = sum(o["amount"] for o in paid_orders)
    avg_order_value = actual_gmv / len(paid_orders) if paid_orders else 0
    print(f"orders-august.json: {len(orders)} 条订单, GMV: {actual_gmv:.2f} 元, 客单价: {avg_order_value:.2f} 元")

    return orders


CHINESE_SURNAMES = ["王", "李", "张", "刘", "陈", "杨", "黄", "赵", "周", "吴",
                    "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
                    "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧",
                    "程", "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕"]

CHINESE_GIVEN_NAMES = ["伟", "芳", "娜", "敏", "静", "丽", "强", "磊", "军", "洋",
                       "勇", "艳", "杰", "娟", "涛", "明", "超", "秀英", "霞", "平",
                       "刚", "桂英", "文", "华", "玲", "辉", "鑫", "斌", "波", "宇",
                       "浩", "凯", "健", "俊", "帆", "鹏", "博", "婷", "雪", "倩"]


def generate_name():
    surname = random.choice(CHINESE_SURNAMES)
    given = random.choice(CHINESE_GIVEN_NAMES)
    return surname + given


def generate_phone():
    prefix = random.choice(["138", "139", "137", "136", "135", "189", "188", "186", "158", "159"])
    suffix = f"{random.randint(1000, 9999)}"
    middle = "****"
    return f"{prefix}{middle}{suffix}"


def generate_users_kitchen():
    users = []
    num_users = 300

    for i in range(1, num_users + 1):
        user_id = f"KCH{i:05d}"
        name = generate_name()
        phone = generate_phone()

        total_orders = random.choices([1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                                       weights=[0.25, 0.2, 0.18, 0.12, 0.08, 0.06, 0.04, 0.03, 0.02, 0.02])[0]

        avg_order_value = random.uniform(60, 130)
        total_amount = round(avg_order_value * total_orders, 2)

        first_order_date = datetime(2023, 1, 1) + timedelta(days=random.randint(0, 180))
        last_order_date = first_order_date + timedelta(days=random.randint(30, 200))
        if last_order_date > datetime(2023, 8, 31):
            last_order_date = datetime(2023, 8, 31)

        r = min(5, max(0, 5 - (datetime(2023, 8, 31) - last_order_date).days // 15))
        f = min(5, max(1, total_orders // 2))
        m = min(5, max(1, int(total_amount / 200) + 1))

        if r >= 4 and f >= 4 and m >= 4:
            customer_type = "重要价值"
        elif r >= 4 and f <= 2 and m >= 3:
            customer_type = "重要发展"
        elif r <= 2 and f >= 4 and m >= 4:
            customer_type = "重要保持"
        elif r <= 2 and f <= 2 and m >= 3:
            customer_type = "重要挽留"
        elif r >= 4 and f >= 3 and m <= 2:
            customer_type = "一般价值"
        elif r >= 4 and f <= 2 and m <= 2:
            customer_type = "一般发展"
        elif r <= 2 and f >= 3 and m <= 2:
            customer_type = "一般保持"
        else:
            customer_type = "一般挽留"

        user = {
            "user_id": user_id,
            "name": name,
            "phone": phone,
            "total_orders": total_orders,
            "total_amount": total_amount,
            "first_order_date": first_order_date.strftime("%Y-%m-%d"),
            "last_order_date": last_order_date.strftime("%Y-%m-%d"),
            "avg_order_value": round(avg_order_value, 2),
            "rfm_r": r,
            "rfm_f": f,
            "rfm_m": m,
            "customer_type": customer_type,
            "preferred_category": "厨房收纳"
        }
        users.append(user)

    print(f"users-kitchen.json: {len(users)} 个用户")
    return users


def generate_competitors_new():
    competitors = [
        {
            "competitor_id": "COMP004",
            "competitor_name": "无印良品官方旗舰店",
            "platform": "天猫",
            "sku_count": 28,
            "price_range": "49-399",
            "avg_price": 159,
            "monthly_sales": 8500,
            "monthly_gmv": 1351500,
            "avg_conversion_rate": 4.2,
            "return_rate": 4.2,
            "main_products": [
                {"name": "聚丙烯收纳箱", "price": 129, "monthly_sales": 2200},
                {"name": "软质收纳盒", "price": 69, "monthly_sales": 3100},
                {"name": "不锈钢厨房架", "price": 259, "monthly_sales": 900}
            ],
            "advantages": ["品牌调性高", "设计简约", "材质环保", "品质稳定"],
            "disadvantages": ["价格偏高", "SKU较少", "活动力度小"]
        },
        {
            "competitor_id": "COMP005",
            "competitor_name": "京东京造官方旗舰店",
            "platform": "京东",
            "sku_count": 42,
            "price_range": "39-249",
            "avg_price": 99,
            "monthly_sales": 15600,
            "monthly_gmv": 1544400,
            "avg_conversion_rate": 5.5,
            "return_rate": 7.1,
            "main_products": [
                {"name": "加厚收纳箱", "price": 79, "monthly_sales": 4500},
                {"name": "厨房置物架", "price": 129, "monthly_sales": 2800},
                {"name": "衣柜收纳盒套装", "price": 99, "monthly_sales": 3600}
            ],
            "advantages": ["自有品牌", "物流快", "品质有保障", "性价比高"],
            "disadvantages": ["设计一般", "品牌调性中等"]
        },
        {
            "competitor_id": "COMP006",
            "competitor_name": "小红书-收纳达人馆",
            "platform": "小红书",
            "sku_count": 15,
            "price_range": "59-199",
            "avg_price": 89,
            "monthly_sales": 12000,
            "monthly_gmv": 1068000,
            "avg_conversion_rate": 6.8,
            "return_rate": 9.5,
            "main_products": [
                {"name": "ins风收纳盒", "price": 69, "monthly_sales": 5200},
                {"name": "厨房调料瓶套装", "price": 89, "monthly_sales": 3500},
                {"name": "桌面化妆品收纳", "price": 129, "monthly_sales": 2100}
            ],
            "advantages": ["内容种草强", "颜值高", "年轻用户多", "传播力强"],
            "disadvantages": ["平台抽成高", "退货率较高", "SKU少"]
        }
    ]

    print(f"competitors-new.json: {len(competitors)} 个竞品")
    return competitors


def generate_promotion_double11():
    promotions = []
    channels = ["直通车", "超级推荐", "钻展", "淘宝客", "抖音直播", "天猫直播", "聚划算", "天猫U先"]

    start_date = datetime(2023, 11, 1)
    end_date = datetime(2023, 11, 11)

    activity_id = 1
    for day in range((end_date - start_date).days + 1):
        date = start_date + timedelta(days=day)
        date_str = date.strftime("%Y-%m-%d")

        day_factor = 1.0
        if day >= 8:
            day_factor = 1.8 + (day - 8) * 0.3

        for channel in channels:
            base_cost = {
                "直通车": 8000,
                "超级推荐": 5000,
                "钻展": 6000,
                "淘宝客": 3000,
                "抖音直播": 12000,
                "天猫直播": 10000,
                "聚划算": 4000,
                "天猫U先": 2000
            }[channel]

            cost = round(base_cost * day_factor * (0.8 + random.random() * 0.4), 2)

            base_impressions = {
                "直通车": 50000,
                "超级推荐": 80000,
                "钻展": 120000,
                "淘宝客": 30000,
                "抖音直播": 200000,
                "天猫直播": 150000,
                "聚划算": 60000,
                "天猫U先": 25000
            }[channel]
            impressions = int(base_impressions * day_factor * (0.8 + random.random() * 0.4))

            ctr = {
                "直通车": 0.035,
                "超级推荐": 0.02,
                "钻展": 0.015,
                "淘宝客": 0.05,
                "抖音直播": 0.08,
                "天猫直播": 0.06,
                "聚划算": 0.04,
                "天猫U先": 0.07
            }[channel]
            clicks = int(impressions * ctr * (0.9 + random.random() * 0.2))

            cvr = {
                "直通车": 0.038,
                "超级推荐": 0.028,
                "钻展": 0.022,
                "淘宝客": 0.045,
                "抖音直播": 0.055,
                "天猫直播": 0.05,
                "聚划算": 0.042,
                "天猫U先": 0.035
            }[channel]
            orders = int(clicks * cvr * (0.9 + random.random() * 0.2))

            avg_order_value = random.uniform(95, 115)
            gmv = round(orders * avg_order_value, 2)

            roi = round(gmv / cost, 2) if cost > 0 else 0

            promo = {
                "activity_id": f"ACT11{activity_id:03d}",
                "activity_name": f"双11-{channel}-{date_str}",
                "date": date_str,
                "channel": channel,
                "cost": cost,
                "impressions": impressions,
                "clicks": clicks,
                "orders": orders,
                "gmv": gmv,
                "roi": roi
            }
            promotions.append(promo)
            activity_id += 1

    total_cost = sum(p["cost"] for p in promotions)
    total_gmv = sum(p["gmv"] for p in promotions)
    overall_roi = total_gmv / total_cost if total_cost > 0 else 0
    print(f"promotion-double11.json: {len(promotions)} 条数据, 总投入: {total_cost:.2f}, 总GMV: {total_gmv:.2f}, 整体ROI: {overall_roi:.2f}")

    return promotions


TRAFFIC_SOURCES_MEDIUM = [
    ("直通车", "cpc"),
    ("超级推荐", "cpm"),
    ("自然搜索", "organic"),
    ("抖音", "content"),
    ("自主访问", "direct"),
    ("直播", "live"),
    ("淘宝客", "cpa"),
    ("聚划算", "promotion"),
]

LANDING_PAGES = [
    "/home",
    "/product/detail/1001",
    "/product/detail/1002",
    "/product/detail/1003",
    "/category/收纳盒",
    "/category/收纳架",
    "/category/厨房收纳",
    "/category/衣柜收纳",
    "/search",
    "/live/room1",
]


def generate_traffic_august():
    sessions = []
    target_sessions = 1000

    visitor_seq = 1
    session_seq = 1

    start_date = datetime(2023, 8, 1)
    end_date = datetime(2023, 8, 31)
    days = (end_date - start_date).days + 1

    daily_sessions = []
    base_sessions = target_sessions // days
    for i in range(days):
        day_factor = 0.85 + random.random() * 0.3
        if (start_date + timedelta(days=i)).weekday() >= 5:
            day_factor *= 1.25
        daily_sessions.append(max(1, int(base_sessions * day_factor)))

    total_daily = sum(daily_sessions)
    scale = target_sessions / total_daily
    daily_sessions = [int(x * scale) for x in daily_sessions]

    for day_idx in range(days):
        date = start_date + timedelta(days=day_idx)
        date_str = date.strftime("%Y%m%d")
        num_sessions = daily_sessions[day_idx]

        daily_visitors = set()

        for _ in range(num_sessions):
            session_id = f"S{date_str}{session_seq:05d}"
            session_seq += 1

            if random.random() < 0.75:
                visitor_id = f"V{visitor_seq:05d}"
                visitor_seq += 1
            else:
                if daily_visitors:
                    visitor_id = random.choice(list(daily_visitors))
                else:
                    visitor_id = f"V{visitor_seq:05d}"
                    visitor_seq += 1

            daily_visitors.add(visitor_id)

            source, medium = random.choice(TRAFFIC_SOURCES_MEDIUM)
            landing_page = random.choice(LANDING_PAGES)

            duration = int(random.expovariate(1/120)) + 10
            page_views = max(1, int(duration / 40 + random.randint(0, 3)))
            bounce = 1 if page_views == 1 else 0

            session = {
                "session_id": session_id,
                "visitor_id": visitor_id,
                "source": source,
                "medium": medium,
                "landing_page": landing_page,
                "duration": duration,
                "page_views": page_views,
                "bounce": bounce
            }
            sessions.append(session)

    unique_visitors = len(set(s["visitor_id"] for s in sessions))
    print(f"traffic-august.json: {len(sessions)} 条会话, UV: {unique_visitors}")
    return sessions


def generate_indicator_trap():
    indicator_groups = []

    indicator_groups.append({
        "trap_type": "口径不一致-GMV是否包含退款",
        "description": "不同报表的GMV口径不一致，有的包含退款，有的不包含",
        "indicators": [
            {
                "report_name": "销售报表A",
                "indicator_name": "GMV",
                "value": 750000,
                "unit": "元",
                "period": "2023年9月",
                "caliber": "包含退款订单",
                "remark": "按下单时间统计，包含已退款订单金额"
            },
            {
                "report_name": "财务报表B",
                "indicator_name": "GMV",
                "value": 712500,
                "unit": "元",
                "period": "2023年9月",
                "caliber": "剔除退款",
                "remark": "按支付时间统计，已扣除退款金额"
            },
            {
                "report_name": "运营报表C",
                "indicator_name": "GMV",
                "value": 735000,
                "unit": "元",
                "period": "2023年9月",
                "caliber": "包含部分退款",
                "remark": "按发货时间统计，仅扣除全额退款"
            }
        ]
    })

    indicator_groups.append({
        "trap_type": "口径不一致-UV是否去重",
        "description": "UV统计口径不一致，有的按去重，有的按不去重",
        "indicators": [
            {
                "report_name": "流量报表A",
                "indicator_name": "UV",
                "value": 168000,
                "unit": "人",
                "period": "2023年9月",
                "caliber": "去重",
                "remark": "按访客ID去重统计"
            },
            {
                "report_name": "流量报表B",
                "indicator_name": "UV",
                "value": 210000,
                "unit": "人次",
                "period": "2023年9月",
                "caliber": "不去重",
                "remark": "按访问次数统计，未去重"
            },
            {
                "report_name": "第三方报表C",
                "indicator_name": "UV",
                "value": 175000,
                "unit": "人",
                "period": "2023年9月",
                "caliber": "按设备去重",
                "remark": "按设备ID去重，与访客ID口径不同"
            }
        ]
    })

    indicator_groups.append({
        "trap_type": "口径不一致-转化率分子分母",
        "description": "转化率的分子分母定义不一致",
        "indicators": [
            {
                "report_name": "运营报表A",
                "indicator_name": "转化率",
                "value": 3.2,
                "unit": "%",
                "period": "2023年9月",
                "caliber": "下单转化率",
                "remark": "下单人数 / 访问人数"
            },
            {
                "report_name": "财务报表B",
                "indicator_name": "转化率",
                "value": 2.8,
                "unit": "%",
                "period": "2023年9月",
                "caliber": "支付转化率",
                "remark": "支付人数 / 访问人数"
            },
            {
                "report_name": "第三方报表C",
                "indicator_name": "转化率",
                "value": 4.5,
                "unit": "%",
                "period": "2023年9月",
                "caliber": "类目均值",
                "remark": "下单转化率，全类目平均水平"
            }
        ]
    })

    indicator_groups.append({
        "trap_type": "单位不统一",
        "description": "同一指标使用不同的单位",
        "indicators": [
            {
                "report_name": "销售报表A",
                "indicator_name": "GMV",
                "value": 75,
                "unit": "万元",
                "period": "2023年9月",
                "caliber": "支付口径",
                "remark": "以万元为单位"
            },
            {
                "report_name": "运营报表B",
                "indicator_name": "GMV",
                "value": 750000,
                "unit": "元",
                "period": "2023年9月",
                "caliber": "支付口径",
                "remark": "以元为单位"
            },
            {
                "report_name": "汇报材料C",
                "indicator_name": "GMV",
                "value": 0.0075,
                "unit": "亿元",
                "period": "2023年9月",
                "caliber": "支付口径",
                "remark": "以亿元为单位"
            }
        ]
    })

    indicator_groups.append({
        "trap_type": "时间范围不一致",
        "description": "报表统计的时间范围不一致",
        "indicators": [
            {
                "report_name": "月报A",
                "indicator_name": "GMV",
                "value": 750000,
                "unit": "元",
                "period": "2023年9月",
                "caliber": "自然月",
                "remark": "9月1日-9月30日，共30天"
            },
            {
                "report_name": "周报B汇总",
                "indicator_name": "GMV",
                "value": 725000,
                "unit": "元",
                "period": "2023年9月",
                "caliber": "按周统计",
                "remark": "9月第1-4周，实际为8月28日-9月24日"
            },
            {
                "report_name": "财务周期C",
                "indicator_name": "GMV",
                "value": 780000,
                "unit": "元",
                "period": "2023年9月",
                "caliber": "财务周期",
                "remark": "财务周期为上月26日-本月25日"
            }
        ]
    })

    indicator_groups.append({
        "trap_type": "逻辑矛盾-数据不自洽",
        "description": "数据之间存在逻辑矛盾，无法互相印证",
        "indicators": [
            {
                "report_name": "用户报表A",
                "indicator_name": "新增用户数",
                "value": 8500,
                "unit": "人",
                "period": "2023年9月",
                "caliber": "按注册时间",
                "remark": "本月新增注册用户"
            },
            {
                "report_name": "订单报表B",
                "indicator_name": "新客订单数",
                "value": 9200,
                "unit": "单",
                "period": "2023年9月",
                "caliber": "首单用户",
                "remark": "新客首单订单数，大于新增用户数，存在矛盾"
            },
            {
                "report_name": "流量报表C",
                "indicator_name": "新访客数",
                "value": 7800,
                "unit": "人",
                "period": "2023年9月",
                "caliber": "按访客ID",
                "remark": "首次访问的访客数"
            }
        ]
    })

    indicator_groups.append({
        "trap_type": "口径不一致-客单价计算方式",
        "description": "客单价的计算方式不一致",
        "indicators": [
            {
                "report_name": "销售报表A",
                "indicator_name": "客单价",
                "value": 105,
                "unit": "元/单",
                "period": "2023年9月",
                "caliber": "按订单数",
                "remark": "GMV / 订单数"
            },
            {
                "report_name": "用户报表B",
                "indicator_name": "客单价",
                "value": 128,
                "unit": "元/人",
                "period": "2023年9月",
                "caliber": "按购买人数",
                "remark": "GMV / 购买人数（人均消费）"
            },
            {
                "report_name": "行业报告C",
                "indicator_name": "客单价",
                "value": 95,
                "unit": "元/件",
                "period": "2023年9月",
                "caliber": "按商品件数",
                "remark": "GMV / 商品件数（件单价）"
            }
        ]
    })

    print(f"indicator-trap.json: {len(indicator_groups)} 组陷阱数据")
    return indicator_groups


def main():
    orders_august = generate_orders_august()
    with open("/workspace/data/sample-data/orders-august.json", "w", encoding="utf-8") as f:
        json.dump(orders_august, f, ensure_ascii=False, indent=2)

    users_kitchen = generate_users_kitchen()
    with open("/workspace/data/sample-data/users-kitchen.json", "w", encoding="utf-8") as f:
        json.dump(users_kitchen, f, ensure_ascii=False, indent=2)

    competitors_new = generate_competitors_new()
    with open("/workspace/data/sample-data/competitors-new.json", "w", encoding="utf-8") as f:
        json.dump(competitors_new, f, ensure_ascii=False, indent=2)

    promotion_double11 = generate_promotion_double11()
    with open("/workspace/data/sample-data/promotion-double11.json", "w", encoding="utf-8") as f:
        json.dump(promotion_double11, f, ensure_ascii=False, indent=2)

    traffic_august = generate_traffic_august()
    with open("/workspace/data/sample-data/traffic-august.json", "w", encoding="utf-8") as f:
        json.dump(traffic_august, f, ensure_ascii=False, indent=2)

    indicator_trap = generate_indicator_trap()
    with open("/workspace/data/sample-data/indicator-trap.json", "w", encoding="utf-8") as f:
        json.dump(indicator_trap, f, ensure_ascii=False, indent=2)

    print("\n所有数据文件生成完成！")


if __name__ == "__main__":
    main()
