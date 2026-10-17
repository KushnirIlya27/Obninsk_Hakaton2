from django.urls import path
from . import views

app_name = "shop"

urlpatterns = [
    path("", views.index, name="index"),
    path("item/<int:item_id>/", views.item_detail, name="item_detail"),
    path("item/<int:item_id>/buy/", views.buy, name="buy"),
]
