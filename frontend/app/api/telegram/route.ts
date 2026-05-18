import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-trading-dashboard-phi.vercel.app";
const API = `https://api.telegram.org/bot${TOKEN}`;

async function send(chatId: number, text: string) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

export async function POST(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ ok: false });

  try {
    const body = await req.json();
    const msg = body?.message;
    if (!msg) return NextResponse.json({ ok: true });

    const text: string = (msg.text ?? "").trim().toLowerCase();
    const chatId: number = msg.chat?.id;
    const name: string = msg.from?.first_name ?? "";
    const greeting = name ? `Hi ${name}! ` : "";

    if (!chatId) return NextResponse.json({ ok: true });

    if (text.startsWith("/setup") || text.startsWith("/start")) {
      const setupLink = `${APP_URL}?setup=${chatId}`;
      await send(chatId,
        `🤖 ${greeting}\n\n` +
        `Your Chat ID: \`${chatId}\`\n\n` +
        `👇 Click the link below to set up alerts automatically:\n` +
        `[Open Trading Signal Desk ↗](${setupLink})\n\n` +
        `_Tapping the link will connect your Telegram to the dashboard automatically._`
      );
    } else if (text.startsWith("/myid")) {
      await send(chatId,
        `🤖 ${greeting}Your Telegram Chat ID is:\n\n\`${chatId}\`\n\n` +
        `Copy this → open Trading Signal Desk → click *Setup alerts* → paste it in.`
      );
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true });
}
