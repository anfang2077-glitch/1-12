# 项目基线规格书（Single Source of Truth）

> 本文件由「项目经理（人类用户 + 编排 Agent）」维护，是所有角色的唯一事实来源。
> 任何角色产出的文档、接口、代码若与本文件冲突，以本文件为准；确需变更须在 `00-team/协作日志.md` 记录变更单。

## 1. 项目基本信息

| 项 | 内容 |
|---|---|
| 中文题目 | 基于 React + Node.js 的在线考试系统设计与实现 |
| 英文题目 | Design and Implementation of an Online Examination System Based on React and Node.js |
| 方向 | 全栈 Web 系统 |
| 前端技术栈 | React 18 + Vite 5 + React Router 6 + Axios + 原生 CSS（不引入 UI 组件库） |
| 后端技术栈 | Node.js 20+ + Express 4 + JWT + bcryptjs + zod 风格手写校验 |
| 数据库 | MySQL 8.0（`utf8mb4`，InnoDB）；测试环境使用同接口的内存仓储（Repository 双实现） |
| 系统角色 | 管理员 admin / 教师 teacher / 学生 student |
| 核心功能 | 用户与课程管理、题库管理、组卷与考试发布、在线答题（自动保存/倒计时/断线恢复）、自动+人工阅卷、成绩统计与分析 |
| 代码根目录 | `E:\shiyan\1-12\exam-system\code` |
| 文档根目录 | `E:\shiyan\1-12\exam-system` |

## 2. 建设目标与范围

### 2.1 目标
1. 支撑一门课程从「建课 → 建题库 → 组卷 → 发布 → 学生答题 → 阅卷 → 成绩分析」的完整闭环。
2. 客观题（单选/多选/判断）自动判分，主观题（简答）人工阅卷，成绩实时汇总。
3. 答题过程具备自动保存、倒计时、超时自动交卷、断线恢复能力。
4. 提供可量化的统计：平均分、最高/最低分、及格率、分数段分布、题目正确率。

### 2.2 范围内（In Scope）
- 三类角色的登录鉴权与基于角色的访问控制（RBAC）。
- 题库 CRUD + 批量导入（JSON）。
- 组卷（手动选题、逐题分值）、发布、考生指派。
- 学生在线答题、自动保存、交卷、成绩查询与解析查看。
- 教师阅卷、成绩统计；管理员全局概览。
- 单元测试 + 接口集成测试 ≥ 40 个用例、行覆盖率 ≥ 70%。

### 2.3 范围外（Out of Scope，论文中需在「不足与展望」说明）
- 防作弊（摄像头监考、切屏检测、人脸识别）不实现，仅做基础约束（一人一卷、时限、服务端时间校验）。
- 移动端小程序、离线考试、多租户 SaaS、消息推送、AI 自动批改主观题。
- 富文本公式编辑（题干为纯文本 + 选项文本）。

## 3. 角色与权限矩阵

| 功能 | 管理员 | 教师 | 学生 |
|---|:--:|:--:|:--:|
| 用户管理（增删改查、重置密码、禁用） | ✅ | ❌ | ❌ |
| 课程管理 | ✅ 全部 | ✅ 本人课程 | 👁 只读 |
| 题库管理 | ✅ 全部 | ✅ 本人课程 | ❌ |
| 组卷 / 发布 / 指派考生 | ✅ | ✅ 本人课程 | ❌ |
| 在线答题 / 交卷 | ❌ | ❌ | ✅ 被指派且进行中 |
| 阅卷（主观题打分） | ✅ | ✅ 本人课程 | ❌ |
| 成绩统计 | ✅ 全局 | ✅ 本人课程 | 👁 本人成绩 |
| 查看试题答案与解析 | ✅ | ✅ | 仅交卷后 |

## 4. 数据模型（MySQL 8.0）

库名 `exam_system`，字符集 `utf8mb4_general_ci`。主键统一 `BIGINT UNSIGNED AUTO_INCREMENT`，时间统一 `DATETIME`，布尔用 `TINYINT(1)`，金额/分数用 `DECIMAL(6,2)`。

