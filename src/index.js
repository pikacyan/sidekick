/**
 * Sidekick监控 Cloudflare Worker
 * 定时检查sidekick状态并通过 Telegram 发送通知
 */

export default {
  async scheduled(event, env, ctx) {
    console.log("开始执行定时监控任务");

    try {
      // 获取所有监控的房间
      const monitoredRooms = await getAllMonitoredRooms(env.STREAMER_MONITOR);

      for (const [roomId, roomData] of Object.entries(monitoredRooms)) {
        await checkRoomStatus(roomId, roomData, env);
      }

      console.log("定时监控任务完成");
    } catch (error) {
      console.error("定时监控任务出错:", error);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理 CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      // Telegram Webhook 处理
      if (path === "/webhook") {
        return await handleTelegramWebhook(request, env);
      }

      // API 接口
      switch (path) {
        case "/api/monitor/add":
          return await addRoomMonitor(request, env);
        case "/api/monitor/remove":
          return await removeRoomMonitor(request, env);
        case "/api/monitor/list":
          return await listMonitoredRooms(request, env);
        case "/api/check-status":
          return await checkStatus(request, env);
        default:
          return new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error("API 错误:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

/**
 * 处理 Telegram Webhook
 */
async function handleTelegramWebhook(request, env) {
  try {
    const update = await request.json();

    if (update.message) {
      await handleTelegramMessage(update.message, env);
    }

    return new Response("OK");
  } catch (error) {
    console.error("处理 webhook 时出错:", error);
    return new Response("Error", { status: 500 });
  }
}

/**
 * 处理 Telegram 消息
 */
async function handleTelegramMessage(message, env) {
  const chatId = message.chat.id;
  const text = message.text || "";
  const username = message.from.username || message.from.first_name;

  console.log(`收到来自 ${username} (${chatId}) 的消息: ${text}`);

  // 检查是否是 Sidekick 链接
  const sidekickUrlMatch = text.match(
    /https?:\/\/sidekick\.fans\/([a-zA-Z0-9]+)/
  );
  if (sidekickUrlMatch) {
    const roomId = sidekickUrlMatch[1];
    await handleSidekickLink(chatId, roomId, env);
    return;
  }

  // 处理命令
  const command = text.toLowerCase().trim();

  switch (command) {
    case "/start":
    case "/help":
      await sendWelcomeMessage(chatId, env);
      break;
    case "/list":
      await handleListCommand(chatId, env);
      break;
    default:
      await sendUnknownCommand(chatId, env);
  }
}

/**
 * 处理 Sidekick 链接
 */
async function handleSidekickLink(chatId, roomId, env) {
  try {
    console.log(`检测到 Sidekick 链接，房间ID: ${roomId}`);

    // 检查房间是否存在
    const statusResponse = await fetch(
      `${env.API_BASE_URL}/query/api/get_streamer_info?uid=${roomId}`
    );
    const statusData = await statusResponse.json();

    if (statusData.code !== 0) {
      await sendTelegramMessage(
        chatId,
        `❌ 无法获取房间信息：${statusData.msg}\n\n请确认链接是否正确`,
        env
      );
      return;
    }

    const streamerInfo = statusData.data;

    // 检查用户是否已经监控这个房间
    const userRooms = await getUserMonitoredRooms(
      chatId.toString(),
      env.STREAMER_MONITOR
    );
    const isAlreadyMonitoring = userRooms.some(
      (room) => room.roomId === roomId
    );

    if (isAlreadyMonitoring) {
      // 如果已经在监控，则删除监控
      await removeUserMonitor(chatId.toString(), roomId, env);
      await sendTelegramMessage(
        chatId,
        `✅ 已取消对 ${streamerInfo.username} 的监控`,
        env
      );
    } else {
      // 如果没有监控，则添加监控
      await addUserMonitor(chatId.toString(), roomId, streamerInfo, env);
      const status = streamerInfo.live_status ? "🟢 直播中" : "🔴 未开播";
      await sendTelegramMessage(
        chatId,
        `✅ 已添加对 ${streamerInfo.username
        } 的监控\n\n📺 当前状态：${status}\n👤 粉丝数：${streamerInfo.followers?.toLocaleString() || 0
        }`,
        env
      );
    }
  } catch (error) {
    console.error("处理 Sidekick 链接时出错:", error);
    await sendTelegramMessage(chatId, "❌ 处理链接时发生错误，请稍后重试", env);
  }
}

/**
 * 处理 /list 命令
 */
async function handleListCommand(chatId, env) {
  try {
    const userRooms = await getUserMonitoredRooms(
      chatId.toString(),
      env.STREAMER_MONITOR
    );

    if (userRooms.length === 0) {
      await sendTelegramMessage(
        chatId,
        "📭 你当前没有监控任何直播间\n\n发送 Sidekick 链接来添加监控",
        env
      );
      return;
    }

    let message = "📋 你当前监控的直播间：\n\n";

    for (const room of userRooms) {
      const status = room.isLive ? "🟢 直播中" : "🔴 未开播";
      const lastChecked = new Date(room.lastChecked).toLocaleString("zh-CN");

      message += `📺 ${room.streamerInfo?.username || "未知主播"}\n`;
      message += `   状态：${status}\n`;
      message += `   房间ID：<code>${room.roomId}</code>\n`;
      message += `   直播间链接：https://sidekick.fans/${room.roomId}\n`;
      message += `   最后检查：${lastChecked}\n\n`;
    }

    message += "💡 再次发送相同链接可取消监控";

    await sendTelegramMessage(chatId, message, env);
  } catch (error) {
    console.error("获取监控列表时出错:", error);
    await sendTelegramMessage(
      chatId,
      "❌ 获取监控列表时发生错误，请稍后重试",
      env
    );
  }
}

/**
 * 发送欢迎消息
 */
async function sendWelcomeMessage(chatId, env) {
  const message = `
🎉 欢迎使用 Sidekick 监控机器人！

📋 使用方法：
• 发送 Sidekick 链接 → 添加监控
• 再次发送相同链接 → 取消监控
• 发送 /list → 查看监控列表
• 发送 /help → 显示帮助

💡 示例：
https://sidekick.fans/cmahm5oy0001fl40m59hgr47g

当主播开播或下播时，我会自动通知你！
  `.trim();

  await sendTelegramMessage(chatId, message, env);
}

/**
 * 发送未知命令提示
 */
async function sendUnknownCommand(chatId, env) {
  const message = `
❓ 未知命令

📋 可用操作：
• 发送 Sidekick 链接 → 添加/取消监控
• /list → 查看监控列表
• /start 或 /help → 显示帮助

💡 示例：
https://sidekick.fans/cmahm5oy0001fl40m59hgr47g
  `.trim();

  await sendTelegramMessage(chatId, message, env);
}

/**
 * 发送 Telegram 消息
 */
async function sendTelegramMessage(chatId, text, env) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      console.error("发送 Telegram 消息失败:", await response.text());
    }
  } catch (error) {
    console.error("发送 Telegram 消息时出错:", error);
  }
}

/**
 * 获取用户监控的房间
 */
async function getUserMonitoredRooms(chatId, kv) {
  const rooms = await getAllMonitoredRooms(kv);
  return Object.entries(rooms)
    .filter(([_, data]) => data.subscribers.includes(chatId))
    .map(([roomId, data]) => ({
      roomId,
      isLive: data.isLive,
      lastChecked: data.lastChecked,
      streamerInfo: data.streamerInfo,
    }));
}

/**
 * 添加用户监控
 */
async function addUserMonitor(chatId, roomId, streamerInfo, env) {
  let roomData = await env.STREAMER_MONITOR.get(roomId);

  if (roomData) {
    roomData = JSON.parse(roomData);
  } else {
    roomData = {
      isLive: streamerInfo.live_status,
      subscribers: [],
      lastChecked: new Date().toISOString(),
      streamerInfo: streamerInfo,
    };
  }

  // 添加订阅者
  if (!roomData.subscribers.includes(chatId)) {
    roomData.subscribers.push(chatId);
  }

  // 保存数据
  await env.STREAMER_MONITOR.put(roomId, JSON.stringify(roomData));
}

/**
 * 移除用户监控
 */
async function removeUserMonitor(chatId, roomId, env) {
  const roomData = await env.STREAMER_MONITOR.get(roomId);
  if (!roomData) return;

  const data = JSON.parse(roomData);
  data.subscribers = data.subscribers.filter((id) => id !== chatId);

  if (data.subscribers.length === 0) {
    // 没有订阅者了，删除整个记录
    await env.STREAMER_MONITOR.delete(roomId);
  } else {
    // 还有订阅者，更新数据
    await env.STREAMER_MONITOR.put(roomId, JSON.stringify(data));
  }
}

/**
 * 获取所有监控的房间
 */
async function getAllMonitoredRooms(kv) {
  const rooms = {};
  let cursor = null;

  do {
    const list = await kv.list({ cursor });
    cursor = list.cursor;

    for (const key of list.keys) {
      const roomData = await kv.get(key.name);
      if (roomData) {
        rooms[key.name] = JSON.parse(roomData);
      }
    }
  } while (cursor);

  return rooms;
}

/**
 * 检查房间状态
 */
async function checkRoomStatus(roomId, roomData, env) {
  try {
    console.log(`检查房间 ${roomId} 的状态`);

    // 调用 API 获取房间信息
    const response = await fetch(
      `${env.API_BASE_URL}/query/api/get_streamer_info?uid=${roomId}`
    );
    const data = await response.json();

    if (data.code !== 0) {
      console.error(`获取房间 ${roomId} 信息失败:`, data.msg);
      return;
    }

    const streamerInfo = data.data;
    const isLive = streamerInfo.live_status;
    const previousStatus = roomData.isLive;

    console.log(
      `房间 ${streamerInfo.username} (${roomId}) 当前状态: ${isLive ? "直播中" : "未开播"}, 之前状态: ${previousStatus ? "直播中" : "未开播"
      }`
    );

    // 如果状态发生变化，发送通知
    if (isLive !== previousStatus) {
      await sendNotifications(
        roomId,
        streamerInfo,
        isLive,
        roomData.subscribers,
        env
      );

      // 更新存储的状态
      roomData.isLive = isLive;
      roomData.lastChecked = new Date().toISOString();
      await env.STREAMER_MONITOR.put(roomId, JSON.stringify(roomData));
    }
  } catch (error) {
    console.error(`检查房间 ${roomId} 状态时出错:`, error);
  }
}

/**
 * 发送 Telegram 通知
 */
async function sendNotifications(
  roomId,
  streamerInfo,
  isLive,
  subscribers,
  env
) {
  const message = createNotificationMessage(streamerInfo, isLive);

  for (const chatId of subscribers) {
    try {
      const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        console.error(`发送通知到 ${chatId} 失败:`, await response.text());
      } else {
        console.log(`成功发送通知到 ${chatId}`);
      }
    } catch (error) {
      console.error(`发送通知到 ${chatId} 时出错:`, error);
    }
  }
}

/**
 * 创建通知消息
 */
function createNotificationMessage(streamerInfo, isLive) {
  const status = isLive ? "🟢 开播了！" : "🔴 下播了";
  const viewerCount = streamerInfo.viewer || 0;
  const followers = streamerInfo.followers || 0;
  const roomUrl = `https://sidekick.fans/${streamerInfo.uid}`;

  return `
<b>${streamerInfo.username}</b> ${status}

📺 直播间标题: ${streamerInfo.title}
👥 当前观众: ${viewerCount.toLocaleString()}
👤 粉丝数: ${followers.toLocaleString()}
🏷️ 标签: ${streamerInfo.tags?.join(", ") || "无"}
🔗 Twitter: ${streamerInfo.twitter || "无"}

房间ID: <code>${streamerInfo.uid}</code>
🔗 直播间链接: ${roomUrl}
  `.trim();
}

/**
 * 添加房间监控 (API)
 */
async function addRoomMonitor(request, env) {
  const { roomId, chatId } = await request.json();

  if (!roomId || !chatId) {
    return new Response(JSON.stringify({ error: "缺少必要参数" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 获取现有数据
  let roomData = await env.STREAMER_MONITOR.get(roomId);
  if (roomData) {
    roomData = JSON.parse(roomData);
  } else {
    // 新房间，先获取初始状态
    try {
      const response = await fetch(
        `${env.API_BASE_URL}/query/api/get_streamer_info?uid=${roomId}`
      );
      const data = await response.json();

      if (data.code !== 0) {
        return new Response(
          JSON.stringify({ error: "房间不存在或获取信息失败" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      roomData = {
        isLive: data.data.live_status,
        subscribers: [],
        lastChecked: new Date().toISOString(),
        streamerInfo: data.data,
      };
    } catch (error) {
      return new Response(JSON.stringify({ error: "获取房间信息失败" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 添加订阅者
  if (!roomData.subscribers.includes(chatId)) {
    roomData.subscribers.push(chatId);
  }

  // 保存数据
  await env.STREAMER_MONITOR.put(roomId, JSON.stringify(roomData));

  return new Response(
    JSON.stringify({
      success: true,
      message: "成功添加监控",
      roomInfo: roomData.streamerInfo,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * 移除房间监控 (API)
 */
async function removeRoomMonitor(request, env) {
  const { roomId, chatId } = await request.json();

  if (!roomId || !chatId) {
    return new Response(JSON.stringify({ error: "缺少必要参数" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const roomData = await env.STREAMER_MONITOR.get(roomId);
  if (!roomData) {
    return new Response(JSON.stringify({ error: "房间未在监控中" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = JSON.parse(roomData);
  data.subscribers = data.subscribers.filter((id) => id !== chatId);

  if (data.subscribers.length === 0) {
    // 没有订阅者了，删除整个记录
    await env.STREAMER_MONITOR.delete(roomId);
  } else {
    // 还有订阅者，更新数据
    await env.STREAMER_MONITOR.put(roomId, JSON.stringify(data));
  }

  return new Response(
    JSON.stringify({ success: true, message: "成功移除监控" }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * 列出监控的房间 (API)
 */
async function listMonitoredRooms(request, env) {
  const url = new URL(request.url);
  const chatId = url.searchParams.get("chatId");

  if (!chatId) {
    return new Response(JSON.stringify({ error: "缺少 chatId 参数" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rooms = await getAllMonitoredRooms(env.STREAMER_MONITOR);
  const userRooms = Object.entries(rooms)
    .filter(([_, data]) => data.subscribers.includes(chatId))
    .map(([roomId, data]) => ({
      roomId,
      isLive: data.isLive,
      lastChecked: data.lastChecked,
      streamerInfo: data.streamerInfo,
    }));

  return new Response(JSON.stringify({ rooms: userRooms }), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * 检查状态（手动触发）
 */
async function checkStatus(request, env) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId");

  if (!roomId) {
    return new Response(JSON.stringify({ error: "缺少 roomId 参数" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(
      `${env.API_BASE_URL}/query/api/get_streamer_info?uid=${roomId}`
    );
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}