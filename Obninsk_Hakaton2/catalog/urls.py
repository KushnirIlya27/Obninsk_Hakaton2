from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf/", views.csrf),
    path("auth/login/", views.session_login),
    path("auth/logout/", views.session_logout),
    path("events/", views.events),
    path("events/<int:event_id>/apply/", views.apply),
    path("rewards/", views.rewards),
    path("rewards/<int:reward_id>/purchase/", views.purchase),
    path("me/", views.me),
    path("me/activities/", views.my_activities),
    path("me/transactions/", views.my_transactions),
    path("me/redemptions/", views.my_redemptions),
    path("activities/<int:activity_id>/hours/", views.hours),
    path("coordinator/activities/", views.coordinator_activities),
    path("coordinator/activities/<int:activity_id>/review/", views.review),
    path("coordinator/redemptions/", views.coordinator_redemptions),
    path("coordinator/redemptions/<int:redemption_id>/issue/", views.issue),
]
