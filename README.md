# 学生信息管理系统

[![Nuxt 4](https://img.shields.io/badge/Nuxt-4.4-00DC82?logo=nuxt&labelColor=020420)](https://nuxt.com)
[![Nuxt UI](https://img.shields.io/badge/Nuxt_UI-4.6-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&labelColor=1C1C1C)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&labelColor=1E1E1E)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7.7-2D3748?logo=prisma&labelColor=111111)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&labelColor=10233E)](https://www.postgresql.org)
[![pnpm](https://img.shields.io/badge/pnpm-10.33-F69220?logo=pnpm&labelColor=1A1A1A)](https://pnpm.io)

基于 Nuxt 4 构建的学生信息管理系统，提供学生信息、角色管理、动态信息表、日志审计等能力，面向管理员、班委和学生场景

## 技术栈

- 前端框架：Nuxt 4、Vue 3
- UI 组件：Nuxt UI
- 语言与类型系统：TypeScript
- 后端运行时：Nuxt Server Routes（Nitro）
- 数据访问层：Prisma
- 数据库：PostgreSQL
- 工程化与包管理：pnpm、ESLint

## 建议环境

- Node.js >= 22
- pnpm >= 10
- PostgreSQL 18

## 本地开发

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

在项目根目录复制 `.env.example` 为 `.env`，并配置数据库链接


### 生成 Prisma Client

```bash
pnpm run db:generate
```

### 初始化数据库

如果你已经准备好数据库连接，可以执行：

```bash
pnpm run db:push
pnpm run db:seed
```

> [!tip]
> - `db:push` 会将 Prisma Schema 推送到数据库，`db:seed` 会写入初始超级管理员和基础数据。
>
> - 使用 `pnpm run db:reset` 重置数据库并重新应用迁移

### 启动开发服务器

```bash
pnpm run dev
```

> [!tip]
> - 默认访问地址：`http://localhost:3000`
>
> - 使用 `pnpm run build` 构建生产版本
>
> - 使用 `pnpm run preview` 本地预览生产构建

## 项目说明

- 系统包含学生信息、角色管理、动态表管理和操作日志等功能
- 管理员可以维护学生档案、信息表和角色数据
- 班委和学生按权限访问各自可见的数据范围
- 运行日志、登录日志和操作日志均在系统内统一管理

## 部署前检查

建议在提交或部署前执行一次：

```bash
pnpm run lint
pnpm run typecheck
```

如果涉及 Prisma Schema 修改，先执行：

```bash
pnpm run db:generate
```

## 许可

本项目采用 [MIT License](LICENSE)
