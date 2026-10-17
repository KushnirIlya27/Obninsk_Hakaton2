from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from accounts.models import VolunteerProfile
from .forms import ReviewForm
from .models import CoinTransaction, Event
from .services import apply_to_event, review_activity, submit_hours, validate_multiplier


class CoefficientRulesTests(SimpleTestCase):
    def test_allowed_values(self):
        for value in ["1", "1.00", "1.05", "1.10", "1.50", "9.95", "10.00"]:
            with self.subTest(value=value):
                self.assertEqual(validate_multiplier(value), Decimal(value))
                form = ReviewForm(
                    {
                        "decision": "approved",
                        "hours": "3",
                        "multiplier": value,
                        "note": "Дождь",
                    }
                )
                self.assertTrue(form.is_valid(), form.errors)

    def test_rejected_values(self):
        for value in [
            "0.10",
            "0.95",
            "0.99",
            "1.01",
            "1.03",
            "1.07",
            "10.05",
            "NaN",
            "Infinity",
        ]:
            with self.subTest(value=value):
                with self.assertRaises(ValidationError):
                    validate_multiplier(value)
                form = ReviewForm(
                    {
                        "decision": "approved",
                        "hours": "3",
                        "multiplier": value,
                        "note": "Дождь",
                    }
                )
                self.assertFalse(form.is_valid())
                self.assertIn("multiplier", form.errors)

    def test_default_and_widget_step(self):
        form = ReviewForm({"decision": "approved", "hours": "3"})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["multiplier"], Decimal("1.00"))
        html = str(ReviewForm()["multiplier"])
        self.assertIn('step="0.05"', html)
        self.assertIn('min="1.00"', html)
        self.assertIn('max="10.00"', html)


class CoefficientAccountingTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user("step-volunteer")
        self.coordinator = User.objects.create_user("step-coordinator", is_staff=True)
        self.coordinator.user_permissions.add(
            Permission.objects.get(codename="review_activity")
        )
        event = Event.objects.create(
            title="Коэффициент 1.05",
            location="Обнинск",
            coins_per_hour=20,
            starts_at=timezone.now() - timedelta(hours=5),
        )
        self.activity, _ = apply_to_event(volunteer=self.user, event_id=event.pk)
        submit_hours(
            volunteer=self.user,
            activity_id=self.activity.pk,
            hours=3,
            report_text="Помощь в парке",
        )

    def test_valid_coefficient_settles_correct_amount(self):
        result = review_activity(
            coordinator=self.coordinator,
            activity_id=self.activity.pk,
            decision="approved",
            hours=3,
            multiplier="1.05",
            note="Дождь",
        )
        self.assertEqual(result.coins_awarded, 63)
        self.assertEqual(VolunteerProfile.objects.get(user=self.user).balance, 63)
        self.assertEqual(CoinTransaction.objects.get(activity=result).amount, 63)

    def test_invalid_coefficient_cannot_credit(self):
        for value in ["0.95", "1.01", "1.03", "10.05"]:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                review_activity(
                    coordinator=self.coordinator,
                    activity_id=self.activity.pk,
                    decision="approved",
                    hours=3,
                    multiplier=value,
                    note="Дождь",
                )
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.status, "pending")
        self.assertEqual(VolunteerProfile.objects.get(user=self.user).balance, 0)
        self.assertFalse(CoinTransaction.objects.exists())
