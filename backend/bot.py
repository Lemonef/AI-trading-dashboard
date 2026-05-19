"""
Standalone Telegram bot — run once to handle /myid instantly.
Usage: python bot.py
"""
import os
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

import telebot

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
if not TOKEN:
    raise SystemExit("TELEGRAM_BOT_TOKEN not set in .env")

bot = telebot.TeleBot(TOKEN)

# Register commands in menu — runs once on startup
bot.set_my_commands([
    telebot.types.BotCommand("setup", "Connect Telegram to Trading Signal Desk"),
    telebot.types.BotCommand("myid", "Get your Chat ID for Setup Alerts"),
])

APP_URL = os.environ.get("NEXT_PUBLIC_APP_URL", "https://ai-trading-dashboard-phi.vercel.app")

@bot.message_handler(commands=["setup", "start"])
def handle_setup(message):
    chat_id = message.chat.id
    name = message.from_user.first_name or ""
    greeting = f"Hi {name}! " if name else ""
    name_param = f"&tgname={quote(name)}" if name else ""
    setup_link = f"{APP_URL}?setup={chat_id}{name_param}"
    bot.reply_to(
        message,
        f"🤖 {greeting}\n\n"
        f"Your Chat ID: <code>{chat_id}</code>\n\n"
        f"👇 Tap the link to connect automatically:\n"
        f'<a href="{setup_link}">Open Trading Signal Desk ↗</a>\n\n'
        f"<i>Tapping the link connects your Telegram instantly.</i>",
        parse_mode="HTML",
    )
    print(f"[bot] /setup → {name} ({chat_id})")


@bot.message_handler(commands=["myid"])
def handle_myid(message):
    chat_id = message.chat.id
    name = message.from_user.first_name or ""
    greeting = f"Hi {name}! " if name else ""
    bot.reply_to(
        message,
        f"🤖 {greeting}Your Telegram Chat ID is:\n\n"
        f"<code>{chat_id}</code>\n\n"
        "Copy this → open Trading Signal Desk → click <b>Setup alerts</b> → paste it in.",
        parse_mode="HTML",
    )
    print(f"[bot] /myid → {name} ({chat_id})")

print("Bot running... Press Ctrl+C to stop.")
bot.infinity_polling()
