from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class LegacyStoreMigrationTests(TransactionTestCase):
    def test_legacy_records_are_preserved_and_items_are_available_as_rewards(self):
        before = [("shop", "0002_alter_item_options_alter_item_price_profile_purchase")]
        after = [("shop", "0003_archive_legacy_balance")]
        executor = MigrationExecutor(connection)
        executor.migrate(before)
        try:
            state = executor.loader.project_state(
                executor.loader.graph.leaf_nodes("accounts")
                + [("catalog", "0003_multiplier_step")]
                + before
            ).apps
            User = state.get_model("auth", "User")
            Item = state.get_model("shop", "Item")
            LegacyProfile = state.get_model("shop", "Profile")
            Account = state.get_model("accounts", "VolunteerProfile")
            user = User.objects.create(username="legacy-store-user")
            item = Item.objects.create(
                name="Сувенир из старого магазина",
                price=20,
                description="Архивная позиция",
            )
            profile = LegacyProfile.objects.create(user_id=user.pk, coins=80)
            Account.objects.create(user_id=user.pk, balance=30)
            executor = MigrationExecutor(connection)
            executor.migrate(after)
            apps = executor.loader.project_state(
                executor.loader.graph.leaf_nodes()
            ).apps
            reward = apps.get_model("catalog", "Reward").objects.get(
                title=item.name, price=20
            )
            self.assertEqual(reward.description, "Архивная позиция")
            self.assertTrue(
                apps.get_model("shop", "Item").objects.filter(pk=item.pk).exists()
            )
            self.assertEqual(
                apps.get_model("shop", "Profile").objects.get(pk=profile.pk).coins, 80
            )
            self.assertEqual(
                apps.get_model("accounts", "VolunteerProfile")
                .objects.get(user_id=user.pk)
                .balance,
                30,
            )
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(executor.loader.graph.leaf_nodes())
