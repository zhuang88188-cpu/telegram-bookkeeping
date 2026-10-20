const TELEGRAM_API = "https://api.telegram.org";

async function telegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Telegram API error:", method, response.status, detail);
  }
  return response;
}

async function reply(chatId, text) {
  return telegram("sendMessage", { chat_id: chatId, text });
}

async function supabase(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase error:", response.status, detail);
    throw new Error("Database request failed");
  }
  if (response.status === 204) return null;
  return response.json();
}

function helpText() {
  return [
    "记账机器人已启动！",
    "",
    "发送以下格式记账：",
    "支出 35 午餐",
    "收入 500 工资",
    "",
    "查看汇总：",
    "/today - 今日收支",
    "/month - 本月收支",
    "/help - 使用说明",
    "",
    "金额请使用数字，例如：支出 12.5 咖啡",
  ].join("\n");
}

function parseEntry(text) {
  const match = text.trim().match(/^(支出|收入|expense|income)\s+(\d+(?:\.\d{1,2})?)(?:\s+(.+))?$/i);
  if (!match) return null;
  const typeWord = match[1].toLowerCase();
  const type = (typeWord === "收入" || typeWord === "income") ? "income" : "expense";
  const amount = Number(match[2]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { type, amount, note: (match[3] || "未分类").slice(0, 200) };
}

function localDateParts(date = new Date()) {
  // Reports use UTC dates for consistency. Change the timezone here if needed.
  const iso = date.toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram bookkeeping webhook is running.");
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const suppliedSecret = req.headers["x-telegram-bot-api-secret-token"];
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return res.status(401).send("Unauthorized");
  }

  const update = req.body || {};
  const message = update.message;
  if (!message || !message.chat || !message.from || typeof message.text !== "string") {
    return res.status(200).send("OK");
  }

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();

  try {
    if (text === "/start" || text === "/help") {
      await reply(chatId, helpText());
      return res.status(200).send("OK");
    }

    if (text === "/today" || text === "/month") {
      const { day, month } = localDateParts();
      const start = text === "/today" ? `${day}T00:00:00.000Z` : `${month}-01T00:00:00.000Z`;
      const now = new Date().toISOString();
      const rows = await supabase(
        `transactions?telegram_user_id=eq.${userId}&created_at=gte.${encodeURIComponent(start)}&created_at=lte.${encodeURIComponent(now)}&select=type,amount,note,created_at&order=created_at.desc&limit=500`
      );
      const income = rows.filter(r => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
      const expense = rows.filter(r => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
      const title = text === "/today" ? "今日" : "本月";
      await reply(chatId, `${title}汇总\n收入：${income.toFixed(2)}\n支出：${expense.toFixed(2)}\n结余：${(income - expense).toFixed(2)}\n\n（日期按 UTC 统计）`);
      return res.status(200).send("OK");
    }

    const entry = parseEntry(text);
    if (!entry) {
      await reply(chatId, "我没看懂这条消息。\n\n请按格式发送：\n支出 35 午餐\n收入 500 工资\n\n发送 /help 查看帮助。");
      return res.status(200).send("OK");
    }

    await supabase("transactions", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        telegram_user_id: userId,
        type: entry.type,
        amount: entry.amount,
        note: entry.note,
      }),
    });

    const label = entry.type === "income" ? "收入" : "支出";
    await reply(chatId, `已记${label}：${entry.amount.toFixed(2)}\n备注：${entry.note}`);
    return res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    await reply(chatId, "操作失败，可能是数据库还没配置好。请稍后重试，或检查 Vercel Logs。");
    return res.status(200).send("OK");
  }
};
