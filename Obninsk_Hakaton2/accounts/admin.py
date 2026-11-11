from django.contrib import admin

from .models import VolunteerProfile


@admin.register(VolunteerProfile)
class VolunteerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "group",
        "phone",
        "email",
        "balance",
        "hours",
        "social_volunteering_hours",
        "environmental_volunteering_hours",
        "cultural_volunteering_hours",
        "event_volunteering_hours",
        "sports_volunteering_hours",
        "zoo_volunteering_hours",
        "scientific_volunteering_hours",
    )

    search_fields = ["user__username", "user__first_name", "user__last_name"]
    readonly_fields = ["user", "balance", "confirmed_hours"]
    list_select_related = ["user"]

    @admin.display(description="Часы")
    def hours(self, obj):
        return (
                obj.social_volunteering_hours
                + obj.environmental_volunteering_hours
                + obj.cultural_volunteering_hours
                + obj.event_volunteering_hours
                + obj.sports_volunteering_hours
                + obj.zoo_volunteering_hours
                + obj.scientific_volunteering_hours
        )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
