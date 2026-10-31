# 在线考试系统 API 契约（明细版）

| 项 | 内容 |
|---|---|
| 文档编号 | SA-API-001 |
| 项目名称 | 基于 React + Node.js 的在线考试系统设计与实现 |
| 编制角色 | 系统架构师（SA） |
| 版本 | v1.0（对应基线 v1.0） |
| 上游输入 | `00-team/project-brief.md` 第 5 节「API 契约」 |
| 下游消费者 | 前端开发者（FE）、后端开发者（BE）、测试工程师（QA） |
| 接口总数 | **36 条**（B01~B36），与基线 5.2~5.9 逐条一一对应，无增删 |

> **契约地位**：本文档与基线第 5 节等价且更细。**路径、方法、字段名、错误码以基线为准**；基线未明确的响应字段、默认值、校验细节由本文档固定（见第 12 节「设计约定」）。前后端实现与本文档不一致即为缺陷（G2 门禁：契约与实现一致率 100%）。

---

## 1 总览

### 1.1 通用信息

| 项 | 值 |
|---|---|
| Base URL | `http://localhost:3000/api` |
| 内容类型 | `Content-Type: application/json; charset=utf-8` |
| 鉴权头 | `Authorization: Bearer <JWT>`（除 B01 外全部必填） |
| JWT payload | `{ sub, username, role }`，有效期 8 小时（HS256） |
| 成功响应 | `{ "code": 0, "message": "ok", "data": ... }`，HTTP 200 / 201 |
| 失败响应 | `{ "code": <业务码>, "message": "<中文提示>" }`，HTTP 400/401/403/404/409/500 |
| 时间格式 | `YYYY-MM-DD HH:mm:ss` |
| 分页响应 | `data` 为 `{ "list": [...], "total": n, "page": 1, "pageSize": 10 }` |
| 请求头建议 | `X-Request-Id` 可选；响应头回带 `X-Request-Id` 便于排错 |

### 1.2 业务码

| 业务码 | HTTP | 语义 | 前端统一处理 |
|---|---|---|---|
| 0 | 200 / 201 | 成功 | 正常渲染 |
| 40001 | 400 | 参数错误 | 表单内联提示，保留输入 |
| 40101 | 401 | 未登录 / 令牌失效 | 清除令牌 → 跳登录页（带 `redirect`） |
| 40301 | 403 | 无权限 | 提示无权限，禁止重试 |
| 40401 | 404 | 资源不存在 | 提示并提供返回列表 |
| 40901 | 409 | 状态冲突 | 提示当前状态，刷新数据 |
| 50001 | 500 | 服务器内部错误 | 提示稍后重试 + 展示 `requestId` |

### 1.3 接口总览（36 条）

| 编号 | 方法 | 路径 | 权限 | 一句话说明 | 基线小节 |
|---|---|---|---|---|---|
| B01 | POST | `/auth/login` | 公开 | 登录换取令牌 | 5.2 |
| B02 | GET | `/auth/me` | 登录 | 当前登录用户 | 5.2 |
| B03 | GET | `/users` | admin | 用户分页列表 | 5.3 |
| B04 | POST | `/users` | admin | 新建用户 | 5.3 |
| B05 | PUT | `/users/:id` | admin | 修改用户 / 重置密码 | 5.3 |
| B06 | DELETE | `/users/:id` | admin | 删除用户 | 5.3 |
| B07 | GET | `/courses` | 登录 | 课程列表（按角色过滤） | 5.4 |
| B08 | POST | `/courses` | admin/teacher | 新建课程 | 5.4 |
| B09 | PUT | `/courses/:id` | admin / teacher(本人) | 修改课程 | 5.4 |
| B10 | DELETE | `/courses/:id` | admin | 删除课程 | 5.4 |
| B11 | GET | `/questions` | teacher/admin | 题库分页列表 | 5.5 |
| B12 | POST | `/questions` | teacher/admin | 新建题目 | 5.5 |
| B13 | PUT | `/questions/:id` | teacher/admin | 修改题目 | 5.5 |
| B14 | DELETE | `/questions/:id` | teacher/admin | 删除题目 | 5.5 |
| B15 | POST | `/questions/import` | teacher/admin | JSON 批量导入 | 5.5 |
| B16 | GET | `/exams` | teacher/admin | 考试列表 | 5.6 |
| B17 | POST | `/exams` | teacher/admin | 组卷创建考试 | 5.6 |
| B18 | GET | `/exams/:id` | teacher/admin | 考试详情（含答案） | 5.6 |
| B19 | PUT | `/exams/:id` | teacher/admin | 修改草稿考试 | 5.6 |
| B20 | DELETE | `/exams/:id` | teacher/admin | 删除草稿考试 | 5.6 |
| B21 | POST | `/exams/:id/publish` | teacher/admin | 发布考试 | 5.6 |
| B22 | POST | `/exams/:id/assign` | teacher/admin | 覆盖式指派考生 | 5.6 |
| B23 | GET | `/exams/available` | student | 可参加的考试 | 5.6 |
| B24 | GET | `/exams/:id/paper` | student | 学生试卷（无答案） | 5.6 |
| B25 | POST | `/exams/:id/attempts` | student | 开考（幂等） | 5.6 |
| B26 | GET | `/attempts/:id` | student(本人)/teacher | 答卷详情 + 剩余秒数 | 5.7 |
| B27 | PUT | `/attempts/:id/answers` | student(本人) | 单题自动保存 | 5.7 |
| B28 | POST | `/attempts/:id/submit` | student(本人) | 交卷 + 自动判分 | 5.7 |
| B29 | GET | `/attempts/:id/result` | student(本人)/teacher/admin | 成绩与解析 | 5.7 |
| B30 | GET | `/grading/pending` | teacher/admin | 待阅列表 | 5.8 |
| B31 | GET | `/grading/:attemptId` | teacher/admin | 阅卷详情 | 5.8 |
| B32 | POST | `/grading/:attemptId` | teacher/admin | 提交评分并重算 | 5.8 |
| B33 | GET | `/stats/overview` | admin | 全局概览 | 5.9 |
| B34 | GET | `/stats/exams` | teacher/admin | 场次统计摘要列表 | 5.9 |
| B35 | GET | `/stats/exams/:id` | teacher/admin | 单场详细统计 | 5.9 |
| B36 | GET | `/stats/students/:id` | student(本人)/teacher | 学生历次成绩 | 5.9 |

### 1.4 路由注册顺序（实现必读）

Express 按注册顺序匹配，以下三条必须先注册具体路径，再注册参数路径，否则 `available`、`pending` 会被当成 `:id`：

```js
// 正确顺序
router.get('/exams/available', ...);      // B23 先
router.get('/exams/:id/paper', ...);      // B24
router.get('/exams/:id', ...);            // B18 后
router.get('/grading/pending', ...);      // B30 先
router.get('/grading/:attemptId', ...);   // B31 后
```

### 1.5 公共响应对象字典

以下对象在各接口中以同名结构出现，字段名即契约。

**PageRes&lt;T&gt;**

| 字段 | 类型 | 说明 |
|---|---|---|
| list | T[] | 当页数据 |
| total | number | 满足条件的总条数 |
| page | number | 当前页码，从 1 开始 |
| pageSize | number | 每页条数 |

**User**（永不含 `password_hash`）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 用户 ID |
| username | string | 登录名 |
| realName | string | 真实姓名 |
| role | string | `admin` / `teacher` / `student` |
| email | string \| null | 邮箱 |
| status | number | 1 启用 / 0 禁用 |
| createdAt | string | `YYYY-MM-DD HH:mm:ss` |

**Course**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 课程 ID |
| name | string | 课程名 |
| code | string | 课程代码 |
| description | string \| null | 简介 |
| teacherId | number | 任课教师 ID |
| teacherName | string | 任课教师姓名（联表字段） |
| createdAt | string | 创建时间 |

**Question**（教师/管理员视图，含答案）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 题目 ID |
| courseId | number | 所属课程 |
| type | string | `single` / `multiple` / `judge` / `short` |
| stem | string | 题干 |
| options | array \| null | `[{"key":"A","text":"..."}]`；judge/short 为 `null` |
| answer | string \| string[] | single `"A"`；multiple `["A","C"]`；judge `"T"`/`"F"`；short 参考答案文本 |
| score | number | 建议分值 |
| difficulty | number | 难度 1~5 |
| knowledgePoint | string \| null | 知识点 |
| analysis | string \| null | 解析 |
| creatorId | number \| null | 创建人 |
| createdAt | string | 创建时间 |

**PaperQuestion**（学生答题视图，**无 answer / analysis**）

| 字段 | 类型 | 说明 |
|---|---|---|
| questionId | number | 题目 ID |
| sortOrder | number | 题序，从 1 开始 |
| score | number | 本卷分值 |
| type | string | 题型 |
| stem | string | 题干 |
| options | array \| null | 选项 |
| savedAnswer | string \| string[] \| null | 已保存作答（仅答题接口返回） |

