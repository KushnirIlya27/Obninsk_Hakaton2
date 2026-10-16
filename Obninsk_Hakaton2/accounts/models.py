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


# Keep the registration branch model for compatibility.
from django.db import models


class Person(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="account",
    )
    hours = models.IntegerField(default=0)
    tokens = models.IntegerField(default=0)
    phone = models.CharField(null=True, blank=True, default=None)
    email = models.EmailField(null=True, blank=True, default=None)
    info = models.CharField(null=True, blank=True, default=None)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


@receiver(post_save, sender=User)
def create_person(sender, instance, created, **kwargs):
    if created:
        Person.objects.get_or_create(user=instance)
        VolunteerProfile.objects.get_or_create(user=instance)
