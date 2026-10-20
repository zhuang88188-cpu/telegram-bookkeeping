
const TELEGRAM_API = "https://api.telegram.org";

async function telegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function reply(chatId, text) {
  return telegram("sendMessage", { chat_id: chatId, text });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram bookkeeping bot is running.");
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    !secret ||
    req.headers["x-telegram-bot-api-secret-token"] !== secret
  ) {
    return res.status(401).send("Unauthorized");
  }

  const message = req.body?.message;
  if (!message?.chat?.id || typeof message.text !== "string") {
    return res.status(200).send("OK");
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start" || text === "/help") {
    await reply(
      chatId,
      "欢迎使用记账机器人！\n\n发送：\n支出 35 午餐\n收入 500 工资\n\n发送 /help 查看帮助。"
    );
    return res.status(200).send("OK");
  }

  const match = text.match(/^(支出|收入)\s+(\d+(?:\.\d{1,2})?)(?:\s+(.+))?$/);

  if (!match || Number(match[2]) <= 0) {
    await reply(chatId, "格式不正确，请发送：\n支出 35 午餐\n收入 500 工资");
    return res.status(200).send("OK");
  }

  const type = match[1];
  const amount = Number(match[2]).toFixed(2);
  const note = match[3] || "未分类";

  await reply(
    chatId,
    `收到记账请求：${type} ${amount}\n备注：${note}\n\n注意：当前是测试版，尚未保存到数据库。`
  );

  return res.status(200).send("OK");
};