**Exam**（列表与详情的基础字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 考试 ID |
| title | string | 标题 |
| courseId | number | 课程 ID |
| courseName | string | 课程名（联表字段） |
| description | string \| null | 说明 |
| startTime | string | 开始时间 |
| endTime | string | 结束时间 |
| durationMin | number | 时长（分钟） |
| totalScore | number | 试卷总分 |
| passScore | number | 及格线 |
| shuffle | boolean | 是否乱序 |
| status | string | `draft` / `published` / `closed` |
| createdBy | number | 创建人 |
| questionCount | number | 题目数（联表统计） |
| createdAt | string | 创建时间 |

---

## 2 认证

### B01 登录

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/auth/login` |
| 权限 | 公开（唯一免鉴权接口） |
| 说明 | 校验用户名密码，签发 8 小时 JWT。用户名不存在与密码错误返回同一错误，防账号枚举 |

**请求参数（Body）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| username | string | 是 | 非空，≤50 字符，自动 `trim` |
| password | string | 是 | 非空，≤100 字符，不 `trim`（保留空格语义） |

**请求示例**

```json
{
  "username": "student01",
  "password": "Stu@123"
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInVzZXJuYW1lIjoic3R1ZGVudDAxIiwicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3MzA0MDMyMDAsImV4cCI6MTczMDQzMjAwMH0.7bJ0m0Qx",
    "user": {
      "id": 3,
      "username": "student01",
      "realName": "李小明",
      "role": "student",
      "email": "student01@example.com"
    }
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 缺少 username 或 password | 400 | 40001 | 参数错误：用户名和密码不能为空 |
| username 超长 | 400 | 40001 | 参数错误：用户名长度不能超过 50 |
| 用户不存在 | 401 | 40101 | 用户名或密码错误 |
| 密码错误 | 401 | 40101 | 用户名或密码错误 |
| 账号被禁用（`status=0`） | 403 | 40301 | 该账号已被禁用，请联系管理员 |
| 数据库异常 | 500 | 50001 | 服务器内部错误 |

---

### B02 获取当前用户

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/auth/me` |
| 权限 | 登录（任意角色） |
| 说明 | 前端刷新页面后校验令牌并恢复会话；服务端返回数据库中的最新角色与状态 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Header | Authorization | string | 是 | `Bearer <JWT>` |

**请求示例**

```
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 2,
    "username": "teacher01",
    "realName": "张老师",
    "role": "teacher",
    "email": "teacher01@example.com",
    "status": 1,
    "createdAt": "2026-09-01 09:00:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 缺少 Authorization | 401 | 40101 | 未登录或登录已过期 |
| 令牌签名不符 / 格式错误 | 401 | 40101 | 未登录或登录已过期 |
| 令牌已过期（>8h） | 401 | 40101 | 登录状态已失效，请重新登录 |
| 令牌对应用户已被删除或禁用 | 401 | 40101 | 账号状态异常，请重新登录 |

---

## 3 用户管理

### B03 用户分页列表

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/users` |
| 权限 | admin |
| 说明 | 支持按角色过滤与关键字模糊搜索（username / realName） |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| role | string | 否 | 枚举 `admin` / `teacher` / `student` |
| keyword | string | 否 | ≤50 字符；匹配 `username` 或 `real_name` 的模糊包含 |
| page | number | 否 | 默认 1，≥1 |
| pageSize | number | 否 | 默认 10，1~100 |

**请求示例**

```
GET /api/users?role=student&keyword=李&page=1&pageSize=10
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 3,
        "username": "student01",
        "realName": "李小明",
        "role": "student",
        "email": "student01@example.com",
        "status": 1,
        "createdAt": "2026-09-01 09:10:00"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 非 admin 调用 | 403 | 40301 | 无权限访问该资源 |
| role 非枚举值 | 400 | 40001 | 参数错误：role 取值必须为 admin/teacher/student |
| page / pageSize 非数字或越界 | 400 | 40001 | 参数错误：pageSize 取值范围为 1~100 |
| 未登录 | 401 | 40101 | 未登录或登录已过期 |

---

### B04 新建用户

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/users` |
| 权限 | admin |
| 说明 | 密码以 bcrypt（cost=10）哈希后入库；响应不含密码 |

**请求参数（Body）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| username | string | 是 | 3~50 字符，仅字母/数字/下划线，全局唯一 |
| password | string | 是 | 6~32 字符 |
| realName | string | 是 | 1~50 字符 |
| role | string | 是 | `admin` / `teacher` / `student` |
| email | string | 否 | 合规邮箱，≤100 字符；空字符串视为未提供 |

**请求示例**

```json
{
  "username": "student03",
  "password": "Stu@123",
  "realName": "王小华",
  "role": "student",
  "email": "student03@example.com"
}
```

**成功响应（HTTP 201）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 12,
    "username": "student03",
    "realName": "王小华",
    "role": "student",
    "email": "student03@example.com",
    "status": 1,
    "createdAt": "2026-10-31 16:20:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 必填缺失 | 400 | 40001 | 参数错误：realName 不能为空 |
| username 已存在 | 409 | 40901 | 用户名已存在 |
| password 长度不足 6 | 400 | 40001 | 参数错误：密码长度必须为 6~32 位 |
| role 非法 | 400 | 40001 | 参数错误：角色必须为 admin/teacher/student |
| email 格式错误 | 400 | 40001 | 参数错误：邮箱格式不正确 |
| 非 admin 调用 | 403 | 40301 | 无权限访问该资源 |

---

### B05 修改用户

| 项 | 内容 |
|---|---|
| 方法与路径 | `PUT /api/users/:id` |
| 权限 | admin |
| 说明 | 局部更新：仅更新请求体中出现的字段；传 `password` 即重置密码。不提供修改 `username` 与 `role` 的能力（避免破坏历史归属） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在 |
| Body | realName | string | 否 | 1~50 字符 |
| Body | email | string | 否 | 合规邮箱，≤100 字符；`null` 表示清空 |
| Body | status | number | 否 | 0 或 1；0 表示禁用 |
| Body | password | string | 否 | 6~32 字符，传入即重置 |

**请求示例**

```json
{
  "realName": "李小明",
  "status": 1,
  "password": "NewPass@123"
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 3,
    "username": "student01",
    "realName": "李小明",
    "role": "student",
    "email": "student01@example.com",
    "status": 1,
    "createdAt": "2026-09-01 09:10:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 用户不存在 | 404 | 40401 | 用户不存在 |
| 管理员禁用自己 | 409 | 40901 | 不能禁用当前登录账号 |
| 请求体为空（无任何可更新字段） | 400 | 40001 | 参数错误：没有需要更新的字段 |
| status 非 0/1 | 400 | 40001 | 参数错误：status 只能为 0 或 1 |
| password 长度不足 | 400 | 40001 | 参数错误：密码长度必须为 6~32 位 |
| 非 admin 调用 | 403 | 40301 | 无权限访问该资源 |

---

### B06 删除用户

| 项 | 内容 |
|---|---|
| 方法与路径 | `DELETE /api/users/:id` |
| 权限 | admin |
| 说明 | 物理删除。存在课程、考试、答卷等引用时拒绝删除，避免破坏成绩链 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在 |

**请求示例**

```
DELETE /api/users/12
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": { "id": 12 }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 用户不存在 | 404 | 40401 | 用户不存在 |
| 该用户有课程/考试/答卷等关联数据 | 409 | 40901 | 该用户存在关联数据，无法删除，请先禁用 |
| 删除当前登录账号 | 409 | 40901 | 不能删除当前登录账号 |
| 非 admin 调用 | 403 | 40301 | 无权限访问该资源 |

---

## 4 课程

### B07 课程列表

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/courses` |
| 权限 | 登录（任意角色） |
| 说明 | admin 返回全部；teacher 仅返回 `teacher_id` 为自己的课程；student 返回全部（只读） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Header | Authorization | string | 是 | `Bearer <JWT>` |

**请求示例**

```
GET /api/courses
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": 1,
      "name": "数据结构",
      "code": "CS201",
      "description": "线性表、树、图与常用算法",
      "teacherId": 2,
      "teacherName": "张老师",
      "createdAt": "2026-09-01 09:20:00"
    },
    {
      "id": 2,
      "name": "计算机网络",
      "code": "CS202",
      "description": "TCP/IP 协议栈与网络编程",
      "teacherId": 2,
      "teacherName": "张老师",
      "createdAt": "2026-09-01 09:25:00"
    }
  ]
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 未登录 / 令牌失效 | 401 | 40101 | 未登录或登录已过期 |
| 数据库异常 | 500 | 50001 | 服务器内部错误 |

---

### B08 新建课程

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/courses` |
| 权限 | admin / teacher |
| 说明 | teacher 创建时 `teacherId` 强制为自己（传其他值被忽略）；admin 不传 `teacherId` 时取自身 ID，传了则校验目标必须为 teacher |

**请求参数（Body）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| name | string | 是 | 1~100 字符 |
| code | string | 是 | 2~30 字符，字母/数字/连字符，全局唯一 |
| description | string | 否 | ≤500 字符 |
| teacherId | number | 否 | 正整数，目标用户 `role=teacher`；teacher 调用时忽略 |

**请求示例**

```json
{
  "name": "操作系统",
  "code": "CS203",
  "description": "进程、内存与文件系统"
}
```

**成功响应（HTTP 201）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 3,
    "name": "操作系统",
    "code": "CS203",
    "description": "进程、内存与文件系统",
    "teacherId": 2,
    "teacherName": "张老师",
    "createdAt": "2026-10-31 16:25:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| name / code 缺失 | 400 | 40001 | 参数错误：课程代码不能为空 |
| code 重复 | 409 | 40901 | 课程代码已存在 |
| teacherId 指向的用户不存在或不是教师 | 400 | 40001 | 参数错误：指定的教师不存在 |
| 学生调用 | 403 | 40301 | 无权限访问该资源 |

---

### B09 修改课程

| 项 | 内容 |
|---|---|
| 方法与路径 | `PUT /api/courses/:id` |
| 权限 | admin；teacher（仅本人课程） |
| 说明 | 局部更新；teacher 不可把课程转给他人（`teacherId` 被忽略） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在 |
| Body | name | string | 否 | 1~100 字符 |
| Body | code | string | 否 | 2~30 字符，唯一 |
| Body | description | string | 否 | ≤500 字符 |
| Body | teacherId | number | 否 | 仅 admin 生效 |

**请求示例**

```json
{
  "name": "操作系统（2026 秋）",
  "description": "增加进程调度实验"
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 3,
    "name": "操作系统（2026 秋）",
    "code": "CS203",
    "description": "增加进程调度实验",
    "teacherId": 2,
    "teacherName": "张老师",
    "createdAt": "2026-10-31 16:25:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 课程不存在 | 404 | 40401 | 课程不存在 |
| teacher 修改他人课程 | 403 | 40301 | 无权限操作该课程 |
| code 与他人重复 | 409 | 40901 | 课程代码已存在 |
| 课程名超长 | 400 | 40001 | 参数错误：课程名长度不能超过 100 |

---

### B10 删除课程

| 项 | 内容 |
|---|---|
| 方法与路径 | `DELETE /api/courses/:id` |
| 权限 | admin |
| 说明 | 有题目或考试时拒绝删除（基线明确返回 40901） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在 |

**请求示例**

```
DELETE /api/courses/3
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": { "id": 3 }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 课程不存在 | 404 | 40401 | 课程不存在 |
| 课程下仍有题目 | 409 | 40901 | 该课程下存在题目，无法删除 |
| 课程下仍有考试 | 409 | 40901 | 该课程下存在考试，无法删除 |
| teacher 调用 | 403 | 40301 | 无权限访问该资源 |

---

## 5 题库

### B11 题库分页列表

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/questions` |
| 权限 | teacher / admin |
| 说明 | teacher 仅能查询本人课程的题目；未传 `courseId` 时自动限定在本人课程范围内；admin 可查全部 |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| courseId | number | 否 | 正整数；teacher 传他人课程返回 40301 |
| type | string | 否 | `single` / `multiple` / `judge` / `short` |
| difficulty | number | 否 | 1~5 |
| keyword | string | 否 | ≤100 字符，匹配题干包含 |
| page | number | 否 | 默认 1，≥1 |
| pageSize | number | 否 | 默认 10，1~100 |

**请求示例**

```
GET /api/questions?courseId=1&type=single&difficulty=3&page=1&pageSize=10
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 15,
        "courseId": 1,
        "type": "single",
        "stem": "顺序表中插入元素平均需要移动多少个元素？",
        "options": [
          { "key": "A", "text": "n" },
          { "key": "B", "text": "n/2" },
          { "key": "C", "text": "1" },
          { "key": "D", "text": "0" }
        ],
        "answer": "B",
        "score": 5.0,
        "difficulty": 3,
        "knowledgePoint": "线性表",
        "analysis": "在等概率前提下平均移动 n/2 个元素。",
        "creatorId": 2,
        "createdAt": "2026-09-05 10:00:00"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| teacher 查询他人课程 | 403 | 40301 | 无权限操作该课程 |
| type / difficulty 非法 | 400 | 40001 | 参数错误：题型取值必须为 single/multiple/judge/short |
| 学生调用 | 403 | 40301 | 无权限访问该资源 |
| courseId 不存在 | 404 | 40401 | 课程不存在 |

---

### B12 新建题目

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/questions` |
| 权限 | teacher / admin |
| 说明 | 按题型校验 `answer` 与 `options` 的形状（基线 5.5 规则） |

**请求参数（Body）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| courseId | number | 是 | 正整数；teacher 必须为本人课程 |
| type | string | 是 | `single` / `multiple` / `judge` / `short` |
| stem | string | 是 | 1~1000 字符 |
| options | array | 条件 | single/multiple 必填：≥2 项，元素 `{key,text}`，key 为 A~F 且唯一，text 非空 ≤200 |
| answer | string \| string[] | 是 | single：`A`~`F` 单字母；multiple：≥2 个不重复字母数组；judge：`T`/`F`；short：非空字符串 ≤500 字 |
| score | number | 是 | >0，≤9999.99，最多两位小数 |
| difficulty | number | 是 | 1~5 整数 |
| knowledgePoint | string | 否 | ≤100 字符 |
| analysis | string | 否 | ≤1000 字符 |

**请求示例（单选）**

```json
{
  "courseId": 1,
  "type": "single",
  "stem": "下列哪种排序算法的平均时间复杂度不是 O(nlogn)？",
  "options": [
    { "key": "A", "text": "快速排序" },
    { "key": "B", "text": "归并排序" },
    { "key": "C", "text": "冒泡排序" },
    { "key": "D", "text": "堆排序" }
  ],
  "answer": "C",
  "score": 5,
  "difficulty": 2,
  "knowledgePoint": "排序",
  "analysis": "冒泡排序平均时间复杂度为 O(n^2)。"
}
```

**请求示例（多选）**

```json
{
  "courseId": 1,
  "type": "multiple",
  "stem": "下列属于稳定排序算法的有？",
  "options": [
    { "key": "A", "text": "冒泡排序" },
    { "key": "B", "text": "快速排序" },
    { "key": "C", "text": "归并排序" },
    { "key": "D", "text": "选择排序" }
  ],
  "answer": ["A", "C"],
  "score": 6,
  "difficulty": 3
}
```

**成功响应（HTTP 201）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 27,
    "courseId": 1,
    "type": "single",
    "stem": "下列哪种排序算法的平均时间复杂度不是 O(nlogn)？",
    "options": [
      { "key": "A", "text": "快速排序" },
      { "key": "B", "text": "归并排序" },
      { "key": "C", "text": "冒泡排序" },
      { "key": "D", "text": "堆排序" }
    ],
    "answer": "C",
    "score": 5.0,
    "difficulty": 2,
    "knowledgePoint": "排序",
    "analysis": "冒泡排序平均时间复杂度为 O(n^2)。",
    "creatorId": 2,
    "createdAt": "2026-10-31 16:30:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| single 的 answer 不是单字母 | 400 | 40001 | 参数错误：单选题答案必须为 A~F 的单个字母 |
| multiple 的 answer 少于 2 项 | 400 | 40001 | 参数错误：多选题答案至少包含 2 个选项 |
| multiple 的 answer 有重复项 | 400 | 40001 | 参数错误：多选题答案不能重复 |
| judge 的 answer 非 T/F | 400 | 40001 | 参数错误：判断题答案必须为 T 或 F |
| short 的 answer 为空或超 500 字 | 400 | 40001 | 参数错误：简答题参考答案不能为空且不超过 500 字 |
| single/multiple 的 options 少于 2 项 | 400 | 40001 | 参数错误：选择题选项至少 2 项 |
| options 的 key 重复 | 400 | 40001 | 参数错误：选项 key 不能重复 |
| answer 字母不在 options 中 | 400 | 40001 | 参数错误：答案必须存在于选项中 |
| score ≤ 0 或超两位小数 | 400 | 40001 | 参数错误：分值必须大于 0 且最多两位小数 |
| difficulty 越界 | 400 | 40001 | 参数错误：难度取值范围为 1~5 |
| 课程不存在 | 404 | 40401 | 课程不存在 |
| teacher 操作他人课程 | 403 | 40301 | 无权限操作该课程 |

---

### B13 修改题目

| 项 | 内容 |
|---|---|
| 方法与路径 | `PUT /api/questions/:id` |
| 权限 | teacher / admin |
| 说明 | 局部更新；校验规则同 B12。若题目已被 `published` 或 `closed` 考试的试卷引用，禁止修改 `type` 与 `answer`（防止历史成绩与判分依据不一致） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在 |
| Body | type | string | 否 | 枚举；受「已发布试卷引用」限制 |
| Body | stem | string | 否 | 1~1000 字符 |
| Body | options | array | 否 | 规则同 B12 |
| Body | answer | string \| string[] | 否 | 规则同 B12；受「已发布试卷引用」限制 |
| Body | score | number | 否 | >0 |
| Body | difficulty | number | 否 | 1~5 |
| Body | knowledgePoint | string | 否 | ≤100 字符 |
| Body | analysis | string | 否 | ≤1000 字符 |

**请求示例**

```json
{
  "stem": "下列排序算法中，平均时间复杂度为 O(n^2) 的是？",
  "difficulty": 1,
  "analysis": "冒泡、插入、选择均为 O(n^2)。"
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 27,
    "courseId": 1,
    "type": "single",
    "stem": "下列排序算法中，平均时间复杂度为 O(n^2) 的是？",
    "options": [
      { "key": "A", "text": "快速排序" },
      { "key": "B", "text": "归并排序" },
      { "key": "C", "text": "冒泡排序" },
      { "key": "D", "text": "堆排序" }
    ],
    "answer": "C",
    "score": 5.0,
    "difficulty": 1,
    "knowledgePoint": "排序",
    "analysis": "冒泡、插入、选择均为 O(n^2)。",
    "creatorId": 2,
    "createdAt": "2026-10-31 16:30:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 题目不存在 | 404 | 40401 | 题目不存在 |
| 题目被已发布考试引用且试图改 type/answer | 409 | 40901 | 该题目已被已发布试卷引用，不能修改题型或答案 |
| 答案形状非法 | 400 | 40001 | 参数错误：多选题答案至少包含 2 个选项 |
| 无任何可更新字段 | 400 | 40001 | 参数错误：没有需要更新的字段 |
| teacher 操作他人课程题目 | 403 | 40301 | 无权限操作该题目 |

---

### B14 删除题目

| 项 | 内容 |
|---|---|
| 方法与路径 | `DELETE /api/questions/:id` |
| 权限 | teacher / admin |
| 说明 | 被任何试卷引用时拒绝删除（保护历史成绩） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在 |

**请求示例**

```
DELETE /api/questions/27
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": { "id": 27 }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 题目不存在 | 404 | 40401 | 题目不存在 |
| 题目已被试卷引用 | 409 | 40901 | 该题目已被试卷引用，无法删除 |
| teacher 操作他人课程题目 | 403 | 40301 | 无权限操作该题目 |

---

### B15 批量导入题目

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/questions/import` |
| 权限 | teacher / admin |
| 说明 | 逐条校验，**部分成功**：合法题目入库，非法题目记录失败原因并跳过。整体仍返回 HTTP 200 与 `code=0` |

**请求参数（Body）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| courseId | number | 是 | 正整数；teacher 必须为本人课程 |
| questions | array | 是 | 1~500 条；元素字段同 B12（不含 `courseId`） |

**请求示例**

```json
{
  "courseId": 1,
  "questions": [
    {
      "type": "single",
      "stem": "栈的特点是？",
      "options": [
        { "key": "A", "text": "先进先出" },
        { "key": "B", "text": "后进先出" }
      ],
      "answer": "B",
      "score": 4,
      "difficulty": 2
    },
    {
      "type": "judge",
      "stem": "队列是先进先出的线性表。",
      "answer": "T",
      "score": 3,
      "difficulty": 1
    },
    {
      "type": "short",
      "stem": "简述栈与队列的区别。",
      "answer": "",
      "score": 10,
      "difficulty": 3
    }
  ]
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "imported": 2,
    "failed": [
      { "index": 2, "reason": "简答题参考答案不能为空" }
    ]
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| questions 缺失或为空数组 | 400 | 40001 | 参数错误：导入题目列表不能为空 |
| questions 超过 500 条 | 400 | 40001 | 参数错误：单次最多导入 500 道题 |
| courseId 不属于当前教师 | 403 | 40301 | 无权限操作该课程 |
| 请求体超过 1MB | 400 | 40001 | 请求体过大，单次导入请不超过 500 道题 |
| 单条题目非法 | 200 | 0 | （记入 `failed[].reason`，不中断整体） |

---

## 6 考试

### B16 考试列表

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/exams` |
| 权限 | teacher / admin |
| 说明 | 非分页，返回数组；teacher 仅本人课程下的考试 |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| status | string | 否 | `draft` / `published` / `closed` |
| courseId | number | 否 | 正整数；teacher 传他人课程返回 40301 |

**请求示例**

```
GET /api/exams?status=published&courseId=1
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": 5,
      "title": "数据结构期中考试",
      "courseId": 1,
      "courseName": "数据结构",
      "description": "闭卷，90 分钟",
      "startTime": "2026-11-05 14:00:00",
      "endTime": "2026-11-05 16:00:00",
      "durationMin": 90,
      "totalScore": 100.0,
      "passScore": 60.0,
      "shuffle": false,
      "status": "published",
      "createdBy": 2,
      "questionCount": 10,
      "createdAt": "2026-10-20 10:00:00"
    }
  ]
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| status 非枚举 | 400 | 40001 | 参数错误：status 取值必须为 draft/published/closed |
| teacher 查询他人课程 | 403 | 40301 | 无权限操作该课程 |
| 学生调用 | 403 | 40301 | 无权限访问该资源 |

---

### B17 组卷并创建考试

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/exams` |
| 权限 | teacher / admin |
| 说明 | 创建为 `draft`；`totalScore` 由服务端按 `questions[].score` 累加，忽略客户端传值 |

**请求参数（Body）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| title | string | 是 | 1~150 字符 |
| courseId | number | 是 | 正整数，存在；teacher 必须为本人课程 |
| description | string | 否 | ≤500 字符 |
| startTime | string | 是 | `YYYY-MM-DD HH:mm:ss` |
| endTime | string | 是 | 同上，须晚于 `startTime` |
| durationMin | number | 是 | 正整数，1~600 |
| passScore | number | 是 | ≥0，≤ totalScore（发布时强校验） |
| shuffle | boolean | 否 | 默认 `false` |
| questions | array | 是 | 1~200 项，元素 `{questionId, score}`；题目须属于 `courseId`；同卷不重复；`score` > 0 |

**请求示例**

```json
{
  "title": "数据结构期中考试",
  "courseId": 1,
  "description": "闭卷，90 分钟",
  "startTime": "2026-11-05 14:00:00",
  "endTime": "2026-11-05 16:00:00",
  "durationMin": 90,
  "passScore": 60,
  "shuffle": false,
  "questions": [
    { "questionId": 15, "score": 5 },
    { "questionId": 16, "score": 6 },
    { "questionId": 23, "score": 10 }
  ]
}
```

**成功响应（HTTP 201）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 6,
    "title": "数据结构期中考试",
    "courseId": 1,
    "courseName": "数据结构",
    "description": "闭卷，90 分钟",
    "startTime": "2026-11-05 14:00:00",
    "endTime": "2026-11-05 16:00:00",
    "durationMin": 90,
    "totalScore": 21.0,
    "passScore": 60.0,
    "shuffle": false,
    "status": "draft",
    "createdBy": 2,
    "questionCount": 3,
    "createdAt": "2026-10-31 16:35:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 必填缺失 | 400 | 40001 | 参数错误：考试标题不能为空 |
| startTime ≥ endTime | 400 | 40001 | 参数错误：结束时间必须晚于开始时间 |
| durationMin ≤ 0 | 400 | 40001 | 参数错误：考试时长必须为正整数 |
| questions 为空 | 400 | 40001 | 参数错误：试卷至少包含 1 道题 |
| 题目不存在或不属于该课程 | 400 | 40001 | 参数错误：第 2 题的题目不属于本课程 |
| questionId 重复 | 400 | 40001 | 参数错误：同一题目不能重复加入试卷 |
| 题目分值 ≤ 0 | 400 | 40001 | 参数错误：每题分值必须大于 0 |
| passScore > totalScore | 400 | 40001 | 参数错误：及格线不能大于试卷总分 |
| courseId 不存在 | 404 | 40401 | 课程不存在 |
| teacher 操作他人课程 | 403 | 40301 | 无权限操作该课程 |

---

### B18 考试详情

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/exams/:id` |
| 权限 | teacher / admin |
| 说明 | 含题目（**带 answer、analysis**）与指派人数；学生不可调用（应使用 B24） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在 |

**请求示例**

```
GET /api/exams/6
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 6,
    "title": "数据结构期中考试",
    "courseId": 1,
    "courseName": "数据结构",
    "description": "闭卷，90 分钟",
    "startTime": "2026-11-05 14:00:00",
    "endTime": "2026-11-05 16:00:00",
    "durationMin": 90,
    "totalScore": 21.0,
    "passScore": 15.0,
    "shuffle": false,
    "status": "draft",
    "createdBy": 2,
    "questionCount": 3,
    "assignedCount": 2,
    "createdAt": "2026-10-31 16:35:00",
    "questions": [
      {
        "questionId": 15,
        "sortOrder": 1,
        "score": 5.0,
        "type": "single",
        "stem": "顺序表中插入元素平均需要移动多少个元素？",
        "options": [
          { "key": "A", "text": "n" },
          { "key": "B", "text": "n/2" },
          { "key": "C", "text": "1" },
          { "key": "D", "text": "0" }
        ],
        "answer": "B",
        "analysis": "平均移动 n/2 个元素。",
        "difficulty": 3,
        "knowledgePoint": "线性表"
      },
      {
        "questionId": 16,
        "sortOrder": 2,
        "score": 6.0,
        "type": "multiple",
        "stem": "下列属于稳定排序算法的有？",
        "options": [
          { "key": "A", "text": "冒泡排序" },
          { "key": "B", "text": "快速排序" },
          { "key": "C", "text": "归并排序" },
          { "key": "D", "text": "选择排序" }
        ],
        "answer": ["A", "C"],
        "analysis": "冒泡与归并稳定。",
        "difficulty": 3,
        "knowledgePoint": "排序"
      },
      {
        "questionId": 23,
        "sortOrder": 3,
        "score": 10.0,
        "type": "short",
        "stem": "简述栈与队列的区别。",
        "options": null,
        "answer": "栈后进先出，队列先进先出。",
        "analysis": "从操作端与顺序两方面作答。",
        "difficulty": 2,
        "knowledgePoint": "栈与队列"
      }
    ]
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 考试不存在 | 404 | 40401 | 考试不存在 |
| teacher 访问他人课程考试 | 403 | 40301 | 无权限操作该考试 |
| 学生调用 | 403 | 40301 | 无权限访问该资源 |

---

### B19 修改考试（仅草稿）

| 项 | 内容 |
|---|---|
| 方法与路径 | `PUT /api/exams/:id` |
| 权限 | teacher / admin |
| 说明 | **仅 `draft` 可改**，否则 40901；提供 `questions` 时整体替换题目集并重算 `totalScore` |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在且 `status='draft'` |
| Body | title | string | 否 | 1~150 字符 |
| Body | description | string | 否 | ≤500 字符 |
| Body | startTime | string | 否 | `YYYY-MM-DD HH:mm:ss` |
| Body | endTime | string | 否 | 同上，须晚于 `startTime` |
| Body | durationMin | number | 否 | 正整数 |
| Body | passScore | number | 否 | ≥0 |
| Body | shuffle | boolean | 否 | — |
| Body | questions | array | 否 | 提供即整体替换 |

**请求示例**

```json
{
  "title": "数据结构期中考试（修订）",
  "durationMin": 100,
  "questions": [
    { "questionId": 15, "score": 4 },
    { "questionId": 16, "score": 6 },
    { "questionId": 23, "score": 10 }
  ]
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 6,
    "title": "数据结构期中考试（修订）",
    "courseId": 1,
    "courseName": "数据结构",
    "description": "闭卷，90 分钟",
    "startTime": "2026-11-05 14:00:00",
    "endTime": "2026-11-05 16:00:00",
    "durationMin": 100,
    "totalScore": 20.0,
    "passScore": 15.0,
    "shuffle": false,
    "status": "draft",
    "createdBy": 2,
    "questionCount": 3,
    "createdAt": "2026-10-31 16:35:00"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 考试不存在 | 404 | 40401 | 考试不存在 |
| 考试已发布或已关闭 | 409 | 40901 | 仅草稿状态的考试可以修改 |
| 已有学生答卷（防改卷破坏成绩） | 409 | 40901 | 该考试已有答卷，不能修改试卷内容 |
| 题目不属于课程 | 400 | 40001 | 参数错误：第 1 题的题目不属于本课程 |
| 时间窗非法 | 400 | 40001 | 参数错误：结束时间必须晚于开始时间 |
| teacher 操作他人考试 | 403 | 40301 | 无权限操作该考试 |

---

### B20 删除考试（仅草稿）

| 项 | 内容 |
|---|---|
| 方法与路径 | `DELETE /api/exams/:id` |
| 权限 | teacher / admin |
| 说明 | 仅 `draft` 可删；`exam_questions`、`exam_students` 随外键级联清理 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在且 `status='draft'` |

**请求示例**

```
DELETE /api/exams/6
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": { "id": 6 }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 考试不存在 | 404 | 40401 | 考试不存在 |
| 已发布或已关闭 | 409 | 40901 | 仅草稿状态的考试可以删除 |
| 已有答卷 | 409 | 40901 | 该考试已有答卷，不能删除 |
| teacher 操作他人考试 | 403 | 40301 | 无权限操作该考试 |

---

### B21 发布考试

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/exams/:id/publish` |
| 权限 | teacher / admin |
| 说明 | 校验「有题、总分>0、及格线≤总分、开始<结束」，通过后 `draft` → `published` |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，存在且 `status='draft'` |

**请求示例**

```
POST /api/exams/6/publish
Authorization: Bearer <JWT>
Content-Type: application/json
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 6,
    "title": "数据结构期中考试（修订）",
    "status": "published",
    "totalScore": 20.0,
    "passScore": 15.0,
    "questionCount": 3,
    "assignedCount": 2
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 考试不存在 | 404 | 40401 | 考试不存在 |
| 试卷无题目 | 400 | 40001 | 发布失败：试卷至少需要 1 道题 |
| 总分为 0 | 400 | 40001 | 发布失败：试卷总分必须大于 0 |
| 及格线 > 总分 | 400 | 40001 | 发布失败：及格线不能大于试卷总分 |
| 开始时间 ≥ 结束时间 | 400 | 40001 | 发布失败：考试开始时间必须早于结束时间 |
| 非 draft 状态 | 409 | 40901 | 仅草稿状态的考试可以发布 |
| teacher 操作他人考试 | 403 | 40301 | 无权限操作该考试 |

---

### B22 指派考生（覆盖式）

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/exams/:id/assign` |
| 权限 | teacher / admin |
| 说明 | **覆盖式**：提交的 `studentIds` 即完整名单，空数组表示清空指派。事务内先删后插 |

**请求参数（Body）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| studentIds | number[] | 是 | 0~500 个正整数；每个用户须存在且 `role='student'`；自动去重 |

**请求示例**

```json
{
  "studentIds": [3, 4, 5]
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "examId": 6,
    "assignedCount": 3,
    "studentIds": [3, 4, 5]
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| studentIds 非数组 | 400 | 40001 | 参数错误：studentIds 必须为数组 |
| 含不存在的用户 | 400 | 40001 | 参数错误：学生 99 不存在 |
| 含非学生角色用户 | 400 | 40001 | 参数错误：用户 2 不是学生 |
| 超过 500 个 | 400 | 40001 | 参数错误：单次最多指派 500 名学生 |
| 考试不存在 | 404 | 40401 | 考试不存在 |
| teacher 操作他人考试 | 403 | 40301 | 无权限操作该考试 |

---

### B23 学生可参加考试列表

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/exams/available` |
| 权限 | student |
| 说明 | 已发布且被指派的考试，附带本人答卷状态；**路由必须先于 B18 注册** |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Header | Authorization | string | 是 | `Bearer <JWT>`，角色 student |

**请求示例**

```
GET /api/exams/available
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": 5,
      "title": "数据结构期中考试",
      "courseId": 1,
      "courseName": "数据结构",
      "startTime": "2026-11-05 14:00:00",
      "endTime": "2026-11-05 16:00:00",
      "durationMin": 90,
      "totalScore": 100.0,
      "passScore": 60.0,
      "status": "published",
      "attemptStatus": "in_progress",
      "attemptId": 18,
      "remainingSeconds": 3600,
      "totalScoreObtained": null
    },
    {
      "id": 7,
      "title": "数据结构期末考试",
      "courseId": 1,
      "courseName": "数据结构",
      "startTime": "2026-12-20 09:00:00",
      "endTime": "2026-12-20 11:00:00",
      "durationMin": 120,
      "totalScore": 100.0,
      "passScore": 60.0,
      "status": "published",
      "attemptStatus": "none",
      "attemptId": null,
      "remainingSeconds": 0,
      "totalScoreObtained": null
    }
  ]
}
```

**字段补充说明**：`attemptStatus` 取值 `none` / `in_progress` / `submitted` / `graded`；`attemptId` 无答卷时为 `null`；`remainingSeconds` 仅在 `in_progress` 时有意义，其它情况为 0；`totalScoreObtained` 仅在 `submitted` / `graded` 时为数字。

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 非学生调用 | 403 | 40301 | 无权限访问该资源 |
| 未登录 | 401 | 40101 | 未登录或登录已过期 |

---

### B24 学生试卷（无答案）

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/exams/:id/paper` |
| 权限 | student |
| 说明 | 返回**不含 `answer` / `analysis`** 的试卷 + 本人答卷摘要（若有）。用于答开前浏览题量与分值，也可用于答题页初始化 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，考试存在、已发布、已指派 |

**请求示例**

```
GET /api/exams/5/paper
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "exam": {
      "id": 5,
      "title": "数据结构期中考试",
      "courseId": 1,
      "courseName": "数据结构",
      "startTime": "2026-11-05 14:00:00",
      "endTime": "2026-11-05 16:00:00",
      "durationMin": 90,
      "totalScore": 100.0,
      "passScore": 60.0,
      "shuffle": false,
      "status": "published"
    },
    "questions": [
      {
        "questionId": 15,
        "sortOrder": 1,
        "score": 5.0,
        "type": "single",
        "stem": "顺序表中插入元素平均需要移动多少个元素？",
        "options": [
          { "key": "A", "text": "n" },
          { "key": "B", "text": "n/2" },
          { "key": "C", "text": "1" },
          { "key": "D", "text": "0" }
        ]
      },
      {
        "questionId": 23,
        "sortOrder": 2,
        "score": 10.0,
        "type": "short",
        "stem": "简述栈与队列的区别。",
        "options": null
      }
    ],
    "attempt": {
      "attemptId": 18,
      "status": "in_progress",
      "deadlineAt": "2026-11-05 15:30:00",
      "remainingSeconds": 3600
    }
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 考试不存在 | 404 | 40401 | 考试不存在 |
| 未被指派 | 403 | 40301 | 您未被指派该考试 |
| 考试未发布 | 409 | 40901 | 考试尚未发布 |
| 教师/管理员调用 | 403 | 40301 | 无权限访问该资源 |

---

### B25 开考

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/exams/:id/attempts` |
| 权限 | student |
| 说明 | **幂等**：已有 `in_progress` 答卷时返回原答卷（HTTP 200）；首次开考返回 HTTP 201。`deadline_at = min(now + durationMin, exam.end_time)` |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数；考试存在、`published`、已指派、当前时间在窗口内 |

**请求示例**

```
POST /api/exams/5/attempts
Authorization: Bearer <JWT>
Content-Type: application/json
```

**成功响应（首次开考，HTTP 201）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "attemptId": 18,
    "deadlineAt": "2026-11-05 15:30:00",
    "remainingSeconds": 5400
  }
}
```

**成功响应（重复开考，HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "attemptId": 18,
    "deadlineAt": "2026-11-05 15:30:00",
    "remainingSeconds": 3600
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 考试不存在 | 404 | 40401 | 考试不存在 |
| 未被指派 | 403 | 40301 | 您未被指派该考试 |
| 考试非 published | 409 | 40901 | 考试尚未发布 |
| 当前时间早于 startTime | 409 | 40901 | 考试尚未开始 |
| 当前时间晚于 endTime | 409 | 40901 | 考试已结束 |
| 已有 submitted / graded 答卷 | 409 | 40901 | 您已提交该考试，不能重复开考 |
| 非学生调用 | 403 | 40301 | 无权限访问该资源 |

---

## 7 答题与交卷

### B26 答卷详情（断线恢复）

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/attempts/:id` |
| 权限 | student（仅本人）/ teacher（本人课程内） |
| 说明 | 返回题目、已保存答案、服务端剩余秒数。**超时未交自动交卷**：若 `now > deadline_at` 且状态为 `in_progress`，先自动交卷再返回，`status` 变为 `submitted`。access 权限严格按基线，**admin 不在放行名单内**（见第 12 节 C-16） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，答卷存在 |

