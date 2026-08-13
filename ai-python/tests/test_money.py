"""
Tests for the shared rupee reader.

The case that motivated it is `"10k sure"` — a real budget, stored verbatim
because the customer answered the budget question in a sentence. Reading it
had to stop raising, and had to stop reading it as ten rupees.
"""

import pytest

from app.utils.money import parse_amount


@pytest.mark.parametrize("raw,expected", [
    ("2000",          2000),
    ("₹2,000",        2000),
    ("2000/month",    2000),
    ("around 1500",   1500),
    (1500,            1500),
    (1500.0,          1500),
])
def test_plain_figures(raw, expected):
    assert parse_amount(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("10k",         10_000),
    ("10k sure",    10_000),
    ("10 k",        10_000),
    ("10 thousand", 10_000),
    ("2 lakh",     200_000),
    ("2lakhs",     200_000),
    ("1.5 lakh",   150_000),
    ("2 lac",      200_000),
    ("1 crore",  10_000_000),
    ("1cr",      10_000_000),
])
def test_indian_magnitudes(raw, expected):
    assert parse_amount(raw) == expected


@pytest.mark.parametrize("raw", [None, "", "abc", "no idea", "not sure yet"])
def test_no_number_is_none_not_an_exception(raw):
    assert parse_amount(raw) is None


@pytest.mark.parametrize("raw,expected", [
    ("2000 kelvi",   2000),   # a word starting with k is not a magnitude
    ("5000 rupees",  5000),
    ("24000 annual", 24000),  # the 'l' of "annual" is not a lakh
])
def test_a_following_word_is_not_read_as_a_magnitude(raw, expected):
    assert parse_amount(raw) == expected
