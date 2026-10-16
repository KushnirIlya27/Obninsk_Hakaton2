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
