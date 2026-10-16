from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import Http404, HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html

from .forms import ReviewForm
from .models import Activity, CoinTransaction, Event, Redemption, Reward
from .services import issue_reward, require_coordinator, review_activity

admin.site.site_header = "Цифровой волонтёр Обнинска"
admin.site.site_title = "Панель координатора"
admin.site.index_title = "Учёт добрых дел · учебная система"


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "starts_at", "location", "is_active"]
    search_fields = ["title", "location"]
    list_filter = ["is_active", "starts_at"]


@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display = ["title", "price", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["title"]


@admin.register(Activity)
class ActivityAdmin(ReadOnlyAdmin):
    list_display = [
        "id",
        "volunteer",
        "event",
        "requested_hours",
        "confirmed_hours",
        "status",
        "reviewed_by",
        "review_link",
    ]
    list_filter = ["status", "event"]
    search_fields = [
        "volunteer__username",
        "volunteer__first_name",
        "volunteer__last_name",
        "event__title",
    ]
    list_select_related = ["volunteer", "event", "reviewed_by"]
    readonly_fields = [
        "status",
        "confirmed_hours",
        "reviewed_by",
        "reviewed_at",
        "review_note",
        "created_at",
    ]

    def has_add_permission(self, request):
        return request.user.has_perm("catalog.add_activity")

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return [*super().get_readonly_fields(request, obj), "review_link"]
        return self.readonly_fields

    @admin.display(description="Проверка")
    def review_link(self, obj):
        if obj.status != Activity.Status.PENDING:
            return "Рассмотрена"
        return format_html(
            '<a href="{}">Проверить часы</a>',
            reverse("admin:catalog_activity_review", args=[obj.pk]),
        )

    def get_urls(self):
        return [
            path(
                "<int:object_id>/review/",
                self.admin_site.admin_view(self.review_view),
                name="catalog_activity_review",
            )
        ] + super().get_urls()

    def review_view(self, request, object_id):
        require_coordinator(request.user, "review_activity")
        obj = self.get_object(request, object_id)
        if obj is None:
            raise Http404
        if not self.has_view_or_change_permission(request, obj):
            raise PermissionDenied
        form = ReviewForm(
            request.POST if request.method == "POST" else None,
            initial={"hours": obj.requested_hours},
        )
        if request.method == "POST" and form.is_valid():
            try:
                result = review_activity(
                    coordinator=request.user, activity_id=obj.pk, **form.cleaned_data
                )
            except ValidationError as exc:
                form.add_error(None, exc)
            else:
                self.log_change(
                    request,
                    result,
                    f"{result.get_status_display()}; часы: {result.confirmed_hours}; {result.review_note}",
                )
                self.message_user(
                    request,
                    f"Заявка №{obj.pk}: {result.get_status_display()}.",
                    messages.SUCCESS,
                )
                return HttpResponseRedirect(
                    reverse("admin:catalog_activity_changelist")
                )
        return TemplateResponse(
            request,
            "admin/catalog/activity/review.html",
            {
                **self.admin_site.each_context(request),
                "opts": self.model._meta,
                "original": obj,
                "title": f"Проверка заявки №{obj.pk}",
                "form": form,
                "already_reviewed": obj.status != Activity.Status.PENDING,
            },
        )


@admin.register(CoinTransaction)
class CoinTransactionAdmin(ReadOnlyAdmin):
    list_display = ["id", "volunteer", "amount", "description", "created_at"]
    search_fields = ["volunteer__username", "description"]
    list_filter = ["created_at"]
    list_select_related = ["volunteer"]


@admin.register(Redemption)
class RedemptionAdmin(ReadOnlyAdmin):
    list_display = [
        "id",
        "volunteer",
        "reward",
        "price",
        "status",
        "created_at",
        "issued_by",
    ]
    list_filter = ["status", "reward"]
    search_fields = ["volunteer__username", "reward__title"]
    list_select_related = ["volunteer", "reward", "issued_by"]
    actions = ["mark_issued"]

    def has_fulfill_permission(self, request):
        return request.user.has_perm("catalog.fulfill_redemption")

    @admin.action(
        description="Отметить условную выдачу поощрения", permissions=["fulfill"]
    )
    def mark_issued(self, request, queryset):
        for obj in queryset:
            try:
                result = issue_reward(coordinator=request.user, redemption_id=obj.pk)
            except ValidationError as exc:
                self.message_user(
                    request,
                    f"Запрос №{obj.pk}: {'; '.join(exc.messages)}",
                    messages.WARNING,
                )
            else:
                self.log_change(request, result, "Отмечена условная выдача поощрения")
                self.message_user(
                    request, f"Запрос №{obj.pk}: условно выдано.", messages.SUCCESS
                )
