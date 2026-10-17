from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Person(models.Model):
    """Профиль пользователя: токены магазина + подтверждённые часы волонтёрства."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="account",
    )
    # было IntegerField — стало DecimalField, как в VolunteerProfile.confirmed_hours
    hours = models.DecimalField(
        "Подтверждённые часы",
        max_digits=10,
        decimal_places=1,
        default=0,
    )
    # было IntegerField — стало PositiveIntegerField, как в VolunteerProfile.balance
    tokens = models.PositiveIntegerField("Токены", default=0)
    phone = models.CharField("Телефон", max_length=20, null=True, blank=True, default=None)
    email = models.EmailField("Email", null=True, blank=True, default=None)
    info = models.CharField("Инфо", max_length=255, null=True, blank=True, default=None)

    class Meta:
        verbose_name = "Профиль"
        verbose_name_plural = "Профили"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(hours__gte=0),
                name="person_hours_nonnegative",
            )
        ]

    def __str__(self):
        return self.user.get_full_name() or self.user.username


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_person(sender, instance, created, **kwargs):
    if created:
        Person.objects.get_or_create(user=instance)