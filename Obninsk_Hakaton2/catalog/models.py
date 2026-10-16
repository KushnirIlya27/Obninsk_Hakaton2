from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Event(models.Model):
    title = models.CharField("Название", max_length=200)
    description = models.TextField("Описание", blank=True)
    location = models.CharField("Место", max_length=200)
    starts_at = models.DateTimeField("Начало")
    is_active = models.BooleanField("Открыта запись", default=True)

    class Meta:
        verbose_name = "Мероприятие"
        verbose_name_plural = "Мероприятия"
        ordering = ["starts_at", "id"]

    def __str__(self):
        return self.title


class Activity(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает проверки"
        APPROVED = "approved", "Подтверждена"
        REJECTED = "rejected", "Отклонена"

    volunteer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="activities",
        verbose_name="Волонтёр",
    )
    event = models.ForeignKey(
        Event, on_delete=models.PROTECT, verbose_name="Мероприятие"
    )
    requested_hours = models.DecimalField(
        "Заявленные часы",
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.1")), MaxValueValidator(24)],
    )
    confirmed_hours = models.DecimalField(
        "Подтверждённые часы",
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
        editable=False,
    )
    status = models.CharField(
        "Статус",
        max_length=12,
        choices=Status.choices,
        default=Status.PENDING,
        editable=False,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_activities",
        verbose_name="Проверил",
        editable=False,
    )
    reviewed_at = models.DateTimeField(
        "Дата проверки", null=True, blank=True, editable=False
    )
    review_note = models.TextField(
        "Комментарий координатора", blank=True, editable=False
    )
    created_at = models.DateTimeField("Дата заявки", auto_now_add=True)

    class Meta:
        verbose_name = "Заявка на участие"
        verbose_name_plural = "Заявки и подтверждение часов"
        ordering = ["-created_at", "-id"]
        permissions = [("review_activity", "Может подтверждать и отклонять часы")]
        constraints = [
            models.UniqueConstraint(
                fields=["volunteer", "event"], name="one_activity_per_volunteer_event"
            ),
            models.CheckConstraint(
                condition=models.Q(requested_hours__isnull=True)
                | models.Q(
                    requested_hours__gte=Decimal("0.1"), requested_hours__lte=24
                ),
                name="valid_requested_hours",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        status="pending",
                        confirmed_hours__isnull=True,
                        reviewed_by__isnull=True,
                        reviewed_at__isnull=True,
                    )
                    | models.Q(
                        status="approved",
                        confirmed_hours__isnull=False,
                        confirmed_hours__gte=Decimal("0.1"),
                        confirmed_hours__lte=24,
                        reviewed_by__isnull=False,
                        reviewed_at__isnull=False,
                    )
                    | models.Q(
                        status="rejected",
                        confirmed_hours__isnull=True,
                        reviewed_by__isnull=False,
                        reviewed_at__isnull=False,
                    )
                ),
                name="valid_activity_review",
            ),
        ]

    def __str__(self):
        return f"{self.volunteer} — {self.event}"


class Reward(models.Model):
    title = models.CharField("Название", max_length=200)
    description = models.TextField("Описание", blank=True)
    price = models.PositiveIntegerField(
        "Цена в койнах", validators=[MinValueValidator(1)]
    )
    is_active = models.BooleanField("Доступна", default=True)

    class Meta:
        verbose_name = "Учебное поощрение"
        verbose_name_plural = "Учебные поощрения"
        ordering = ["price", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gt=0), name="reward_price_positive"
            )
        ]

    def __str__(self):
        return f"{self.title} ({self.price} койнов)"


class Redemption(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает выдачи"
        ISSUED = "issued", "Условно выдано"

    volunteer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, verbose_name="Волонтёр"
    )
    reward = models.ForeignKey(
        Reward, on_delete=models.PROTECT, verbose_name="Поощрение"
    )
    price = models.PositiveIntegerField("Списано койнов", editable=False)
    request_key = models.UUIDField("Ключ запроса", editable=False)
    status = models.CharField(
        "Статус",
        max_length=12,
        choices=Status.choices,
        default=Status.PENDING,
        editable=False,
    )
    created_at = models.DateTimeField("Дата запроса", auto_now_add=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="issued_redemptions",
        verbose_name="Выдал",
        editable=False,
    )
    issued_at = models.DateTimeField(
        "Дата выдачи", null=True, blank=True, editable=False
    )

    class Meta:
        verbose_name = "Запрос на поощрение"
        verbose_name_plural = "Запросы на выдачу поощрений"
        ordering = ["-created_at", "-id"]
        permissions = [("fulfill_redemption", "Может отмечать выдачу поощрения")]
        constraints = [
            models.UniqueConstraint(
                fields=["volunteer", "request_key"], name="unique_purchase_request"
            ),
            models.CheckConstraint(
                condition=models.Q(price__gt=0), name="redemption_price_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    status="pending", issued_by__isnull=True, issued_at__isnull=True
                )
                | models.Q(
                    status="issued", issued_by__isnull=False, issued_at__isnull=False
                ),
                name="valid_redemption_issue",
            ),
        ]

    def __str__(self):
        return f"Запрос №{self.pk}: {self.volunteer} — {self.reward}"


class CoinTransaction(models.Model):
    volunteer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, verbose_name="Волонтёр"
    )
    amount = models.IntegerField("Изменение баланса")
    description = models.CharField("Основание", max_length=400)
    activity = models.OneToOneField(
        Activity,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Подтверждённая заявка",
    )
    redemption = models.OneToOneField(
        Redemption,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Запрос на поощрение",
    )
    created_at = models.DateTimeField("Дата", auto_now_add=True)

    class Meta:
        verbose_name = "Операция с койнами"
        verbose_name_plural = "История операций с койнами"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    amount__gt=0, activity__isnull=False, redemption__isnull=True
                )
                | models.Q(
                    amount__lt=0, activity__isnull=True, redemption__isnull=False
                ),
                name="transaction_sign_and_source",
            )
        ]

    def __str__(self):
        return f"{self.amount:+d} койнов — {self.description}"
