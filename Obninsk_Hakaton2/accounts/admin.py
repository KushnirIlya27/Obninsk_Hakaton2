from django.contrib import admin

from .models import VolunteerProfile


@admin.register(VolunteerProfile)
class VolunteerProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "balance", "confirmed_hours"]
    search_fields = ["user__username", "user__first_name", "user__last_name"]
    readonly_fields = ["user", "balance", "confirmed_hours"]
    list_select_related = ["user"]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
