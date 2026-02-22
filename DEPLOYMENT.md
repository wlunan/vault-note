# VaultNote 部署指南

本文档说明如何部署 VaultNote 到生产环境。

## 📦 构建项目

```bash
# 安装依赖
npm install

# 构建生产版本
npm run build

# 预览生产版本（可选）
npm run preview
```

构建完成后，`dist/` 目录包含所有静态文件。

## 🚀 部署选项

### 选项 1: Vercel（推荐）

Vercel 是 Vite 官方推荐的部署平台。

#### 第一次部署

```bash
# 全局安装 Vercel CLI
npm install -g vercel

# 在项目根目录登录
vercel login

# 部署项目
vercel --prod
```

#### 通过 Git 部署（推荐）

1. 将代码推送到 GitHub
2. 在 [Vercel Dashboard](https://vercel.com/dashboard) 导入项目
3. 配置环境变量
4. 部署完成！后续每次 push 到 main 分支会自动部署

#### 配置环境变量

在 Vercel Dashboard 中：

1. 进入项目设置 → "Environment Variables"
2. 添加以下变量：
   ```
   VITE_SUPABASE_URL = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-key
   ```
3. 重新部署

### 选项 2: Netlify

#### 通过 Git 部署

1. 将代码推送到 GitHub/GitLab/Bitbucket
2. 在 [Netlify](https://netlify.com) 连接你的仓库
3. 配置构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 添加环境变量
5. 部署！

#### netlify.toml 配置文件

```toml
[build]
  command = "npm run build"
  publish = "dist"

[env]
  VITE_SUPABASE_URL = "https://your-project.supabase.co"
  VITE_SUPABASE_ANON_KEY = "your-anon-key"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 选项 3: GitHub Pages

适合个人项目。

```bash
# 修改 vite.config.ts 中的 base 配置
# 如果仓库名为 vault-note，修改为：
# base: '/vault-note/'

npm run build

# 推送到 gh-pages 分支
npx gh-pages -d dist
```

在 GitHub 仓库设置中启用 GitHub Pages，选择 gh-pages 分支。

### 选项 4: Docker 部署

创建 `Dockerfile`:

```dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 运行阶段
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

创建 `nginx.conf`:

```nginx
server {
  listen 80;
  server_name _;

  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }

  # 安全头部
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
```

构建和运行：

```bash
docker build -t vault-note .
docker run -p 80:80 vault-note
```

### 选项 5: 自己的服务器

#### Nginx 配置

```nginx
server {
  listen 80;
  server_name vaultnote.app;

  # 重定向到 HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name vaultnote.app;

  # SSL 证书配置（使用 Let's Encrypt）
  ssl_certificate /etc/letsencrypt/live/vaultnote.app/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/vaultnote.app/privkey.pem;

  # 安全配置
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  root /var/www/vault-note/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  # 缓存静态资源
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # 不缓存 HTML
  location = /index.html {
    expires -1;
    add_header Cache-Control "public, must-revalidate, proxy-revalidate";
  }

  # 安全头部
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
```

部署步骤：

```bash
# 构建
npm run build

# 上传到服务器
scp -r dist/* user@your-server:/var/www/vault-note/dist/

# 获取 SSL 证书（首次）
sudo certbot certonly --webroot -w /var/www/vault-note -d vaultnote.app

# 重新加载 Nginx
sudo systemctl reload nginx
```

## 🔐 生产环境检查清单

- [ ] HTTPS 已启用
- [ ] Supabase 环境变量已正确配置
- [ ] CSP（Content Security Policy）已配置
- [ ] CORS 头部已正确设置
- [ ] 静态资源已启用缓存
- [ ] HTML 未缓存（总是最新版本）
- [ ] 错误日志已配置
- [ ] 备份策略已建立
- [ ] DNS 已指向正确的服务器/CDN
- [ ] 性能监控已启用（可选）

## 📊 监控和维护

### 错误监控

建议集成错误追踪服务（如 Sentry）：

```typescript
// main.ts 中添加
import * as Sentry from "@sentry/vue";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: import.meta.env.MODE,
});
```

### 日志收集

Vercel、Netlify 等平台自动记录日志。自建服务器可使用：
- ELK Stack
- Datadog
- New Relic

### 性能分析

1. 使用 Vercel Analytics（如在 Vercel 部署）
2. 配置 Google Analytics
3. 使用 Web Vitals

## 🔄 更新流程

```bash
# 本地开发
git add .
git commit -m "feat: 新功能"
git push origin main

# 如果使用 Vercel/Netlify：自动部署！

# 如果自建服务器：
npm run build
# 上传 dist/ 目录到服务器
```

## 🆘 常见问题

### Q: 部署后页面空白
**A**: 检查：
1. 浏览器控制台是否有 JavaScript 错误
2. 网络标签是否有失败的请求
3. Supabase 连接是否正常

### Q: 环境变量未生效
**A**: 
1. 重新部署
2. 清除浏览器缓存
3. 检查变量名是否正确（区分大小写）

### Q: HTTPS 证书错误
**A**:
1. 检查证书有效期
2. 使用 `https://certbot.eff.org/` 更新
3. 确保 DNS 指向正确的服务器

### Q: 性能不佳
**A**:
1. 启用 Gzip 压缩
2. 使用 CDN
3. 优化 Supabase 查询
4. 增加数据库连接池

## 📞 支持

遇到问题？
- 查看 Vercel/Netlify 文档
- 阅读 Supabase 文档
- 在项目 Issues 中提问

---

祝部署顺利！🎉
