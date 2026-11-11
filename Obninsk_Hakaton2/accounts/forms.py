import re
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import VolunteerProfile


class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True, label="Почта")
    phone = forms.CharField(required=True, max_length=32, label="Телефон")
    group = forms.CharField(
        required=True, max_length=2000, label="Группа", widget=forms.Textarea
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "email", "phone", "group", "password1", "password2")

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError("Пользователь с таким логином уже существует.")
        return username

    def clean_email(self):
        email = self.cleaned_data.get("email", "").strip().lower()
        if email and User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Пользователь с такой почтой уже существует.")
        return email

    def clean_phone(self):
        phone = self.cleaned_data.get("phone", "")
        if not phone:
            return ""
        digits = re.sub(r"\D", "", phone)
        if len(digits) == 10:
            digits = "7" + digits
        if len(digits) != 11 or digits[0] not in "78":
            raise forms.ValidationError("Укажите телефон в формате +7 900 000-00-00.")
        return "+7" + digits[1:]

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data.get("email", "")
        if commit:
            user.save()
            profile, _ = VolunteerProfile.objects.get_or_create(user=user)
            profile.phone = self.cleaned_data["phone"]
            profile.email = self.cleaned_data["email"]
            profile.group = self.cleaned_data["group"]
            profile.save()
        return user
