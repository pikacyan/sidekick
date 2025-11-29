# Sidekick 监控机器人 (Sidekick Monitor Bot)

这是一个基于 Cloudflare Workers 的 Sidekick 直播间监控机器人。它能够定时检查指定直播间的状态，并通过 Telegram 机器人第一时间通知你主播开播或下播的消息。

## ✨ 功能特性

*   **自动监控**：利用 Cloudflare Workers 的 Cron Triggers 定时检查直播间状态。
*   **即时通知**：通过 Telegram 发送开播/下播通知，包含观众人数、粉丝数等信息。
*   **简单交互**：直接向机器人发送 Sidekick 直播间链接即可添加或取消监控。
*   **多用户支持**：支持多个用户分别监控不同的直播间。
*   **无服务器架构**：完全运行在 Cloudflare Edge 上，无需维护服务器。

## 🛠️ 程序功能分析

该项目是一个 Cloudflare Worker 应用，核心逻辑位于 `src/index.js`。

1.  **定时任务 (Cron)**: 配置为每 2 分钟运行一次 (`*/2 * * * *`)。它会遍历 KV 存储中所有被监控的房间，调用 Sidekick API 检查状态。如果状态发生变化（开播/下播），则触发通知。
2.  **KV 存储**: 使用 `STREAMER_MONITOR` 命名空间存储房间信息、当前直播状态 (`isLive`) 以及订阅该房间的用户列表 (`subscribers`)。
3.  **Telegram Webhook**: 处理用户发送的消息。
    *   **链接识别**: 自动识别 `sidekick.fans` 链接，实现一键订阅/退订。
    *   **指令响应**: 支持 `/list` 查看监控列表，`/start` 和 `/help` 查看帮助。
4.  **API 交互**: 封装了与 Sidekick 官方 API 的通信，获取主播实时信息。

*(注：未在项目中找到 Dockerfile，以上分析基于源代码 `src/index.js` 和配置文件 `wrangler.toml`)*

## 🚀 部署教程

### 准备工作
1.  拥有一个 Cloudflare 账户。
2.  申请一个 Telegram Bot Token (通过 [@BotFather](https://t.me/BotFather))。
3.  安装 [Node.js](https://nodejs.org/) 和 `wrangler` CLI。

### 步骤 1: 配置 Cloudflare KV
在终端中运行以下命令创建 KV 命名空间：

```bash
npx wrangler kv:namespace create "STREAMER_MONITOR"
```

将输出的 `id` 复制到 `wrangler.toml` 文件中的 `id` 字段。

### 步骤 2: 修改配置文件
编辑 `wrangler.toml` 文件：

```toml
# wrangler.toml

[[kv_namespaces]]
binding = "STREAMER_MONITOR"
id = "替换为你刚才创建的 KV ID" 
preview_id = "替换为你的 preview KV ID (可选)"

[vars]
TELEGRAM_BOT_TOKEN = "替换为你的 Telegram Bot Token"
# API 地址通常无需修改，除非 Sidekick 接口变更
API_BASE_URL = "https://sidekick-service-go-query-696817756223.europe-west1.run.app"
```

### 步骤 3: 部署
运行以下命令将 Worker 部署到 Cloudflare：

```bash
npx wrangler deploy
```

### 步骤 4: 设置 Telegram Webhook
部署成功后，你会获得一个 Worker URL (例如 `https://streamer-monitor.your-name.workers.dev`)。
你需要将 Telegram Bot 的 Webhook 设置为这个地址：

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_URL>/webhook"
```
*(将 `<YOUR_BOT_TOKEN>` 和 `<YOUR_WORKER_URL>` 替换为实际值)*

## 📱 使用说明

1.  打开你的 Telegram 机器人对话框。
2.  **添加监控**：发送 Sidekick 直播间链接，例如：`https://sidekick.fans/u123456`。
3.  **取消监控**：再次发送相同的链接即可取消。
4.  **查看列表**：发送 `/list` 命令查看当前正在监控的所有直播间。