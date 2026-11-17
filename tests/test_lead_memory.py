# -*- coding: utf-8 -*-
"""
Tests for AgentMemory Lead Deduplication & Cross-Session Memory Engine
"""

import json
from pathlib import Path
import pytest
from agent_reach.lead_memory import (
    LeadMemoryEngine,
    normalize_handle,
    normalize_phone,
    normalize_name,
)


def test_normalize_handle():
    assert normalize_handle("@UK_Tree_Surgeon") == "uk_tree_surgeon"
    assert normalize_handle("  @ArborCare  ") == "arborcare"
    assert normalize_handle("https://www.instagram.com/canopy_trees/") == "canopy_trees"
    assert normalize_handle("http://instagram.com/arborist?hl=en#posts") == "arborist"
    assert normalize_handle("") == ""
    assert normalize_handle(None) == ""


def test_normalize_phone():
    # UK mobile prefix normalization
    assert normalize_phone("07123 456789") == "447123456789"
    assert normalize_phone("+44 7123 456789") == "447123456789"
    assert normalize_phone("07598759151") == "447598759151"


def test_known_uk_batches_rejected():
    engine = LeadMemoryEngine()

    # Batch 1 UK Tree Surgeon
    is_known, reason, data = engine.is_lead_known("@altitudetreeservices")
    assert is_known is True
    assert "already memorized in agentmemory" in reason
    assert data is not None
    assert data["username"] == "altitudetreeservices"

    # Case-insensitive & URL variants
    assert engine.is_lead_known("ALTITUDETREESERVICES")[0] is True
    assert engine.is_lead_known("https://www.instagram.com/altitudetreeservices/")[0] is True

    # Batch 2 UK Tree Surgeon
    is_known2, _, data2 = engine.is_lead_known("@allertontreeservices")
    assert is_known2 is True
    assert data2 is not None and data2["username"] == "allertontreeservices"

    # Batch 3 UK Tree Surgeon
    is_known3, _, data3 = engine.is_lead_known("@cobra23trees")
    assert is_known3 is True
    assert data3 is not None and data3["username"] == "cobra23trees"


def test_fresh_lead_allowed():
    engine = LeadMemoryEngine()
    is_known, reason, data = engine.is_lead_known("brand_new_unique_uk_arborist_998877")
    assert is_known is False
    assert "Fresh lead" in reason
    assert data is None


def test_filter_unseen_handles():
    engine = LeadMemoryEngine()
    candidates = [
        "@altitudetreeservices",                    # Known UK Batch 1
        "allertontreeservices",                     # Known UK Batch 2
        "cobra23trees",                             # Known UK Batch 3
        "completely_fresh_uk_arborist_12345",       # Fresh
        "another_unseen_tree_surgeon_67890",        # Fresh
    ]
    unseen = engine.filter_unseen_handles(candidates)
    assert unseen == [
        "completely_fresh_uk_arborist_12345",
        "another_unseen_tree_surgeon_67890",
    ]


def test_record_lead_lifecycle(tmp_path):
    test_json = tmp_path / "test_memory.json"
    test_reg = tmp_path / "test_registry.json"
    engine = LeadMemoryEngine(persist_path=str(test_json), repo_registry_path=test_reg)

    lead_sample = {
        "username": "oakwood_arborists_surrey",
        "business_name": "Oakwood Arborists Surrey",
        "niche": "UK Tree Surgeons",
        "country": "United Kingdom",
        "location": "Surrey",
        "phone": "07999 111222",
        "website_status": "NO_WEBSITE",
    }

    assert engine.is_lead_known("oakwood_arborists_surrey")[0] is False
    assert engine.record_lead(lead_sample, campaign="Test Campaign") is True
    assert engine.record_lead(lead_sample, campaign="Test Campaign") is False

    is_known, _, data = engine.is_lead_known("@OAKWOOD_ARBORISTS_SURREY")
    assert is_known is True
    assert data["username"] == "oakwood_arborists_surrey"

    # Phone collision check on alternate handle
    is_known_p, _, _ = engine.is_lead_known("another_handle", phone="+44 7999 111222")
    assert is_known_p is True


def test_master_350_uk_dataset_and_no_pet_leads():
    master_path = Path("leads/uk_tree_surgeons_350_leads.json")
    assert master_path.exists()
    leads = json.load(open(master_path, encoding="utf-8"))
    assert len(leads) == 350

    handles = [normalize_handle(l["username"]) for l in leads]
    assert len(set(handles)) == 350, "Master UK 350 dataset must have 0 duplicate handles"

    # Confirm no doggy daycare / pet boarding / dog grooming files or leads exist
    assert not Path("leads/sydney_dog_groomers_50_leads.json").exists()
    assert not Path("web/src/data/sydney_dog_groomers_50_leads.json").exists()

    for l in leads:
        txt = f"{l.get('username','')} {l.get('full_name','')} {l.get('bio','')}".lower()
        assert "doggy daycare" not in txt
        assert "pet boarding" not in txt
        assert "dog grooming" not in txt


def test_total_stats():
    engine = LeadMemoryEngine()
    stats = engine.get_stats()
    assert stats["total_memorized_leads"] >= 350
    assert stats["breakdown_by_country"].get("Australia", 0) == 0
    assert stats["breakdown_by_country"]["United Kingdom"] >= 350
