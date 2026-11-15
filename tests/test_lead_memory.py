# -*- coding: utf-8 -*-
"""
Tests for AgentMemory Lead Deduplication & Cross-Session Memory Engine
"""

import pytest
from agent_reach.lead_memory import (
    LeadMemoryEngine,
    normalize_handle,
    normalize_phone,
    normalize_name,
)


def test_normalize_handle():
    assert normalize_handle("@DogGroomer_Sydney") == "doggroomer_sydney"
    assert normalize_handle("  @Barkly  ") == "barkly"
    assert normalize_handle("https://www.instagram.com/paws_and_claws/") == "paws_and_claws"
    assert normalize_handle("http://instagram.com/groomer?hl=en#posts") == "groomer"
    assert normalize_handle("") == ""
    assert normalize_handle(None) == ""


def test_normalize_phone():
    # Australian mobile prefix normalization
    assert normalize_phone("0421 691 881") == "61421691881"
    assert normalize_phone("+61 421 691 881") == "61421691881"
    assert normalize_phone("0421-691-881") == "61421691881"
    assert normalize_phone("(0421) 691 881") == "61421691881"

    # UK mobile prefix normalization
    assert normalize_phone("07123 456789") == "447123456789"
    assert normalize_phone("+44 7123 456789") == "447123456789"


def test_known_sydney_lead_rejected():
    engine = LeadMemoryEngine()
    # Test Sydney dog grooming lead
    is_known, reason, data = engine.is_lead_known("4wetpaws_")
    assert is_known is True
    assert "already memorized in agentmemory" in reason
    assert data is not None
    assert data["username"] == "4wetpaws_"

    # Case insensitive and @ prefix
    is_known, reason, _ = engine.is_lead_known("@4WETPAWS_")
    assert is_known is True

    # URL format
    is_known, reason, _ = engine.is_lead_known("https://instagram.com/4wetpaws_/")
    assert is_known is True


def test_known_uk_lead_rejected():
    engine = LeadMemoryEngine()
    # Test UK tree surgeon lead
    is_known, reason, data = engine.is_lead_known("@altitudetreeservices")
    assert is_known is True
    assert "UK Tree Surgeons" in reason
    assert data is not None
    assert data["username"] == "altitudetreeservices"


def test_phone_collision_rejection():
    engine = LeadMemoryEngine()
    # 4wetpaws_ has phone 0421 691 881 -> normalized 61421691881
    # Check a completely different dummy handle but using the same phone number
    is_known, reason, data = engine.is_lead_known("brand_new_pet_salon_xyz_999", phone="+61 421 691 881")
    assert is_known is True
    assert "Phone number matches memorized lead '@4wetpaws_'" in reason
    assert data is not None
    assert data["username"] == "4wetpaws_"


def test_fresh_lead_allowed():
    engine = LeadMemoryEngine()
    is_known, reason, data = engine.is_lead_known("brand_new_unique_canine_spa_998877")
    assert is_known is False
    assert "Fresh lead" in reason
    assert data is None


def test_filter_unseen_handles():
    engine = LeadMemoryEngine()
    candidates = [
        "4wetpaws_",                               # Known Sydney
        "@altitudetreeservices",                   # Known UK
        "completely_fresh_lead_12345",             # Fresh
        "https://instagram.com/barklys_co/",       # Known Sydney
        "another_unseen_lead_67890",               # Fresh
    ]
    unseen = engine.filter_unseen_handles(candidates)
    assert unseen == ["completely_fresh_lead_12345", "another_unseen_lead_67890"]


def test_record_lead_lifecycle(tmp_path):
    # Test on isolated store
    test_json = tmp_path / "test_memory.json"
    test_reg = tmp_path / "test_registry.json"
    engine = LeadMemoryEngine(persist_path=str(test_json), repo_registry_path=test_reg)

    lead_sample = {
        "username": "super_pooch_sydney",
        "business_name": "Super Pooch Sydney",
        "niche": "Sydney Dog Groomers",
        "country": "Australia",
        "location": "Surry Hills",
        "phone": "0499 111 222",
        "website_status": "NO_WEBSITE",
    }

    # Initial check: unseen
    assert engine.is_lead_known("super_pooch_sydney")[0] is False

    # Record lead
    assert engine.record_lead(lead_sample, campaign="Test Campaign") is True

    # Duplicate record: must return False
    assert engine.record_lead(lead_sample, campaign="Test Campaign") is False

    # Check now: must be rejected
    is_known, reason, data = engine.is_lead_known("@SUPER_POOCH_SYDNEY")
    assert is_known is True
    assert data["username"] == "super_pooch_sydney"

    # Check phone collision on new handle
    is_known_p, _, _ = engine.is_lead_known("another_handle", phone="+61 499 111 222")
    assert is_known_p is True


def test_total_stats():
    engine = LeadMemoryEngine()
    stats = engine.get_stats()
    assert stats["total_memorized_leads"] >= 150
    assert stats["breakdown_by_niche"]["Sydney Dog Groomers"] == 50
    assert stats["breakdown_by_niche"]["UK Tree Surgeons"] == 100
    assert stats["breakdown_by_country"]["Australia"] == 50
    assert stats["breakdown_by_country"]["United Kingdom"] == 100

