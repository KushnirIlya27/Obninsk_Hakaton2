from uuid import uuid4

from accounts.models import VolunteerProfile
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import CoinTransaction, Event, Reward
from catalog.services import (
    Conflict,
    apply_to_event,
    purchase_reward,
    review_activity,
    submit_hours,
)


class Command(BaseCommand):
    help = "Показать сценарий 3 ч. → +30 → −20 → 10 и запрет повторного начисления. Создаёт нового учебного волонтёра."

    @transaction.atomic
    def handle(self, *args, **options):
        call_command("seed_demo", stdout=self.stdout)
        coordinator = get_user_model().objects.get(username="coordinator")
        volunteer = get_user_model().objects.create_user(
            username=f"demo_{uuid4().hex[:10]}", first_name="Учебный участник защиты"
        )
        event = Event.objects.filter(is_active=True).first()
        reward = Reward.objects.get(title="Учебный значок")
        if reward.price != 20 or not reward.is_active or event is None:
            from django.core.management.base import CommandError

            raise CommandError(
                "Для сценария нужны активное мероприятие и активный «Учебный значок» за 20 койнов."
            )
        activity, _ = apply_to_event(volunteer=volunteer, event_id=event.pk)
        submit_hours(volunteer=volunteer, activity_id=activity.pk, hours=3)
        self.stdout.write(
            f"{volunteer.username}: заявка №{activity.pk}, заявлено 3 часа; баланс 0."
        )
        review_activity(
            coordinator=coordinator,
            activity_id=activity.pk,
            decision="approved",
            hours=3,
            note="Учебная демонстрация",
        )
        profile = VolunteerProfile.objects.get(user=volunteer)
        self.stdout.write(
            f"Координатор подтвердил {profile.confirmed_hours} ч.; баланс {profile.balance}."
        )
        purchase_reward(volunteer=volunteer, reward_id=reward.pk, request_key=uuid4())
        profile.refresh_from_db()
        self.stdout.write(f"Запрос на значок за 20 койнов; остаток {profile.balance}.")
        try:
            review_activity(
                coordinator=coordinator,
                activity_id=activity.pk,
                decision="approved",
                hours=3,
            )
        except Conflict as exc:
            self.stdout.write(f"Повторное начисление заблокировано: {exc.messages[0]}")
        for entry in CoinTransaction.objects.filter(volunteer=volunteer).order_by("id"):
            self.stdout.write(str(entry))
        self.stdout.write(
            self.style.SUCCESS(
                "Готово. Заявка, история и запрос на выдачу доступны в /admin/."
            )
        )
