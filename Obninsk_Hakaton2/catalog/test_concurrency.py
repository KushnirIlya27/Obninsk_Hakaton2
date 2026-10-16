from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

from accounts.models import VolunteerProfile
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from django.utils import timezone

from .models import CoinTransaction, Event, Redemption, Reward
from .services import Conflict, apply_to_event, purchase_reward, review_activity


class ConcurrentOperationsTests(TransactionTestCase):
    def setUp(self):
        if "memory" in str(connection.settings_dict["NAME"]):
            self.skipTest(
                "Run with --settings=Obninsk_Hakaton2.test_settings for file-backed SQLite."
            )
        User = get_user_model()
        self.volunteer = User.objects.create_user("concurrent-volunteer")
        self.coordinator = User.objects.create_user(
            "concurrent-coordinator", is_staff=True
        )
        self.coordinator.user_permissions.add(
            Permission.objects.get(codename="review_activity")
        )
        event = Event.objects.create(
            title="Parallel test", location="Обнинск", starts_at=timezone.now()
        )
        self.activity, _ = apply_to_event(volunteer=self.volunteer, event_id=event.pk)
        self.reward = Reward.objects.create(title="Значок", price=20)

    def run_concurrently(self, operation):
        barrier = Barrier(2)

        def worker():
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                operation()
                return "success"
            except Conflict:
                return "conflict"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(worker) for _ in range(2)]
            return [future.result(timeout=30) for future in futures]

    def test_two_simultaneous_approvals_credit_once(self):
        coordinator_id, activity_id = self.coordinator.pk, self.activity.pk

        def approve():
            review_activity(
                coordinator=get_user_model().objects.get(pk=coordinator_id),
                activity_id=activity_id,
                decision="approved",
                hours=3,
            )

        self.assertCountEqual(self.run_concurrently(approve), ["success", "conflict"])
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 30)
        self.assertEqual(CoinTransaction.objects.count(), 1)

    def test_two_simultaneous_purchases_cannot_overspend(self):
        review_activity(
            coordinator=self.coordinator,
            activity_id=self.activity.pk,
            decision="approved",
            hours=3,
        )
        volunteer_id, reward_id = self.volunteer.pk, self.reward.pk

        def buy():
            purchase_reward(
                volunteer=get_user_model().objects.get(pk=volunteer_id),
                reward_id=reward_id,
                request_key=uuid4(),
            )

        self.assertCountEqual(self.run_concurrently(buy), ["success", "conflict"])
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 10)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(CoinTransaction.objects.count(), 2)
