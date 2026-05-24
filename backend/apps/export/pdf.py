import logging
from django.http import HttpResponse
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def generate_pdf(review) -> HttpResponse:
    # Implemented in Step 12
    raise NotImplementedError