**请求示例**

```
GET /api/attempts/18
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "attemptId": 18,
    "examId": 5,
    "examTitle": "数据结构期中考试",
    "status": "in_progress",
    "startedAt": "2026-11-05 14:00:00",
    "deadlineAt": "2026-11-05 15:30:00",
    "remainingSeconds": 3600,
    "totalScore": null,
    "questions": [
      {
        "questionId": 15,
        "sortOrder": 1,
        "score": 5.0,
        "type": "single",
        "stem": "顺序表中插入元素平均需要移动多少个元素？",
        "options": [
          { "key": "A", "text": "n" },
          { "key": "B", "text": "n/2" },
          { "key": "C", "text": "1" },
          { "key": "D", "text": "0" }
        ],
        "savedAnswer": "B"
      },
      {
        "questionId": 16,
        "sortOrder": 2,
        "score": 6.0,
        "type": "multiple",
        "stem": "下列属于稳定排序算法的有？",
        "options": [
          { "key": "A", "text": "冒泡排序" },
          { "key": "B", "text": "快速排序" },
          { "key": "C", "text": "归并排序" },
          { "key": "D", "text": "选择排序" }
        ],
        "savedAnswer": ["A", "C"]
      },
      {
        "questionId": 23,
        "sortOrder": 3,
        "score": 10.0,
        "type": "short",
        "stem": "简述栈与队列的区别。",
        "options": null,
        "savedAnswer": null
      }
    ]
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 答卷不存在 | 404 | 40401 | 答卷不存在 |
| 学生访问他人答卷 | 403 | 40301 | 无权限访问该答卷 |
| teacher 访问非本人课程答卷 | 403 | 40301 | 无权限访问该答卷 |
| admin 调用 | 403 | 40301 | 无权限访问该资源 |
| 未登录 | 401 | 40101 | 未登录或登录已过期 |

---

### B27 单题自动保存

| 项 | 内容 |
|---|---|
| 方法与路径 | `PUT /api/attempts/:id/answers` |
| 权限 | student（仅本人） |
| 说明 | 每次选项变更调用一次；幂等 upsert。**交卷后返回 40901**；已超时则先自动交卷再返回 40901 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，答卷存在且属于本人 |
| Body | questionId | number | 是 | 正整数，必须属于本场试卷 |
| Body | answer | string \| string[] \| null | 是 | 形状随题型：single `"A"`~`"F"`；multiple 字母数组（可空数组表示清空）；judge `"T"`/`"F"`；short ≤500 字；`null` 表示清空作答 |

**请求示例（多选）**

```json
{
  "questionId": 16,
  "answer": ["A", "C"]
}
```

**请求示例（清空）**

```json
{
  "questionId": 23,
  "answer": null
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "questionId": 16,
    "savedAt": "2026-11-05 14:12:33"
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 答卷不存在 | 404 | 40401 | 答卷不存在 |
| 答卷不属于本人 | 403 | 40301 | 无权限操作该答卷 |
| 已交卷 | 409 | 40901 | 答卷已提交，不能继续作答 |
| 已超时（触发自动交卷） | 409 | 40901 | 考试已结束，答卷已自动提交 |
| questionId 不属于本卷 | 400 | 40001 | 参数错误：该题目不属于本场考试 |
| answer 形状非法 | 400 | 40001 | 参数错误：多选题答案必须为选项字母数组 |
| 单选答案不在选项中 | 400 | 40001 | 参数错误：答案必须存在于选项中 |
| 非学生调用 | 403 | 40301 | 无权限访问该资源 |

---

### B28 交卷

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/attempts/:id/submit` |
| 权限 | student（仅本人） |
| 说明 | 自动判客观题；**幂等**：重复交卷返回既有判分结果（HTTP 200，`code=0`）。响应字段严格为基线三字段 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，答卷存在且属于本人 |
| Body | — | — | — | 无请求体（传空对象亦可） |

**请求示例**

```
POST /api/attempts/18/submit
Authorization: Bearer <JWT>
Content-Type: application/json
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "totalScore": 11.0,
    "objectiveScore": 11.0,
    "subjectivePending": 1
  }
}
```

**字段说明**：`totalScore` 当前总分（客观 + 已评分主观）；`objectiveScore` 客观题得分；`subjectivePending` 待人工评阅的简答题数量。

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 答卷不存在 | 404 | 40401 | 答卷不存在 |
| 答卷不属于本人 | 403 | 40301 | 无权限操作该答卷 |
| 并发交卷冲突且无法读取结果 | 409 | 40901 | 答卷状态异常，请刷新后重试 |
| teacher/admin 调用 | 403 | 40301 | 无权限访问该资源 |

---

### B29 成绩与解析

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/attempts/:id/result` |
| 权限 | student（仅本人）/ teacher / admin |
| 说明 | **交卷后可见**：含逐题得分、正确答案、解析、评语。`in_progress` 状态返回 40901 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，答卷存在且 `status != 'in_progress'` |

