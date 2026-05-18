import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const API = `https://api.telegram.org/bot${TOKEN}`;

export async function POST(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ ok: false });

  try {
    const body = await req.json();
    const msg = body?.message;
    if (!msg) return NextResponse.json({ ok: true });

    const text: string = (msg.text ?? "").trim().toLowerCase();
    const chatId: number = msg.chat?.id;
    const name: string = msg.from?.first_name ?? "";

    if (chatId && (text.startsWith("/myid") || text.startsWith("/start"))) {
      const greeting = name ? `Hi ${name}! ` : "";
      await fetch(`${API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text:
            `🤖 ${greeting}Your Telegram Chat ID is:\n\n` +
            `\`${chatId}\`\n\n` +
            "Copy this → open Trading Signal Desk → click *Setup alerts* → paste it in.",
          parse_mode: "Markdown",
        }),
      });
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true });
}
