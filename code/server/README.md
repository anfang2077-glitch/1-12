# 在线考试系统 · 后端服务（server）

基于 **Node.js + Express 4 + MySQL 8** 的在线考试系统后端，严格实现 `00-team/project-brief.md` 第 5 节 API 契约（B01~B36，共 36 条），并提供 **MySQL 与内存仓储双实现**：无数据库环境下也能完整演示与运行测试。

## 1. 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Node.js 20+（本机验证 v24） |
| Web 框架 | Express **4.x** |
| 数据库 | MySQL 8.0（`utf8mb4` / InnoDB），`mysql2/promise` 参数化查询 |
| 鉴权 | jsonwebtoken（HS256，8 小时） |
| 密码 | bcryptjs（cost=10） |
| 跨域 / 配置 | cors / dotenv |
| 测试 | jest + supertest（内存仓储，无需 MySQL） |

## 2. 快速开始

### 2.1 安装依赖

```bash
cd code/server
npm install
```

### 2.2 方式一：内存模式（无需 MySQL，推荐用于演示与测试）

```bash
npm run start:memory
```

启动后自动写入基线第 8 节种子数据（4 个用户、2 门课程、16 道题、2 场考试、1 份已交卷待阅答卷），API 地址：

```
http://localhost:3000/api
```

### 2.3 方式二：MySQL 模式

1. 复制环境变量并填写数据库账号：

```bash
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
```

2. 修改 `MYSQL_DRIVER=mysql` 与 `MYSQL_*` 配置。

3. 建库建表（会删除并重建 8 张业务表，仅用于开发环境）：

```bash
npm run db:init
```

4. 写入种子数据（bcrypt 哈希密码）：

```bash
npm run db:seed
```

5. 启动：

```bash
npm start        # 或 npm run dev（node --watch 热重载）
```

### 2.4 演示账号（基线第 8 节）

| 角色 | 账号 | 密码 |
|---|---|---|
| 管理员 | `admin` | `Admin@123` |
| 教师 | `teacher01` | `Teach@123` |
| 学生 | `student01` | `Stu@123` |
| 学生（种子额外提供，用于指派/统计） | `student02` | `Stu@123` |

