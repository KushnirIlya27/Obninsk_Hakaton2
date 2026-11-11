"""All balance changes go through these transactional business operations."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from uuid import UUID

from accounts.models import VolunteerProfile
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Activity, CoinTransaction, Event, Redemption, Reward

# Event rate is snapshotted when a volunteer joins; settled amounts never change.


def validate_multiplier(value):
    try:
        multiplier = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError("Введите коэффициент от 1.00 до 10.00 с шагом 0.05.")
    if (
        not multiplier.is_finite()
        or not Decimal("1.00") <= multiplier <= 10
        or multiplier != multiplier.quantize(Decimal("0.01"))
        or multiplier % Decimal("0.05") != 0
    ):
        raise ValidationError("Коэффициент должен быть от 1.00 до 10.00 с шагом 0.05.")
    return multiplier


def calculate_coins(hours, rate, multiplier=Decimal("1.00")):
    return int(
        (hours * rate * multiplier).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


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
        or hours != hours.quantize(Decimal("0.1"))
    ):
        raise ValidationError("Часы должны быть от 0.1 до 24 с шагом 0.1.")
    return hours


@transaction.atomic
def apply_to_event(*, volunteer, event_id):
    require_user(volunteer)
    event = Event.objects.select_for_update().get(pk=event_id)
    if not event.is_active:
        raise Conflict("Запись на мероприятие закрыта.")
    activity, created = Activity.objects.get_or_create(
        volunteer=volunteer,
        event=event,
        defaults={"rate_snapshot": event.coins_per_hour},
    )
    VolunteerProfile.objects.get_or_create(user=volunteer)
    return activity, created


@transaction.atomic
def submit_hours(*, volunteer, activity_id, hours, report_text=""):
    require_user(volunteer)
    hours = validate_hours(hours)
    activity = Activity.objects.select_for_update().get(
        pk=activity_id, volunteer=volunteer
    )
    if activity.status not in (Activity.Status.REGISTERED, Activity.Status.PENDING):
        raise Conflict("Заявка уже рассмотрена; изменить отчёт нельзя.")
    if timezone.now() < activity.event.report_available_at:
        raise Conflict("Отправить отчёт можно после окончания мероприятия.")
    if not isinstance(report_text, str) or len(report_text) > 3000:
        raise ValidationError("Отчёт должен быть строкой длиной до 3000 символов.")
    activity.requested_hours = hours
    activity.report_text = report_text.strip()
    activity.report_submitted_at = timezone.now()
    activity.status = Activity.Status.PENDING
    activity.save(
        update_fields=[
            "requested_hours",
            "report_text",
            "report_submitted_at",
            "status",
        ]
    )
    return activity


@transaction.atomic
def review_activity(
    *, coordinator, activity_id, decision, hours=None, note="", multiplier="1.00"
):
    require_coordinator(coordinator, "review_activity")
    if decision not in (Activity.Status.APPROVED, Activity.Status.REJECTED):
        raise ValidationError("Выберите подтверждение или отклонение.")
    activity = (
        Activity.objects.select_for_update().select_related("event").get(pk=activity_id)
    )
    if activity.volunteer_id == coordinator.pk:
        raise PermissionDenied("Свою заявку должен проверить другой координатор.")
    if activity.status == Activity.Status.REGISTERED:
        raise Conflict("Волонтёр ещё не отправил отчёт на начисление койнов.")
    if activity.status != Activity.Status.PENDING:
        raise Conflict("Заявка уже рассмотрена. Повторное начисление запрещено.")
    if not isinstance(note, str):
        raise ValidationError("Комментарий должен быть строкой.")
    factor = (
        validate_multiplier(multiplier)
        if decision == Activity.Status.APPROVED
        else Decimal("1.00")
    )
    if factor != 1 and not note.strip():
        raise ValidationError(
            "При изменении коэффициента укажите причину, например дождь."
        )
    if decision == Activity.Status.REJECTED and not note.strip():
        raise ValidationError("Укажите причину отклонения.")
    confirmed = validate_hours(hours) if decision == Activity.Status.APPROVED else None
    coins = (
        calculate_coins(confirmed, activity.rate_snapshot, factor)
        if confirmed is not None
        else 0
    )
    if confirmed is not None and coins < 1:
        raise ValidationError(
            "По этой формуле получается меньше 1 койна. Проверьте часы и коэффициент."
        )
    changed = Activity.objects.filter(
        pk=activity.pk, status=Activity.Status.PENDING
    ).update(
        status=decision,
        confirmed_hours=confirmed,
        reviewed_by=coordinator,
        reviewed_at=timezone.now(),
        review_note=note.strip(),
        multiplier=factor,
        coins_awarded=coins,
    )
    if changed != 1:
        raise Conflict("Заявка уже рассмотрена.")
    if confirmed is not None:
        profile, _ = VolunteerProfile.objects.get_or_create(
            user_id=activity.volunteer_id
        )
        VolunteerProfile.objects.filter(pk=profile.pk).update(
            balance=F("balance") + coins,
            confirmed_hours=F("confirmed_hours") + confirmed,
        )
        CoinTransaction.objects.create(
            volunteer_id=activity.volunteer_id,
            amount=coins,
            activity=activity,
            description=f"{activity.event.title}: {confirmed} ч. × {activity.rate_snapshot} койнов/ч × {factor} = {coins} койнов"
            + (f"; причина: {note.strip()[:100]}" if note.strip() else ""),
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
    profile, _ = VolunteerProfile.objects.get_or_create(user=volunteer)
    profile = VolunteerProfile.objects.select_for_update().get(pk=profile.pk)
    previous = Redemption.objects.filter(volunteer=volunteer, request_key=key).first()
    if previous:
        if previous.reward_id != reward_id:
            raise Conflict("Этот ключ уже использован для другого поощрения.")
        return previous, False
    reward = Reward.objects.select_for_update().get(pk=reward_id)
    if not reward.is_active:
        raise Conflict("Поощрение недоступно.")
    if (
        VolunteerProfile.objects.filter(
            pk=profile.pk, balance__gte=reward.price
        ).update(balance=F("balance") - reward.price)
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
    changed = Redemption.objects.filter(pk=redemption.pk, status=Redemption.Status.PENDING).update(
        status=Redemption.Status.ISSUED, issued_by=coordinator, issued_at=timezone.now())
    if changed != 1:
        raise Conflict("Запрос уже обработан.")
    redemption.refresh_from_db()
    return redemption


@transaction.atomic
def cancel_reward(*, user, redemption_id):
    require_user(user)
    redemption = Redemption.objects.select_for_update().get(pk=redemption_id)
    if redemption.volunteer_id != user.pk:
        require_coordinator(user, "fulfill_redemption")
    if redemption.status == Redemption.Status.CANCELLED:
        return redemption
    if redemption.status != Redemption.Status.PENDING:
        raise Conflict("Выданное поощрение отменить нельзя.")
    changed = Redemption.objects.filter(pk=redemption.pk, status=Redemption.Status.PENDING).update(
        status=Redemption.Status.CANCELLED, cancelled_by=user, cancelled_at=timezone.now())
    if changed != 1:
        raise Conflict("Запрос уже обработан.")
    CoinTransaction.objects.create(volunteer_id=redemption.volunteer_id,
        amount=redemption.price, refund=redemption,
        description=f"Возврат за отменённое поощрение: {redemption.reward.title}")
    VolunteerProfile.objects.filter(user_id=redemption.volunteer_id).update(balance=F("balance") + redemption.price)
    redemption.refresh_from_db()
    return redemption

