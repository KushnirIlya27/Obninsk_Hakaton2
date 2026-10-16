import json
from functools import wraps

from accounts.models import VolunteerProfile
from django.contrib.auth import authenticate, login, logout
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied, ValidationError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods

from .models import Activity, CoinTransaction, Event, Redemption, Reward
from .services import (
    Conflict,
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
    return {
        "id": obj.pk,
        "volunteer_id": obj.volunteer_id,
        "event_id": obj.event_id,
        "requested_hours": obj.requested_hours,
        "confirmed_hours": obj.confirmed_hours,
        "status": obj.status,
        "review_note": obj.review_note,
        "reviewed_by_id": obj.reviewed_by_id,
        "reviewed_at": obj.reviewed_at,
    }


def redemption_data(obj):
    return {
        "id": obj.pk,
        "volunteer_id": obj.volunteer_id,
        "reward_id": obj.reward_id,
        "price": obj.price,
        "status": obj.status,
        "created_at": obj.created_at,
        "issued_by_id": obj.issued_by_id,
        "issued_at": obj.issued_at,
    }


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
        {"id": user.pk, "username": user.username, "csrfToken": get_token(request)}
    )


@endpoint(["POST"])
def session_logout(request):
    logout(request)
    return JsonResponse({"ok": True})


@endpoint(["GET"], public=True)
def events(request):
    return JsonResponse(
        {
            "results": list(
                Event.objects.filter(is_active=True).values(
                    "id", "title", "description", "location", "starts_at"
                )
            )
        }
    )


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
    profile = VolunteerProfile.objects.filter(user=request.user).first()
    return JsonResponse(
        {
            "id": request.user.pk,
            "username": request.user.username,
            "name": request.user.get_full_name(),
            "balance": profile.balance if profile else 0,
            "confirmed_hours": profile.confirmed_hours if profile else "0.0",
            "can_review": request.user.is_staff
            and request.user.has_perm("catalog.review_activity"),
        }
    )


@endpoint(["POST"])
def apply(request, event_id):
    obj, created = apply_to_event(volunteer=request.user, event_id=event_id)
    return JsonResponse(activity_data(obj), status=201 if created else 200)


@endpoint(["GET"])
def my_activities(request):
    return JsonResponse(
        {
            "results": [
                activity_data(obj)
                for obj in Activity.objects.filter(volunteer=request.user)
            ]
        }
    )


@endpoint(["POST"])
def hours(request, activity_id):
    obj = submit_hours(
        volunteer=request.user, activity_id=activity_id, hours=request.data["hours"]
    )
    return JsonResponse(activity_data(obj))


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
    return JsonResponse(redemption_data(obj), status=201 if created else 200)


@endpoint(["GET"])
def my_redemptions(request):
    return JsonResponse(
        {
            "results": [
                redemption_data(obj)
                for obj in Redemption.objects.filter(volunteer=request.user)
            ]
        }
    )


@endpoint(["GET"])
def coordinator_activities(request):
    require_coordinator(request.user, "review_activity")
    queryset = Activity.objects.all()
    if status := request.GET.get("status"):
        queryset = queryset.filter(status=status)
    return JsonResponse({"results": [activity_data(obj) for obj in queryset]})


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
    )
    return JsonResponse(activity_data(obj))


@endpoint(["GET"])
def coordinator_redemptions(request):
    require_coordinator(request.user, "fulfill_redemption")
    return JsonResponse(
        {"results": [redemption_data(obj) for obj in Redemption.objects.all()]}
    )


@endpoint(["POST"])
def issue(request, redemption_id):
    obj = issue_reward(coordinator=request.user, redemption_id=redemption_id)
    return JsonResponse(redemption_data(obj))
