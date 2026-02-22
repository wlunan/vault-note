# Supabase 配置指南

本文档说明如何设置 Supabase 后端以支持 VaultNote。

## 🚀 第一步：创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 点击 "New Project"
3. 填入项目名称（例如 "vaultnote"）和数据库密码
4. 选择地域和计划（Free 计划足够）
5. 等待项目创建完成

## 📋 第二步：获取 API 密钥

1. 进入项目仪表板
2. 左侧菜单 → "Settings" → "API"
3. 复制以下信息：
   - **Project URL**: 填入 `VITE_SUPABASE_URL`
   - **anon public key**: 填入 `VITE_SUPABASE_ANON_KEY`

## 💾 第三步：创建数据库表

### 方法 1：使用 SQL 编辑器（推荐）

1. 进入项目仪表板
2. 左侧菜单 → "SQL Editor"
3. 点击 "New Query"
4. 复制 `supabase/migrations/20260222000000_create_notes_table.sql` 中的全部 SQL
5. 粘贴到编辑器
6. 点击 "Run" 执行

### 方法 2：使用 Supabase CLI

```bash
# 安装 CLI
npm install -g supabase

# 登录
supabase login

# 链接到项目
supabase link --project-ref your-project-ref

# 执行迁移
supabase db push
```

## ✅ 第四步：配置 RLS 策略（已在迁移脚本中完成）

迁移脚本已经自动配置了以下 RLS 策略：

- **SELECT**: 所有人可读取所有笔记
- **INSERT**: 所有人可创建新笔记
- **UPDATE**: 所有人可更新笔记
- **DELETE**: 所有人可删除笔记

由于所有数据都是加密的，RLS 主要用于日志审计，不影响数据安全性。

## 🔧 第五步：配置环境变量

1. 复制 `.env.example` 为 `.env.local`
2. 填入 Supabase 项目信息：
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## 🧪 测试连接

运行开发服务器：
```bash
npm run dev
```

尝试创建或打开笔记。如果成功加载并保存，说明配置正确。

## 🔒 生产环境配置

### 1. 启用 HTTPS

Supabase 自动启用 HTTPS，你的应用也应该部署到支持 HTTPS 的平台（如 Vercel、Netlify）。

### 2. 配置 CORS（如需跨域）

如果前端和 Supabase 在不同域名：

1. 进入项目设置 → "API" → "CORS"
2. 添加你的域名到允许列表

### 3. 备份数据

定期在 Supabase 控制台导出数据备份：

1. Settings → "Backups"
2. 创建手动备份或配置自动备份

## 📊 监控和维护

### 查看数据库使用量

1. 进入项目仪表板
2. "Database" → "Backups" 下方查看存储使用情况

### 查看 API 调用统计

1. "Analytics" 标签页查看请求统计

### 调试查询问题

1. "SQL Editor" 中测试 SQL 查询
2. 检查 RLS 策略是否正确应用

## ⚠️ 常见问题

### Q: 数据会被 Supabase 看到吗？
**A**: 不会。所有数据都在客户端加密后再上传，Supabase 只能看到无意义的加密数据。

### Q: 能否升级为付费计划？
**A**: 可以。在项目设置中升级，不影响现有数据和应用。

### Q: 如何删除所有笔记？
**A**: 进入 "Table Editor" → "notes" 表 → 全选删除。或执行：
```sql
DELETE FROM notes;
```

### Q: 误删笔记怎么办？
**A**: 可以在 "Backups" 中恢复备份，或联系 Supabase 支持获取数据恢复帮助。

## 🔐 安全最佳实践

1. **定期备份**: 每月至少备份一次
2. **监控成本**: 免费计划有使用限制，定期检查
3. **更新依赖**: 定期更新 Vue 和 Supabase 库
4. **审计日志**: 启用 Supabase 审计日志（付费功能）

---

更多信息请参考 [Supabase 官方文档](https://supabase.com/docs)