### 4.1 users 用户表
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AI | |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 登录名（学号/工号） |
| password_hash | VARCHAR(100) | NOT NULL | bcrypt，cost=10 |
| real_name | VARCHAR(50) | NOT NULL | 真实姓名 |
| role | ENUM('admin','teacher','student') | NOT NULL | 角色 |
| email | VARCHAR(100) | NULL | |
| status | TINYINT(1) | DEFAULT 1 | 1 启用 / 0 禁用 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### 4.2 courses 课程表
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| name | VARCHAR(100) | NOT NULL | 课程名 |
| code | VARCHAR(30) | UNIQUE, NOT NULL | 课程代码 |
| description | VARCHAR(500) | NULL | |
| teacher_id | BIGINT UNSIGNED | FK→users.id, NOT NULL | 任课教师 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### 4.3 questions 题库表
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| course_id | BIGINT UNSIGNED | FK→courses.id, NOT NULL | |
| type | ENUM('single','multiple','judge','short') | NOT NULL | 单选/多选/判断/简答 |
| stem | VARCHAR(1000) | NOT NULL | 题干 |
| options | JSON | NULL | `[{"key":"A","text":"..."}]`，简答为 NULL |
| answer | JSON | NOT NULL | single:`"A"`；multiple:`["A","C"]`；judge:`"T"`/`"F"`；short:`"参考答案文本"` |
| score | DECIMAL(6,2) | NOT NULL | 建议分值（组卷可覆盖） |
| difficulty | TINYINT | NOT NULL DEFAULT 3 | 1~5 |
| knowledge_point | VARCHAR(100) | NULL | 知识点 |
| analysis | VARCHAR(1000) | NULL | 解析 |
| creator_id | BIGINT UNSIGNED | FK→users.id | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### 4.4 exams 考试表
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| title | VARCHAR(150) | NOT NULL | |
| course_id | BIGINT UNSIGNED | FK→courses.id | |
| description | VARCHAR(500) | NULL | |
| start_time / end_time | DATETIME | NOT NULL | 考试窗口 |
| duration_min | INT | NOT NULL | 时长（分钟） |
| total_score | DECIMAL(6,2) | NOT NULL | 试卷总分（由题目分值累加） |
| pass_score | DECIMAL(6,2) | NOT NULL | 及格线 |
| shuffle | TINYINT(1) | DEFAULT 0 | 是否乱序（按 attempt 固定种子） |
| status | ENUM('draft','published','closed') | DEFAULT 'draft' | |
| created_by | BIGINT UNSIGNED | FK→users.id | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### 4.5 exam_questions 试卷题目表
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| exam_id | BIGINT UNSIGNED | FK→exams.id ON DELETE CASCADE | |
| question_id | BIGINT UNSIGNED | FK→questions.id | |
| score | DECIMAL(6,2) | NOT NULL | 该题在本卷分值 |
| sort_order | INT | NOT NULL | 题序 |
| UNIQUE(exam_id, question_id) | | | 同卷不重复 |

### 4.6 exam_students 考生指派表
| 字段 | 类型 | 约束 |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| exam_id | BIGINT UNSIGNED | FK→exams.id ON DELETE CASCADE |
| student_id | BIGINT UNSIGNED | FK→users.id |
| UNIQUE(exam_id, student_id) | | |

### 4.7 attempts 答卷（考试记录）表
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| exam_id | BIGINT UNSIGNED | FK→exams.id | |
| student_id | BIGINT UNSIGNED | FK→users.id | |
| started_at | DATETIME | NOT NULL | 开考时间 |
| submitted_at | DATETIME | NULL | 交卷时间 |
| deadline_at | DATETIME | NOT NULL | 服务端计算的截止时间 = min(started_at+duration, exam.end_time) |
| status | ENUM('in_progress','submitted','graded') | DEFAULT 'in_progress' | |
| objective_score | DECIMAL(6,2) | DEFAULT 0 | 客观题得分 |
| subjective_score | DECIMAL(6,2) | DEFAULT 0 | 主观题得分 |
| total_score | DECIMAL(6,2) | DEFAULT 0 | 总分 |
| UNIQUE(exam_id, student_id) | | | 一人一卷 |

### 4.8 answers 答题明细表
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| attempt_id | BIGINT UNSIGNED | FK→attempts.id ON DELETE CASCADE | |
| question_id | BIGINT UNSIGNED | FK→questions.id | |
| answer | JSON | NULL | 学生作答 |
| score | DECIMAL(6,2) | DEFAULT 0 | 本题得分 |
| comment | VARCHAR(500) | NULL | 评语 |
| graded_by | BIGINT UNSIGNED | NULL | 阅卷人 |
| graded_at | DATETIME | NULL | |
| UNIQUE(attempt_id, question_id) | | | |

## 5. API 契约（必须严格实现）

### 5.1 通用约定
- Base URL：`http://localhost:3000/api`；所有请求/响应 `application/json; charset=utf-8`。
- 鉴权：除 `POST /auth/login` 外，均需 `Authorization: Bearer <JWT>`；JWT payload `{ sub, username, role }`，有效期 8h。
- 成功响应：`{ "code": 0, "message": "ok", "data": <payload> }`，HTTP 200/201。
- 失败响应：`{ "code": <业务码>, "message": "<中文提示>" }`，HTTP 400/401/403/404/409/500。
  业务码：40001 参数错误、40101 未登录/令牌失效、40301 无权限、40401 资源不存在、40901 状态冲突、50001 服务器内部错误。