登录示例：

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"student01\",\"password\":\"Stu@123\"}"
```

## 3. npm scripts

| 命令 | 说明 |
|---|---|
| `npm start` | 读取 `.env`，按 `MYSQL_DRIVER` 启动（默认 memory） |
| `npm run start:memory` | 强制内存模式并自动写入种子数据 |
| `npm run dev` | `node --watch` 热重载 |
| `npm test` | jest 全量测试（内存仓储，无需 MySQL） |
| `npm run test:coverage` | 测试 + 覆盖率（行覆盖率门槛 70%） |
| `npm run db:init` | 执行 `src/db/schema.sql` 建库建表（破坏性，开发环境用） |
| `npm run db:seed` | 写入种子数据（需 `MYSQL_DRIVER=mysql`） |

## 4. 目录结构

```
server/
├─ src/
│  ├─ app.js                    # createApp(deps) 工厂，供 supertest 注入内存仓储
│  ├─ index.js                  # 启动入口：读 .env / 连 MySQL / 监听
│  ├─ config.js                 # 环境配置归一化
│  ├─ db/
│  │  ├─ mysql.js               # mysql2 连接池 + withTransaction
│  │  ├─ schema.sql             # 8 张表 DDL（索引、外键、唯一约束）
│  │  ├─ seed-data.js           # 种子数据定义（相对当前时间生成考试窗口）
│  │  ├─ seed.js                # 种子写入（bcrypt，仓储通用）
│  │  └─ init.js                # db:init 脚本
│  ├─ repositories/
│  │  ├─ index.js               # 按驱动装配仓储
│  │  ├─ memory/                # 内存实现（测试/演示）
│  │  └─ mysql/                 # MySQL 实现（参数化 SQL）
│  ├─ services/                 # 八大服务 + serializers
│  ├─ controllers/              # 参数校验与响应封装
│  ├─ routes/index.js           # 路由与中间件装配（注意具体路径先注册）
│  ├─ middlewares/              # auth(RBAC)、error、requestId
│  └─ utils/                    # jwt、password、answer、time、response、validate
├─ tests/                       # jest + supertest（10 个测试文件，217 个用例）
├─ package.json
├─ .env.example
└─ README.md
```

## 5. API 一览（36 条，与基线 5.2~5.9 逐条对应）

| 编号 | 方法 | 路径 | 权限 |
|---|---|---|---|
| B01 | POST | `/api/auth/login` | 公开 |
| B02 | GET | `/api/auth/me` | 登录 |
| B03 | GET | `/api/users` | admin |
| B04 | POST | `/api/users` | admin |
| B05 | PUT | `/api/users/:id` | admin |
| B06 | DELETE | `/api/users/:id` | admin |
| B07 | GET | `/api/courses` | 登录 |
| B08 | POST | `/api/courses` | admin/teacher |
| B09 | PUT | `/api/courses/:id` | admin / teacher(本人) |
| B10 | DELETE | `/api/courses/:id` | admin |
| B11 | GET | `/api/questions` | teacher/admin |
| B12 | POST | `/api/questions` | teacher/admin |
| B13 | PUT | `/api/questions/:id` | teacher/admin |
| B14 | DELETE | `/api/questions/:id` | teacher/admin |
| B15 | POST | `/api/questions/import` | teacher/admin |
| B16 | GET | `/api/exams` | teacher/admin |
| B17 | POST | `/api/exams` | teacher/admin |
| B18 | GET | `/api/exams/:id` | teacher/admin |
| B19 | PUT | `/api/exams/:id` | teacher/admin |
| B20 | DELETE | `/api/exams/:id` | teacher/admin |
| B21 | POST | `/api/exams/:id/publish` | teacher/admin |
| B22 | POST | `/api/exams/:id/assign` | teacher/admin |
| B23 | GET | `/api/exams/available` | student |
| B24 | GET | `/api/exams/:id/paper` | student |
| B25 | POST | `/api/exams/:id/attempts` | student |
| B26 | GET | `/api/attempts/:id` | student(本人)/teacher |
| B27 | PUT | `/api/attempts/:id/answers` | student(本人) |
| B28 | POST | `/api/attempts/:id/submit` | student(本人) |
| B29 | GET | `/api/attempts/:id/result` | student(本人)/teacher/admin |
| B30 | GET | `/api/grading/pending` | teacher/admin |
| B31 | GET | `/api/grading/:attemptId` | teacher/admin |
| B32 | POST | `/api/grading/:attemptId` | teacher/admin |
| B33 | GET | `/api/stats/overview` | admin |
| B34 | GET | `/api/stats/exams` | teacher/admin |
| B35 | GET | `/api/stats/exams/:id` | teacher/admin |
| B36 | GET | `/api/stats/students/:id` | student(本人)/teacher |

> 说明：任务书正文提到「40 余个接口」，经逐表清点基线第 5 节为 **36 条**（2+4+4+5+10+4+3+4）。本实现严格遵循「不得增删接口」原则，未编造基线之外的接口。

## 6. 核心业务规则

1. **判分**：单选/判断精确匹配；多选必须与标准答案集合完全一致（少选、多选、错选均 0 分）；简答不自动给分，进入待阅队列。
2. **开考**：仅 `published`、在时间窗内且被指派的学生可开考；`deadline_at = min(now + duration_min, exam.end_time)`；一人一卷，重复开考返回原答卷。
3. **自动保存**：仅 `in_progress` 可写；校验题目属于本卷、作答结构随题型校验；`null` 表示清空。
4. **交卷**：幂等；服务端时间超过 deadline 视为超时自动交卷（`GET /attempts/:id` 与自动保存时触发）；客观题立即判分，有简答题 `status=submitted`，否则 `graded`。
5. **阅卷**：仅已交卷答卷；只能对简答题评分，`0 ≤ score ≤ 该题本卷满分`；汇总重算 objective/subjective/total，状态置 `graded`。
6. **统计**：仅统计 `submitted` / `graded`；分数段按百分制五段；题目正确率按「平均得分 / 满分」计算。
7. **权限**：教师只能操作本人课程下的题库/考试/阅卷；学生只能操作本人答卷；越权返回 `40301`。
8. **安全**：响应永不含 `password_hash`；SQL 全部参数化；JWT 8 小时。

## 7. 错误码

| 业务码 | HTTP | 语义 |
|---|---|---|
| 0 | 200 / 201 | 成功 |
| 40001 | 400 | 参数错误 |
| 40101 | 401 | 未登录 / 令牌失效 |
| 40301 | 403 | 无权限 |
| 40401 | 404 | 资源不存在 |
| 40901 | 409 | 状态冲突 |
| 50001 | 500 | 服务器内部错误 |

失败响应只含 `{ code, message }`；成功响应 `{ code: 0, message: "ok", data }`；分页数据 `{ list, total, page, pageSize }`；时间统一 `YYYY-MM-DD HH:mm:ss`。

## 8. 测试与质量门禁

```bash
npm install
npm test
npm run test:coverage
```

实测结果（2026-10-31，Windows / Node v24.14.1）：

- 测试文件 10 个，用例 **217 个**，全部通过（`Tests: 217 passed, 217 total`）；
- 行覆盖率 **93.60%**（1376/1470），语句覆盖率 90.91%，函数覆盖率 94.14%，分支覆盖率 77.41%，高于 70% 门禁；
- 测试完全运行在内存仓储上，无需 MySQL。

## 9. 已知限制

- MySQL 仓储实现与内存实现同接口，但本机无 MySQL 服务，未执行真实数据库集成测试；上线前需执行 `db:init` / `db:seed` 并做一次冒烟。
- `exams.shuffle` 字段已持久化并按契约返回，服务端未实现乱序发卷（基线未定义具体乱序算法）。
- 超时自动交卷的 `submitted_at` 记录为 `deadline_at`（考试窗口截止时刻），而非检测到超时的服务端时间，以保证成绩归属与考试窗口一致。
- 考试 `passScore > totalScore` 在草稿阶段允许保存，在发布时按基线校验并返回 40001（契约 B17 失败场景表与该接口成功示例存在矛盾，按基线「发布时校验」实现）。
- 批量导入为部分成功语义：非法题目记入 `failed[].index`（从 0 开始），不中断整体。
