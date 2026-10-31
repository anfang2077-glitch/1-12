-- =============================================================================
-- 在线考试系统 数据库初始化脚本（MySQL 8.0）
-- 注意：本脚本会先删除 8 张业务表再重建，仅用于开发/演示环境。
-- 执行方式：npm run db:init  （读取 .env 中的 MYSQL_* 配置）
-- 字符集：utf8mb4_general_ci；引擎：InnoDB
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `exam_system`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE `exam_system`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `answers`;
DROP TABLE IF EXISTS `attempts`;
DROP TABLE IF EXISTS `exam_students`;
DROP TABLE IF EXISTS `exam_questions`;
DROP TABLE IF EXISTS `exams`;
DROP TABLE IF EXISTS `questions`;
DROP TABLE IF EXISTS `courses`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- 4.1 用户表
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username` VARCHAR(50) NOT NULL COMMENT '登录名（学号/工号）',
  `password_hash` VARCHAR(100) NOT NULL COMMENT 'bcrypt 哈希，cost=10',
  `real_name` VARCHAR(50) NOT NULL COMMENT '真实姓名',
  `role` ENUM('admin','teacher','student') NOT NULL COMMENT '角色',
  `email` VARCHAR(100) NULL COMMENT '邮箱',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 启用 / 0 禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户表';

-- 4.2 课程表
CREATE TABLE `courses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '课程名',
  `code` VARCHAR(30) NOT NULL COMMENT '课程代码',
  `description` VARCHAR(500) NULL COMMENT '简介',
  `teacher_id` BIGINT UNSIGNED NOT NULL COMMENT '任课教师',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_courses_code` (`code`),
  KEY `idx_courses_teacher` (`teacher_id`),
  CONSTRAINT `fk_courses_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='课程表';

-- 4.3 题库表
CREATE TABLE `questions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` BIGINT UNSIGNED NOT NULL COMMENT '所属课程',
  `type` ENUM('single','multiple','judge','short') NOT NULL COMMENT '题型',
  `stem` VARCHAR(1000) NOT NULL COMMENT '题干',
  `options` JSON NULL COMMENT '[{"key":"A","text":"..."}]，简答为 NULL',
  `answer` JSON NOT NULL COMMENT '标准答案：字符串或数组',
  `score` DECIMAL(6,2) NOT NULL COMMENT '建议分值',
  `difficulty` TINYINT NOT NULL DEFAULT 3 COMMENT '难度 1~5',
  `knowledge_point` VARCHAR(100) NULL COMMENT '知识点',
  `analysis` VARCHAR(1000) NULL COMMENT '解析',
  `creator_id` BIGINT UNSIGNED NULL COMMENT '创建人',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_questions_course` (`course_id`),
  KEY `idx_questions_type` (`type`),
  KEY `idx_questions_difficulty` (`difficulty`),
  KEY `idx_questions_creator` (`creator_id`),
  CONSTRAINT `fk_questions_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`),
  CONSTRAINT `fk_questions_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='题库表';

-- 4.4 考试表
CREATE TABLE `exams` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(150) NOT NULL COMMENT '考试标题',
  `course_id` BIGINT UNSIGNED NOT NULL COMMENT '所属课程',
  `description` VARCHAR(500) NULL COMMENT '说明',
  `start_time` DATETIME NOT NULL COMMENT '开始时间',
  `end_time` DATETIME NOT NULL COMMENT '结束时间',
  `duration_min` INT NOT NULL COMMENT '时长（分钟）',
  `total_score` DECIMAL(6,2) NOT NULL COMMENT '试卷总分',
  `pass_score` DECIMAL(6,2) NOT NULL COMMENT '及格线',
  `shuffle` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否乱序',
  `status` ENUM('draft','published','closed') NOT NULL DEFAULT 'draft',
  `created_by` BIGINT UNSIGNED NOT NULL COMMENT '创建人',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exams_course_status` (`course_id`, `status`),
  KEY `idx_exams_created_by` (`created_by`),
  CONSTRAINT `fk_exams_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`),
  CONSTRAINT `fk_exams_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='考试表';

-- 4.5 试卷题目表
CREATE TABLE `exam_questions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `exam_id` BIGINT UNSIGNED NOT NULL,
  `question_id` BIGINT UNSIGNED NOT NULL,
  `score` DECIMAL(6,2) NOT NULL COMMENT '该题在本卷分值',
  `sort_order` INT NOT NULL COMMENT '题序',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_exam_questions` (`exam_id`, `question_id`),
  KEY `idx_exam_questions_question` (`question_id`),
  CONSTRAINT `fk_exam_questions_exam` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exam_questions_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='试卷题目表';

-- 4.6 考生指派表
CREATE TABLE `exam_students` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `exam_id` BIGINT UNSIGNED NOT NULL,
  `student_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_exam_students` (`exam_id`, `student_id`),
  KEY `idx_exam_students_student` (`student_id`),
  CONSTRAINT `fk_exam_students_exam` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exam_students_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='考生指派表';

-- 4.7 答卷（考试记录）表
CREATE TABLE `attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `exam_id` BIGINT UNSIGNED NOT NULL,
  `student_id` BIGINT UNSIGNED NOT NULL,
  `started_at` DATETIME NOT NULL COMMENT '开考时间',
  `submitted_at` DATETIME NULL COMMENT '交卷时间',
  `deadline_at` DATETIME NOT NULL COMMENT '截止时间 = min(started_at+duration, exam.end_time)',
  `status` ENUM('in_progress','submitted','graded') NOT NULL DEFAULT 'in_progress',
  `objective_score` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `subjective_score` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `total_score` DECIMAL(6,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_attempts_exam_student` (`exam_id`, `student_id`),
  KEY `idx_attempts_student` (`student_id`),
  KEY `idx_attempts_exam_status` (`exam_id`, `status`),
  CONSTRAINT `fk_attempts_exam` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`),
  CONSTRAINT `fk_attempts_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='答卷表';

-- 4.8 答题明细表
CREATE TABLE `answers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `attempt_id` BIGINT UNSIGNED NOT NULL,
  `question_id` BIGINT UNSIGNED NOT NULL,
  `answer` JSON NULL COMMENT '学生作答',
  `score` DECIMAL(6,2) NOT NULL DEFAULT 0 COMMENT '本题得分',
  `comment` VARCHAR(500) NULL COMMENT '评语',
  `graded_by` BIGINT UNSIGNED NULL COMMENT '阅卷人',
  `graded_at` DATETIME NULL COMMENT '阅卷时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_answers_attempt_question` (`attempt_id`, `question_id`),
  KEY `idx_answers_question` (`question_id`),
  KEY `idx_answers_graded_by` (`graded_by`),
  CONSTRAINT `fk_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_answers_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`),
  CONSTRAINT `fk_answers_grader` FOREIGN KEY (`graded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='答题明细表';
