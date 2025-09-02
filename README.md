# 直播间监控 Cloudflare Worker

一个基于 Cloudflare Worker 的直播间监控系统，支持通过 Telegram Bot 发送开播/下播通知。

## 功能特性

- 🕐 **定时监控**: 每5分钟自动检查直播间状态
- 📱 **Telegram 通知**: 当主播开播或下播时自动发送通知
- 🔄 **状态变化检测**: 只有状态发生变化时才发送通知
- 💾 **KV 存储**: 使用 Cloudflare KV 存储监控数据和用户订阅信息
- 🌐 **RESTful API**: 提供完整的 API 接口
- 🤖 **Telegram Bot**: 支持用户通过 Bot 命令管理监控

## 系统架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │   Telegram Bot   │    │   Streamer API  │
│     Worker      │◄──►│   (Webhook)      │    │   (External)    │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │   Cron Job  │ │    │ │ Command      │ │    │ │ Room Status │ │
│ │ (每5分钟)    │ │    │ │ Handler      │ │    │ │ Check       │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    └─────────────────┘
│ │   KV Store  │ │    │ │ Notification │ │
│ │ (监控数据)   │ │    │ │ Sender       │ │
│ └─────────────┘ │    │ └──────────────┘ │
└─────────────────┘    └──────────────────┘
```

## 快速开始

### 1. 环境准备

1. 安装 [Node.js](https://nodejs.org/) (版本 16 或更高)
2. 安装 Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```
3. 登录 Cloudflare:
   ```bash
   wrangler login
   ```

### 2. 创建 Telegram Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/botfather)
2. 发送 `/newbot` 命令创建新机器人
3. 设置机器人名称和用户名
4. 保存获得的 Bot Token

### 3. 设置项目

1. 克隆项目并安装依赖:
   ```bash
   git clone <your-repo>
   cd streamer-monitor
   npm install
   ```

2. 创建 KV 命名空间:
   ```bash
   npm run setup
   npm run setup:preview
   ```

3. 配置环境变量，编辑 `wrangler.toml`:
   ```toml
   [vars]
   TELEGRAM_BOT_TOKEN = "your-telegram-bot-token"
   API_BASE_URL = "https://sidekick-service-go-query-696817756223.europe-west1.run.app"
   WORKER_URL = "https://your-worker-name.your-subdomain.workers.dev"
   ```

4. 更新 KV 命名空间 ID:
   ```toml
   [[kv_namespaces]]
   binding = "STREAMER_MONITOR"
   id = "your-kv-namespace-id"        # 从 setup 命令获得
   preview_id = "your-preview-kv-id"  # 从 setup:preview 命令获得
   ```

### 4. 部署

1. 部署 Worker:
   ```bash
   npm run deploy
   ```

2. 设置 Telegram Webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
        -H "Content-Type: application/json" \
        -d '{"url": "https://your-worker-name.your-subdomain.workers.dev/webhook"}'
   ```

## API 接口

jiank
Content-Type: application/json

{
  "roomId": "cmahm5oy0001fl40m59hgr47g",
  "chatId": "123456789"
}
```

### 移除监控
```http
POST /api/monitor/remove
Content-Type: application/json

{
  "roomId": "cmahm5oy0001fl40m59hgr47g",
  "chatId": "123456789"
}
```

### 查看监控列表
```http
GET /api/monitor/list?chatId=123456789
```

### 检查房间状态
```http
GET /api/check-status?roomId=cmahm5oy0001fl40m59hgr47g
```

## Telegram Bot 使用说明

### 📋 简单操作

| 操作 | 说明 | 示例 |
|------|------|------|
| 发送 Sidekick 链接 | 添加监控 | `https://sidekick.fans/cmahm5oy0001fl40m59hgr47g` |
| 再次发送相同链接 | 取消监控 | `https://sidekick.fans/cmahm5oy0001fl40m59hgr47g` |
| `/list` | 查看监控列表 | `/list` |
| `/start` | 显示帮助信息 | `/start` |

### 🔗 链接支持

机器人支持直接发送 Sidekick 链接，会自动识别房间ID：

