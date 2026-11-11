from django.contrib import admin
from .models import Item, Profile, Purchase


class ArchivedAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]


@admin.register(Item)
class ItemAdmin(ArchivedAdmin):
    list_display = ("id", "name", "price")


@admin.register(Profile)
class ProfileAdmin(ArchivedAdmin):
    list_display = ("user", "coins")


@admin.register(Purchase)
class PurchaseAdmin(ArchivedAdmin):
    list_display = ("user", "item", "bought_at")
