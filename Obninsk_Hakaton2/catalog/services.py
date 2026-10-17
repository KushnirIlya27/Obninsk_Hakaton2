"""All balance changes go through these transactional business operations."""

from decimal import Decimal, InvalidOperation
from uuid import UUID

from accounts.models import Person
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Activity, CoinTransaction, Event, Redemption, Reward

COINS_PER_HOUR = 10


class Conflict(ValidationError):
    pass


def require_user(user):
    if not user.is_authenticated or not user.is_active:
        raise PermissionDenied("Требуется активная учётная запись.")


def require_coordinator(user, permission):
    require_user(user)
    if not user.is_staff or not user.has_perm(f"catalog.{permission}"):
        raise PermissionDenied("Недостаточно прав координатора.")


def validate_hours(value):
    try:
        hours = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError("Введите число часов от 0.1 до 24 с шагом 0.1.")
    if (
        not hours.is_finite()
        or not Decimal("0.1") <= hours <= 24
        or hours * 10 != (hours * 10).to_integral_value()
    ):
        raise ValidationError("Часы должны быть от 0.1 до 24 с шагом 0.1.")
    return hours


@transaction.atomic
def apply_to_event(*, volunteer, event_id):
    require_user(volunteer)
    event = Event.objects.select_for_update().get(pk=event_id)
    if not event.is_active:
        raise Conflict("Запись на мероприятие закрыта.")
    activity, created = Activity.objects.get_or_create(volunteer=volunteer, event=event)
    Person.objects.get_or_create(user=volunteer)          # было VolunteerProfile
    return activity, created


@transaction.atomic
def submit_hours(*, volunteer, activity_id, hours):
    require_user(volunteer)
    hours = validate_hours(hours)
    activity = Activity.objects.select_for_update().get(
        pk=activity_id, volunteer=volunteer
    )
    if activity.status != Activity.Status.PENDING:
        raise Conflict("Заявка уже рассмотрена; изменить часы нельзя.")
    activity.requested_hours = hours
    activity.save(update_fields=["requested_hours"])
    return activity


@transaction.atomic
def review_activity(*, coordinator, activity_id, decision, hours=None, note=""):
    require_coordinator(coordinator, "review_activity")
    if decision not in (Activity.Status.APPROVED, Activity.Status.REJECTED):
        raise ValidationError("Выберите подтверждение или отклонение.")
    activity = (
        Activity.objects.select_for_update().select_related("event").get(pk=activity_id)
    )
    if activity.status != Activity.Status.PENDING:
        raise Conflict("Заявка уже рассмотрена. Повторное начисление запрещено.")
    if activity.volunteer_id == coordinator.pk:
        raise PermissionDenied("Свою заявку должен проверить другой координатор.")
    if decision == Activity.Status.REJECTED and not note.strip():
        raise ValidationError("Укажите причину отклонения.")
    confirmed = validate_hours(hours) if decision == Activity.Status.APPROVED else None
    changed = Activity.objects.filter(
        pk=activity.pk, status=Activity.Status.PENDING
    ).update(
        status=decision,
        confirmed_hours=confirmed,
        reviewed_by=coordinator,
        reviewed_at=timezone.now(),
        review_note=note.strip(),
    )
    if changed != 1:
        raise Conflict("Заявка уже рассмотрена.")
    if confirmed is not None:
        coins = int(confirmed * COINS_PER_HOUR)
        person, _ = Person.objects.get_or_create(user_id=activity.volunteer_id)
        Person.objects.filter(pk=person.pk).update(
            tokens=F("tokens") + coins,
            hours=F("hours") + confirmed,
        )
        CoinTransaction.objects.create(
            volunteer_id=activity.volunteer_id,
            amount=coins,
            activity=activity,
            description=f"{activity.event.title}: подтверждено {confirmed} ч. × {COINS_PER_HOUR}",
        )
    activity.refresh_from_db()
    return activity


@transaction.atomic
def purchase_reward(*, volunteer, reward_id, request_key):
    require_user(volunteer)
    try:
        key = UUID(str(request_key))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError(
            "request_key должен быть UUID; повтор запроса использует тот же ключ."
        )
    person, _ = Person.objects.get_or_create(user=volunteer)
    person = Person.objects.select_for_update().get(pk=person.pk)
    previous = Redemption.objects.filter(volunteer=volunteer, request_key=key).first()
    if previous:
        if previous.reward_id != reward_id:
            raise Conflict("Этот ключ уже использован для другого поощрения.")
        return previous, False
    reward = Reward.objects.select_for_update().get(pk=reward_id)
    if not reward.is_active:
        raise Conflict("Поощрение недоступно.")
    if (
        Person.objects.filter(
            pk=person.pk, tokens__gte=reward.price
        ).update(tokens=F("tokens") - reward.price)
        != 1
    ):
        raise Conflict("Недостаточно койнов.")
    redemption = Redemption.objects.create(
        volunteer=volunteer, reward=reward, price=reward.price, request_key=key
    )
    CoinTransaction.objects.create(
        volunteer=volunteer,
        amount=-reward.price,
        redemption=redemption,
        description=f"Учебное поощрение: {reward.title}",
    )
    return redemption, True


@transaction.atomic
def issue_reward(*, coordinator, redemption_id):
    require_coordinator(coordinator, "fulfill_redemption")
    redemption = Redemption.objects.select_for_update().get(pk=redemption_id)
    if redemption.status != Redemption.Status.PENDING:
        raise Conflict("Поощрение уже отмечено как выданное.")
    redemption.status = Redemption.Status.ISSUED
    redemption.issued_by = coordinator
    redemption.issued_at = timezone.now()
    redemption.save(update_fields=["status", "issued_by", "issued_at"])
    return redemption