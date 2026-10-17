"""Compatibility routes lead to the React store using the shared account balance."""

from django.conf import settings
from django.shortcuts import redirect


def index(request):
    return redirect(settings.FRONTEND_URL + "/dashboard/rewards")


def item_detail(request, item_id):
    return index(request)


def buy(request, item_id):
    # The old endpoint must never spend the independent legacy Profile.coins.
    # Purchasing in React goes through catalog.services.purchase_reward.
    return index(request)
