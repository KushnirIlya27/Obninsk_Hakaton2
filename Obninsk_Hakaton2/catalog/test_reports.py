from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import VolunteerProfile
from .models import Activity, CoinTransaction, Event
from .services import Conflict, apply_to_event, review_activity, submit_hours


class EventRateAndReportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.volunteer = User.objects.create_user(
            "report-volunteer", password="Obninsk-Strong-2026!"
        )
        cls.other = User.objects.create_user("report-other")
        cls.coordinator = User.objects.create_user("report-coordinator", is_staff=True)
        cls.coordinator.user_permissions.add(
            *Permission.objects.filter(
                content_type__app_label="catalog",
                codename__in=["review_activity", "view_activity", "change_activity"],
            )
        )
        cls.event = Event.objects.create(
            title="Уборка парка за 20",
            location="Обнинск",
            coins_per_hour=20,
            starts_at=timezone.now() - timedelta(hours=5),
            ends_at=timezone.now() - timedelta(hours=2),
        )

    def join(self, event=None):
        return apply_to_event(
            volunteer=self.volunteer, event_id=(event or self.event).pk
        )[0]

    def report(self, event=None):
        activity = self.join(event)
        return submit_hours(
            volunteer=self.volunteer,
            activity_id=activity.pk,
            hours=3,
            report_text="Убирал мусор в городском парке.",
        )

    def approve(self, activity, multiplier="1.00", note=""):
        return review_activity(
            coordinator=self.coordinator,
            activity_id=activity.pk,
            decision="approved",
            hours=3,
            multiplier=multiplier,
            note=note,
        )

    def test_registration_shows_catalog_and_rates(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "catalog-new",
                "password1": "Obninsk-Strong-2026!",
                "password2": "Obninsk-Strong-2026!",
            },
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.event.title)
        self.assertContains(response, "20 койнов / час")

    def test_join_does_not_request_credit(self):
        activity = self.join()
        self.assertEqual(activity.status, "registered")
        self.assertIsNone(activity.report_submitted_at)
        self.assertEqual(activity.rate_snapshot, 20)
        with self.assertRaises(Conflict):
            self.approve(activity)
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 0)
        self.assertFalse(CoinTransaction.objects.exists())

    def test_submission_does_not_credit_and_records_description(self):
        activity = self.report()
        self.assertEqual(activity.status, "pending")
        self.assertIsNotNone(activity.report_submitted_at)
        self.assertIn("Убирал", activity.report_text)
        self.assertFalse(CoinTransaction.objects.exists())
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 0)

    def test_report_not_allowed_before_end(self):
        self.event.ends_at = timezone.now() + timedelta(hours=2)
        self.event.save()
        activity = self.join()
        with self.assertRaises(Conflict):
            submit_hours(volunteer=self.volunteer, activity_id=activity.pk, hours=3)
        activity.refresh_from_db()
        self.assertEqual(activity.status, "registered")

    def test_rate_snapshot_and_updated_catalog(self):
        activity = self.report()
        self.event.coins_per_hour = 100
        self.event.save()
        result = self.approve(activity)
        self.assertEqual(result.coins_awarded, 60)
        self.assertEqual(result.rate_snapshot, 20)
        self.assertEqual(
            self.client.get("/api/events/").json()["results"][0]["coins_per_hour"], 100
        )
        another, _ = apply_to_event(volunteer=self.other, event_id=self.event.pk)
        self.assertEqual(another.rate_snapshot, 100)
        duplicate = self.join()
        self.assertEqual(duplicate.rate_snapshot, 20)

    def test_different_events_have_different_rewards(self):
        self.approve(self.report())
        second = Event.objects.create(
            title="Помощь приюту",
            location="Обнинск",
            coins_per_hour=15,
            starts_at=self.event.starts_at,
        )
        result = self.approve(self.report(second))
        self.assertEqual(result.coins_awarded, 45)
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 105)

    def test_force_majeure_multiplier_and_audit(self):
        result = self.approve(
            self.report(), multiplier="1.50", note="Работа под дождём"
        )
        self.assertEqual(result.coins_awarded, 90)
        self.assertEqual(result.multiplier, Decimal("1.50"))
        entry = CoinTransaction.objects.get(activity=result)
        self.assertEqual(entry.amount, 90)
        self.assertIn("20 койнов/ч", entry.description)
        self.assertIn("1.50", entry.description)
        self.assertIn("дождём", entry.description)
        with self.assertRaises(Conflict):
            self.approve(result, multiplier="2", note="Повтор")
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 90)

    def test_multiplier_validation_and_reason(self):
        activity = self.report()
        for multiplier in [
            "NaN",
            "Infinity",
            0,
            -1,
            11,
            "1.234",
            "1.0000000000000000000000000000001",
            "bad",
            None,
        ]:
            with self.subTest(multiplier=multiplier), self.assertRaises(
                ValidationError
            ):
                self.approve(activity, multiplier=multiplier, note="Проверка")
        with self.assertRaises(ValidationError):
            self.approve(activity, multiplier="1.50")
        self.assertFalse(CoinTransaction.objects.exists())

    def test_decimal_rounding_half_up(self):
        self.event.coins_per_hour = 15
        self.event.save()
        activity = self.join()
        submit_hours(volunteer=self.volunteer, activity_id=activity.pk, hours="0.1")
        result = review_activity(
            coordinator=self.coordinator,
            activity_id=activity.pk,
            decision="approved",
            hours="0.1",
        )
        self.assertEqual(result.coins_awarded, 2)

    def test_rejected_report_has_no_credit_and_cannot_be_edited(self):
        activity = self.report()
        result = review_activity(
            coordinator=self.coordinator,
            activity_id=activity.pk,
            decision="rejected",
            note="Участие не подтверждено",
        )
        self.assertEqual(result.coins_awarded, 0)
        self.assertFalse(CoinTransaction.objects.exists())
        with self.assertRaises(Conflict):
            submit_hours(volunteer=self.volunteer, activity_id=activity.pk, hours=4)

    def test_volunteer_cannot_forge_award_or_multiplier(self):
        self.client.force_login(self.volunteer)
        activity = self.join()
        response = self.client.post(
            f"/api/activities/{activity.pk}/report/",
            {
                "hours": 3,
                "report_text": "Помощь в парке",
                "coins_awarded": 99999,
                "rate_snapshot": 999,
                "multiplier": 10,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["coins_awarded"], 0)
        self.assertEqual(response.json()["multiplier"], "1.00")
        self.assertEqual(response.json()["rate_snapshot"], 20)
        url = f"/api/coordinator/activities/{activity.pk}/review/"
        self.assertEqual(
            self.client.post(
                url,
                {"decision": "approved", "hours": 3},
                content_type="application/json",
            ).status_code,
            403,
        )

    def test_api_review_exposes_final_formula(self):
        activity = self.report()
        self.client.force_login(self.coordinator)
        response = self.client.post(
            f"/api/coordinator/activities/{activity.pk}/review/",
            {"decision": "approved", "hours": 3, "multiplier": "1.5", "note": "Дождь"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["coins_awarded"], 90)
        self.assertEqual(response.json()["multiplier"], "1.50")

    def test_complete_web_flow_from_registration_to_admin(self):
        self.client.post(
            reverse("register"),
            {
                "username": "web-flow",
                "password1": "Obninsk-Strong-2026!",
                "password2": "Obninsk-Strong-2026!",
            },
        )
        user = get_user_model().objects.get(username="web-flow")
        self.assertRedirects(
            self.client.post(reverse("event_apply", args=[self.event.pk])),
            reverse("event_detail", args=[self.event.pk]),
        )
        activity = Activity.objects.get(volunteer=user)
        report_url = reverse("activity_report", args=[activity.pk])
        self.assertContains(self.client.get(report_url), "Что вы делали")
        response = self.client.post(
            report_url,
            {"hours": "3", "report_text": "Убирал мусор и раздавал перчатки."},
        )
        self.assertRedirects(response, reverse("profile"))
        self.assertEqual(VolunteerProfile.objects.get(user=user).balance, 0)
        self.client.force_login(self.coordinator)
        review_url = reverse("admin:catalog_activity_review", args=[activity.pk])
        self.assertContains(self.client.get(review_url), "id_multiplier")
        response = self.client.post(
            review_url,
            {
                "decision": "approved",
                "hours": "3",
                "multiplier": "1.5",
                "note": "Ливень",
            },
        )
        self.assertRedirects(response, reverse("admin:catalog_activity_changelist"))
        self.client.force_login(user)
        response = self.client.get(reverse("profile"))
        self.assertContains(response, "+90 койнов")
        self.assertContains(response, "Ливень")

    def test_report_owner_and_required_description(self):
        activity = self.join()
        self.client.force_login(self.other)
        url = reverse("activity_report", args=[activity.pk])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(
            self.client.post(url, {"hours": "3", "report_text": "Подмена"}).status_code,
            404,
        )
        self.client.force_login(self.volunteer)
        self.assertEqual(
            self.client.post(url, {"hours": "3", "report_text": ""}).status_code, 200
        )
        activity.refresh_from_db()
        self.assertEqual(activity.status, "registered")

    def test_event_dates_and_rates_validated(self):
        self.event.ends_at = self.event.starts_at - timedelta(hours=1)
        with self.assertRaises(ValidationError):
            self.event.full_clean()
        with self.assertRaises(IntegrityError), transaction.atomic():
            Event.objects.filter(pk=self.event.pk).update(coins_per_hour=0)

    def test_api_registration_returns_catalog_route_and_no_privileges(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "react-volunteer",
                "password1": "Obninsk-Strong-2026!",
                "password2": "Obninsk-Strong-2026!",
                "is_staff": True,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["events_url"], "/api/events/")
        self.assertEqual(response.json()["redirect_url"], "/dashboard")
        user = get_user_model().objects.get(username="react-volunteer")
        self.assertFalse(user.is_staff)
        self.assertEqual(self.client.get("/api/me/").json()["balance"], 0)

    def test_api_registration_errors_and_empty_report(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "invalid", "password1": "short", "password2": "other"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("fields", response.json())
        activity = self.join()
        self.client.force_login(self.volunteer)
        response = self.client.post(
            f"/api/activities/{activity.pk}/report/",
            {"hours": 3, "report_text": ""},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        activity.refresh_from_db()
        self.assertEqual(activity.status, "registered")