**请求示例**

```
GET /api/attempts/18/result
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "attemptId": 18,
    "examId": 5,
    "examTitle": "数据结构期中考试",
    "status": "graded",
    "startedAt": "2026-11-05 14:00:00",
    "submittedAt": "2026-11-05 15:12:00",
    "objectiveScore": 11.0,
    "subjectiveScore": 8.0,
    "totalScore": 19.0,
    "examTotalScore": 21.0,
    "passScore": 15.0,
    "passed": true,
    "items": [
      {
        "questionId": 15,
        "sortOrder": 1,
        "type": "single",
        "stem": "顺序表中插入元素平均需要移动多少个元素？",
        "options": [
          { "key": "A", "text": "n" },
          { "key": "B", "text": "n/2" },
          { "key": "C", "text": "1" },
          { "key": "D", "text": "0" }
        ],
        "myAnswer": "B",
        "correctAnswer": "B",
        "score": 5.0,
        "fullScore": 5.0,
        "comment": null,
        "analysis": "平均移动 n/2 个元素。"
      },
      {
        "questionId": 16,
        "sortOrder": 2,
        "type": "multiple",
        "stem": "下列属于稳定排序算法的有？",
        "options": [
          { "key": "A", "text": "冒泡排序" },
          { "key": "B", "text": "快速排序" },
          { "key": "C", "text": "归并排序" },
          { "key": "D", "text": "选择排序" }
        ],
        "myAnswer": ["A"],
        "correctAnswer": ["A", "C"],
        "score": 0.0,
        "fullScore": 6.0,
        "comment": null,
        "analysis": "冒泡与归并稳定；少选不得分。"
      },
      {
        "questionId": 23,
        "sortOrder": 3,
        "type": "short",
        "stem": "简述栈与队列的区别。",
        "options": null,
        "myAnswer": "栈是后进先出，队列是先进先出。",
        "correctAnswer": "栈后进先出，队列先进先出。",
        "score": 8.0,
        "fullScore": 10.0,
        "comment": "要点正确，可补充应用场景。",
        "analysis": "从操作端与顺序两方面作答。"
      }
    ]
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 答卷不存在 | 404 | 40401 | 答卷不存在 |
| 尚未交卷 | 409 | 40901 | 该答卷尚未提交，暂无成绩 |
| 学生查看他人成绩 | 403 | 40301 | 无权限访问该答卷 |
| teacher 查看非本人课程成绩 | 403 | 40301 | 无权限访问该答卷 |

---

## 8 阅卷

### B30 待阅列表

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/grading/pending` |
| 权限 | teacher / admin |
| 说明 | 返回已交卷答卷及其**待评简答题数量**（`graded_at IS NULL` 的 `short` 题）。仅返回 `pendingCount > 0` 的答卷，即在待阅队列中的答卷。**路由必须先于 B31 注册** |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 约束 |
|---|---|:--:|---|
| examId | number | 否 | 正整数；缺省表示本人全部考试 |

