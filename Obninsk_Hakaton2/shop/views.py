from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.shortcuts import render, get_object_or_404, redirect
from .models import Item, Profile, Purchase


def index(request):
    items = Item.objects.all()
    profile = getattr(request.user, "profile", None) if request.user.is_authenticated else None
    return render(request, "shop/index.html", {"items": items, "profile": profile})


def item_detail(request, item_id):
    item = get_object_or_404(Item, pk=item_id)
    return render(request, "shop/item.html", {"item": item})


@login_required
def buy(request, item_id):
    if request.method != "POST":
        return redirect("shop:item_detail", item_id=item_id)

    item = get_object_or_404(Item, pk=item_id)
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if profile.coins < item.price:
        messages.error(request, f"Недостаточно коинов: нужно {item.price}, у вас {profile.coins}")
        return redirect("shop:item_detail", item_id=item.id)

    # Атомарно: списываем и пишем покупку
    with transaction.atomic():
        profile.coins -= item.price
        profile.save(update_fields=["coins"])
        Purchase.objects.create(user=request.user, item=item)

    messages.success(request, f"Вы купили «{item.name}» за {item.price} коинов")
    return redirect("shop:item_detail", item_id=item.id)
