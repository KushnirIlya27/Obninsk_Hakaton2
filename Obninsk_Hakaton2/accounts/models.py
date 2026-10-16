# models.py
from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Person(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="person",
    )
    hours = models.IntegerField(default=0)
    tokens = models.IntegerField(default=0)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


@receiver(post_save, sender=User)
def create_person(sender, instance, created, **kwargs):
    if created:
        Person.objects.get_or_create(user=instance)