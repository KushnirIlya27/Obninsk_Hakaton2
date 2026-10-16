from django.urls import path
from .views import CustomLoginView
from . import views

urlpatterns = [
    path('register/', CustomLoginView.as_view(), name='register'),
    path('login/', CustomLoginView.as_view(), name='login'),
    path('logout/', views.logout_view, name='logout'),
]