**请求示例**

```
GET /api/grading/pending?examId=5
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "attemptId": 18,
      "studentName": "李小明",
      "submittedAt": "2026-11-05 15:12:00",
      "pendingCount": 1
    },
    {
      "attemptId": 19,
      "studentName": "王小华",
      "submittedAt": "2026-11-05 15:20:00",
      "pendingCount": 2
    }
  ]
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| examId 不属于本人课程 | 403 | 40301 | 无权限操作该考试 |
| examId 非法 | 400 | 40001 | 参数错误：examId 必须为正整数 |
| 学生调用 | 403 | 40301 | 无权限访问该资源 |

---

### B31 阅卷详情

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/grading/:attemptId` |
| 权限 | teacher / admin |
| 说明 | 含参考答案、学生作答、本卷满分、已有得分与评语；`needGrading` 标记待评的简答题 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | attemptId | number | 是 | 正整数，答卷存在且已交卷 |

**请求示例**

```
GET /api/grading/18
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "attemptId": 18,
    "examId": 5,
    "examTitle": "数据结构期中考试",
    "studentId": 3,
    "studentName": "李小明",
    "status": "submitted",
    "submittedAt": "2026-11-05 15:12:00",
    "objectiveScore": 11.0,
    "subjectiveScore": 0.0,
    "totalScore": 11.0,
    "pendingCount": 1,
    "items": [
      {
        "questionId": 15,
        "sortOrder": 1,
        "type": "single",
        "stem": "顺序表中插入元素平均需要移动多少个元素？",
        "options": [
          { "key": "A", "text": "n" },
          { "key": "B", "text": "n/2" },
          { "key": "C", "text": "1" },
          { "key": "D", "text": "0" }
        ],
        "correctAnswer": "B",
        "studentAnswer": "B",
        "fullScore": 5.0,
        "score": 5.0,
        "comment": null,
        "gradedAt": null,
        "needGrading": false
      },
      {
        "questionId": 23,
        "sortOrder": 2,
        "type": "short",
        "stem": "简述栈与队列的区别。",
        "options": null,
        "correctAnswer": "栈后进先出，队列先进先出。",
        "studentAnswer": "栈是后进先出，队列是先进先出。",
        "fullScore": 10.0,
        "score": 0.0,
        "comment": null,
        "gradedAt": null,
        "needGrading": true
      }
    ]
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 答卷不存在 | 404 | 40401 | 答卷不存在 |
| 答卷尚未交卷 | 409 | 40901 | 该答卷尚未交卷，无法阅卷 |
| 非本人课程答卷 | 403 | 40301 | 无权限访问该答卷 |
| 学生调用 | 403 | 40301 | 无权限访问该资源 |

---

### B32 提交评分并重算总分

| 项 | 内容 |
|---|---|
| 方法与路径 | `POST /api/grading/:attemptId` |
| 权限 | teacher / admin |
| 说明 | 仅允许对 `short` 题型打分；分数覆盖写入后由 `SUM(answers.score)` **重算**总分并将状态置 `graded`。允许对同一答卷多次提交（重评） |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | attemptId | number | 是 | 正整数，答卷存在且已交卷 |
| Body | items | array | 是 | 1~50 项；元素 `{questionId, score, comment?}` |
| Body | items[].questionId | number | 是 | 必须属于本场试卷且题型的 `short` |
| Body | items[].score | number | 是 | 0 ≤ score ≤ 该题本卷满分，最多两位小数 |
| Body | items[].comment | string | 否 | ≤500 字符 |

**请求示例**

```json
{
  "items": [
    { "questionId": 23, "score": 8, "comment": "要点正确，可补充应用场景。" }
  ]
}
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "attemptId": 18,
    "status": "graded",
    "objectiveScore": 11.0,
    "subjectiveScore": 8.0,
    "totalScore": 19.0,
    "pendingCount": 0
  }
}
```

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| items 缺失或为空 | 400 | 40001 | 参数错误：评分项不能为空 |
| 分数为负或超过满分 | 400 | 40001 | 参数错误：第 1 项分数必须在 0~10 之间 |
| 题目不属于本卷 | 400 | 40001 | 参数错误：题目 99 不属于本场考试 |
| 对客观题打分 | 400 | 40001 | 参数错误：只能对简答题评分 |
| 评语超长 | 400 | 40001 | 参数错误：评语不能超过 500 字 |
| 答卷不存在 | 404 | 40401 | 答卷不存在 |
| 答卷尚未交卷 | 409 | 40901 | 该答卷尚未交卷，无法阅卷 |
| 非本人课程答卷 | 403 | 40301 | 无权限访问该答卷 |

---

## 9 统计

### B33 全局概览

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/stats/overview` |
| 权限 | admin |
| 说明 | 7 项计数，用于管理员首页卡片 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Header | Authorization | string | 是 | `Bearer <JWT>`，角色 admin |

