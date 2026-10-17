import asyncio
import logging
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton

from config import BotK

from setup_django import setup as setup_django
setup_django()

from asgiref.sync import sync_to_async

from catalog.models import Event

BOT_TOKEN = BotK
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

db = sync_to_async


@dp.message(CommandStart())
async def cmd_start(message: Message):
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📖 Мероприятия")],
            [KeyboardButton(text="ℹ️ О нас")],
        ],
        resize_keyboard=True,            # компактный размер
        input_field_placeholder="Выберите пункт",
    )
    # ДОБАВЛЕН reply_markup=kb, чтобы клавиатура появилась у пользователя
    await message.answer(
        "Привет! Этот бот создан для показа мероприятий, которые будут скоро проходить",
        reply_markup=kb
    )


@dp.message(F.text == "📖 Мероприятия")
async def show_events(message: Message):
    events = await db(list)(Event.objects.filter(is_active=True).order_by('starts_at')[:5])

    if not events:
        await message.answer("Пока нет предстоящих мероприятий 😔")
        return

    text = "Ближайшие события:\n\n"
    for event in events:
        text += (f"📌 {event.title}\n"
                 f"Где: {event.location}\n"
                 f"Когда: {event.starts_at.strftime('%d.%m.%Y %H:%M')}\n"
                 f"Описание: {event.description}\n")

    await message.answer(text)


@dp.message(F.text == "ℹ️ О нас")
async def about_btn(message: Message):
    await message.answer("Здесь должна быть ссылка 🤖")


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