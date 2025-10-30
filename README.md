## 统一身份信息管理系统

### 技术栈
- Python 3.10+
- Flask + SQLAlchemy
- MySQL 8.x
- openpyxl（Excel 导出）

### 功能概览
- 学生端：提交/更新个人信息。
- 管理端：登录后批量导入、导出、搜索、增改学生信息。

### ⚡ 本地一键快速启动指南

#### Windows（推荐 PowerShell，需已装 Python 3.10+ 和 MySQL 8）
1. 克隆或下载代码，`cd` 到项目目录。
2. 创建虚拟环境并激活：
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
3. 安装全部依赖：
   ```powershell
   pip install -r requirements.txt
   ```
4. 初始化数据库
   - 启动 MySQL 后，登录并执行：
     ```sql
     CREATE DATABASE student_info CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
     ```
   - 复制 .env，修改数据库连接配置：
     ```powershell
     Copy-Item .env.example .env
     # 编辑 .env 文件，填写数据库名/用户名/密码
     ```
   - 初始化数据表及管理员：
     ```powershell
     python run.py db
     python run.py create-admin
     # (可选, 仅首次运行)
     ```
5. 运行：
   ```powershell
   python run.py
   ```
6. 访问网址：
   - 学生端：http://127.0.0.1:5000/
   - 管理端：http://127.0.0.1:5000/admin/login

#### Linux (Ubuntu 20.04+/Debian，需 Python 3.10+ 和 MySQL 8)
1. 安装依赖：
   ```bash
   sudo apt update
   sudo apt install python3 python3-venv python3-pip mysql-server git
   ```
2. 克隆代码并创建虚拟环境：
   ```bash
   git clone <your_repo_url> /opt/student-info
   cd /opt/student-info
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. 初始化和配置数据库（同上，建表语句一致）。
4. 拷贝.env并填写生产地址及DB密码：
   ```bash
   cp .env.example .env
   # 编辑 .env
   ```
5. 建表与初始管理员：
   ```bash
   python run.py db
   python run.py create-admin
   ```
6. 本地开发环境运行：
   ```bash
   python run.py
   ```
7. 生产部署（推荐 Nginx + Gunicorn/Supervisor 管理）：
   - Gunicorn 启动：
     ```bash
     source .venv/bin/activate
     gunicorn 'app:create_app()' --bind 127.0.0.1:8000 --workers 2
     ```
   - 配置 systemd 或 supervisor 保活见下文。
   - 配置 nginx 反向代理（见示例 nginx 配置段）。
   - HTTPS 推荐用 certbot。

### 部署技巧与安全建议
- 管理员实现 DB 持久化，强密码策略。
- 建议 MySQL 独立账号、仅该库操作权限。
- 启用 HTTPS，生产用独立 Gunicorn workers，尽量用 systemd/supervisor 托管。
- 日志仅记录关键信息。

### 常用维护/初始化命令
- 初始化数据库及表+补齐字段
  `python run.py db`
- 创建初始管理员 `python run.py create-admin`
- 新增管理员/改密详见 scripts/add_admin.py 和 scripts/reset_admin_pwd.py 示例。

如有部署异常/扩展需求请按实际服务器环境调整 python/sql/nginx/gunicorn 配置，或联系开发/运维同事协助。

### Railway/Machine/Cloud 一键部署须知（适用 Serverless/云平台）
1. 推荐将本项目推送至 GitHub 后，绑定至 Railway、新建 Web 服务。
2. 项目所有敏感信息如 `SECRET_KEY`、`MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DB` 等须全部通过 Railway 的环境变量面板配置。
3. 不要上传/提交 .env 文件，仅提供 .env.example 示例供开发者参照。
4. Railway 环境通常无需建表指令，首次启动会自动建表。如需初始化管理员可绑定 Github Workflow 或 PR 后台运行 `python run.py create-admin`。
5. 如果用 Railway 的 MySQL 插件，需在数据库插件页面查找连接串填入对应环境变量。
6. 生产部署可通过 Railway 变量面板快速更换数据源和密钥。

### 环境变量（无论哪里部署均需配置，不应 hardcode 于 settings...）
- SECRET_KEY
- MYSQL_HOST
- MYSQL_USER
- MYSQL_PASSWORD
- MYSQL_DB

*建议始终通过云平台控制台配置各关键的环境变量，严禁明文写进仓库与 settings 文件。*