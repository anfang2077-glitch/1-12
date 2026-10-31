'use strict';

const { formatDateTime, addMinutes } = require('../utils/time');
const { hashPasswordSync } = require('../utils/password');

// 种子密码哈希只计算一次，避免每个测试上下文重复 bcrypt 运算
const HASH_CACHE = new Map();
function passwordHash(plain) {
  if (!HASH_CACHE.has(plain)) HASH_CACHE.set(plain, hashPasswordSync(plain));
  return HASH_CACHE.get(plain);
}

/**
 * 构造基线第 8 节要求的演示数据（不含自增 ID，由仓储插入时生成）。
 * 2 门课程、每门 8 道题（四种题型齐全）、2 场考试、1 份已交卷待阅答卷。
 * @param {{now?: Date}} options
 */
function buildSeedData(options = {}) {
  const now = options.now || new Date();
  const stamp = formatDateTime(now);

  const users = [
    {
      key: 'admin',
      username: 'admin',
      password: 'Admin@123',
      realName: '系统管理员',
      role: 'admin',
      email: 'admin@example.com',
      status: 1
    },
    {
      key: 'teacher01',
      username: 'teacher01',
      password: 'Teach@123',
      realName: '张老师',
      role: 'teacher',
      email: 'teacher01@example.com',
      status: 1
    },
    {
      key: 'student01',
      username: 'student01',
      password: 'Stu@123',
      realName: '李小明',
      role: 'student',
      email: 'student01@example.com',
      status: 1
    },
    {
      key: 'student02',
      username: 'student02',
      password: 'Stu@123',
      realName: '王小红',
      role: 'student',
      email: 'student02@example.com',
      status: 1
    }
  ];

  const courses = [
    {
      key: 'ds',
      name: '数据结构',
      code: 'CS201',
      description: '线性表、树、图与常用算法',
      teacherKey: 'teacher01'
    },
    {
      key: 'net',
      name: '计算机网络',
      code: 'CS202',
      description: 'TCP/IP 协议栈与网络编程',
      teacherKey: 'teacher01'
    }
  ];

  const questions = [
    {
      key: 'ds-q1',
      courseKey: 'ds',
      type: 'single',
      stem: '顺序表中插入元素平均需要移动多少个元素？',
      options: [
        { key: 'A', text: 'n' },
        { key: 'B', text: 'n/2' },
        { key: 'C', text: '1' },
        { key: 'D', text: '0' }
      ],
      answer: 'B',
      score: 10,
      difficulty: 3,
      knowledgePoint: '线性表',
      analysis: '在等概率前提下平均移动 n/2 个元素。'
    },
    {
      key: 'ds-q2',
      courseKey: 'ds',
      type: 'single',
      stem: '冒泡排序的平均时间复杂度是？',
      options: [
        { key: 'A', text: 'O(n)' },
        { key: 'B', text: 'O(nlogn)' },
        { key: 'C', text: 'O(n^2)' },
        { key: 'D', text: 'O(1)' }
      ],
      answer: 'C',
      score: 10,
      difficulty: 2,
      knowledgePoint: '排序',
      analysis: '冒泡排序平均时间复杂度为 O(n^2)。'
    },
    {
      key: 'ds-q3',
      courseKey: 'ds',
      type: 'multiple',
      stem: '下列属于稳定排序算法的有？',
      options: [
        { key: 'A', text: '冒泡排序' },
        { key: 'B', text: '快速排序' },
        { key: 'C', text: '归并排序' },
        { key: 'D', text: '选择排序' }
      ],
      answer: ['A', 'C'],
      score: 10,
      difficulty: 3,
      knowledgePoint: '排序',
      analysis: '冒泡与归并稳定；快速与选择不稳定。'
    },
    {
      key: 'ds-q4',
      courseKey: 'ds',
      type: 'multiple',
      stem: '下列属于线性结构的有？',
      options: [
        { key: 'A', text: '栈' },
        { key: 'B', text: '队列' },
        { key: 'C', text: '二叉树' },
        { key: 'D', text: '图' }
      ],
      answer: ['A', 'B'],
      score: 10,
      difficulty: 2,
      knowledgePoint: '线性表',
      analysis: '栈与队列是操作受限的线性表。'
    },
    {
      key: 'ds-q5',
      courseKey: 'ds',
      type: 'judge',
      stem: '队列是先进先出的线性表。',
      answer: 'T',
      score: 10,
      difficulty: 1,
      knowledgePoint: '栈与队列',
      analysis: '队列在队尾插入、队头删除，先进先出。'
    },
    {
      key: 'ds-q6',
      courseKey: 'ds',
      type: 'judge',
      stem: '栈是先进先出的线性表。',
      answer: 'F',
      score: 10,
      difficulty: 1,
      knowledgePoint: '栈与队列',
      analysis: '栈是后进先出（LIFO）。'
    },
    {
      key: 'ds-q7',
      courseKey: 'ds',
      type: 'short',
      stem: '简述栈与队列的区别。',
      answer: '栈是后进先出（LIFO），只能在栈顶插入和删除；队列是先进先出（FIFO），队尾插入、队头删除。',
      score: 20,
      difficulty: 2,
      knowledgePoint: '栈与队列',
      analysis: '从操作端与出入顺序两方面作答。'
    },
    {
      key: 'ds-q8',
      courseKey: 'ds',
      type: 'short',
      stem: '简述快速排序的基本思想。',
      answer: '选择基准元素，将序列划分为小于和大于基准的两部分，再分别递归排序。',
      score: 20,
      difficulty: 4,
      knowledgePoint: '排序',
      analysis: '分治思想，平均时间复杂度 O(nlogn)。'
    },
    {
      key: 'net-q1',
      courseKey: 'net',
      type: 'single',
      stem: 'TCP 三次握手的主要目的是？',
      options: [
        { key: 'A', text: '加密数据' },
        { key: 'B', text: '建立可靠连接并同步序号' },
        { key: 'C', text: '压缩报文' },
        { key: 'D', text: '选择路由' }
      ],
      answer: 'B',
      score: 10,
      difficulty: 3,
      knowledgePoint: '传输层',
      analysis: '三次握手确认双方收发能力并同步初始序号。'
    },
    {
      key: 'net-q2',
      courseKey: 'net',
      type: 'single',
      stem: '默认使用 80 端口的应用层协议是？',
      options: [
        { key: 'A', text: 'FTP' },
        { key: 'B', text: 'SMTP' },
        { key: 'C', text: 'HTTP' },
        { key: 'D', text: 'DNS' }
      ],
      answer: 'C',
      score: 10,
      difficulty: 1,
      knowledgePoint: '应用层',
      analysis: 'HTTP 默认端口为 80，HTTPS 为 443。'
    },
    {
      key: 'net-q3',
      courseKey: 'net',
      type: 'multiple',
      stem: '下列属于传输层协议的有？',
      options: [
        { key: 'A', text: 'TCP' },
        { key: 'B', text: 'UDP' },
        { key: 'C', text: 'IP' },
        { key: 'D', text: 'ICMP' }
      ],
      answer: ['A', 'B'],
      score: 10,
      difficulty: 2,
      knowledgePoint: '传输层',
      analysis: 'TCP 与 UDP 是传输层协议，IP/ICMP 属于网络层。'
    },
    {
      key: 'net-q4',
      courseKey: 'net',
      type: 'multiple',
      stem: '下列属于应用层协议的有？',
      options: [
        { key: 'A', text: 'HTTP' },
        { key: 'B', text: 'DNS' },
        { key: 'C', text: 'TCP' },
        { key: 'D', text: 'FTP' }
      ],
      answer: ['A', 'B', 'D'],
      score: 10,
      difficulty: 2,
      knowledgePoint: '应用层',
      analysis: 'HTTP、DNS、FTP 均为应用层协议。'
    },
    {
      key: 'net-q5',
      courseKey: 'net',
      type: 'judge',
      stem: 'UDP 提供可靠传输。',
      answer: 'F',
      score: 10,
      difficulty: 1,
      knowledgePoint: '传输层',
      analysis: 'UDP 不保证可靠交付。'
    },
    {
      key: 'net-q6',
      courseKey: 'net',
      type: 'judge',
      stem: 'HTTP 是无状态协议。',
      answer: 'T',
      score: 10,
      difficulty: 1,
      knowledgePoint: '应用层',
      analysis: 'HTTP 本身不保存会话状态，需要 Cookie/Session 辅助。'
    },
    {
      key: 'net-q7',
      courseKey: 'net',
      type: 'short',
      stem: '简述 TCP 与 UDP 的主要区别。',
      answer: 'TCP 面向连接、可靠、有序、有流量控制；UDP 无连接、不可靠、开销小、实时性好。',
      score: 20,
      difficulty: 3,
      knowledgePoint: '传输层',
      analysis: '从连接性、可靠性、开销与适用场景作答。'
    },
    {
      key: 'net-q8',
      courseKey: 'net',
      type: 'short',
      stem: '简述 DNS 域名解析的基本过程。',
      answer: '先查本地缓存与 hosts，再依次向本地域名服务器、根域名服务器、顶级域名服务器、权威域名服务器递归/迭代查询。',
      score: 20,
      difficulty: 4,
      knowledgePoint: '应用层',
      analysis: '强调递归查询与迭代查询的配合。'
    }
  ];

  const exams = [
    {
      key: 'midterm',
      title: '数据结构期中考试',
      courseKey: 'ds',
      description: '闭卷，90 分钟',
      startTime: addMinutes(now, -60),
      endTime: addMinutes(now, 180),
      durationMin: 90,
      passScore: 60,
      shuffle: false,
      status: 'published',
      createdByKey: 'teacher01',
      questions: [
        { questionKey: 'ds-q1', score: 10 },
        { questionKey: 'ds-q2', score: 10 },
        { questionKey: 'ds-q3', score: 10 },
        { questionKey: 'ds-q4', score: 10 },
        { questionKey: 'ds-q5', score: 10 },
        { questionKey: 'ds-q6', score: 10 },
        { questionKey: 'ds-q7', score: 20 },
        { questionKey: 'ds-q8', score: 20 }
      ],
      studentKeys: ['student01', 'student02']
    },
    {
      key: 'final-draft',
      title: '计算机网络期末考试（草稿）',
      courseKey: 'net',
      description: '待定稿',
      startTime: addMinutes(now, 7 * 24 * 60),
      endTime: addMinutes(now, 7 * 24 * 60 + 120),
      durationMin: 120,
      passScore: 60,
      shuffle: false,
      status: 'draft',
      createdByKey: 'teacher01',
      questions: [
        { questionKey: 'net-q1', score: 10 },
        { questionKey: 'net-q2', score: 10 },
        { questionKey: 'net-q3', score: 10 },
        { questionKey: 'net-q4', score: 10 },
        { questionKey: 'net-q5', score: 10 },
        { questionKey: 'net-q6', score: 10 },
        { questionKey: 'net-q7', score: 20 },
        { questionKey: 'net-q8', score: 20 }
      ],
      studentKeys: []
    }
  ];

  const attempts = [
    {
      key: 'student02-midterm',
      examKey: 'midterm',
      studentKey: 'student02',
      startedAt: addMinutes(now, -80),
      submittedAt: addMinutes(now, -30),
      deadlineAt: addMinutes(now, 10),
      status: 'submitted',
      objectiveScore: 50,
      subjectiveScore: 0,
      totalScore: 50,
      answers: [
        { questionKey: 'ds-q1', answer: 'B', score: 10 },
        { questionKey: 'ds-q2', answer: 'C', score: 10 },
        { questionKey: 'ds-q3', answer: ['A'], score: 0 },
        { questionKey: 'ds-q4', answer: ['A', 'B'], score: 10 },
        { questionKey: 'ds-q5', answer: 'T', score: 10 },
        { questionKey: 'ds-q6', answer: 'F', score: 10 },
        {
          questionKey: 'ds-q7',
          answer: '栈是后进先出，队列是先进先出。',
          score: 0
        },
        {
          questionKey: 'ds-q8',
          answer: '选择基准，把序列分成两部分，再递归排序。',
          score: 0
        }
      ]
    }
  ];

  return { now, stamp, users, courses, questions, exams, attempts };
}

module.exports = { buildSeedData, passwordHash };
