from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.views import LoginView
from django.db import transaction
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_http_methods, require_POST

from .models import VolunteerProfile


class CustomLoginView(LoginView):
    template_name = 'registration/login.html'
    redirect_authenticated_user = True

    def get_success_url(self):
        user = self.request.user
        if user.is_staff and user.has_perm('catalog.review_activity'):
            return reverse('admin:index')
        return reverse('profile')


@require_http_methods(['GET', 'POST'])
def register(request):
    if request.user.is_authenticated:
        return redirect('profile')
    form = UserCreationForm(request.POST if request.method == 'POST' else None)
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            user = form.save()
            VolunteerProfile.objects.get_or_create(user=user)
        login(request, user)
        return redirect('profile')
    return render(request, 'registration/register.html', {'form': form})


@login_required(login_url='login')
def profile(request):
    card, _ = VolunteerProfile.objects.get_or_create(user=request.user)
    return render(request, 'registration/profile.html', {'card': card})


@require_POST
def logout_view(request):
    logout(request)
    return redirect('login')
