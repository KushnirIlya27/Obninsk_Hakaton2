from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from accounts.models import VolunteerProfile
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from .models import CoinTransaction, Event, Redemption, Reward
from .services import (
    Conflict,
    apply_to_event,
    issue_reward,
    purchase_reward,
    review_activity,
    submit_hours,
)


class VolunteerTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.volunteer = User.objects.create_user("volunteer", password="test-password")
        cls.other = User.objects.create_user("other")
        cls.coordinator = User.objects.create_user(
            "coordinator", password="test-password", is_staff=True
        )
        cls.coordinator.user_permissions.add(
            *Permission.objects.filter(
                content_type__app_label="catalog",
                codename__in=[
                    "review_activity",
                    "fulfill_redemption",
                    "view_activity",
                    "change_activity",
                    "view_redemption",
                    "change_redemption",
                    "view_cointransaction",
                ],
            )
        )
        cls.event = Event.objects.create(
            title="Уборка парка",
            location="Обнинск",
            starts_at=timezone.now() - timedelta(hours=5),
        )
        cls.reward = Reward.objects.create(title="Значок", price=20)

    def setUp(self):
        self.activity, _ = apply_to_event(
            volunteer=self.volunteer, event_id=self.event.pk
        )
        submit_hours(volunteer=self.volunteer, activity_id=self.activity.pk, hours=3)

    def approve(self):
        return review_activity(
            coordinator=self.coordinator,
            activity_id=self.activity.pk,
            decision="approved",
            hours="3",
        )

    def test_full_scenario_and_duplicate_credit(self):
        submit_hours(volunteer=self.volunteer, activity_id=self.activity.pk, hours=3)
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 0)
        self.approve()
        profile = VolunteerProfile.objects.get(user=self.volunteer)
        self.assertEqual((profile.balance, profile.confirmed_hours), (30, Decimal("3")))
        redemption, created = purchase_reward(
            volunteer=self.volunteer, reward_id=self.reward.pk, request_key=uuid4()
        )
        self.assertTrue(created)
        profile.refresh_from_db()
        self.assertEqual(profile.balance, 10)
        self.assertEqual(
            list(
                CoinTransaction.objects.order_by("id").values_list("amount", flat=True)
            ),
            [30, -20],
        )
        with self.assertRaises(Conflict):
            self.approve()
        issue_reward(coordinator=self.coordinator, redemption_id=redemption.pk)
        profile.refresh_from_db()
        self.assertEqual(profile.balance, 10)
        with self.assertRaises(Conflict):
            issue_reward(coordinator=self.coordinator, redemption_id=redemption.pk)

    def test_duplicate_application(self):
        obj, created = apply_to_event(volunteer=self.volunteer, event_id=self.event.pk)
        self.assertFalse(created)
        self.assertEqual(obj.pk, self.activity.pk)

    def test_closed_event(self):
        self.event.is_active = False
        self.event.save()
        with self.assertRaises(Conflict):
            apply_to_event(volunteer=self.other, event_id=self.event.pk)

    def test_no_credit_without_permission(self):
        staff = get_user_model().objects.create_user("staff", is_staff=True)
        for actor in [self.volunteer, staff]:
            with self.assertRaises(PermissionDenied):
                review_activity(
                    coordinator=actor,
                    activity_id=self.activity.pk,
                    decision="approved",
                    hours=3,
                )
        self.assertFalse(CoinTransaction.objects.exists())

    def test_self_review(self):
        activity, _ = apply_to_event(volunteer=self.coordinator, event_id=self.event.pk)
        with self.assertRaises(PermissionDenied):
            review_activity(
                coordinator=self.coordinator,
                activity_id=activity.pk,
                decision="approved",
                hours=3,
            )

    def test_rejection(self):
        with self.assertRaises(ValidationError):
            review_activity(
                coordinator=self.coordinator,
                activity_id=self.activity.pk,
                decision="rejected",
            )
        review_activity(
            coordinator=self.coordinator,
            activity_id=self.activity.pk,
            decision="rejected",
            note="Участие не подтверждено",
        )
        with self.assertRaises(Conflict):
            self.approve()
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 0)
        self.assertFalse(CoinTransaction.objects.exists())

    def test_hours_validation_and_fractional_credit(self):
        for hours in [0, -1, 25, "NaN", "Infinity", "abc", None, "1.25", True]:
            with self.subTest(hours=hours), self.assertRaises(ValidationError):
                submit_hours(
                    volunteer=self.volunteer, activity_id=self.activity.pk, hours=hours
                )
        review_activity(
            coordinator=self.coordinator,
            activity_id=self.activity.pk,
            decision="approved",
            hours="1.5",
        )
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 15)

    def test_insufficient_funds(self):
        with self.assertRaises(Conflict):
            purchase_reward(
                volunteer=self.volunteer, reward_id=self.reward.pk, request_key=uuid4()
            )
        self.assertFalse(Redemption.objects.exists())
        self.assertFalse(CoinTransaction.objects.exists())

    def test_duplicate_purchase_and_price_snapshot(self):
        self.approve()
        key = uuid4()
        first, _ = purchase_reward(
            volunteer=self.volunteer, reward_id=self.reward.pk, request_key=key
        )
        self.reward.price = 40
        self.reward.is_active = False
        self.reward.save()
        second, created = purchase_reward(
            volunteer=self.volunteer, reward_id=self.reward.pk, request_key=key
        )
        self.assertFalse(created)
        self.assertEqual((second.pk, second.price), (first.pk, 20))
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 10)
        another = Reward.objects.create(title="Другое", price=1)
        with self.assertRaises(Conflict):
            purchase_reward(
                volunteer=self.volunteer, reward_id=another.pk, request_key=key
            )

    def test_disabled_reward_and_invalid_key(self):
        self.approve()
        with self.assertRaises(ValidationError):
            purchase_reward(
                volunteer=self.volunteer, reward_id=self.reward.pk, request_key="bad"
            )
        self.reward.is_active = False
        self.reward.save()
        with self.assertRaises(Conflict):
            purchase_reward(
                volunteer=self.volunteer, reward_id=self.reward.pk, request_key=uuid4()
            )
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 30)

    def test_approval_rollback(self):
        with patch(
            "catalog.services.CoinTransaction.objects.create",
            side_effect=RuntimeError("storage failure"),
        ):
            with self.assertRaises(RuntimeError):
                self.approve()
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.status, "pending")
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 0)

    def test_purchase_rollback(self):
        self.approve()
        with patch(
            "catalog.services.CoinTransaction.objects.create",
            side_effect=RuntimeError("storage failure"),
        ):
            with self.assertRaises(RuntimeError):
                purchase_reward(
                    volunteer=self.volunteer,
                    reward_id=self.reward.pk,
                    request_key=uuid4(),
                )
        self.assertFalse(Redemption.objects.exists())
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 30)

    def test_database_duplicate_ledger_source(self):
        self.approve()
        with self.assertRaises(IntegrityError), transaction.atomic():
            CoinTransaction.objects.create(
                volunteer=self.volunteer,
                activity=self.activity,
                amount=30,
                description="Duplicate",
            )

    def test_api_ownership(self):
        self.assertEqual(self.client.get("/api/me/").status_code, 401)
        self.client.force_login(self.other)
        response = self.client.post(
            f"/api/activities/{self.activity.pk}/hours/",
            {"hours": 3},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get("/api/me/activities/").json()["results"], [])
        self.assertEqual(
            self.client.get("/api/coordinator/activities/").status_code, 403
        )
        self.assertEqual(
            self.client.get("/api/coordinator/redemptions/").status_code, 403
        )

    def test_api_ignores_forged_price_and_user(self):
        self.client.force_login(self.volunteer)
        response = self.client.post(
            f"/api/events/{self.event.pk}/apply/",
            {"volunteer_id": self.other.pk, "balance": 999},
            content_type="application/json",
        )
        self.assertEqual(response.json()["volunteer_id"], self.volunteer.pk)
        self.approve()
        response = self.client.post(
            f"/api/rewards/{self.reward.pk}/purchase/",
            {"request_key": str(uuid4()), "price": 1},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["price"], 20)

    def test_api_repeat_review_and_locked_hours(self):
        self.client.force_login(self.coordinator)
        url = f"/api/coordinator/activities/{self.activity.pk}/review/"
        payload = {"decision": "approved", "hours": 3}
        self.assertEqual(
            self.client.post(url, payload, content_type="application/json").status_code,
            200,
        )
        self.assertEqual(
            self.client.post(url, payload, content_type="application/json").status_code,
            409,
        )
        self.client.force_login(self.volunteer)
        self.assertEqual(
            self.client.post(
                f"/api/activities/{self.activity.pk}/hours/",
                {"hours": 5},
                content_type="application/json",
            ).status_code,
            409,
        )

    def test_csrf_login_and_writes(self):
        client = Client(enforce_csrf_checks=True)
        payload = {"username": "volunteer", "password": "test-password"}
        self.assertEqual(
            client.post(
                "/api/auth/login/", payload, content_type="application/json"
            ).status_code,
            403,
        )
        token = client.get("/api/auth/csrf/").json()["csrfToken"]
        response = client.post(
            "/api/auth/login/",
            payload,
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.get("/api/me/").status_code, 200)
        self.assertEqual(
            client.post(
                f"/api/events/{self.event.pk}/apply/",
                {},
                content_type="application/json",
            ).status_code,
            403,
        )
        self.assertEqual(
            client.post(
                f"/api/events/{self.event.pk}/apply/",
                {},
                content_type="application/json",
                HTTP_X_CSRFTOKEN=response.json()["csrfToken"],
            ).status_code,
            200,
        )

    def test_admin_review(self):
        self.client.force_login(self.coordinator)
        url = reverse("admin:catalog_activity_review", args=[self.activity.pk])
        self.assertContains(self.client.get(url), "Проверка заявки")
        response = self.client.post(
            url, {"decision": "approved", "hours": 3, "note": "Проверено"}
        )
        self.assertRedirects(response, reverse("admin:catalog_activity_changelist"))
        self.assertContains(self.client.get(url), "Повторное начисление запрещено")
        self.assertContains(
            self.client.post(url, {"decision": "approved", "hours": 3}),
            "уже рассмотрена",
        )
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 30)

    def test_admin_readonly_and_no_delete(self):
        self.approve()
        self.client.force_login(self.coordinator)
        url = reverse("admin:catalog_activity_change", args=[self.activity.pk])
        self.client.post(
            url, {"status": "pending", "confirmed_hours": 20, "_save": "Save"}
        )
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.status, "approved")
        self.assertEqual(self.activity.confirmed_hours, Decimal("3"))
        self.assertEqual(
            self.client.post(
                reverse("admin:catalog_activity_delete", args=[self.activity.pk]),
                {"post": "yes"},
            ).status_code,
            403,
        )

    def test_bad_json(self):
        self.client.force_login(self.volunteer)
        for payload in ["[]", "{broken", "{}"]:
            response = self.client.post(
                f"/api/activities/{self.activity.pk}/hours/",
                payload,
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 400)