**请求示例**

```
GET /api/stats/overview
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "userCount": 53,
    "teacherCount": 2,
    "studentCount": 50,
    "courseCount": 2,
    "questionCount": 16,
    "examCount": 2,
    "attemptCount": 4
  }
}
```

**口径**：`userCount` 为全部用户（含 admin）；`attemptCount` 为全部答卷记录（含 `in_progress`）；其余为全表计数。

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 非 admin 调用 | 403 | 40301 | 无权限访问该资源 |
| 未登录 | 401 | 40101 | 未登录或登录已过期 |

---

### B34 场次统计摘要列表

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/stats/exams` |
| 权限 | teacher（本人课程）/ admin |
| 说明 | 每场考试的统计摘要；`count` 仅统计 `submitted` 与 `graded` 的答卷 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Header | Authorization | string | 是 | `Bearer <JWT>`，角色 teacher/admin |

**请求示例**

```
GET /api/stats/exams
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "examId": 5,
      "title": "数据结构期中考试",
      "courseId": 1,
      "courseName": "数据结构",
      "status": "published",
      "totalScore": 100.0,
      "passScore": 60.0,
      "count": 2,
      "avg": 72.5,
      "max": 85.0,
      "min": 60.0,
      "passRate": 100.0
    },
    {
      "examId": 6,
      "title": "数据结构期末考试",
      "courseId": 1,
      "courseName": "数据结构",
      "status": "draft",
      "totalScore": 100.0,
      "passScore": 60.0,
      "count": 0,
      "avg": 0.0,
      "max": 0.0,
      "min": 0.0,
      "passRate": 0.0
    }
  ]
}
```

**口径**：`count=0` 时 `avg`/`max`/`min`/`passRate` 均为 0；`avg` 保留两位小数；`passRate` 为百分数（0~100），保留两位小数。

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 学生调用 | 403 | 40301 | 无权限访问该资源 |
| 数据库异常 | 500 | 50001 | 服务器内部错误 |

---

### B35 单场详细统计

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/stats/exams/:id` |
| 权限 | teacher（本人课程）/ admin |
| 说明 | 场次聚合 + 五段分布 + 逐题正确率；响应字段严格按基线 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数，考试存在且属于本人课程（teacher） |

