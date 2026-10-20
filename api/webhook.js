
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
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
  });
}

async function saveTransaction(data) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  const response = await fetch(
    `${url.replace(/\/+$/, "")}/rest/v1/transactions`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    console.error("Supabase insert failed:", response.status, details);
    throw new Error("Failed to save transaction");
  }
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

  if (
    !message?.chat?.id ||
    !message?.from?.id ||
    typeof message.text !== "string"
  ) {
    return res.status(200).send("OK");
  }

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();

  if (text === "/start" || text === "/help") {
    await reply(
      chatId,
      "欢迎使用记账机器人！\n\n发送：\n支出 35 午餐\n收入 500 工资\n\n发送 /help 查看帮助。"
    );

    return res.status(200).send("OK");
  }

  const match = text.match(
    /^(支出|收入)\s+(\d+(?:\.\d{1,2})?)(?:\s+(.+))?$/
  );

  if (!match || !Number.isFinite(Number(match[2])) || Number(match[2]) <= 0) {
    await reply(
      chatId,
      "格式不正确，请发送：\n支出 35 午餐\n收入 500 工资"
    );

    return res.status(200).send("OK");
  }

  const type = match[1];
  const amount = Number(match[2]);
  const note = match[3] || "未分类";

  try {
    await saveTransaction({
      telegram_chat_id: chatId,
      telegram_user_id: userId,
      type,
      amount,
      note,
    });

    await reply(
      chatId,
      `记账成功！\n类型：${type}\n金额：${amount.toFixed(2)}\n备注：${note}`
    );
  } catch (error) {
    console.error("Bookkeeping failed:", error.message);

    await reply(
      chatId,
      "保存账目失败，请稍后再试。账目尚未确认保存，请勿连续重复发送。"
    );
  }

  return res.status(200).send("OK");
};
