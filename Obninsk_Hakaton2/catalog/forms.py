from django import forms

from .models import Activity


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
        help_text="1 час = 10 койнов. Например, 3 часа = 30 койнов.",
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
        return data
