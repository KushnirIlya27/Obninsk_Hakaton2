import json
from functools import wraps

from accounts.models import VolunteerProfile, Person
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.utils import timezone
from accounts.forms import CustomUserCreationForm
from .forms import EventForm
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied, ValidationError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods

from .models import Activity, CoinTransaction, Event, EventTemplate, Redemption, Reward
from .services import (
    Conflict,
    cancel_reward,
    apply_to_event,
    issue_reward,
    purchase_reward,
    require_coordinator,
    review_activity,
    submit_hours,
)


def endpoint(methods, *, public=False):
    def decorator(view):
        @require_http_methods(methods)
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if not public and (
                not request.user.is_authenticated or not request.user.is_active
            ):
                return JsonResponse({"error": "Требуется вход."}, status=401)
            try:
                request.data = {}
                if request.method == "POST":
                    request.data = json.loads(request.body or b"{}")
                    if not isinstance(request.data, dict):
                        raise ValidationError("Ожидается JSON-объект.")
                return view(request, *args, **kwargs)
            except PermissionDenied as exc:
                return JsonResponse({"error": str(exc)}, status=403)
            except ObjectDoesNotExist:
                return JsonResponse({"error": "Объект не найден."}, status=404)
            except Conflict as exc:
                return JsonResponse({"error": "; ".join(exc.messages)}, status=409)
            except ValidationError as exc:
                return JsonResponse({"error": "; ".join(exc.messages)}, status=400)
            except (
                json.JSONDecodeError,
                UnicodeDecodeError,
                KeyError,
                TypeError,
                ValueError,
            ):
                return JsonResponse(
                    {"error": "Некорректный JSON или отсутствует обязательное поле."},
                    status=400,
                )

        return wrapped

    return decorator


def activity_data(obj):
    event = obj.event
    return {
        "id": obj.pk,
        "volunteer_id": obj.volunteer_id,
        "volunteer_username": obj.volunteer.username,
        "event_id": obj.event_id,
        "event_title": event.title,
        "event_starts_at": event.starts_at,
        "event_ends_at": event.ends_at,
        "report_available_at": event.report_available_at,
        "can_submit_report": obj.status
        in (Activity.Status.REGISTERED, Activity.Status.PENDING)
        and timezone.now() >= event.report_available_at,
        "rate_snapshot": obj.rate_snapshot,
        "requested_hours": obj.requested_hours,
        "report_text": obj.report_text,
        "report_submitted_at": obj.report_submitted_at,
        "confirmed_hours": obj.confirmed_hours,
        "coefficient": obj.multiplier,
        "multiplier": obj.multiplier,
        "coins_awarded": obj.coins_awarded,
        "status": obj.status,
        "review_note": obj.review_note,
        "reviewed_by_id": obj.reviewed_by_id,
        "reviewed_at": obj.reviewed_at,
        "created_at": obj.created_at,
    }


_activity_data_with_event = activity_data


def event_data(event):
    return {
        "id": event.pk,
        "title": event.title,
        "description": event.description,
        "location": event.location,
        "starts_at": event.starts_at,
        "ends_at": event.ends_at,
        "coins_per_hour": event.coins_per_hour,
        "rate": event.coins_per_hour,
        "is_active": event.is_active,
        "report_available_at": event.report_available_at,
    }


def redemption_data(obj):
    data = {
        "id": obj.pk,
        "volunteer_id": obj.volunteer_id,
        "reward_id": obj.reward_id,
        "price": obj.price,
        "request_key": obj.request_key,
        "status": obj.status,
        "created_at": obj.created_at,
        "issued_by_id": obj.issued_by_id,
        "issued_at": obj.issued_at,
        "cancelled_at": obj.cancelled_at,
        "cancelled_by_id": obj.cancelled_by_id,
    }
    if hasattr(obj, "reward") and obj.reward:
        data["reward_title"] = obj.reward.title
    return data


@endpoint(["GET"], public=True)
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@endpoint(["POST"], public=True)
def session_login(request):
    username, password = request.data["username"], request.data["password"]
    if not isinstance(username, str) or not isinstance(password, str):
        raise ValidationError("Логин и пароль должны быть строками.")
    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Неверный логин или пароль."}, status=401)
    login(request, user)
    return JsonResponse(
        {
            "id": user.pk,
            "username": user.username,
            "is_staff": user.is_staff,
            "can_review": user.is_staff and user.has_perm("catalog.review_activity"),
            "csrfToken": get_token(request),
        }
    )


