# shop/models.py
from django.contrib.auth.models import User
from django.db import models


class Item(models.Model):
    """Товар в магазине."""
    name = models.CharField("Название", max_length=100)
    price = models.PositiveIntegerField("Цена в токенах")
    description = models.TextField("Описание", blank=True)

    class Meta:
        verbose_name = "Товар"
        verbose_name_plural = "Товары"
        ordering = ["price"]

    def __str__(self):
        return f"{self.name} — {self.price}"


class Purchase(models.Model):
    """История покупок: кто, что и когда купил."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="purchases",
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name="purchases",
    )
    bought_at = models.DateTimeField("Дата покупки", auto_now_add=True)

    class Meta:
        verbose_name = "Покупка"
        verbose_name_plural = "Покупки"
        ordering = ["-bought_at"]

    def __str__(self):
        return f"{self.user.username} купил «{self.item.name}»"