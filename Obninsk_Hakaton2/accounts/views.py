from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from .forms import CustomUserCreationForm as UserCreationForm
from django.contrib.auth.views import LoginView
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_http_methods, require_POST

from django.contrib import messages
from django.core.exceptions import ValidationError
from django.utils import timezone
from catalog.forms import ActivityReportForm
from catalog.models import Activity, CoinTransaction, Event
from catalog.services import apply_to_event, submit_hours

from .models import VolunteerProfile


class CustomLoginView(LoginView):
    template_name = "registration/login.html"
    redirect_authenticated_user = True

    def get_success_url(self):
        user = self.request.user
        if user.is_staff and user.has_perm("catalog.review_activity"):
            return reverse("admin:index")
        return reverse("profile")


@require_http_methods(["GET", "POST"])
def register(request):
    if request.user.is_authenticated:
        return redirect("profile")
    form = UserCreationForm(request.POST if request.method == "POST" else None)
    if request.method == "POST" and form.is_valid():
        with transaction.atomic():
            user = form.save()
            VolunteerProfile.objects.get_or_create(user=user)
        login(request, user)
        return redirect("profile")
    return render(request, "registration/register.html", {"form": form})


@login_required(login_url="login")
def profile(request):
    card, _ = VolunteerProfile.objects.get_or_create(user=request.user)
    activities = list(
        Activity.objects.filter(volunteer=request.user).select_related("event")
    )
    now = timezone.now()
    for activity in activities:
        activity.can_submit_report = (
            activity.status in (Activity.Status.REGISTERED, Activity.Status.PENDING)
            and now >= activity.event.report_available_at
        )
    by_event = {activity.event_id: activity for activity in activities}
    events = [
        {"event": event, "activity": by_event.get(event.pk)}
        for event in Event.objects.filter(is_active=True)
    ]
    history = CoinTransaction.objects.filter(volunteer=request.user)[:20]
    return render(
        request,
        "registration/profile.html",
        {"card": card, "events": events, "activities": activities, "history": history},
    )


@require_POST
def logout_view(request):
    logout(request)
    return redirect("login")


@login_required(login_url="login")
def event_detail(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    activity = Activity.objects.filter(event=event, volunteer=request.user).first()
    return render(
        request,
        "volunteers/event_detail.html",
        {
            "event": event,
            "activity": activity,
            "report_available": timezone.now() >= event.report_available_at,
        },
    )


@login_required(login_url="login")
@require_POST
def event_apply(request, event_id):
    get_object_or_404(Event, pk=event_id)
    try:
        _, created = apply_to_event(volunteer=request.user, event_id=event_id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages))
    else:
        messages.success(
            request,
            (
                "Вы записаны. После мероприятия отправьте отчёт на начисление койнов."
                if created
                else "Вы уже записаны на это мероприятие."
            ),
        )
    return redirect("event_detail", event_id=event_id)


@login_required(login_url="login")
@require_http_methods(["GET", "POST"])
def activity_report(request, activity_id):
    activity = get_object_or_404(
        Activity.objects.select_related("event"), pk=activity_id, volunteer=request.user
    )
    form = ActivityReportForm(
        request.POST if request.method == "POST" else None,
        initial={
            "hours": activity.requested_hours,
            "report_text": activity.report_text,
        },
    )
    if request.method == "POST" and form.is_valid():
        try:
            submit_hours(
                volunteer=request.user, activity_id=activity.pk, **form.cleaned_data
            )
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(
                request,
                "Отчёт отправлен координатору. Койны появятся только после подтверждения.",
            )
            return redirect("profile")
    can_submit = (
        activity.status in (Activity.Status.REGISTERED, Activity.Status.PENDING)
        and timezone.now() >= activity.event.report_available_at
    )
    return render(
        request,
        "volunteers/report.html",
        {"activity": activity, "form": form, "can_submit": can_submit},
    )