@endpoint(["POST"], public=True)
def session_register(request):
    data = request.data.copy()
    if "password" in data:
        data.setdefault("password1", data["password"])
        data.setdefault("password2", data["password"])
    for key in ("username", "password1", "password2"):
        if not isinstance(data.get(key), str):
            raise ValidationError("Логин и пароль должны быть строками.")
    for key in ("phone", "email", "info"):
        if key in data and not isinstance(data[key], str):
            raise ValidationError("Контактные данные должны быть строками.")
    form = CustomUserCreationForm(data)
    if not form.is_valid():
        return JsonResponse(
            {
                "error": "Проверьте данные регистрации.",
                "fields": form.errors.get_json_data(),
            },
            status=400,
        )
    try:
        with transaction.atomic():
            user = form.save()
            VolunteerProfile.objects.get_or_create(user=user)
    except IntegrityError:
        raise Conflict("Пользователь с таким логином уже существует.")
    login(request, user)
    return JsonResponse(
        {
            "id": user.pk,
            "username": user.username,
            "is_staff": False,
            "can_review": False,
            "csrfToken": get_token(request),
            "events_url": "/api/events/",
            "redirect_url": "/dashboard",
        },
        status=201,
    )


@endpoint(["POST"])
def session_logout(request):
    logout(request)
    return JsonResponse({"ok": True})


@endpoint(["GET"], public=True)
def events(request):
    results = [event_data(event) for event in Event.objects.filter(is_active=True)]
    own = (
        {a.event_id: a for a in Activity.objects.filter(volunteer=request.user)}
        if request.user.is_authenticated
        else {}
    )
    for item in results:
        activity = own.get(item["id"])
        item["my_status"] = activity.status if activity else None
        item["activity_id"] = activity.pk if activity else None
    return JsonResponse({"results": results})


@endpoint(["GET"], public=True)
def rewards(request):
    return JsonResponse(
        {
            "results": list(
                Reward.objects.filter(is_active=True).values(
                    "id", "title", "description", "price"
                )
            )
        }
    )


@endpoint(["GET"])
def me(request):
    person = Person.objects.filter(user=request.user).first()
    profile = VolunteerProfile.objects.filter(user=request.user).first()
    return JsonResponse(
        {
            "id": request.user.pk,
            "username": request.user.username,
            "name": request.user.get_full_name(),
            "email": request.user.email,
            "phone": (person.phone or "") if person else "",
            "info": person.info if person else "",
            "can_issue": request.user.is_staff
            and request.user.has_perm("catalog.fulfill_redemption"),
            "can_manage_events": request.user.is_staff
            and request.user.has_perm("catalog.add_event"),
            "balance": profile.balance if profile else 0,
            "confirmed_hours": str(profile.confirmed_hours) if profile else "0.0",
            "is_staff": request.user.is_staff,
            "can_review": request.user.is_staff
            and request.user.has_perm("catalog.review_activity"),
        }
    )


@endpoint(["POST"])
def apply(request, event_id):
    obj, created = apply_to_event(volunteer=request.user, event_id=event_id)
    obj = Activity.objects.select_related("event", "volunteer").get(pk=obj.pk)
    return JsonResponse(_activity_data_with_event(obj), status=201 if created else 200)


@endpoint(["GET"])
def my_activities(request):
    return JsonResponse(
        {
            "results": [
                _activity_data_with_event(obj)
                for obj in Activity.objects.select_related("event", "volunteer").filter(
                    volunteer=request.user
                )
            ]
        }
    )


@endpoint(["POST"])
def hours(request, activity_id):
    obj = submit_hours(
        volunteer=request.user,
        activity_id=activity_id,
        hours=request.data["hours"],
        report_text=request.data.get("report_text", ""),
    )
    obj = Activity.objects.select_related("event", "volunteer").get(pk=obj.pk)
    return JsonResponse(_activity_data_with_event(obj))


@endpoint(["GET"])
def my_transactions(request):
    return JsonResponse(
        {
            "results": list(
                CoinTransaction.objects.filter(volunteer=request.user).values(
                    "id",
                    "amount",
                    "description",
                    "activity_id",
                    "redemption_id",
                    "refund_id",
                    "created_at",
                )
            )
        }
    )


@endpoint(["POST"])
def purchase(request, reward_id):
    obj, created = purchase_reward(
        volunteer=request.user,
        reward_id=reward_id,
        request_key=request.data["request_key"],
    )
    obj = Redemption.objects.select_related("reward").get(pk=obj.pk)
    return JsonResponse(redemption_data(obj), status=201 if created else 200)


@endpoint(["GET"])
def my_redemptions(request):
    return JsonResponse(
        {
            "results": [
                redemption_data(obj)
                for obj in Redemption.objects.select_related("reward").filter(
                    volunteer=request.user
                )
            ]
        }
    )


