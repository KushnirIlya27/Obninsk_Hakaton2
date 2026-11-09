from django.contrib import admin
from .models import Person
from django.contrib.auth.models import User, Group

admin.site.unregister(User)
admin.site.unregister(Group)


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):

    def has_add_permission(self, request):
        return False

    list_display = (
        "user",
        "group",
        "phone",
        "email",
        "tokens",
        "hours",
        "social_volunteering_hours",
        "environmental_volunteering_hours",
        "cultural_volunteering_hours",
        "event_volunteering_hours",
        "sports_volunteering_hours",
        "zoo_volunteering_hours",
        "scientific_volunteering_hours",
    )
    search_fields = ("user__username", "user__email", "phone")

    fieldsets = (
        ("Основная информация", {
            "fields": ("user", "phone", "email", "group", "tokens")
        }),
        ("Общие часы", {
            "fields": ("hours",)
        }),
        ("Часы по направлениям", {
            "fields": (
                "social_volunteering_hours",
                "environmental_volunteering_hours",
                "cultural_volunteering_hours",
                "event_volunteering_hours",
                "sports_volunteering_hours",
                "zoo_volunteering_hours",
                "scientific_volunteering_hours",
            )
        }),
    )