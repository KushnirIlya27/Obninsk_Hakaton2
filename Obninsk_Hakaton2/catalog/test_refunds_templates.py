from uuid import uuid4
from django.contrib.auth.models import User, Permission
from django.core.exceptions import PermissionDenied
from django.db.models import Sum
from django.test import TestCase
from accounts.models import VolunteerProfile
from .models import Reward, Redemption, CoinTransaction, EventTemplate
from .services import cancel_reward, purchase_reward, issue_reward, Conflict


class RefundTemplateTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('buyer')
        self.other = User.objects.create_user('other')
        self.staff = User.objects.create_user('staff', is_staff=True)
        self.staff.user_permissions.add(*Permission.objects.filter(
            content_type__app_label='catalog', codename__in=['fulfill_redemption', 'add_event']))
        VolunteerProfile.objects.update_or_create(user=self.user, defaults={'balance': 30})
        self.reward = Reward.objects.create(title='Gift', price=20)

    def buy(self):
        return purchase_reward(volunteer=self.user, reward_id=self.reward.pk, request_key=uuid4())[0]

    def test_cancel_refunds_snapshot_once_and_keeps_original_debit(self):
        obj = self.buy()
        self.reward.price = 99
        self.reward.save()
        cancel_reward(user=self.user, redemption_id=obj.pk)
        cancel_reward(user=self.staff, redemption_id=obj.pk)
        self.assertEqual(VolunteerProfile.objects.get(user=self.user).balance, 30)
        self.assertEqual(list(CoinTransaction.objects.order_by('id').values_list('amount', flat=True)), [-20, 20])
        self.assertEqual(CoinTransaction.objects.get(refund=obj).amount, 20)
        with self.assertRaises(Conflict):
            issue_reward(coordinator=self.staff, redemption_id=obj.pk)
        obj.refresh_from_db()
        self.assertEqual(obj.cancelled_by_id, self.user.pk)

    def test_other_volunteer_cannot_cancel(self):
        obj = self.buy()
        with self.assertRaises(PermissionDenied):
            cancel_reward(user=self.other, redemption_id=obj.pk)
        self.assertEqual(VolunteerProfile.objects.get(user=self.user).balance, 10)

    def test_issued_reward_cannot_be_cancelled(self):
        obj = self.buy()
        issue_reward(coordinator=self.staff, redemption_id=obj.pk)
        with self.assertRaises(Conflict):
            cancel_reward(user=self.user, redemption_id=obj.pk)
        self.assertFalse(CoinTransaction.objects.filter(refund=obj).exists())

    def test_coordinator_cancel_api_and_purchase_retry(self):
        obj = self.buy()
        self.client.force_login(self.staff)
        self.assertEqual(self.client.post(f'/api/redemptions/{obj.pk}/cancel/', {}, content_type='application/json').status_code, 200)
        retry, created = purchase_reward(volunteer=self.user, reward_id=self.reward.pk, request_key=obj.request_key)
        self.assertFalse(created)
        self.assertEqual(retry.status, Redemption.Status.CANCELLED)
        self.assertEqual(VolunteerProfile.objects.get(user=self.user).balance, 30)

    def test_cancel_api_requires_owner_or_coordinator(self):
        obj = self.buy()
        path = f'/api/redemptions/{obj.pk}/cancel/'
        self.assertEqual(self.client.post(path, {}, content_type='application/json').status_code, 401)
        self.client.force_login(self.other)
        self.assertEqual(self.client.post(path, {}, content_type='application/json').status_code, 403)
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(path, {}, content_type='application/json').status_code, 200)

    def test_templates_persist_and_create_independent_event(self):
        self.client.force_login(self.staff)
        payload = {'title': 'Park cleanup', 'description': 'Bring gloves', 'location': 'Park', 'coins_per_hour': 15}
        response = self.client.post('/api/coordinator/templates/', payload, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        template_id = response.json()['id']
        self.assertEqual(self.client.get('/api/coordinator/templates/').json()['results'][0]['coins_per_hour'], 15)
        event = self.client.post('/api/coordinator/events/', {**payload, 'starts_at': '2026-10-20T10:00:00Z', 'ends_at': '2026-10-20T12:00:00Z', 'is_active': True}, content_type='application/json')
        self.assertEqual(event.status_code, 201)
        self.assertEqual(self.client.post(f'/api/coordinator/templates/{template_id}/archive/', {}, content_type='application/json').status_code, 200)
        self.assertEqual(self.client.get('/api/coordinator/templates/').json()['results'], [])
        from .models import Event
        self.assertTrue(Event.objects.filter(pk=event.json()['id']).exists())

    def test_templates_permissions_and_validation(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/coordinator/templates/').status_code, 403)
        self.client.force_login(self.staff)
        for rate in [0, -1, 100001, 'bad']:
            response = self.client.post('/api/coordinator/templates/', {'title': 'A', 'location': 'B', 'coins_per_hour': rate}, content_type='application/json')
            self.assertEqual(response.status_code, 400)
        self.assertEqual(EventTemplate.objects.count(), 0)
