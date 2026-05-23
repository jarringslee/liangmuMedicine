# 部署指南 · Cloudflare Pages

本项目使用 **Cloudflare Pages** 进行公网部署，目标是让 `public/data/herb-batches.json` 内置的样例二维码可以被任意手机扫描访问，从而真正验证「扫码 → 弹窗 → 详情」闭环。

---

## 一、为什么是 Cloudflare Pages

- 静态站点托管 + CDN + 免费 HTTPS
- 与 GitHub 仓库直连，每次 `git push` 自动构建 & 部署
- 支持 SPA fallback（通过 `_redirects` 配置）
- `*.pages.dev` 子域开箱即用，可后续绑自定义域名

---

## 二、关键配置文件

### 1. `public/_redirects`

让 `BrowserRouter` 的所有路由（如 `/trace/YM-TRACE-2026-0001`）在直链访问时回落到 `index.html`，由 React Router 接管路由匹配。

```
/data/*    200
/images/*  200

/*    /index.html    200
```

> 前两行显式声明 `/data` 与 `/images` 走静态文件命中，避免被通配规则吞掉。

### 2. `public/_headers`

为不同资源配置不同的缓存策略，平衡「样例数据需要可被更新」与「构建产物可长缓存」两个需求：

- `herb-batches.json` → 短缓存（60s），更新后可以快速生效
- `assets/*`（vite 出的带 hash 的 JS/CSS）→ 一年不可变
- `*.html` → 不缓存，每次拉新

---

## 三、首次部署流程

### Step 1 · 推送代码到 GitHub

```powershell
git add .
git commit -m "feat: step5 buyer & trace-loop, ready for Cloudflare Pages"
git push origin main
```

### Step 2 · 在 Cloudflare 控制台创建 Pages 项目

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com/) → 左侧 `Workers 和 Pages`
2. `创建` → `Pages` → `连接到 Git`
3. 授权 GitHub、选中 `jarringslee/liangmuMedicine`
4. 进入构建配置页，按下表填写：

| 项                | 值                       |
| ----------------- | ------------------------ |
| 项目名称           | `liangmu-medicine`（任意，会生成 `<name>.pages.dev`）|
| 生产分支           | `main`                   |
| Framework preset  | `Vite`                   |
| Build command     | `npm run build`          |
| Build output dir  | `dist`                   |
| Root directory    | `/`（留空）              |
| Node 版本环境变量  | `NODE_VERSION = 20`（或更高）|

5. 保存并部署。约 2-3 分钟后会得到形如 `https://liangmu-medicine.pages.dev` 的访问地址。

### Step 3 · 验收

部署完成后做以下三项验证：

1. 打开 `https://<your>.pages.dev/login`，用 `liangmu_admin` 或 `liangmu_buyer` 登录。
2. 进入任一药材详情，二维码下方的 URL 应当显示为 `https://<your>.pages.dev/trace/YM-TRACE-2026-XXXX`，**不是 localhost**。
3. 用手机微信 / 浏览器扫描该二维码：
   - 应直接打开 `/trace/...` 路径
   - 自动弹出「快速溯源」Modal（外部访问场景）
   - 点「查看完整溯源」可进入详情页

---

## 四、日常迭代

只要往 `main` push，Cloudflare 会自动重新构建：

```powershell
git add .
git commit -m "feat: ..."
git push
```

如果想在合并前先看效果，给分支起任意名称 push 上去，Pages 会生成 `https://<commit-hash>.<project>.pages.dev` 的预览链接。

---

## 五、本地与线上数据隔离

- **基础数据**（`public/data/herb-batches.json`） — 跟随构建产物分发，所有访客一致。
- **新增 / 编辑数据** — 走前端 `localStorage` 覆盖层（参考 `src/services/herbStorage.ts`），**只在当前浏览器可见**，不会同步到线上。

这是符合「演示型毕设」定位的合理取舍：保持公网二维码可扫，同时避免任何后端依赖。

---

## 六、常见问题

**Q1. 扫码后页面 404？**  
A：确认 `public/_redirects` 已随构建上传到 `dist` 根。可在 Pages 项目的「部署详情 → 部署文件」中检查。

**Q2. 二维码里依然是 localhost？**  
A：`TraceQrPanel.tsx` 用 `window.location.origin` 生成，确保是在线上域名下打开管理端再生成 / 查看二维码即可。

**Q3. 修改了 `herb-batches.json` 但线上没变？**  
A：默认短缓存最长 5 分钟。强制刷新或等待即可。彻底刷新可在 Cloudflare 控制台 `缓存 → 清除缓存`。

**Q4. 摄像头权限提示「不安全来源」？**  
A：手机浏览器要求 HTTPS 或 localhost 才允许调用摄像头。`*.pages.dev` 自带 HTTPS，正常使用即可。
