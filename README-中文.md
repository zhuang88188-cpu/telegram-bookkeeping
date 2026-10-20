# Telegram 记账机器人（Vercel + Supabase）

这是一个简易起步版：支持收入、支出、今日汇总、本月汇总。它不是现成的完整财务系统。

## 支持的消息

- `支出 35 午餐`
- `收入 500 工资`
- `/today`
- `/month`
- `/help`

## 部署总流程

1. 将项目文件上传到 GitHub 仓库（保留 `api` 文件夹结构）。
2. 在 Supabase 创建项目，在 SQL Editor 中运行 `database.sql`。
3. 在 Vercel 导入 GitHub 仓库。
4. 在 Vercel Project → Settings → Environment Variables 添加：
   - `TELEGRAM_BOT_TOKEN`：BotFather 提供的机器人 Token
   - `TELEGRAM_WEBHOOK_SECRET`：自定义随机字符串，只允许 A-Z、a-z、0-9、下划线和连字符，建议至少 32 位
   - `SUPABASE_URL`：Supabase 项目 URL，例如 `https://xxxx.supabase.co`
   - `SUPABASE_SECRET_KEY`：Supabase 的 secret key（旧项目可能显示 `service_role`）。只放在 Vercel 服务端环境变量，绝不能公开。
5. 部署成功后，打开 `https://你的域名.vercel.app/api/webhook`，应看到 `Telegram bookkeeping webhook is running.`
6. 设置 Telegram Webhook。将下面地址里的占位符换成真实值，再在浏览器地址栏打开（不要分享该地址，因为其中包含 Token）：

`https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<你的Vercel域名>/api/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`

成功时 Telegram 应返回 JSON，包含 `"ok":true`。
7. 在 Telegram 打开机器人，发送 `/start`，再测试 `支出 35 午餐`、`收入 500 工资`、`/today`。

## 重要说明

- Vercel 免费套餐和服务额度可能变化，请以账户当前显示为准。
- 本示例按 UTC 统计今日/月度；如果需要日本/中国当地日期统计，需要修改时区处理。
- 这是基础版，没有多人群组隔离以外的高级权限、预算、导出、附件识别或自动分类功能。
- 如果 BotFather Token 曾公开发送给别人，请在 BotFather 中撤销/重新生成。