**请求示例**

```
GET /api/stats/exams/5
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "title": "数据结构期中考试",
    "count": 2,
    "avg": 72.5,
    "max": 85.0,
    "min": 60.0,
    "passRate": 100.0,
    "distribution": [
      { "label": "[0,60)", "count": 0 },
      { "label": "[60,70)", "count": 0 },
      { "label": "[70,80)", "count": 1 },
      { "label": "[80,90)", "count": 1 },
      { "label": "[90,100]", "count": 0 }
    ],
    "questions": [
      {
        "questionId": 15,
        "stem": "顺序表中插入元素平均需要移动多少个元素？",
        "type": "single",
        "accuracy": 100.0,
        "avgScore": 5.0
      },
      {
        "questionId": 16,
        "stem": "下列属于稳定排序算法的有？",
        "type": "multiple",
        "accuracy": 50.0,
        "avgScore": 3.0
      },
      {
        "questionId": 23,
        "stem": "简述栈与队列的区别。",
        "type": "short",
        "accuracy": 80.0,
        "avgScore": 8.0
      }
    ]
  }
}
```

**口径**：
1. `count` 仅统计 `submitted` 与 `graded` 答卷；
2. `distribution` 固定 5 段 `[0,60)`、`[60,70)`、`[70,80)`、`[80,90)`、`[90,100]`，按 `total_score / exams.total_score × 100` 折算，区间左闭右开、末段闭合，5 段之和等于 `count`；
3. `accuracy = 该题平均得分 / 该题本卷满分 × 100`（保留两位小数），客观题等价于正确率（全对得满分，否则 0 分）；
4. `avgScore` 为该题平均得分；无答卷时 `accuracy` 与 `avgScore` 均为 0；
5. 断言依据：基线 5.9。

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 考试不存在 | 404 | 40401 | 考试不存在 |
| teacher 查询他人课程 | 403 | 40301 | 无权限操作该考试 |
| 学生调用 | 403 | 40301 | 无权限访问该资源 |

