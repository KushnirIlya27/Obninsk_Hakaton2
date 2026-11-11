from django.urls import path
from . import views

urlpatterns = [
    path("events/<int:event_id>/", views.event_detail, name="event_detail"),
    path("events/<int:event_id>/apply/", views.event_apply, name="event_apply"),
    path(
        "activities/<int:activity_id>/report/",
        views.activity_report,
        name="activity_report",
    ),
    path("register/", views.register, name="register"),
    path("login/", views.CustomLoginView.as_view(), name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("profile/", views.profile, name="profile"),
]
