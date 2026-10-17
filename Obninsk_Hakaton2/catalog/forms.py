from decimal import Decimal
from django import forms

from .models import Activity, Event


class ReviewForm(forms.Form):
    decision = forms.ChoiceField(
        label="Решение",
        choices=[
            (Activity.Status.APPROVED, "Подтвердить часы"),
            (Activity.Status.REJECTED, "Отклонить заявку"),
        ],
    )
    hours = forms.DecimalField(
        label="Подтверждённые часы",
        max_digits=3,
        decimal_places=1,
        min_value=0.1,
        max_value=24,
        required=False,
        help_text="Укажите фактически подтверждённое время. Ставка берётся из условий записи.",
    )
    multiplier = forms.DecimalField(
        label="Коэффициент",
        max_digits=4,
        decimal_places=2,
        min_value=Decimal("1.00"),
        step_size=Decimal("0.05"),
        widget=forms.NumberInput(attrs={"step": "0.05"}),
        max_value=Decimal("10.00"),
        initial=Decimal("1.00"),
        required=False,
        help_text="От 1.00× до 10.00× с шагом 0.05. Например, 1.50× при дожде. При изменении укажите причину.",
    )
    note = forms.CharField(
        label="Комментарий", widget=forms.Textarea(attrs={"rows": 3}), required=False
    )

    def clean(self):
        data = super().clean()
        if (
            data.get("decision") == Activity.Status.APPROVED
            and data.get("hours") is None
        ):
            self.add_error("hours", "Для подтверждения укажите часы.")
        if (
            data.get("decision") == Activity.Status.REJECTED
            and not data.get("note", "").strip()
        ):
            self.add_error("note", "Укажите причину отклонения.")
        if data.get("multiplier") is None:
            data["multiplier"] = Decimal("1.00")
        if (
            data.get("decision") == Activity.Status.APPROVED
            and data["multiplier"] != 1
            and not data.get("note", "").strip()
        ):
            self.add_error("note", "Объясните, почему изменён коэффициент.")
        return data


class ActivityReportForm(forms.Form):
    hours = forms.DecimalField(
        label="Сколько часов вы работали",
        max_digits=3,
        decimal_places=1,
        min_value=Decimal("0.1"),
        max_value=Decimal("24"),
        widget=forms.NumberInput(attrs={"step": "0.1", "placeholder": "Например, 3"}),
    )
    report_text = forms.CharField(
        label="Что вы делали",
        max_length=3000,
        widget=forms.Textarea(
            attrs={
                "rows": 4,
                "placeholder": "Кратко опишите свою работу на мероприятии",
            }
        ),
    )


class EventForm(forms.ModelForm):
    class Meta:
        model = Event
        fields = [
            "title",
            "description",
            "location",
            "starts_at",
            "ends_at",
            "coins_per_hour",
            "is_active",
        ]
