"""
Standalone Telegram bot — run once to handle /myid instantly.
Usage: python bot.py
"""
import os
from dotenv import load_dotenv

load_dotenv()

import telebot

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
if not TOKEN:
    raise SystemExit("TELEGRAM_BOT_TOKEN not set in .env")

bot = telebot.TeleBot(TOKEN)

# Register commands in menu — runs once on startup
bot.set_my_commands([
    telebot.types.BotCommand("myid", "Get your Chat ID for Setup Alerts"),
])

@bot.message_handler(commands=["myid", "start"])
def handle_myid(message):
    chat_id = message.chat.id
    name = message.from_user.first_name or ""
    greeting = f"Hi {name}! " if name else ""
    bot.reply_to(
        message,
        f"🤖 {greeting}Your Telegram Chat ID is:\n\n"
        f"`{chat_id}`\n\n"
        "Copy this → open Trading Signal Desk → click *Setup alerts* → paste it in\\.",
        parse_mode="MarkdownV2",
    )
    print(f"[bot] /myid → {name} ({chat_id})")

print("Bot running... Press Ctrl+C to stop.")
bot.infinity_polling()
