# Sidekick 监控机器人部署教程

## 📋 项目简介

这是一个基于 Cloudflare Workers 的 Sidekick 直播监控机器人，具有以下功能：

- 🔍 自动监控 Sidekick 主播的直播状态
- 📱 通过 Telegram 机器人发送开播/下播通知
- ⏰ 定时检查（每2分钟）
- 🎯 支持多用户订阅同一主播
- 🔗 通过发送 Sidekick 链接即可添加/取消监控

## 🛠️ 部署前准备

### 1. 安装必要工具

#### 安装 Node.js
```bash
# 下载并安装 Node.js (推荐 v18+)
# 访问 https://nodejs.org/ 下载安装包
```

#### 安装 Wrangler CLI
```bash
npm install -g wrangler
```

### 2. 创建 Telegram 机器人

1. 在 Telegram 中找到 [@BotFather](https://t.me/botfather)
2. 发送 `/newbot` 命令
3. 按提示设置机器人名称和用户名
4. 保存获得的 Bot Token（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 3. 登录 Cloudflare

```bash
wrangler login
```

## 🚀 部署步骤

### 步骤 1: 克隆项目

```bash
git clone <your-repository-url>
cd sidekick
```

### 步骤 2: 创建 KV 命名空间

```bash
# 创建生产环境 KV 命名空间
wrangler kv:namespace create "STREAMER_MONITOR"

# 创建预览环境 KV 命名空间
wrangler kv:namespace create "STREAMER_MONITOR" --preview
```

### 步骤 3: 配置环境变量

编辑 `wrangler.toml` 文件，更新以下配置：

```toml
name = "streamer-monitor"
main = "src/index.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/2 * * * *"]  # 每2分钟运行一次

[[kv_namespaces]]
binding = "STREAMER_MONITOR"
id = "你的生产环境KV命名空间ID"  # 替换为步骤2中获得的ID
preview_id = "你的预览环境KV命名空间ID"  # 替换为步骤2中获得的ID

[vars]
TELEGRAM_BOT_TOKEN = "你的Telegram机器人Token"  # 替换为你的Bot Token
API_BASE_URL = "https://sidekick-service-go-query-696817756223.europe-west1.run.app"
```

### 步骤 4: 部署到 Cloudflare Workers

```bash
# 部署到生产环境
wrangler deploy

# 或者先部署到预览环境测试
wrangler deploy --env preview
```

### 步骤 5: 设置 Telegram Webhook

部署成功后，设置 Telegram Webhook：

```bash
# 替换为你的实际域名和Bot Token
curl -X POST "https://api.telegram.org/bot你的BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://你的worker域名.workers.dev/webhook"
  }'
```

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram 机器人 Token | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` |
| `API_BASE_URL` | Sidekick API 基础地址 | `https://sidekick-service-go-query-696817756223.europe-west1.run.app` |

### KV 存储结构

```json
{
  "房间ID": {
    "isLive": true,
    "subscribers": ["用户ID1", "用户ID2"],
    "lastChecked": "2024-01-01T00:00:00.000Z",
    "streamerInfo": {
      "uid": "房间ID",
      "username": "主播用户名",
      "title": "直播标题",
      "live_status": true,
      "viewer": 1000,
      "followers": 50000,
      "tags": ["标签1", "标签2"],
      "twitter": "twitter用户名"
    }
  }
}
```

## 📱 使用方法

### 用户操作指南

1. **添加监控**：向机器人发送 Sidekick 链接
   ```
   https://sidekick.fans/cmahm5oy0001fl40m59hgr47g
   ```

2. **查看监控列表**：发送 `/list` 命令

3. **取消监控**：再次发送相同的 Sidekick 链接

4. **获取帮助**：发送 `/start` 或 `/help` 命令

### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/monitor/add` | POST | 添加房间监控 |
| `/api/monitor/remove` | POST | 移除房间监控 |
| `/api/monitor/list` | GET | 获取监控列表 |
| `/api/check-status` | GET | 检查房间状态 |
| `/webhook` | POST | Telegram Webhook |

## 🔍 监控和调试

### 查看日志

```bash
# 查看实时日志
wrangler tail

# 查看特定环境的日志
wrangler tail --env preview
```

### 测试功能

```bash
# 测试 API 接口
curl -X POST "https://你的worker域名.workers.dev/api/monitor/add" \
  -H "Content-Type: application/json" \
  -d '{"roomId": "测试房间ID", "chatId": "测试用户ID"}'
```

## 🛡️ 安全注意事项

1. **保护 Bot Token**：不要将 Token 提交到公开仓库
2. **限制访问**：可以添加用户白名单机制
3. **监控使用量**：注意 Cloudflare Workers 的使用限制

## 🔄 更新部署

```bash
# 修改代码后重新部署
wrangler deploy

# 如果需要回滚
wrangler rollback
```

## 📊 性能优化

1. **批量操作**：减少 KV 存储的读写次数
2. **缓存策略**：合理使用缓存减少 API 调用
3. **错误处理**：完善错误处理机制

## 🆘 常见问题

### Q: 机器人没有响应
A: 检查 Webhook 是否正确设置，查看 Worker 日志

### Q: 监控通知延迟
A: 检查 cron 触发器配置，确保每2分钟执行一次

### Q: KV 存储错误
A: 确认 KV 命名空间 ID 配置正确，检查权限设置

### Q: API 调用失败
A: 检查 `API_BASE_URL` 配置，确认网络连接正常

## 📞 技术支持

如果遇到问题，请检查：

1. Cloudflare Workers 控制台日志
2. Telegram Bot API 响应
3. KV 存储数据状态
4. 网络连接和防火墙设置

---

**部署完成后，您的 Sidekick 监控机器人就可以正常工作了！** 🎉
