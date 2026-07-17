"""
Profile files must stay inside the profile directory.

A customer id is built from a name that arrives over the wire, so a separator
in it decides where the file lands. ConversationStore and RecommendationCache
already neutralise separators; EnhancedProfileManager did not, and was held
closed only by the id builder happening to replace dots — slug-making that
nothing marks as load-bearing.

These use a tmp_path directory, so nothing here touches the repository's real
customer profiles.
"""
import pytest

from app.memory.profile_manager import EnhancedProfileManager


@pytest.fixture
def manager(tmp_path):
    return EnhancedProfileManager(profiles_dir=tmp_path)


def _is_inside(path, root) -> bool:
    return root.resolve() in path.resolve().parents


# The ids a hostile `user_name` could produce, if the dot-replacement in the
# id builder were ever relaxed or bypassed.
HOSTILE_IDS = [
    "cust_../../../../etc/passwd",
    "cust_..\\..\\windows\\system32",
    "cust_sri/../../../../tmp/pwn",
    "cust_/etc/cron.d/evil",
]


@pytest.mark.parametrize("customer_id", HOSTILE_IDS)
def test_a_shared_profile_cannot_escape_the_directory(manager, tmp_path, customer_id):
    assert _is_inside(manager._shared_path(customer_id), tmp_path)


@pytest.mark.parametrize("customer_id", HOSTILE_IDS)
def test_a_domain_profile_cannot_escape_the_directory(manager, tmp_path, customer_id):
    assert _is_inside(manager._domain_path(customer_id), tmp_path)


@pytest.mark.parametrize("customer_id", HOSTILE_IDS)
def test_saving_writes_inside_the_directory_and_nowhere_else(manager, tmp_path, customer_id):
    manager.save_shared_profile(customer_id, {"name": "probe"})
    written = list(tmp_path.rglob("*.json"))
    assert written, "the save must land somewhere"
    for path in written:
        assert _is_inside(path, tmp_path)


def test_an_ordinary_customer_id_is_untouched(manager, tmp_path):
    # Sanitising must not rename the profiles real customers already have.
    assert manager._shared_path("cust_sri").name == "shared_cust_sri.json"
    assert manager._domain_path("health_cust_sri").name == "health_cust_sri.json"


def test_separators_are_the_thing_being_neutralised(manager):
    # Named explicitly so the reason survives: dots are not what keeps this safe.
    assert "/" not in manager._shared_path("cust_a/b").name
    assert "\\" not in manager._shared_path("cust_a\\b").name
