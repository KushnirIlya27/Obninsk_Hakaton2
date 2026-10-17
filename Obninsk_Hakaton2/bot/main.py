import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import asyncio
import logging
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton

from config import BotK

from setup_django import setup as setup_django
setup_django()

from asgiref.sync import sync_to_async
from accounts.models import VolunteerProfile
from catalog.models import Event

BOT_TOKEN = BotK
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: Message):
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📖 Мероприятия")],
            [KeyboardButton(text="ℹ️ О нас")],
            [KeyboardButton(text="🏆 Таблица лидеров")],
        ],
        resize_keyboard=True,
        input_field_placeholder="Выберите пункт",
    )
    await message.answer(
        "Привет! Этот бот создан для показа мероприятий, которые будут скоро проходить",
        reply_markup=kb,
    )


@dp.message(F.text == "📖 Мероприятия")
async def show_events(message: Message):
    events = await sync_to_async(list)(
        Event.objects.filter(is_active=True).order_by("starts_at")[:5]
    )

    if not events:
        await message.answer("Пока нет предстоящих мероприятий 😔")
        return

    text = "Ближайшие события:\n\n"
    for event in events:
        text += (
            f"📌 {event.title}\n"
            f"Где: {event.location}\n"
            f"Когда: {event.starts_at.strftime('%d.%m.%Y %H:%M')}\n"
            f"Описание: {event.description or '—'}\n"
        )

    await message.answer(text[:4000])


@dp.message(F.text == "ℹ️ О нас")
async def about_btn(message: Message):
    await message.answer("Здесь должна быть ссылка 🤖")


@dp.message(F.text == "🏆 Таблица лидеров")
async def show_leaders(message: Message):
    volunteers = await sync_to_async(list)(
        VolunteerProfile.objects
        .filter(confirmed_hours__gt=0)
        .select_related("user")
        .order_by("-confirmed_hours", "user__username")
    )

    if not volunteers:
        await message.answer("Пока нет волонтёров с часами")
        return

    lines = ["🏆 Волонтёры по часам:\n"]
    for i, v in enumerate(volunteers, start=1):
        name = v.user.get_full_name() or v.user.get_username()
        lines.append(f"{i}. {name} — {v.confirmed_hours:.1f} ч")

    await message.answer("\n".join(lines)[:4000])


async def main():
    logging.basicConfig(level=logging.INFO)
    me = await bot.get_me()
    print(f"Бот запущен: @{me.username}")
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())