---

### B36 学生历次成绩

| 项 | 内容 |
|---|---|
| 方法与路径 | `GET /api/stats/students/:id` |
| 权限 | student（仅本人）/ teacher |
| 说明 | 本人（或教师查看学生）历次成绩与平均分；仅统计已交卷答卷 |

**请求参数**

| 位置 | 参数 | 类型 | 必填 | 约束 |
|---|---|---|:--:|---|
| Path | id | number | 是 | 正整数；student 只能为自己；teacher 需与该生有课程关联 |

**请求示例**

```
GET /api/stats/students/3
Authorization: Bearer <JWT>
```

**成功响应（HTTP 200）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "studentId": 3,
    "studentName": "李小明",
    "count": 2,
    "avg": 74.5,
    "list": [
      {
        "attemptId": 18,
        "examId": 5,
        "examTitle": "数据结构期中考试",
        "fullScore": 100.0,
        "passScore": 60.0,
        "totalScore": 19.0,
        "status": "graded",
        "submittedAt": "2026-11-05 15:12:00"
      },
      {
        "attemptId": 21,
        "examId": 7,
        "examTitle": "数据结构期末考试",
        "fullScore": 100.0,
        "passScore": 60.0,
        "totalScore": 85.0,
        "status": "graded",
        "submittedAt": "2026-12-20 10:40:00"
      }
    ]
  }
}
```

**口径**：`count` 与 `avg` 只统计 `submitted` 与 `graded`；`list` 按 `submittedAt` 倒序。

**失败场景**

| 场景 | HTTP | 业务码 | message 示例 |
|---|---|---|---|
| 学生查询他人成绩 | 403 | 40301 | 无权限访问该用户成绩 |
| teacher 与该生无课程关联 | 403 | 40301 | 无权限访问该用户成绩 |
| 用户不存在 | 404 | 40401 | 用户不存在 |
| 用户不是学生 | 400 | 40001 | 参数错误：该用户不是学生 |
| admin 调用（基线未放行） | 403 | 40301 | 无权限访问该资源 |

---

## 10 权限矩阵（接口级）

| 接口 | admin | teacher | student | 归属校验 |
|---|:--:|:--:|:--:|---|
| B01 | ✅ | ✅ | ✅ | 公开 |
| B02 | ✅ | ✅ | ✅ | — |
| B03~B06 | ✅ | ❌ | ❌ | — |
| B07 | ✅ 全部 | ✅ 本人 | ✅ 全部（只读） | 按角色过滤 |
| B08 | ✅ | ✅ 强制自己 | ❌ | — |
| B09 | ✅ | ✅ 本人 | ❌ | `course.teacher_id` |
| B10 | ✅ | ❌ | ❌ | — |
| B11~B15 | ✅ | ✅ 本人课程 | ❌ | `question.course_id → teacher_id` |
| B16~B22 | ✅ | ✅ 本人课程 | ❌ | `exam.course_id → teacher_id` |
| B23~B25 | ❌ | ❌ | ✅ | `exam_students` 指派 + 时间窗 |
| B26 | ❌ | ✅ 本人课程 | ✅ 本人 | 答卷归属 |
| B27 B28 | ❌ | ❌ | ✅ 本人 | `attempt.student_id` |
| B29 | ✅ | ✅ | ✅ 本人 | 答卷归属 |
| B30~B32 | ✅ | ✅ 本人课程 | ❌ | `attempt → exam → course → teacher_id` |
| B33 | ✅ | ❌ | ❌ | — |
| B34 B35 | ✅ | ✅ 本人课程 | ❌ | 同上 |
| B36 | ❌ | ✅ 关联学生 | ✅ 本人 | `studentId === user.id` |

## 11 与基线的逐条对照

| 基线小节 | 基线条目数 | 契约编号 | 一致性 |
|---|---:|---|---|
| 5.2 认证 | 2 | B01~B02 | 路径、方法、data 字段一致 |
| 5.3 用户管理 | 4 | B03~B06 | 一致 |
| 5.4 课程 | 4 | B07~B10 | 一致 |
| 5.5 题库 | 5 | B11~B15 | 一致（含 import 的 `{imported, failed:[{index,reason}]}`） |
| 5.6 考试 | 10 | B16~B25 | 一致（含 available、paper、attempts） |
| 5.7 答题与交卷 | 4 | B26~B29 | 一致（含 submit 三字段） |
| 5.8 阅卷 | 3 | B30~B32 | 一致 |
| 5.9 统计 | 4 | B33~B36 | 一致（含 distribution 五段与 count 口径） |
| **合计** | **36** | **B01~B36** | **100% 对应，无增删** |

> **关于「40+ 接口」的说明**：任务书正文提到「40 余个接口」，经对基线第 5 节逐表清点，实际为 **36 条**（2+4+4+5+10+4+3+4）。依「基线优先、不得增删接口」原则，本契约以 36 条为准，未编造任何基线之外的接口。若后续确需扩展到 40 条以上（例如「关闭考试」「导出成绩」「导出试卷」），应先修订 `project-brief.md` 并登记变更单，再同步本契约、`系统设计说明书` 与测试用例。

## 12 设计约定（基线未明确，本契约固定）

以下 18 条为基线未逐字规定、但实现必须统一的细节。它们**不新增接口、不改字段名**，仅固定行为，避免前后端各自猜测。

| 编号 | 约定 |
|---|---|
| C-1 | 分页默认 `page=1`、`pageSize=10`，`pageSize` 上限 100；越界返回 40001 而非静默夹紧（前端应自行约束）。 |
| C-2 | 路由注册顺序：`/exams/available` 先于 `/exams/:id`；`/grading/pending` 先于 `/grading/:attemptId`。 |
| C-3 | 失败响应只含 `code` 与 `message`，不含 `data`。 |
| C-4 | 唯一约束冲突（用户名、课程代码）统一返回 40901，`message` 说明冲突字段。 |
| C-5 | 被 `published` / `closed` 考试的试卷引用的题目，禁止修改 `type`/`answer`、禁止删除，返回 40901；其余字段可改。 |
| C-6 | 存在关联数据（课程、考试、答卷、答题明细）的用户不可删除，返回 40901；不可删除/禁用当前登录账号。 |
| C-7 | `attemptStatus` 枚举固定为 `none` / `in_progress` / `submitted` / `graded`。 |
| C-8 | `PUT /exams/:id` 为「提供即更新」，`questions` 提供则整体替换并重算总分；仅 `draft` 可调用。 |
| C-9 | `GET /attempts/:id` 对教师也不返回 `answer`/`analysis`（该接口面向答题现场）；教师阅卷请用 B31。 |
| C-10 | 成绩接口要求 `status != 'in_progress'`，否则 40901。 |
| C-11 | 时间入参统一 `YYYY-MM-DD HH:mm:ss`，亦兼容 `new Date()` 可解析的 ISO 8601；出参恒为前者。 |
| C-12 | 批量导入的 `failed[].index` 为 `questions` 数组下标，**从 0 开始**。 |
| C-13 | 可选字段传空字符串视为「未提供」；传 `null` 表示显式清空（仅对可空字段生效）。 |
| C-14 | 开考时间窗校验使用服务端时间：`start_time ≤ now ≤ end_time`，否则 40901。 |
| C-15 | 指派为覆盖式语义：请求中的 `studentIds` 即最终名单，空数组清空指派。 |
| C-16 | `GET /attempts/:id` 严格按基线仅放行 `student(本人)` 与 `teacher`，**admin 调用返回 40301**；管理员排查请用 B29 或 B31。此不对称已登记为设计权衡 T7。 |
| C-17 | 多选判分「集合完全相等才得分」，少选、错选、多选均 0 分；单选与判断精确匹配；简答不自动判分。 |
| C-18 | 重复开考返回原答卷（HTTP 200），重复交卷返回既有判分（HTTP 200），二者均非错误。 |

## 13 契约变更记录

| 版本 | 日期 | 变更 | 变更单 |
|---|---|---|---|
| v1.0 | 2026-10-31 | 首版，覆盖基线 36 条接口 | — |