- 分页响应：`{ "list": [...], "total": 123, "page": 1, "pageSize": 10 }`。
- 时间格式：`YYYY-MM-DD HH:mm:ss`（后端统一序列化，前端直接展示）。

### 5.2 认证
| 方法 | 路径 | 权限 | 请求 | 响应 data |
|---|---|---|---|---|
| POST | /auth/login | 公开 | `{username, password}` | `{token, user:{id,username,realName,role,email}}` |
| GET | /auth/me | 登录 | — | `user` |

### 5.3 用户管理
| 方法 | 路径 | 权限 |
|---|---|---|
| GET | /users?role=&keyword=&page=&pageSize= | admin |
| POST | /users `{username,password,realName,role,email}` | admin |
| PUT | /users/:id `{realName?,email?,status?,password?}` | admin |
| DELETE | /users/:id | admin |

### 5.4 课程
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | /courses | 登录 | admin 全部；teacher 本人；student 全部 |
| POST | /courses `{name,code,description,teacherId?}` | admin/teacher | teacher 创建时 teacherId 强制为自己 |
| PUT | /courses/:id | admin/teacher(本人) | |
| DELETE | /courses/:id | admin | 有题目/考试时返回 40901 |

### 5.5 题库
| 方法 | 路径 | 权限 |
|---|---|---|
| GET | /questions?courseId=&type=&difficulty=&keyword=&page=&pageSize= | teacher/admin |
| POST | /questions `{courseId,type,stem,options?,answer,score,difficulty,knowledgePoint?,analysis?}` | teacher/admin |
| PUT | /questions/:id | teacher/admin |
| DELETE | /questions/:id | teacher/admin |
| POST | /questions/import `{courseId, questions:[...]}` | teacher/admin | → `{imported, failed:[{index,reason}]}` |

答案校验规则：single 为 `A~F` 单字母；multiple 为 ≥2 个不重复字母数组；judge 为 `"T"`/`"F"`；short 为非空字符串 ≤500 字。options 对 single/multiple 必填 ≥2 项且 key 唯一；judge/short 忽略 options。

### 5.6 考试
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | /exams?status=&courseId= | teacher/admin | 教师仅本人课程 |
| POST | /exams | teacher/admin | `{title,courseId,description?,startTime,endTime,durationMin,passScore,shuffle?,questions:[{questionId,score}]}` |
| GET | /exams/:id | teacher/admin | 含题目（带答案、解析）与指派人数 |
| PUT | /exams/:id | teacher/admin | 仅 draft 可改，返回 40901 否则 |
| DELETE | /exams/:id | teacher/admin | 仅 draft |
| POST | /exams/:id/publish | teacher/admin | 校验：有题、总分>0、及格线≤总分、开始时间<结束时间；状态→published |
| POST | /exams/:id/assign | teacher/admin | `{studentIds:[1,2]}` 覆盖式指派 |
| GET | /exams/available | student | 已发布且被指派的考试 + `attemptStatus` |
| GET | /exams/:id/paper | student | 无 `answer`/`analysis` 的试卷 + `attempt`（若有） |
| POST | /exams/:id/attempts | student | 开考，返回 `{attemptId, deadlineAt, remainingSeconds}`；重复开考返回原答卷 |

### 5.7 答题与交卷
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | /attempts/:id | student(本人)/teacher | 含题目、已保存答案、剩余秒数；超时未交自动交卷 |
| PUT | /attempts/:id/answers | student(本人) | `{questionId, answer}` 单题自动保存；交卷后 40901 |
| POST | /attempts/:id/submit | student(本人) | 自动判客观题，返回 `{totalScore, objectiveScore, subjectivePending}` |
| GET | /attempts/:id/result | student(本人)/teacher/admin | 交卷后可见：逐题得分、正确答案、解析、评语 |

### 5.8 阅卷
| 方法 | 路径 | 权限 |
|---|---|---|
| GET | /grading/pending?examId= | teacher/admin | 待阅列表 `[{attemptId, studentName, submittedAt, pendingCount}]` |
| GET | /grading/:attemptId | teacher/admin | 答卷详情（含参考答案与学生作答） |
| POST | /grading/:attemptId | teacher/admin | `{items:[{questionId,score,comment?}]}`，重算总分，状态→graded |

### 5.9 统计
| 方法 | 路径 | 权限 | data |
|---|---|---|---|
| GET | /stats/overview | admin | `{userCount, teacherCount, studentCount, courseCount, questionCount, examCount, attemptCount}` |
| GET | /stats/exams | teacher/admin | 考试列表及各场次统计摘要 |
| GET | /stats/exams/:id | teacher/admin | `{title, count, avg, max, min, passRate, distribution:[{label,count}], questions:[{questionId,stem,type,accuracy,avgScore}]}` |
| GET | /stats/students/:id | student(本人)/teacher | 本人历次成绩列表与平均分 |

