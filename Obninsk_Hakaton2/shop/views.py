from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render

from .models import Item, Purchase
from accounts.models import Person   # ← Person живёт в accounts


def index(request):
    items = Item.objects.all()
    person = (
        getattr(request.user, "account", None)   # ← было "person"
        if request.user.is_authenticated
        else None
    )
    return render(request, "shop/index.html", {"items": items, "person": person})


def item_detail(request, item_id):
    item = get_object_or_404(Item, pk=item_id)
    return render(request, "shop/item.html", {"item": item})


@login_required
def buy(request, item_id):
    if request.method != "POST":
        return redirect("shop:item_detail", item_id=item_id)

    item = get_object_or_404(Item, pk=item_id)
    person, _ = Person.objects.get_or_create(user=request.user)

    if person.tokens < item.price:
        messages.error(
            request,
            f"Недостаточно токенов: нужно {item.price}, у вас {person.tokens}",
        )
        return redirect("shop:item_detail", item_id=item.id)

    with transaction.atomic():
        person.tokens -= item.price
        person.save(update_fields=["tokens"])
        Purchase.objects.create(user=request.user, item=item)

    messages.success(request, f"Вы купили «{item.name}» за {item.price} токенов")
    return redirect("shop:item_detail", item_id=item.id)