@endpoint(["GET"])
def coordinator_activities(request):
    require_coordinator(request.user, "review_activity")
    queryset = Activity.objects.select_related("event", "volunteer").all()
    if status := request.GET.get("status"):
        queryset = queryset.filter(status=status)
    results = []
    for obj in queryset:
        data = _activity_data_with_event(obj)
        data["volunteer_username"] = obj.volunteer.username
        results.append(data)
    return JsonResponse({"results": results})


@endpoint(["POST"])
def review(request, activity_id):
    note = request.data.get("note", "")
    if not isinstance(note, str):
        raise ValidationError("Комментарий должен быть строкой.")
    obj = review_activity(
        coordinator=request.user,
        activity_id=activity_id,
        decision=request.data["decision"],
        hours=request.data.get("hours"),
        note=note,
        multiplier=request.data.get(
            "multiplier", request.data.get("coefficient", "1.00")
        ),
    )
    obj = Activity.objects.select_related("event", "volunteer").get(pk=obj.pk)
    return JsonResponse(_activity_data_with_event(obj))


@endpoint(["GET"])
def coordinator_redemptions(request):
    require_coordinator(request.user, "fulfill_redemption")
    return JsonResponse(
        {
            "results": [
                {**redemption_data(obj), "volunteer_username": obj.volunteer.username}
                for obj in Redemption.objects.select_related(
                    "reward", "volunteer"
                ).all()
            ]
        }
    )


@endpoint(["POST"])
def issue(request, redemption_id):
    obj = issue_reward(coordinator=request.user, redemption_id=redemption_id)
    obj = Redemption.objects.select_related("reward").get(pk=obj.pk)
    return JsonResponse(redemption_data(obj))


@endpoint(["POST"])
def report(request, activity_id):
    text = request.data.get("report_text")
    if not isinstance(text, str) or not text.strip():
        raise ValidationError("Опишите выполненную работу.")
    obj = submit_hours(
        volunteer=request.user,
        activity_id=activity_id,
        hours=request.data["hours"],
        report_text=text,
    )
    return JsonResponse(activity_data(obj))


@endpoint(["GET", "POST"])
def coordinator_events(request):
    require_coordinator(
        request.user, "add_event" if request.method == "POST" else "view_event"
    )
    if request.method == "GET":
        return JsonResponse(
            {"results": [event_data(event) for event in Event.objects.all()]}
        )
    data = request.data.copy()
    data.setdefault("coins_per_hour", data.get("rate", 10))
    data.setdefault("is_active", True)
    form = EventForm(data)
    if not form.is_valid():
        return JsonResponse(
            {
                "error": "Проверьте данные мероприятия.",
                "fields": form.errors.get_json_data(),
            },
            status=400,
        )
    return JsonResponse(event_data(form.save()), status=201)


def csrf_failure(request, reason=""):
    return JsonResponse(
        {
            "error": "Не удалось проверить CSRF-токен. Обновите страницу.",
            "code": "csrf_failed",
        },
        status=403,
    )


@endpoint(["GET"], public=True)
def stats(request):
    total = (
        VolunteerProfile.objects.aggregate(hours=Sum("confirmed_hours"))["hours"] or 0
    )
    return JsonResponse(
        {
            "volunteers": User.objects.filter(is_active=True, is_staff=False).count(),
            "confirmed_hours": str(total),
            "events": Event.objects.filter(is_active=True).count(),
        }
    )


@endpoint(["POST"])
def cancel(request, redemption_id):
    obj = cancel_reward(user=request.user, redemption_id=redemption_id)
    return JsonResponse(redemption_data(obj))


def template_data(obj):
    return {"id": obj.pk, "title": obj.title, "description": obj.description,
            "location": obj.location, "coins_per_hour": obj.coins_per_hour}


@endpoint(["GET", "POST"])
def event_templates(request):
    require_coordinator(request.user, "add_event")
    if request.method == "GET":
        return JsonResponse({"results": [template_data(obj) for obj in EventTemplate.objects.filter(is_active=True)]})
    data = request.data
    for field in ("title", "location"):
        if not isinstance(data.get(field), str) or not data[field].strip():
            raise ValidationError("Заполните название и место шаблона.")
    if not isinstance(data.get("description", ""), str):
        raise ValidationError("Описание должно быть строкой.")
    obj = EventTemplate(title=data["title"].strip(), location=data["location"].strip(),
        description=data.get("description", ""), coins_per_hour=data.get("coins_per_hour", 10))
    obj.full_clean()
    obj.save()
    return JsonResponse(template_data(obj), status=201)


@endpoint(["POST"])
def archive_template(request, template_id):
    require_coordinator(request.user, "add_event")
    obj = EventTemplate.objects.get(pk=template_id)
    obj.is_active = False
    obj.save(update_fields=["is_active"])
    return JsonResponse({"archived": True})
