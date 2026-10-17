from datetime import timedelta
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import Client, TestCase
from django.utils import timezone
from accounts.models import Person, VolunteerProfile
from shop.models import Profile as LegacyProfile
from .models import Activity, CoinTransaction, Event, Reward


class ReactIntegrationApiTests(TestCase):
    def setUp(self):
        self.volunteer = get_user_model().objects.create_user(
            "react-user", password="Strong-Obninsk-2026!"
        )
        self.coordinator = get_user_model().objects.create_user(
            "react-coordinator", is_staff=True
        )
        self.coordinator.user_permissions.add(
            *Permission.objects.filter(
                content_type__app_label="catalog",
                codename__in=[
                    "review_activity",
                    "fulfill_redemption",
                    "view_event",
                    "add_event",
                ],
            )
        )
        self.event = Event.objects.create(
            title="Участие React",
            location="Обнинск",
            coins_per_hour=10,
            starts_at=timezone.now() - timedelta(hours=5),
            ends_at=timezone.now() - timedelta(hours=2),
        )
        self.reward = Reward.objects.create(title="Значок React", price=20)

    def test_api_full_flow_and_purchase_retry(self):
        self.client.force_login(self.volunteer)
        data = self.client.get("/api/events/").json()["results"][0]
        self.assertEqual((data["rate"], data["coins_per_hour"]), (10, 10))
        activity = self.client.post(
            f"/api/events/{self.event.pk}/apply/", {}, content_type="application/json"
        ).json()
        self.assertTrue(activity["can_submit_report"])
        self.assertEqual(activity["status"], "registered")
        self.assertEqual(
            self.client.post(
                f'/api/activities/{activity["id"]}/report/',
                {"hours": "3", "report_text": "Помощь на акции"},
                content_type="application/json",
            ).status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/me/").json()["balance"], 0)
        self.client.force_login(self.coordinator)
        review = f'/api/coordinator/activities/{activity["id"]}/review/'
        response = self.client.post(
            review,
            {"decision": "approved", "hours": "3", "coefficient": "1.00"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["coefficient"], "1.00")
        self.assertEqual(
            self.client.post(
                review,
                {"decision": "approved", "hours": "3"},
                content_type="application/json",
            ).status_code,
            409,
        )
        self.client.force_login(self.volunteer)
        key = str(uuid4())
        url = f"/api/rewards/{self.reward.pk}/purchase/"
        first = self.client.post(
            url, {"request_key": key}, content_type="application/json"
        )
        second = self.client.post(
            url, {"request_key": key}, content_type="application/json"
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["id"], second.json()["id"])
        self.assertEqual(self.client.get("/api/me/").json()["balance"], 10)
        self.assertEqual(CoinTransaction.objects.count(), 2)
        self.client.force_login(self.coordinator)
        response = self.client.post(
            f'/api/coordinator/redemptions/{first.json()["id"]}/issue/',
            {},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "issued")

    def test_registration_saves_contacts_and_never_grants_staff(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "contacts",
                "password": "Strong-Obninsk-2026!",
                "phone": "+7 900 000-00-01",
                "email": "person@example.test",
                "info": "Помогаю городу",
                "is_staff": True,
                "role": "coordinator",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(username="contacts")
        self.assertFalse(user.is_staff)
        self.assertEqual(Person.objects.get(user=user).info, "Помогаю городу")
        self.assertEqual(self.client.get("/api/me/").json()["phone"], "+79000000001")
        self.assertFalse(LegacyProfile.objects.filter(user=user).exists())
        self.assertEqual(VolunteerProfile.objects.get(user=user).balance, 0)

    def test_event_creation_permissions_and_validation(self):
        data = {
            "title": "Новое событие",
            "location": "Парк",
            "starts_at": self.event.starts_at.isoformat(),
            "ends_at": self.event.ends_at.isoformat(),
            "coins_per_hour": 20,
        }
        self.client.force_login(self.volunteer)
        self.assertEqual(
            self.client.post(
                "/api/coordinator/events/", data, content_type="application/json"
            ).status_code,
            403,
        )
        self.client.force_login(self.coordinator)
        response = self.client.post(
            "/api/coordinator/events/", data, content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["coins_per_hour"], 20)
        data["ends_at"] = (self.event.starts_at - timedelta(hours=1)).isoformat()
        self.assertEqual(
            self.client.post(
                "/api/coordinator/events/", data, content_type="application/json"
            ).status_code,
            400,
        )

    def test_proxy_origin_cookie_and_rotated_csrf(self):
        client = Client(enforce_csrf_checks=True)
        headers = {
            "HTTP_HOST": "127.0.0.1:5173",
            "HTTP_ORIGIN": "http://127.0.0.1:5173",
        }
        response = client.post(
            "/api/auth/login/",
            {"username": "react-user", "password": "Strong-Obninsk-2026!"},
            content_type="application/json",
            **headers,
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "csrf_failed")
        token = client.get("/api/auth/csrf/", **headers).json()["csrfToken"]
        response = client.post(
            "/api/auth/login/",
            {"username": "react-user", "password": "Strong-Obninsk-2026!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
            **headers,
        )
        self.assertEqual(response.status_code, 200)
        new_token = response.json()["csrfToken"]
        self.assertNotEqual(new_token, token)
        self.assertEqual(
            client.post(
                f"/api/events/{self.event.pk}/apply/",
                {},
                content_type="application/json",
                HTTP_X_CSRFTOKEN=new_token,
                **headers,
            ).status_code,
            201,
        )

    def test_legacy_balance_cannot_be_spent_via_old_route(self):
        LegacyProfile.objects.create(user=self.volunteer, coins=100)
        self.client.force_login(self.volunteer)
        self.assertEqual(self.client.post("/shop/item/1/buy/").status_code, 302)
        self.assertEqual(LegacyProfile.objects.get(user=self.volunteer).coins, 100)
        self.assertEqual(VolunteerProfile.objects.get(user=self.volunteer).balance, 0)

    def test_public_statistics_come_from_database(self):
        response = self.client.get("/api/stats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["events"], 1)
        self.assertEqual(response.json()["volunteers"], 1)
