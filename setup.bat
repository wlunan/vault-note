@echo off
REM VaultNote 快速开始脚本（Windows 版本）

setlocal enabledelayedexpansion

echo.
echo 🚀 VaultNote 快速开始
echo ====================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Node.js，请先安装
    echo 📥 访问 https://nodejs.org 下载
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✅ Node.js 版本: %NODE_VERSION%
echo ✅ npm 版本: %NPM_VERSION%
echo.

REM 1. 安装依赖
echo 📦 正在安装依赖...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)
echo ✅ 依赖安装完成
echo.

REM 2. 检查环境配置
if not exist .env.local (
    echo ⚠️  未找到 .env.local，正在复制示例文件...
    copy .env.example .env.local >nul
    echo 📝 请编辑 .env.local 并填入 Supabase 配置
    echo.
    echo 获取配置步骤:
    echo 1. 访问 https://supabase.com/dashboard
    echo 2. 创建新项目（或选择现有项目）
    echo 3. 进入项目设置 → API
    echo 4. 复制 Project URL 和 anon public key
    echo 5. 粘贴到 .env.local 中
    echo.
    echo 创建数据库表:
    echo 1. 在 Supabase 控制台进入 SQL Editor
    echo 2. 创建新查询
    echo 3. 复制 supabase/migrations/20260222000000_create_notes_table.sql 内容
    echo 4. 执行查询
    echo.
    pause
)

REM 3. 启动开发服务器
echo 🎯 启动开发服务器...
echo 📱 本地访问地址: http://localhost:5173
echo.
echo 按 Ctrl+C 停止服务器
echo.

call npm run dev

endlocal
