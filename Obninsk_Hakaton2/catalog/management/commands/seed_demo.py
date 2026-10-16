from datetime import timedelta

from accounts.models import VolunteerProfile
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalog.models import Event, Reward


class Command(BaseCommand):
    help = "Создать учебные аккаунты, три мероприятия и три поощрения (без сброса существующих данных)."

    @transaction.atomic
    def handle(self, *args, **options):
        group, _ = Group.objects.get_or_create(name="Координаторы")
        allowed = {
            "catalog": [
                "view_event",
                "add_event",
                "change_event",
                "view_activity",
                "add_activity",
                "change_activity",
                "review_activity",
                "view_reward",
                "add_reward",
                "change_reward",
                "view_redemption",
                "change_redemption",
                "fulfill_redemption",
                "view_cointransaction",
            ],
            "accounts": ["view_volunteerprofile"],
        }
        for app, codenames in allowed.items():
            group.permissions.add(
                *Permission.objects.filter(
                    content_type__app_label=app, codename__in=codenames
                )
            )
        for username, name, staff in [
            ("coordinator", "Учебный координатор", True),
            ("volunteer", "Учебный волонтёр", False),
        ]:
            user, created = get_user_model().objects.get_or_create(
                username=username, defaults={"first_name": name, "is_staff": staff}
            )
            if created:
                user.set_password("Demo-Obninsk-2026!")
                user.save()
                if staff:
                    user.groups.add(group)
                self.stdout.write(f"Создан {username}; пароль: Demo-Obninsk-2026!")
            else:
                self.stdout.write(
                    f"{username} уже существует; пароль и права не изменены."
                )
            VolunteerProfile.objects.get_or_create(user=user)
        for index, (title, location) in enumerate(
            [
                ("Уборка городского парка", "Городской парк Обнинска"),
                ("Помощь учебному приюту", "Учебный волонтёрский центр"),
                ("Сбор книг для библиотеки", "Учебная библиотека"),
            ]
        ):
            Event.objects.get_or_create(
                title=title,
                defaults={
                    "location": location,
                    "starts_at": timezone.now() + timedelta(days=index + 1),
                    "description": "Учебное мероприятие. Все данные демонстрационные.",
                },
            )
        for title, price in [
            ("Учебный значок", 20),
            ("Учебный блокнот", 30),
            ("Благодарственное письмо", 10),
        ]:
            Reward.objects.get_or_create(
                title=title,
                defaults={
                    "price": price,
                    "description": "Условное поощрение без реальной выдачи.",
                },
            )
        self.stdout.write(
            self.style.SUCCESS("Готово: /admin/ для координатора; /api/ для фронтенда.")
        )
