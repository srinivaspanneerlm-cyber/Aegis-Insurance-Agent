"""
The memory-isolation key, and the collision it used to allow.

Two independent call sites derived this key themselves, both from a
normalized display name alone. Two customers named "Priya Kumar" collided on
the exact same key and read and wrote each other's conversation history,
profile answers and cached recommendation. These tests pin the fix: a stable
user_id takes priority and separates them; the name-based fallback stays for
callers that predate it.
"""
from app.utils.customer_identity import derive_customer_id


def test_two_customers_with_the_same_name_no_longer_collide():
    a = derive_customer_id("Priya Kumar", user_id="user-aaa-111")
    b = derive_customer_id("Priya Kumar", user_id="user-bbb-222")
    assert a != b


def test_user_id_takes_priority_over_the_name():
    with_id = derive_customer_id("Priya Kumar", user_id="user-aaa-111")
    assert with_id == "cust_user-aaa-111"


def test_a_caller_with_no_user_id_falls_back_to_the_name_exactly_as_before():
    # Backward compatible: callers that predate user_id (tests, the direct
    # /ai-chat integration endpoint) must keep working identically.
    assert derive_customer_id("Priya Kumar") == "cust_priya_kumar"
    assert derive_customer_id("Priya.Kumar") == "cust_priya_kumar"


def test_name_variations_still_collide_when_no_user_id_is_available():
    # The residual risk, stated rather than hidden: without an authenticated
    # id, normalization still means two differently-cased/spaced spellings of
    # the same name land on one key. Every caller in this codebase now sends
    # user_id, so this path is the pre-fix behaviour kept for compatibility,
    # not a live gap.
    assert derive_customer_id("priya kumar") == derive_customer_id("Priya Kumar")


def test_no_name_and_no_user_id_falls_back_to_a_session_scoped_id():
    result = derive_customer_id(None, user_id=None, session_id="abcdef1234567890")
    assert result == "anon_abcdef12"


def test_no_name_no_user_id_no_session_still_returns_something_usable():
    assert derive_customer_id(None) == "cust_default"


def test_blank_strings_are_treated_as_absent_not_as_a_literal_key():
    # " " as a name or id must not become part of the key, and must not
    # silently produce "cust_" with nothing after it.
    assert derive_customer_id("   ", user_id="user-aaa-111") == "cust_user-aaa-111"
    assert derive_customer_id("Priya Kumar", user_id="   ") == "cust_priya_kumar"
