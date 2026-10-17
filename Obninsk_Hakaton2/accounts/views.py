from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_http_methods, require_POST

from .forms import CustomUserCreationForm
from .models import Person   # ← было VolunteerProfile (или вообще не было импорта)


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

    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('profile')
    else:
        form = CustomUserCreationForm()
    return render(request, 'registration/register.html', {'form': form})


@login_required(login_url='login')
def profile(request):
    card, _ = Person.objects.get_or_create(user=request.user)   # ← было VolunteerProfile
    return render(request, 'registration/profile.html', {'card': card})


@require_POST
def logout_view(request):
    logout(request)
    return redirect('login')
