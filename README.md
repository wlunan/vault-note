# VaultNote - 隐私优先的加密笔记本

一个完全客户端加密的在线笔记应用，所有数据在浏览器端加密后上传到服务器，确保端到端的隐私保护。

## 🔐 安全特性

- **端到端加密（E2E）**: 所有内容在浏览器端使用 Web Crypto API 加密
- **无需注册**: 只需设定笔记名称和密码即可使用
- **密码派生密钥**: 从用户输入的 noteName + password 派生 AES-GCM 密钥
- **服务端无法访问**: Supabase 服务器只存储加密数据，无法访问明文
- **忘记密码 = 永久丢失**: 明确告知用户密码无法恢复

## 🛠 技术栈

- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **加密**: Web Crypto API (AES-GCM, SHA-256)
- **后端**: Supabase (PostgreSQL + RLS)
- **样式**: 纯 CSS（无外部 UI 库依赖）

## 📋 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

在 [Supabase](https://supabase.com) 创建新项目，然后：

1. 复制 `.env.example` 为 `.env.local`
2. 填入你的 Supabase 项目 URL 和匿名密钥
3. 在 Supabase 控制台执行迁移脚本 (`supabase/migrations/20260222000000_create_notes_table.sql`)

### 3. 运行开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173`

### 4. 构建生产版本

```bash
npm run build
```

## 📁 项目结构

```
vault-note/
├── src/
│   ├── components/
│   │   └── NoteEditor.vue      # 主应用组件
│   ├── utils/
│   │   └── crypto.ts           # 加密/解密工具
│   ├── lib/
│   │   └── supabase.ts         # Supabase 客户端
│   ├── App.vue                 # 根组件
│   └── main.ts                 # 入口文件
├── supabase/
│   └── migrations/
│       └── 20260222000000_create_notes_table.sql  # 数据库迁移
├── index.html                  # HTML 入口
├── vite.config.ts             # Vite 配置
├── tsconfig.json              # TypeScript 配置
├── package.json               # 项目配置
└── .env.local                 # 环境变量（本地）
```

## 🔄 工作流程

### 创建或打开笔记

1. 用户输入 **笔记名称** 和 **访问密码**（至少 6 位）
2. 前端计算 `id = SHA-256(noteName)` 作为记录主键
3. 查询 Supabase 是否存在该笔记
4. 如果存在：验证密码 → 解密内容 → 显示
5. 如果不存在：创建新笔记（空内容）

### 保存笔记

1. 用户编辑文本框时，触发防抖保存逻辑
2. 延迟 1 秒后，加密当前内容 + 认证字符串
3. 调用 Supabase `upsert` API 保存（新建或更新）
4. 显示保存状态提示

### 加密方案

**密钥派生**:
```
key = SHA-256(noteName + password)
```

**加密步骤**:
1. 生成随机 IV（12 字节）
2. 使用 AES-GCM 加密内容和认证字符串
3. 将 IV + 加密数据 合并为一个 Uint8Array
4. 编码为 Base64 字符串存储

**解密步骤**:
1. 从 Base64 解码获得 Uint8Array
2. 提取前 12 字节作为 IV
3. 使用 AES-GCM 解密剩余数据
4. 验证密码正确性（检查认证字符串是否为 `"VAULTNOTE_AUTH_2026"`）

## 🗄 数据库架构

### notes 表

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,                    -- SHA-256(noteName) 的十六进制字符串
  encrypted_content TEXT NOT NULL,        -- Base64 加密的笔记内容
  encrypted_auth TEXT NOT NULL,           -- Base64 加密的认证字符串
  updated_at TIMESTAMP WITH TIME ZONE,    -- 最后更新时间
  created_at TIMESTAMP WITH TIME ZONE     -- 创建时间
);
```

### 行级安全 (RLS)

所有操作都允许（SELECT, INSERT, UPDATE, DELETE），因为数据已在客户端加密，服务器无法访问明文。

## 🔒 安全考虑

1. **加密强度**: AES-256-GCM（业界标准）
2. **密钥派生**: SHA-256（简化方案，可升级为 PBKDF2）
3. **IV 处理**: 每次加密生成新的随机 IV，包含在加密数据中
4. **认证标签**: GCM 模式自动生成，防止篡改
5. **HTTPS**: 生产环境必须使用 HTTPS 加密传输
6. **浏览器环境**: 依赖用户浏览器的 Web Crypto API 实现安全性

## ⚠️ 限制

- **密码恢复**: 无法恢复忘记的密码，数据永久丢失
- **离线同步**: 不支持离线编辑（需要网络连接）
- **社交分享**: 无内置分享功能（可手动分享 noteName + password）
- **版本控制**: 不保存历史版本（当前仅保存最新版本）

## 🚀 部署

### Vercel 部署

1. Fork 本仓库或上传到 GitHub
2. 在 Vercel 中导入项目
3. 设置环境变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 部署完成

### 其他静态托管

只需将 `dist/` 目录部署到任何 HTTP 服务器：

```bash
npm run build
# 上传 dist/ 文件夹到托管服务
```

## 📝 使用示例

1. **创建新笔记**:
   - 笔记名称: `my-secret-note`
   - 密码: `MySecurePassword123`
   - 点击"进入笔记"

2. **编辑笔记**:
   - 开始在文本框中输入
   - 自动保存每条编辑（延迟 1 秒）
   - 关闭浏览器标签页前确保已保存

3. **重新打开笔记**:
   - 输入相同的名称和密码
   - 之前的内容会被解密并显示

## 🐛 故障排除

### "无法访问该笔记（密码错误或不存在）"

- 确认输入的笔记名称和密码完全正确（区分大小写）
- 检查网络连接和 Supabase 连接状态
- 如果是新笔记，需要先保存内容再关闭

### 加载缓慢

- 检查 Supabase 连接是否正常
- 查看浏览器控制台是否有错误信息
- 尝试刷新页面

### 环境变量未加载

- 确保 `.env.local` 文件在项目根目录
- 修改环境变量后需要重启开发服务器

## 📄 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请在 GitHub Issues 中提出。

---

**提醒**: 忘记笔记名称和密码将导致数据永久丢失。请妥善保管！