**支持的链接格式：**
- `https://sidekick.fans/cmahm5oy0001fl40m59hgr47g`
- `http://sidekick.fans/cmahm5oy0001fl40m59hgr47g`
- 带查询参数：`https://sidekick.fans/cmahm5oy0001fl40m59hgr47g?param=value`
- 带锚点：`https://sidekick.fans/cmahm5oy0001fl40m59hgr47g#section`
- 混合文本：`这是文本 https://sidekick.fans/cmahm5oy0001fl40m59hgr47g 其他文本`

**使用流程：**
1. 发送 Sidekick 链接 → 自动添加监控
2. 再次发送相同链接 → 自动取消监控
3. 发送 `/list` → 查看当前监控列表

## 数据存储结构

### KV 存储格式

**Key**: 房间ID (例如: `cmahm5oy0001fl40m59hgr47g`)

**Value**: JSON 对象
```json
{
  "isLive": true,
  "subscribers": ["123456789", "987654321"],
  "lastChecked": "2024-01-01T12:00:00.000Z",
  "streamerInfo": {
    "uid": "cmahm5oy0001fl40m59hgr47g",
    "username": "凡",
    "live_status": true,
    "viewer": 11951,
    "followers": 1618,
    "title": "扒地址 玩二段 聊行情",
    "tags": ["Memes", "Fomo", "Alpha"],
    "twitter": "https://x.com/0xfanfanfan"
  }
}
```

## 通知消息格式

### 开播通知
```
🟢 凡 开播了！

📺 直播间标题: 扒地址 玩二段 聊行情
👥 当前观众: 11,951
👤 粉丝数: 1,618
🏷️ 标签: Memes, Fomo, Alpha
🔗 Twitter: https://x.com/0xfanfanfan

房间ID: cmahm5oy0001fl40m59hgr47g
```

### 下播通知
```
🔴 凡 下播了

📺 直播间标题: 扒地址 玩二段 聊行情
👥 当前观众: 0
👤 粉丝数: 1,618
🏷️ 标签: Memes, Fomo, Alpha
🔗 Twitter: https://x.com/0xfanfanfan

房间ID: cmahm5oy0001fl40m59hgr47g
```

## 配置说明

### wrangler.toml 配置项

- `name`: Worker 名称
- `main`: 主脚本文件路径
- `compatibility_date`: Cloudflare Worker 兼容性日期
- `crons`: 定时任务配置 (每5分钟执行一次)
- `kv_namespaces`: KV 存储命名空间配置
- `vars`: 环境变量配置

### 环境变量

- `TELEGRAM_BOT_TOKEN`: Telegram Bot Token
- `API_BASE_URL`: 直播间状态查询 API 地址
- `WORKER_URL`: 主 Worker 的 URL (用于 Bot 调用 API)

## 开发指南

### 本地开发

1. 启动本地开发服务器:
   ```bash
   npm run dev
   ```

2. 测试 API 接口:
   ```bash
   curl -X POST "http://localhost:8787/api/monitor/add" \
        -H "Content-Type: application/json" \
        -d '{"roomId": "test-room", "chatId": "123456789"}'
   ```

### 调试

1. 查看 Worker 日志:
   ```bash
   wrangler tail
   ```

2. 查看 KV 存储数据:
   ```bash
   wrangler kv:key get --binding=STREAMER_MONITOR "room-id"
   ```

## 故障排除

### 常见问题

1. **Telegram Bot 不响应**
   - 检查 Bot Token 是否正确
   - 确认 Webhook URL 设置正确
   - 查看 Worker 日志是否有错误

2. **监控不工作**
   - 检查 KV 命名空间 ID 是否正确
   - 确认定时任务是否启用
   - 验证 API 地址是否可访问

3. **通知发送失败**
   - 检查 Bot Token 权限
   - 确认用户是否已与 Bot 开始对话
   - 查看网络连接是否正常

### 日志查看

```bash
# 查看实时日志
wrangler tail

# 查看特定时间段的日志
wrangler tail --format=pretty
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基本的直播间监控功能
- 集成 Telegram Bot 通知
- 提供完整的 API 接口