`distribution` 固定 5 段：`[0,60)` `[60,70)` `[70,80)` `[80,90)` `[90,100]`，按百分制折算（得分/总分×100）。
`count` 仅统计 `submitted` 与 `graded` 状态答卷。

## 6. 代码结构与工程约定

```
code/
├─ server/                       # 后端
│  ├─ src/
│  │  ├─ app.js                  # createApp(deps) 工厂，供 supertest 使用
│  │  ├─ index.js                # 启动入口：读 .env、连 MySQL、监听
│  │  ├─ config.js               # 环境配置
│  │  ├─ db/mysql.js             # mysql2 连接池
│  │  ├─ db/schema.sql           # 建库建表 + 种子数据
│  │  ├─ db/seed.js              # 种子脚本（密码 bcrypt）
│  │  ├─ repositories/           # 数据访问层（接口 + mysql 实现 + memory 实现）
│  │  ├─ services/               # 业务逻辑（判分、状态机、统计）
│  │  ├─ routes/                 # 路由 + 中间件装配
│  │  ├─ controllers/            # 请求校验与响应封装
│  │  ├─ middlewares/            # auth(role)、errorHandler、requestId
│  │  └─ utils/                  # jwt、password、answer、time、pick
│  ├─ tests/                     # jest + supertest
│  ├─ package.json               # scripts: start, dev, test, test:coverage
│  └─ .env.example
└─ web/                          # 前端
   ├─ src/
   │  ├─ main.jsx / App.jsx      # 路由与角色守卫
   │  ├─ api/client.js           # axios 实例、拦截器、统一错误提示
   │  ├─ api/*.js                # 按域拆分接口函数
   │  ├─ contexts/AuthContext.jsx
   │  ├─ components/             # Layout、ProtectedRoute、Table、Modal、Countdown 等
   │  ├─ pages/                  # login / admin / teacher / student / common
   │  └─ styles.css
   ├─ index.html
   └─ vite.config.js             # 代理 /api → localhost:3000
```

工程要求：
- 后端不引入 ORM，使用 `mysql2/promise` 参数化查询，杜绝 SQL 拼接注入。
- 数据访问抽象为 Repository 接口，`MYSQL_DRIVER=memory` 时装配内存实现，使测试无需真实数据库。
- 所有写操作在 service 层做权限与状态校验，controller 只做参数校验。
- 前端不得出现硬编码的 mock 数据；所有数据经 `api/` 层获取。
- 统一错误提示 `message` 直接用后端返回的中文 message。

## 7. 质量门禁（验收标准）

| 门禁 | 标准 | 责任角色 |
|---|---|---|
| G1 需求 | 三类角色 100% 功能覆盖，≥20 条需求且全部可追踪到设计与测试 | 需求分析师 |
| G2 设计 | 架构图/ER 图/时序图齐全，API 契约与实现一致率 100% | 系统架构师 |
| G3 后端 | `npm test` 全绿，用例 ≥40，行覆盖率 ≥70%（`npm run test:coverage`） | 后端开发者 |
| G4 前端 | `npm run build` 成功，无未使用 mock，路由覆盖全部页面 | 前端开发者 |
| G5 测试 | 测试报告含真实执行输出、缺陷记录与回归结论 | 测试工程师 |
| G6 论文 | 6 章结构完整，≥15000 字，图表 ≥8，参考文献 ≥20，与代码一致 | 论文撰写者 |
| G7 答辩 | PPT 14~16 页，演示脚本按分钟编排，预测问答 ≥20 条 | 答辩助手 |

## 8. 演示账号（种子数据）

| 角色 | 账号 | 密码 |
|---|---|---|
| 管理员 | admin | Admin@123 |
| 教师 | teacher01（张老师） | Teach@123 |
| 学生 | student01（李小明） | Stu@123 |

种子数据还需：2 门课程、每门 ≥8 道题（四种题型齐全）、2 场考试（1 场已发布并指派 2 名学生、1 场草稿）、1 份已交卷待阅答卷。

## 9. 术语表

| 术语 | 含义 |
|---|---|
| 组卷 | 从题库选题并设定每题分值，生成一份试卷 |
| 答卷（attempt） | 某个学生对某场考试的一次作答记录，全系统一人一卷 |
| 自动保存 | 学生每次选择答案即调用 `PUT /attempts/:id/answers` 持久化 |
| 客观题 | single/multiple/judge，可程序判分 |
| 主观题 | short，需教师人工给分 |
