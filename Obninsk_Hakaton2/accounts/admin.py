from django.contrib import admin
from .models import Person


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("user", "hours", "tokens", "phone", "email")
    search_fields = ("user__username", "user__email", "phone")