import os
import django

def setup():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Obninsk_Hakaton2.settings")
    django.setup()
