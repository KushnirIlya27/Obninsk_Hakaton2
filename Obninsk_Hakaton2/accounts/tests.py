from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.urls import reverse
from accounts.models import Person, VolunteerProfile
from django.core.management import call_command


class RegistrationIntegrationTests(TestCase):
    def test_register_page_is_registration(self):
        self.assertContains(self.client.get(reverse('register')), 'name="password2"')

    def test_registration_creates_user_and_both_profiles(self):
        response = self.client.post(reverse('register'), {
            'username': 'new-volunteer', 'password1': 'Obninsk-Strong-2026!',
            'password2': 'Obninsk-Strong-2026!',
        })
        self.assertRedirects(response, reverse('profile'))
        user = get_user_model().objects.get(username='new-volunteer')
        self.assertFalse(user.is_staff)
        self.assertEqual(VolunteerProfile.objects.get(user=user).balance, 0)
        self.assertTrue(Person.objects.filter(user=user).exists())
        self.assertEqual(self.client.get('/api/me/').json()['id'], user.pk)
        self.assertContains(self.client.get(reverse('profile')), 'new-volunteer')
        self.assertEqual(self.client.get('/admin/').status_code, 302)

    def test_invalid_registration_does_not_create_user(self):
        response = self.client.post(reverse('register'), {
            'username':'bad', 'password1':'strong-Obninsk-2026!', 'password2':'mismatch',
        })
        self.assertEqual(response.status_code, 200)
        self.assertFalse(get_user_model().objects.filter(username='bad').exists())

    def test_login_and_logout(self):
        get_user_model().objects.create_user('existing', password='Obninsk-Strong-2026!')
        response = self.client.post(reverse('login'), {'username':'existing', 'password':'Obninsk-Strong-2026!'})
        self.assertRedirects(response, reverse('profile'))
        self.assertRedirects(self.client.post(reverse('logout')), reverse('login'))
        self.assertEqual(self.client.get('/api/me/').status_code, 401)

    def test_coordinator_redirects_to_admin(self):
        call_command('seed_demo', verbosity=0)
        response = self.client.post(reverse('login'), {'username':'coordinator', 'password':'Demo-Obninsk-2026!'})
        self.assertRedirects(response, reverse('admin:index'))
        self.assertContains(self.client.get('/admin/'), 'Панель координатора')

    def test_profile_requires_login(self):
        self.assertRedirects(self.client.get(reverse('profile')), reverse('login') + '?next=' + reverse('profile'))
        self.assertEqual(self.client.get(reverse('logout')).status_code, 405)

    def test_registration_csrf_and_password_is_not_reflected(self):
        client = Client(enforce_csrf_checks=True)
        payload = {'username':'csrf-user', 'password1':'Obninsk-Strong-2026!', 'password2':'mismatch'}
        self.assertEqual(client.post(reverse('register'), payload).status_code, 403)
        client.get(reverse('register'))
        response = client.post(reverse('register'), payload, HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, payload['password1'])
