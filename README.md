# 学生信息管理系统

[![Nuxt 4](https://img.shields.io/badge/Nuxt-4.4-00DC82?logo=nuxt&labelColor=020420)](https://nuxt.com)
[![Nuxt UI](https://img.shields.io/badge/Nuxt_UI-4.6-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&labelColor=1C1C1C)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&labelColor=1E1E1E)](https://www.typescriptlang.org)
[![Drizzle](https://img.shields.io/badge/Drizzle-0.45-C5F74F?logo=drizzle&labelColor=151718)](https://orm.drizzle.team)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&labelColor=10233E)](https://www.postgresql.org)
[![pnpm](https://img.shields.io/badge/pnpm-10.33-F69220?logo=pnpm&labelColor=1A1A1A)](https://pnpm.io)

使用 Nuxt 4 构建的全栈网站，提供可视化仪表盘、角色管理、动态信息表、日志审计等功能，解决传统问卷收集学生信息方式存在的诸多如数据孤立、重复填写、信息变更不便、学生无法核验等弊端

## 项目说明

- 网站包含仪表盘、角色管理、信息表和操作日志等页面
- 管理员可以方便地收集、管理、持久化存储学生信息
- 设置多种角色和分配适当权限以辅助管理员收集学生信息
- 记录各种动作的操作日志方便管理员查看

## 技术栈

- 前端框架：Nuxt 4、Vue 3
- UI 组件：Nuxt UI
- 语言与类型系统：TypeScript
- 后端运行时：Nuxt Server Routes（Nitro）
- 数据访问层：Drizzle ORM
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

> [!tip]
> 请先创建好数据库

### 初始化数据库

如果你已经准备好数据库连接，可以执行：

```bash
pnpm run db:push
pnpm run db:seed
```

> [!tip]
> - `db:push` 会将 Drizzle Schema 推送到数据库，`db:seed` 会写入初始超级管理员和基础数据
>
> - 使用 `pnpm run db:studio` 启动数据库管理界面
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

## 部署前检查

建议在提交或部署前执行一次：

```bash
pnpm run lint
pnpm run typecheck
```

## 许可

本项目采用 [MIT License](LICENSE)
