import os
import sys
from pathlib import Path


def setup():
    BASE_DIR = Path(__file__).resolve().parent.parent

    if str(BASE_DIR) not in sys.path:
        sys.path.insert(0, str(BASE_DIR))

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Obninsk_Hakaton2.settings")

    import django
    django.setup()