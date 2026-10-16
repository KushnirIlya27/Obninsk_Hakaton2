from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from .models import Person

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(
        required=True,
        label="Почта",
        widget=forms.EmailInput(attrs={"class": "form-control"}),
    )
    phone = forms.CharField(
        required=True,
        label="Телефон",
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )

    info = forms.CharField(
        required=True,
        label="Информация о себе",
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )



    class Meta:
        model = User
        fields = ("info","email", "phone", "password1", "password2")

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("Пользователь с таким email уже существует")
        return email

    def clean_phone(self):
        phone = self.cleaned_data["phone"].lower()
        if Person.objects.filter(phone=phone).exists():
            raise forms.ValidationError("Пользователь с таким телефоном уже существует")
        return phone

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]

        if commit:
            user.save()
            person, created = Person.objects.get_or_create(user=user)
            person.phone = self.cleaned_data["phone"]
            person.email = self.cleaned_data["email"]
            person.info = self.cleaned_data["info"]
            person.save()
        return user

