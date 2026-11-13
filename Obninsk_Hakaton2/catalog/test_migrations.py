from decimal import Decimal
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class ExistingAccountingMigrationTests(TransactionTestCase):
    def test_upgrade_preserves_ledger_balance_and_old_decisions(self):
        before = [("catalog", "0001_initial")]
        after = [("catalog", "0002_event_rates_and_reports")]
        executor = MigrationExecutor(connection)
        executor.migrate(before)
        try:
            apps = executor.loader.project_state(before).apps
            # Profiles belong to another app, so its state is supplied by the leaf graph.
            full_before = executor.loader.graph.leaf_nodes("accounts") + before
            apps = executor.loader.project_state(full_before).apps
            User = apps.get_model("auth", "User")
            Event = apps.get_model("catalog", "Event")
            Activity = apps.get_model("catalog", "Activity")
            Ledger = apps.get_model("catalog", "CoinTransaction")
            Profile = apps.get_model("accounts", "VolunteerProfile")
            user = User.objects.create(username="migration-volunteer")
            coordinator = User.objects.create(
                username="migration-coordinator", is_staff=True
            )
            event = Event.objects.create(
                title="Старое событие", location="Обнинск", starts_at=timezone.now()
            )
            registered = Activity.objects.create(
                volunteer_id=user.pk, event_id=event.pk
            )
            second_event = Event.objects.create(
                title="Старый отчёт", location="Обнинск", starts_at=timezone.now()
            )
            pending = Activity.objects.create(
                volunteer_id=user.pk, event_id=second_event.pk, requested_hours=3
            )
            third_event = Event.objects.create(
                title="Старое подтверждение",
                location="Обнинск",
                starts_at=timezone.now(),
            )
            approved = Activity.objects.create(
                volunteer_id=user.pk,
                event_id=third_event.pk,
                status="approved",
                confirmed_hours=3,
                reviewed_by_id=coordinator.pk,
                reviewed_at=timezone.now(),
            )
            ledger = Ledger.objects.create(
                volunteer_id=user.pk,
                amount=30,
                description="Историческое начисление",
                activity_id=approved.pk,
            )
            Profile.objects.create(user_id=user.pk, balance=30, confirmed_hours=3)
            fourth_event = Event.objects.create(
                title="Старый отказ", location="Обнинск", starts_at=timezone.now()
            )
            rejected = Activity.objects.create(
                volunteer_id=user.pk,
                event_id=fourth_event.pk,
                status="rejected",
                reviewed_by_id=coordinator.pk,
                reviewed_at=timezone.now(),
                review_note="Отказ",
            )
            executor = MigrationExecutor(connection)
            executor.migrate(after)
            apps = executor.loader.project_state(
                executor.loader.graph.leaf_nodes("accounts") + after
            ).apps
            NewActivity = apps.get_model("catalog", "Activity")
            new_approved = NewActivity.objects.get(pk=approved.pk)
            self.assertEqual(
                (
                    new_approved.coins_awarded,
                    new_approved.multiplier,
                    new_approved.rate_snapshot,
                ),
                (30, Decimal("1.00"), 10),
            )
            self.assertIsNotNone(new_approved.report_submitted_at)
            self.assertEqual(
                NewActivity.objects.get(pk=registered.pk).status, "registered"
            )
            self.assertEqual(NewActivity.objects.get(pk=pending.pk).status, "pending")
            self.assertIsNotNone(
                NewActivity.objects.get(pk=pending.pk).report_submitted_at
            )
            self.assertEqual(NewActivity.objects.get(pk=rejected.pk).status, "rejected")
            self.assertEqual(
                apps.get_model("accounts", "VolunteerProfile")
                .objects.get(user_id=user.pk)
                .balance,
                30,
            )
            self.assertEqual(
                list(
                    apps.get_model("catalog", "CoinTransaction").objects.values_list(
                        "pk", "amount", "description"
                    )
                ),
                [(ledger.pk, 30, "Историческое начисление")],
            )
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(executor.loader.graph.leaf_nodes())
