from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.db import models


class VolunteerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, verbose_name="Пользователь"
    )
    balance = models.PositiveIntegerField("Баланс койнов", default=0, editable=False)
    confirmed_hours = models.DecimalField(
        "Подтверждённые часы",
        max_digits=10,
        decimal_places=1,
        default=0,
        editable=False,
    )
    social_volunteering_hours = models.DecimalField("Социальное", default=0, max_digits=10, decimal_places=1, editable=False)
    environmental_volunteering_hours = models.DecimalField("Экологическое", default=0, max_digits=10, decimal_places=1, editable=False)
    cultural_volunteering_hours = models.DecimalField("Культурное", default=0, max_digits=10, decimal_places=1, editable=False)
    event_volunteering_hours = models.DecimalField("Событийное", default=0, max_digits=10, decimal_places=1, editable=False)
    sports_volunteering_hours = models.DecimalField("Спортивное", default=0, max_digits=10, decimal_places=1, editable=False)
    zoo_volunteering_hours = models.DecimalField("Зооволонтёрство", default=0, max_digits=10, decimal_places=1, editable=False)
    scientific_volunteering_hours = models.DecimalField("Научное", default=0, max_digits=10, decimal_places=1, editable=False)
    phone = models.CharField("Телефон", max_length=20, null=True, blank=True, default=None, editable=False)
    email = models.EmailField("Email", null=True, blank=True, default=None, editable=False)
    group = models.CharField("Группа", max_length=255, null=True, blank=True, default=None)

    class Meta:
        verbose_name = "Карточка волонтёра"
        verbose_name_plural = "Карточки волонтёров"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(confirmed_hours__gte=0),
                name="profile_hours_nonnegative",
            )
        ]

    def __str__(self):
        return self.user.get_full_name() or self.user.get_username()