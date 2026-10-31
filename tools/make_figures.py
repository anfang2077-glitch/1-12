# -*- coding: utf-8 -*-
"""生成毕业论文与答辩 PPT 所需的示意图（Pillow 绘制，无需外部图形库）。"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "05-thesis", "figures")
os.makedirs(OUT, exist_ok=True)

REG = r"C:\Windows\Fonts\msyh.ttc"
BOLD = r"C:\Windows\Fonts\msyhbd.ttc"

INK = (31, 41, 55)
MUTED = (107, 114, 128)
LINE = (156, 163, 175)
BLUE = (37, 99, 235)
BLUE_L = (219, 234, 254)
GREEN = (5, 150, 105)
GREEN_L = (209, 250, 229)
AMBER = (180, 83, 9)
AMBER_L = (254, 243, 199)
PURPLE = (109, 40, 217)
PURPLE_L = (237, 233, 254)
RED = (185, 28, 28)
GREY_L = (243, 244, 246)


def F(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REG, size, index=0)


def canvas(w, h):
    img = Image.new("RGB", (w, h), "white")
    return img, ImageDraw.Draw(img)


def title(d, text, w, y=24, size=30):
    d.text((w // 2, y), text, font=F(size, True), fill=INK, anchor="mt")


def wrap(d, text, f, maxw):
    lines, cur = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(cur)
            cur = ""
            continue
        if d.textlength(cur + ch, font=f) > maxw:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def box(d, x, y, w, h, text, fill="white", outline=LINE, f=None, r=10, color=INK, lw=2):
    d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=fill, outline=outline, width=lw)
    if text:
        f = f or F(20)
        lines = wrap(d, text, f, w - 24)
        lh = f.size + 8
        cy = y + h / 2 - (len(lines) * lh) / 2 + lh / 2
        for i, ln in enumerate(lines):
            d.text((x + w / 2, cy + i * lh), ln, font=f, fill=color, anchor="mm")


def arrow(d, p1, p2, color=LINE, width=2, head=9, dashed=False):
    import math
    x1, y1 = p1
    x2, y2 = p2
    if dashed:
        dist = math.hypot(x2 - x1, y2 - y1)
        n = max(int(dist // 10), 1)
        for i in range(n):
            if i % 2 == 0:
                a = i / n
                b = min((i + 0.6) / n, 1)
                d.line([x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b], fill=color, width=width)
    else:
        d.line([x1, y1, x2, y2], fill=color, width=width)
    ang = math.atan2(y2 - y1, x2 - x1)
    d.polygon([
        (x2, y2),
        (x2 - head * math.cos(ang - 0.4), y2 - head * math.sin(ang - 0.4)),
        (x2 - head * math.cos(ang + 0.4), y2 - head * math.sin(ang + 0.4)),
    ], fill=color)


def actor(d, x, y, label, f=None):
    f = f or F(19, True)
    d.ellipse([x - 14, y - 52, x + 14, y - 24], outline=INK, width=2, fill="white")
    d.line([x, y - 24, x, y + 10], fill=INK, width=2)
    d.line([x - 22, y - 8, x + 22, y - 8], fill=INK, width=2)
    d.line([x, y + 10, x - 18, y + 40], fill=INK, width=2)
    d.line([x, y + 10, x + 18, y + 40], fill=INK, width=2)
    d.text((x, y + 48), label, font=f, fill=INK, anchor="ma")


# ---------------------------------------------------------------- 图 3-1 用例图
def fig_usecase():
    groups = [
        ("管理员", ["用户管理", "角色与权限", "课程管理", "全局概览"]),
        ("教师", ["课程管理", "题库管理", "批量导入题目", "组卷", "发布考试", "指派考生", "在线阅卷", "成绩统计"]),
        ("学生", ["查看考试", "在线答题", "自动保存", "交卷", "查看成绩", "查看解析"]),
    ]
    cols, cw, ch, gapx, gapy = 4, 215, 58, 17, 16
    bands, y = [], 150
    for name, cases in groups:
        rows = (len(cases) + cols - 1) // cols
        h = 44 + rows * (ch + gapy) + 8
        bands.append((name, cases, y, h))
        y += h + 16
    W, H = 1500, int(y + 60)
    img, d = canvas(W, H)
    title(d, "在线考试系统用例图", W)
    d.rounded_rectangle([230, 88, 1270, H - 30], radius=14, outline=BLUE, width=3, fill=(248, 250, 255))
    d.text((750, 104), "在线考试系统", font=F(20, True), fill=BLUE, anchor="mt")

    for name, cases, y0, h in bands:
        d.rounded_rectangle([250, y0, 1250, y0 + h], radius=10, outline=(203, 213, 225), width=2, fill="white")
        d.text((262, y0 + 8), name + "用例", font=F(16, True), fill=MUTED, anchor="lt")
        for j, c in enumerate(cases):
            r, col = divmod(j, cols)
            x = 300 + col * (cw + gapx)
            yy = y0 + 40 + r * (ch + gapy)
            d.ellipse([x, yy, x + cw, yy + ch], outline=BLUE, width=2, fill=BLUE_L)
            d.text((x + cw / 2, yy + ch / 2), c, font=F(17), fill=(30, 58, 138), anchor="mm")

    for i, (name, cases, y0, h) in enumerate(bands):
        cy = y0 + h / 2
        actor(d, 90, cy - 10, name)
        arrow(d, (128, cy), (246, cy), color=(148, 163, 184), head=9)
    img.save(os.path.join(OUT, "fig-3-1-usecase.png"))


# ---------------------------------------------------------------- 图 3-2 功能模块
def fig_module():
    W, H = 1500, 780
    img, d = canvas(W, H)
    title(d, "系统功能模块图", W)
    box(d, 600, 90, 300, 64, "在线考试系统", BLUE_L, BLUE, F(22, True), color=(30, 58, 138))
    groups = [
        ("用户与权限", ["用户管理", "登录鉴权", "角色权限控制"], BLUE, BLUE_L),
        ("教学资源", ["课程管理", "题库管理", "题目批量导入"], GREEN, GREEN_L),
        ("考试业务", ["组卷", "发布与指派", "在线答题", "自动保存", "交卷判分"], AMBER, AMBER_L),
        ("质量分析", ["人工阅卷", "成绩统计", "题目正确率"], PURPLE, PURPLE_L),
    ]
    gw, gap = 330, 20
    total = len(groups) * gw + (len(groups) - 1) * gap
    start = (W - total) / 2
    for i, (g, items, color, light) in enumerate(groups):
        x = start + i * (gw + gap)
        cx = x + gw / 2
        d.line([750, 154, 750, 180], fill=LINE, width=2)
        d.line([cx, 180, cx, 200], fill=LINE, width=2)
        box(d, x, 200, gw, 56, g, light, color, F(21, True), color=color)
        for j, it in enumerate(items):
            box(d, x + 18, 282 + j * 92, gw - 36, 60, it, "white", LINE, F(18))
        d.line([cx, 256, cx, 282], fill=LINE, width=2)
        if len(items) > 1:
            d.line([cx, 282, cx, 282 + (len(items) - 1) * 92], fill=LINE, width=2)
    img.save(os.path.join(OUT, "fig-3-2-module.png"))


# ---------------------------------------------------------------- 图 4-1 架构
def fig_arch():
    W, H = 1500, 900
    img, d = canvas(W, H)
    title(d, "系统分层架构图", W)
    layers = [
        ("表现层", "React 18 + Vite + React Router 6 + Axios", ["登录页", "管理员端", "教师端", "学生端"], BLUE, BLUE_L),
        ("接口层", "Express Router + 中间件", ["REST API /api", "JWT 鉴权", "参数校验", "统一错误处理"], GREEN, GREEN_L),
        ("业务层", "Service（事务边界 / 状态机 / 判分规则）", ["认证服务", "考试服务", "答卷服务", "阅卷服务", "统计服务"], AMBER, AMBER_L),
        ("数据访问层", "Repository 接口 + 双实现", ["MySQL 实现", "内存实现（测试）", "连接池 / 事务"], PURPLE, PURPLE_L),
        ("基础设施", "运行环境与中间件", ["MySQL 8.0", "bcrypt", "jsonwebtoken", "日志"], (55, 65, 81), GREY_L),
    ]
    y = 100
    for i, (name, sub, comps, color, light) in enumerate(layers):
        h = 130
        d.rounded_rectangle([70, y, 1430, y + h], radius=12, fill="white", outline=color, width=2)
        d.rounded_rectangle([70, y, 340, y + h], radius=12, fill=light, outline=color, width=2)
        d.text((205, y + 46), name, font=F(24, True), fill=color, anchor="mm")
        for k, ln in enumerate(wrap(d, sub, F(12), 236)):
            d.text((205, y + 84 + k * 18), ln, font=F(12), fill=MUTED, anchor="mm")
        cw = (1060 - (len(comps) - 1) * 16) / len(comps)
        for j, c in enumerate(comps):
            x = 360 + j * (cw + 16)
            box(d, x, y + 32, cw, 66, c, "white", color, F(16))
        if i < len(layers) - 1:
            arrow(d, (750, y + h), (750, y + h + 22), color=LINE, head=8)
            d.text((762, y + h + 11), "调用", font=F(13), fill=MUTED, anchor="lm")
        y += h + 24
    img.save(os.path.join(OUT, "fig-4-1-architecture.png"))


# ---------------------------------------------------------------- 图 4-2 部署
def fig_deploy():
    W, H = 1500, 760
    img, d = canvas(W, H)
    title(d, "系统部署图", W)
    box(d, 60, 300, 220, 120, "客户端浏览器\nChrome / Edge", "white", BLUE, F(18))
    box(d, 400, 220, 330, 280, "", "white", GREEN, None, r=14)
    d.text((565, 246), "Web 服务器（Nginx）", font=F(19, True), fill=GREEN, anchor="mm")
    box(d, 430, 285, 270, 70, "静态资源\nReact 构建产物 dist/", GREY_L, LINE, F(16))
    box(d, 430, 380, 270, 90, "反向代理\n/api → 127.0.0.1:3000", GREY_L, LINE, F(16))
    box(d, 860, 210, 300, 300, "", "white", AMBER, None, r=14)
    d.text((1010, 238), "应用服务器（Node.js 20）", font=F(18, True), fill=AMBER, anchor="mm")
    for i, t in enumerate(["Express 应用进程", "JWT 鉴权中间件", "业务服务层", "Repository 数据访问"]):
        box(d, 885, 268 + i * 56, 250, 46, t, AMBER_L, LINE, F(15))
    box(d, 1250, 300, 210, 120, "MySQL 8.0\n数据库 exam_system", "white", PURPLE, F(17))
    arrow(d, (280, 360), (398, 360), color=LINE)
    d.text((339, 340), "HTTPS", font=F(14), fill=MUTED, anchor="mm")
    arrow(d, (730, 360), (858, 360), color=LINE)
    d.text((794, 340), "HTTP/JSON", font=F(14), fill=MUTED, anchor="mm")
    arrow(d, (1160, 360), (1248, 360), color=LINE)
    d.text((1204, 340), "TCP 3306", font=F(14), fill=MUTED, anchor="mm")
    d.text((750, 660), "开发环境：Vite Dev Server :5173 通过 proxy 将 /api 转发至 :3000", font=F(16), fill=MUTED, anchor="mm")
    img.save(os.path.join(OUT, "fig-4-2-deploy.png"))


# ---------------------------------------------------------------- 图 4-3 ER
def fig_er():
    W, H = 1520, 1080
    img, d = canvas(W, H)
    title(d, "数据库 ER 图", W)
    ents = {
        "users": (60, 90, 300, ["id PK", "username", "password_hash", "real_name", "role", "status"]),
        "courses": (600, 90, 300, ["id PK", "name", "code", "teacher_id FK", "description"]),
        "questions": (1140, 90, 300, ["id PK", "course_id FK", "type", "stem", "answer", "score"]),
        "exams": (600, 400, 300, ["id PK", "course_id FK", "title", "start_time", "duration_min", "status"]),
        "exam_questions": (1140, 400, 300, ["id PK", "exam_id FK", "question_id FK", "score", "sort_order"]),
        "exam_students": (60, 660, 300, ["id PK", "exam_id FK", "student_id FK"]),
        "attempts": (600, 740, 300, ["id PK", "exam_id FK", "student_id FK", "status", "deadline_at", "total_score"]),
        "answers": (1140, 740, 300, ["id PK", "attempt_id FK", "question_id FK", "answer", "score", "comment"]),
    }
    for name, (x, y, w, fields) in ents.items():
        h = 44 + len(fields) * 30 + 12
        d.rounded_rectangle([x, y, x + w, y + 40], radius=8, fill=BLUE_L, outline=BLUE, width=2)
        d.text((x + w / 2, y + 20), name, font=F(18, True), fill=(30, 58, 138), anchor="mm")
        d.rounded_rectangle([x, y + 40, x + w, y + h], radius=8, fill="white", outline=BLUE, width=2)
        for i, f_ in enumerate(fields):
            d.text((x + 16, y + 58 + i * 30), f_, font=F(15), fill=INK, anchor="lt")

    def poly(points, ca, cb):
        for i in range(len(points) - 1):
            d.line([points[i], points[i + 1]], fill=(100, 116, 139), width=2)
        # 在终点补箭头
        arrow(d, points[-2], points[-1], color=(100, 116, 139), head=9)
        d.text((ca[0] + 8, ca[1] - 12), "1", font=F(15, True), fill=RED, anchor="mm")
        d.text((cb[0] + 8, cb[1] - 12), "N", font=F(15, True), fill=RED, anchor="mm")

    poly([(360, 210), (598, 210)], (360, 210), (598, 210))                      # users - courses
    poly([(900, 210), (1138, 210)], (900, 210), (1138, 210))                    # courses - questions
    poly([(750, 330), (750, 398)], (750, 330), (750, 398))                      # courses - exams
    poly([(900, 520), (1138, 520)], (900, 520), (1138, 520))                    # exams - exam_questions
    poly([(1290, 360), (1290, 398)], (1290, 360), (1290, 398))                  # questions - exam_questions
    poly([(210, 340), (210, 658)], (210, 340), (210, 658))                      # users - exam_students
    poly([(600, 560), (440, 560), (440, 700), (362, 700)], (600, 560), (362, 700))  # exams - exam_students
    poly([(750, 670), (750, 738)], (750, 670), (750, 738))                      # exams - attempts
    poly([(360, 300), (500, 300), (500, 880), (598, 880)], (360, 300), (598, 880))   # users - attempts
    poly([(900, 860), (1138, 860)], (900, 860), (1138, 860))                    # attempts - answers
    poly([(1440, 300), (1480, 300), (1480, 860), (1442, 860)], (1440, 300), (1442, 860))  # questions - answers
    img.save(os.path.join(OUT, "fig-4-3-er.png"))


# ---------------------------------------------------------------- 时序图工具
def sequence(name, fig_title, actors, msgs, W=1500):
    H = 130 + 56 + 100 + len(msgs) * 46 + 70
    img, d = canvas(W, H)
    title(d, fig_title, W)
    n = len(actors)
    left, right = 120, W - 120
    xs = [left + i * (right - left) / (n - 1) for i in range(n)]
    top = 130
    for i, a in enumerate(actors):
        box(d, xs[i] - 85, top, 170, 56, a, BLUE_L, BLUE, F(16, True), color=(30, 58, 138))
        d.line([xs[i], top + 56, xs[i], H - 50], fill=(203, 213, 225), width=2)
    y = top + 90
    for (src, dst, text_, kind) in msgs:
        x1, x2 = xs[src], xs[dst]
        color = (100, 116, 139) if kind == "sync" else (5, 150, 105)
        if abs(x2 - x1) < 2:
            d.line([x1, y, x1 + 90, y], fill=color, width=2)
            d.polygon([(x1 + 90, y), (x1 + 76, y - 5), (x1 + 76, y + 5)], fill=color)
            d.line([x1, y, x1, y + 26], fill=color, width=2)
            d.line([x1, y + 26, x1 + 70, y + 26], fill=color, width=2)
            d.text((x1 + 100, y - 12), text_, font=F(15), fill=INK, anchor="lt")
            y += 48
            continue
        arrow(d, (x1, y), (x2, y), color=color, width=2, head=8, dashed=(kind == "ret"))
        mid = (x1 + x2) / 2
        f = F(15)
        tw = d.textlength(text_, font=f)
        d.rectangle([mid - tw / 2 - 6, y - 26, mid + tw / 2 + 6, y - 2], fill="white")
        d.text((mid, y - 14), text_, font=f, fill=INK, anchor="mm")
        y += 46
    d.text((W / 2, H - 26), "实线：请求调用　虚线：返回结果", font=F(14), fill=MUTED, anchor="mm")
    img.save(os.path.join(OUT, name))


def fig_seq_login():
    sequence("fig-4-4-sequence-login.png", "登录鉴权时序图",
             ["浏览器", "React 页面", "Axios 封装", "Express 路由", "认证服务", "MySQL"],
             [(0, 1, "输入账号密码", "sync"), (1, 2, "login(username, password)", "sync"),
              (2, 3, "POST /api/auth/login", "sync"), (3, 4, "verifyCredentials()", "sync"),
              (4, 5, "SELECT … FROM users WHERE username=?", "sync"),
              (5, 4, "用户记录（含 password_hash）", "ret"), (4, 4, "bcrypt.compare + 签发 JWT(8h)", "self"),
              (3, 4, "用户不存在 / 密码错误", "ret"), (4, 3, "{ token, user }", "ret"),
              (3, 2, "200 { code:0, data }", "ret"), (2, 1, "写入 localStorage", "ret"),
              (1, 0, "按角色跳转 / 提示错误", "ret")])


def fig_seq_exam():
    sequence("fig-4-5-sequence-exam.png", "开考、自动保存与交卷判分时序图",
             ["学生", "答题页面", "API 服务", "答卷服务", "判分模块", "MySQL"],
             [(0, 1, "点击「开始考试」", "sync"), (1, 2, "POST /exams/:id/attempts", "sync"),
              (2, 3, "startAttempt()", "sync"), (3, 5, "INSERT attempts(deadline_at)", "sync"),
              (5, 3, "attempt_id", "ret"), (2, 1, "{ attemptId, deadlineAt }", "ret"),
              (1, 2, "GET /attempts/:id（试卷，去除答案）", "sync"), (2, 1, "题目 + 已保存答案", "ret"),
              (1, 2, "PUT /attempts/:id/answers（防抖 400ms）", "sync"),
              (2, 5, "UPSERT answers", "sync"), (2, 1, "已保存 12:03:45", "ret"),
              (1, 2, "POST /attempts/:id/submit", "sync"), (2, 4, "gradeObjective()", "sync"),
              (4, 5, "UPDATE answers / attempts", "sync"), (4, 2, "总分 / 待阅主观题", "ret"),
              (2, 1, "{ totalScore, subjectivePending }", "ret"), (1, 0, "跳转成绩页", "ret")])


# ---------------------------------------------------------------- 界面示意
def browser_frame(d, x, y, w, h, url):
    d.rounded_rectangle([x, y, x + w, y + h], radius=10, fill="white", outline=(203, 213, 225), width=2)
    d.rounded_rectangle([x, y, x + w, y + 42], radius=10, fill=GREY_L, outline=(203, 213, 225), width=2)
    for i, c in enumerate([(248, 113, 113), (251, 191, 36), (52, 211, 153)]):
        d.ellipse([x + 14 + i * 20, y + 15, x + 26 + i * 20, y + 27], fill=c)
    d.rounded_rectangle([x + 90, y + 10, x + w - 20, y + 32], radius=8, fill="white", outline=(229, 231, 235), width=1)
    d.text((x + 104, y + 21), url, font=F(13), fill=MUTED, anchor="lm")


def fig_ui_answer():
    W, H = 1500, 960
    img, d = canvas(W, H)
    title(d, "在线答题界面示意图", W)
    browser_frame(d, 60, 90, 1380, 800, "http://localhost:5173/student/exam/2")
    # 顶部信息条
    d.rectangle([62, 132, 1438, 196], fill=(30, 58, 138))
    d.text((90, 164), "《数据库系统原理》期中考试", font=F(22, True), fill="white", anchor="lm")
    d.rounded_rectangle([1180, 146, 1400, 182], radius=8, fill=(239, 68, 68))
    d.text((1290, 164), "剩余 42:18", font=F(18, True), fill="white", anchor="mm")
    # 左侧题目区
    d.rounded_rectangle([90, 220, 980, 850], radius=10, fill="white", outline=(229, 231, 235), width=2)
    d.text((118, 252), "第 3 题 / 共 10 题　多选题　5 分", font=F(16), fill=MUTED, anchor="lm")
    d.text((118, 292), "3. 下列关于 InnoDB 的说法，正确的有（　　）", font=F(21, True), fill=INK, anchor="lm")
    opts = ["A. 支持事务与行级锁", "B. 使用聚簇索引组织数据", "C. 不支持外键约束", "D. 支持 MVCC 一致性读"]
    for i, o in enumerate(opts):
        y = 350 + i * 76
        fill = BLUE_L if i in (0, 3) else "white"
        d.rounded_rectangle([118, y, 950, y + 60], radius=8, fill=fill, outline=BLUE if i in (0, 3) else (229, 231, 235), width=2)
        d.text((140, y + 30), o, font=F(18), fill=INK, anchor="lm")
        if i in (0, 3):
            d.ellipse([906, y + 18, 930, y + 42], fill=BLUE)
            d.line([911, y + 30, 916, y + 35], fill="white", width=3)
            d.line([916, y + 35, 926, y + 23], fill="white", width=3)
    d.text((118, 700), "已保存 12:03:45", font=F(15), fill=GREEN, anchor="lm")
    d.rounded_rectangle([118, 740, 300, 796], radius=8, fill="white", outline=(203, 213, 225), width=2)
    d.text((209, 768), "上一题", font=F(18), fill=INK, anchor="mm")
    d.rounded_rectangle([760, 740, 950, 796], radius=8, fill=BLUE)
    d.text((855, 768), "下一题", font=F(18), fill="white", anchor="mm")
    # 右侧答题卡
    d.rounded_rectangle([1010, 220, 1410, 850], radius=10, fill="white", outline=(229, 231, 235), width=2)
    d.text((1038, 252), "答题卡", font=F(20, True), fill=INK, anchor="lm")
    for i in range(10):
        r, c = divmod(i, 5)
        x = 1040 + c * 68
        y = 300 + r * 68
        done = i in (0, 1, 3, 5)
        fill = BLUE if done else "white"
        d.rounded_rectangle([x, y, x + 52, y + 52], radius=8, fill=fill, outline=BLUE if done else (203, 213, 225), width=2)
        d.text((x + 26, y + 26), str(i + 1), font=F(17, True), fill="white" if done else INK, anchor="mm")
    d.rounded_rectangle([1040, 460, 1380, 520], radius=8, fill="white", outline=(229, 231, 235), width=1)
    d.text((1060, 490), "已答 4　未答 6", font=F(15), fill=MUTED, anchor="lm")
    d.rounded_rectangle([1040, 760, 1380, 820], radius=8, fill=AMBER)
    d.text((1210, 790), "交 卷", font=F(20, True), fill="white", anchor="mm")
    img.save(os.path.join(OUT, "fig-5-1-ui-answer.png"))


def fig_ui_stats():
    W, H = 1500, 960
    img, d = canvas(W, H)
    title(d, "成绩统计界面示意图", W)
    browser_frame(d, 60, 90, 1380, 800, "http://localhost:5173/teacher/stats")
    d.text((90, 160), "《数据库系统原理》期中考试 · 成绩统计", font=F(24, True), fill=INK, anchor="lm")
    cards = [("参考人数", "48"), ("平均分", "76.4"), ("最高分", "98"), ("最低分", "41"), ("及格率", "83.3%")]
    for i, (k, v) in enumerate(cards):
        x = 90 + i * 266
        d.rounded_rectangle([x, 200, x + 240, 320], radius=10, fill="white", outline=(229, 231, 235), width=2)
        d.text((x + 24, 232), k, font=F(15), fill=MUTED, anchor="lm")
        d.text((x + 24, 278), v, font=F(30, True), fill=BLUE, anchor="lm")
    # 柱状图
    d.rounded_rectangle([90, 350, 780, 850], radius=10, fill="white", outline=(229, 231, 235), width=2)
    d.text((114, 382), "分数段分布", font=F(18, True), fill=INK, anchor="lm")
    base = 800
    data = [("0-59", 8, 60), ("60-69", 9, 120), ("70-79", 14, 210), ("80-89", 12, 180), ("90-100", 5, 90)]
    for i, (label, cnt, h) in enumerate(data):
        x = 150 + i * 125
        d.rectangle([x, base - h, x + 70, base], fill=BLUE if i < 4 else GREEN)
        d.text((x + 35, base - h - 18), str(cnt), font=F(16, True), fill=INK, anchor="mm")
        d.text((x + 35, base + 24), label, font=F(14), fill=MUTED, anchor="mm")
    d.line([130, base, 750, base], fill=LINE, width=2)
    # 表格
    d.rounded_rectangle([810, 350, 1410, 850], radius=10, fill="white", outline=(229, 231, 235), width=2)
    d.text((834, 382), "题目正确率（节选）", font=F(18, True), fill=INK, anchor="lm")
    rows = [("题号", "题型", "正确率", "平均分"), ("1", "单选", "92%", "1.84"), ("2", "单选", "78%", "1.56"),
            ("3", "多选", "54%", "2.16"), ("4", "判断", "88%", "1.76"), ("5", "简答", "71%", "7.10")]
    for r, row in enumerate(rows):
        y = 420 + r * 56
        if r == 0:
            d.rectangle([834, y, 1386, y + 48], fill=GREY_L)
        for c, cell in enumerate(row):
            d.text((850 + c * 140, y + 24), cell, font=F(16, True if r == 0 else False), fill=INK, anchor="lm")
        d.line([834, y + 52, 1386, y + 52], fill=(229, 231, 235), width=1)
    img.save(os.path.join(OUT, "fig-5-2-ui-stats.png"))


if __name__ == "__main__":
    fig_usecase()
    fig_module()
    fig_arch()
    fig_deploy()
    fig_er()
    fig_seq_login()
    fig_seq_exam()
    fig_ui_answer()
    fig_ui_stats()
    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        print(f, os.path.getsize(p) // 1024, "KB")
