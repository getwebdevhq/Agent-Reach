/**
 * UK Tree Surgeons Lead Intelligence Dashboard - Core Application Logic
 * ======================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    leads: [],
    filteredLeads: [],
    currentView: 'cards', // 'cards' | 'table'
    activeModalLead: null,
    activePitchTemplate: 'local_seo',
    pipelineMap: JSON.parse(localStorage.getItem('uk_arb_pipeline_status') || '{}')
  };

  // DOM Elements
  const cardsContainer = document.getElementById('cards-container');
  const tableContainer = document.getElementById('table-container');
  const tableBody = document.getElementById('table-body');
  const emptyState = document.getElementById('empty-state');
  const visibleCountEl = document.getElementById('visible-count');
  const totalCountEl = document.getElementById('total-count');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterContact = document.getElementById('filter-contact');
  const filterRegion = document.getElementById('filter-region');
  const filterService = document.getElementById('filter-service');
  const filterPipeline = document.getElementById('filter-pipeline');
  const sortSelect = document.getElementById('sort-select');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const activeTagChips = document.getElementById('active-tag-chips');

  // View Toggle Buttons
  const btnViewGrid = document.getElementById('btn-view-grid');
  const btnViewTable = document.getElementById('btn-view-table');

  // Export Buttons
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');

  // Stats Elements
  const statTotalLeads = document.getElementById('stat-total-leads');
  const statPhoneLeads = document.getElementById('stat-phone-leads');
  const statDmLeads = document.getElementById('stat-dm-leads');
  const statPipelineActive = document.getElementById('stat-pipeline-active');
  const statContactedBadge = document.getElementById('stat-contacted-badge');

  // Modal Elements
  const pitchModal = document.getElementById('pitch-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalLeadTitle = document.getElementById('modal-lead-title');
  const modalLeadHandle = document.getElementById('modal-lead-handle');
  const modalLocation = document.getElementById('modal-location');
  const modalContact = document.getElementById('modal-contact');
  const modalAudience = document.getElementById('modal-audience');
  const modalWebStatus = document.getElementById('modal-web-status');
  const pitchTextarea = document.getElementById('pitch-textarea');
  const btnCopyPitch = document.getElementById('btn-copy-pitch');
  const btnOpenDirectChannel = document.getElementById('btn-open-direct-channel');
  const pitchTabBtns = document.querySelectorAll('.pitch-tab-btn');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // 1. Initialize Leads Data
  function initData() {
    if (window.LEADS_DATA && Array.isArray(window.LEADS_DATA)) {
      state.leads = window.LEADS_DATA;
      setupApp();
    } else {
      // Fallback to fetch JSON
      fetch('../leads/uk_tree_surgeons_100_leads.json')
        .then(res => res.json())
        .then(data => {
          state.leads = data;
          setupApp();
        })
        .catch(err => {
          console.error("Failed to load leads JSON:", err);
          showToast("Error loading leads dataset. Check file paths.", "error");
        });
    }
  }

  function setupApp() {
    updatePipelineStats();
    applyFiltersAndSort();
    bindEvents();
  }

  // 2. Filter & Sort Logic
  function applyFiltersAndSort() {
    const query = searchInput.value.toLowerCase().trim();
    const contactVal = filterContact.value;
    const regionVal = filterRegion.value;
    const serviceVal = filterService.value;
    const pipelineVal = filterPipeline.value;
    const sortVal = sortSelect.value;

    let result = state.leads.filter(lead => {
      // Text Search
      if (query) {
        const matchName = (lead.full_name || '').toLowerCase().includes(query);
        const matchHandle = (lead.username || '').toLowerCase().includes(query);
        const matchLocation = (lead.location || '').toLowerCase().includes(query);
        const matchService = (lead.service_evidence || '').toLowerCase().includes(query);
        const matchPhone = (lead.phones || '').toLowerCase().includes(query);
        const matchBio = (lead.bio || '').toLowerCase().includes(query);
        if (!matchName && !matchHandle && !matchLocation && !matchService && !matchPhone && !matchBio) {
          return false;
        }
      }

      // Contact Route Filter
      if (contactVal === 'phone') {
        if (!lead.phones && !lead.contact_route.includes('Phone:')) return false;
      } else if (contactVal === 'dm') {
        if (lead.phones || lead.emails) return false;
      } else if (contactVal === 'email') {
        if (!lead.emails && lead.website_status !== 'WHATSAPP_ONLY') return false;
      }

      // Region Filter
      if (regionVal !== 'all') {
        const loc = (lead.location || '').toLowerCase();
        if (regionVal === 'Scotland' && !loc.includes('glasgow') && !loc.includes('edinburgh') && !loc.includes('scotland') && !loc.includes('borders')) return false;
        if (regionVal === 'Wales' && !loc.includes('cardiff') && !loc.includes('swansea') && !loc.includes('newport') && !loc.includes('wales')) return false;
        if (regionVal === 'Northern Ireland' && !loc.includes('belfast') && !loc.includes('northern ireland') && !loc.includes('ni')) return false;
        if (regionVal === 'East Anglia' && !loc.includes('norwich') && !loc.includes('ipswich') && !loc.includes('cambridge') && !loc.includes('norfolk') && !loc.includes('suffolk')) return false;
        if (['London', 'Leeds', 'Manchester', 'Liverpool', 'Bristol', 'Leicester', 'Nottingham', 'Sheffield', 'Newcastle', 'Exeter', 'Bournemouth', 'Southampton', 'Kent', 'Essex', 'Sussex'].includes(regionVal)) {
          if (!loc.includes(regionVal.toLowerCase())) return false;
        }
      }

      // Service Filter
      if (serviceVal !== 'all') {
        const serv = (lead.service_evidence || '').toLowerCase() + ' ' + (lead.bio || '').toLowerCase();
        if (serviceVal === 'felling' && !serv.includes('fell') && !serv.includes('removal')) return false;
        if (serviceVal === 'reduction' && !serv.includes('reduction') && !serv.includes('thinning')) return false;
        if (serviceVal === 'pruning' && !serv.includes('prun')) return false;
        if (serviceVal === 'stump' && !serv.includes('stump')) return false;
        if (serviceVal === 'hedge' && !serv.includes('hedge')) return false;
        if (serviceVal === 'emergency' && !serv.includes('emergency') && !serv.includes('storm')) return false;
      }

      // Pipeline Filter
      const currentStatus = state.pipelineMap[lead.username] || 'New';
      if (pipelineVal !== 'all' && currentStatus !== pipelineVal) {
        return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortVal === 'priority') {
        const aHasPhone = (a.phones || a.contact_route.includes('Phone:')) ? 1 : 0;
        const bHasPhone = (b.phones || b.contact_route.includes('Phone:')) ? 1 : 0;
        if (bHasPhone !== aHasPhone) return bHasPhone - aHasPhone;
        return (b.followers || 0) - (a.followers || 0);
      }
      if (sortVal === 'followers-desc') {
        return (b.followers || 0) - (a.followers || 0);
      }
      if (sortVal === 'followers-asc') {
        return (a.followers || 0) - (b.followers || 0);
      }
      if (sortVal === 'posts-desc') {
        return (b.posts || 0) - (a.posts || 0);
      }
      if (sortVal === 'name-asc') {
        return (a.full_name || a.username).localeCompare(b.full_name || b.username);
      }
      return 0;
    });

    state.filteredLeads = result;
    renderLeads();
    updateTagChips();
  }

  // 3. Render Cards & Table
  function renderLeads() {
    visibleCountEl.textContent = state.filteredLeads.length;
    totalCountEl.textContent = state.leads.length;

    if (state.filteredLeads.length === 0) {
      cardsContainer.style.display = 'none';
      tableContainer.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    if (state.currentView === 'cards') {
      cardsContainer.style.display = 'grid';
      tableContainer.style.display = 'none';
      renderCardsView();
    } else {
      cardsContainer.style.display = 'none';
      tableContainer.style.display = 'block';
      renderTableView();
    }
  }

  function renderCardsView() {
    cardsContainer.innerHTML = '';
    state.filteredLeads.forEach(lead => {
      const card = document.createElement('article');
      card.className = 'lead-card';
      card.id = `lead-card-${lead.username}`;

      const status = state.pipelineMap[lead.username] || 'New';
      const statusClass = `status-${status.toLowerCase().replace(/\s+/g, '-')}`;

      // Phone formatting
      const hasPhone = Boolean(lead.phones || (lead.contact_route && lead.contact_route.startsWith('Phone:')));
      const displayPhone = lead.phones || (lead.contact_route.replace('Phone: ', '').trim());

      // Parse services tags
      const servicesList = (lead.service_evidence || 'Tree surgery, felling, pruning')
        .split(/[,|•]/)
        .map(s => s.trim())
        .filter(s => s.length > 2)
        .slice(0, 4);

      card.innerHTML = `
        <div class="card-header">
          <div class="header-meta">
            <span class="id-badge">#${String(lead.id).padStart(3, '0')}</span>
            <h3 class="business-name">${escapeHtml(lead.full_name)}</h3>
            <a href="${lead.profile_url}" target="_blank" rel="noopener noreferrer" class="handle-link" title="Open profile on Instagram">
              @${escapeHtml(lead.username)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline></svg>
            </a>
          </div>
          <span class="location-badge" title="Location in the United Kingdom">
            📍 ${escapeHtml(lead.location)}
          </span>
        </div>

        <div class="card-body">
          <div class="opportunity-banner">
            <span>🚫 No Website (Link-In-Bio / IG Only)</span>
            <span title="Prime Prospect">High Conv 🔥</span>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <span class="val">${formatNumber(lead.followers)}</span>
              <span class="lbl">Followers</span>
            </div>
            <div class="stat-item">
              <span class="val">${formatNumber(lead.posts)}</span>
              <span class="lbl">Posts</span>
            </div>
            <div class="stat-item">
              <span class="val">Active</span>
              <span class="lbl">Verified</span>
            </div>
          </div>

          <div class="services-tags">
            ${servicesList.map(s => `<span class="service-tag">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>

        <div class="card-footer">
          <div class="contact-action-bar">
            ${hasPhone ? `
              <a href="tel:${displayPhone.replace(/\s+/g, '')}" class="btn-contact btn-phone" title="Call directly">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                ${displayPhone}
              </a>
              <button class="btn-copy btn-copy-phone" data-phone="${displayPhone}" title="Copy phone number">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            ` : `
              <a href="${lead.profile_url}" target="_blank" rel="noopener noreferrer" class="btn-contact btn-dm" title="Send quote message on Instagram">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Send IG DM Quote
              </a>
            `}
          </div>

          <div class="card-actions-secondary">
            <select class="pipeline-select ${statusClass}" data-username="${lead.username}">
              <option value="New" ${status === 'New' ? 'selected' : ''}>Status: New Lead</option>
              <option value="Contacted" ${status === 'Contacted' ? 'selected' : ''}>Status: Contacted</option>
              <option value="In Talks" ${status === 'In Talks' ? 'selected' : ''}>Status: In Talks</option>
              <option value="Won" ${status === 'Won' ? 'selected' : ''}>Status: Won Deal 🎉</option>
              <option value="Archived" ${status === 'Archived' ? 'selected' : ''}>Status: Archived</option>
            </select>

            <button class="btn-pitch" data-username="${lead.username}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Pitch
            </button>
          </div>
        </div>
      `;

      cardsContainer.appendChild(card);
    });

    attachCardEventListeners();
  }

  function renderTableView() {
    tableBody.innerHTML = '';
    state.filteredLeads.forEach(lead => {
      const tr = document.createElement('tr');
      const status = state.pipelineMap[lead.username] || 'New';
      const hasPhone = Boolean(lead.phones || (lead.contact_route && lead.contact_route.startsWith('Phone:')));
      const displayPhone = lead.phones || (lead.contact_route.replace('Phone: ', '').trim());

      tr.innerHTML = `
        <td class="col-id">#${lead.id}</td>
        <td class="col-business"><strong>${escapeHtml(lead.full_name)}</strong></td>
        <td class="col-handle">
          <a href="${lead.profile_url}" target="_blank" rel="noopener noreferrer">@${escapeHtml(lead.username)}</a>
        </td>
        <td class="col-loc">📍 ${escapeHtml(lead.location)}</td>
        <td class="col-website"><span class="pill-amber" style="padding: 2px 6px; font-size: 0.7rem; border-radius: 4px;">NO WEBSITE</span></td>
        <td class="col-contact">${hasPhone ? `📞 ${displayPhone}` : '💬 DM Quote'}</td>
        <td class="col-followers">${formatNumber(lead.followers)}</td>
        <td class="col-services" title="${escapeHtml(lead.service_evidence)}">${escapeHtml(lead.service_evidence)}</td>
        <td class="col-status">
          <select class="pipeline-select" data-username="${lead.username}">
            <option value="New" ${status === 'New' ? 'selected' : ''}>New</option>
            <option value="Contacted" ${status === 'Contacted' ? 'selected' : ''}>Contacted</option>
            <option value="In Talks" ${status === 'In Talks' ? 'selected' : ''}>In Talks</option>
            <option value="Won" ${status === 'Won' ? 'selected' : ''}>Won</option>
            <option value="Archived" ${status === 'Archived' ? 'selected' : ''}>Archived</option>
          </select>
        </td>
        <td class="col-actions">
          <button class="btn-pitch" data-username="${lead.username}" style="padding: 4px 8px; font-size: 0.72rem;">Pitch</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    attachCardEventListeners();
  }

  function attachCardEventListeners() {
    // Pipeline selects
    document.querySelectorAll('.pipeline-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const u = e.target.getAttribute('data-username');
        const newStatus = e.target.value;
        state.pipelineMap[u] = newStatus;
        localStorage.setItem('uk_arb_pipeline_status', JSON.stringify(state.pipelineMap));
        e.target.className = `pipeline-select status-${newStatus.toLowerCase().replace(/\s+/g, '-')}`;
        updatePipelineStats();
        showToast(`Updated @${u} status to "${newStatus}"`, 'info');
      });
    });

    // Pitch buttons
    document.querySelectorAll('.btn-pitch').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = btn.getAttribute('data-username');
        const lead = state.leads.find(l => l.username === u);
        if (lead) {
          openPitchModal(lead);
        }
      });
    });

    // Copy Phone buttons
    document.querySelectorAll('.btn-copy-phone').forEach(btn => {
      btn.addEventListener('click', () => {
        const phone = btn.getAttribute('data-phone');
        navigator.clipboard.writeText(phone);
        showToast(`Copied phone number ${phone} to clipboard!`);
      });
    });
  }

  // 4. Outreach Pitch Modal Logic
  function openPitchModal(lead) {
    state.activeModalLead = lead;
    modalLeadTitle.textContent = `Pitch for ${lead.full_name}`;
    modalLeadHandle.textContent = `@${lead.username}`;
    modalLocation.textContent = `${lead.location}, England 🇬🇧`;
    modalContact.textContent = lead.phones ? `Phone: ${lead.phones}` : lead.contact_route;
    modalAudience.textContent = `${formatNumber(lead.followers)} Followers • ${formatNumber(lead.posts)} Posts`;
    modalWebStatus.textContent = `NO WEBSITE (${lead.website_status})`;

    btnOpenDirectChannel.href = lead.profile_url;
    btnOpenDirectChannel.textContent = lead.phones ? `Text / WhatsApp (${lead.phones})` : 'Send on Instagram';
    if (lead.phones) {
      btnOpenDirectChannel.href = `https://wa.me/44${lead.phones.replace(/^0/, '').replace(/\s+/g, '')}`;
    }

    renderPitchText();
    pitchModal.style.display = 'flex';
  }

  function renderPitchText() {
    if (!state.activeModalLead) return;
    const lead = state.activeModalLead;
    const name = lead.full_name.split(' ')[0] || 'there';
    const city = lead.location || 'your area';
    const handle = lead.username;
    const phone = lead.phones || 'your number';

    let text = '';
    if (state.activePitchTemplate === 'local_seo') {
      text = `Hi ${name},

I came across your tree surgery portfolio on Instagram (@${handle}) in ${city} — really impressive work on the recent tree removals and crown reductions!

I noticed you don't currently have a dedicated standalone website or quote page. Right now across ${city}, dozens of local property owners and commercial clients search Google every week for "tree surgeon near me" and emergency removals. Because you're only on Instagram, national directories and competitors with local pages are capturing those high-ticket jobs.

We design clean, mobile-first quote pages specifically for UK tree surgeons that rank locally on Google and route inquiries straight to your phone (${phone}).

Would you be open to a 2-minute video showing what this could look like for ${lead.full_name}?`;
    } else if (state.activePitchTemplate === 'quote_tool') {
      text = `Hey ${name},

Love the work you guys are doing at @${handle}! 

Quick question: Are you spending too much time back-and-forth in Instagram DMs answering "how much for a felling?" without enough project details?

We build fast 1-page tree quotation calculators for independent UK arborists. Homeowners upload photos of their tree, choose their service (felling, stump grinding, or pruning), and their postcode — then all job details ping your phone instantly with zero time wasted.

Would love to send over a quick 60-second interactive demo if you're curious!`;
    } else if (state.activePitchTemplate === 'emergency') {
      text = `Hello team at @${handle},

Hope you're having a productive week! With the UK storm season causing sudden tree failures and emergency callouts in ${city}, local demand for 24/7 emergency tree surgery is at an all-time high.

Because you only operate via Instagram right now, homeowners looking for immediate storm damage cleanup can't easily find a direct emergency contact button on Google.

We create high-converting emergency callout landing pages with instant tap-to-call buttons routing straight to ${phone}. Happy to share a quick preview if you'd like to capture more emergency callouts this season!`;
    }

    pitchTextarea.value = text;
  }

  // 5. Pipeline Stats Update
  function updatePipelineStats() {
    const statuses = Object.values(state.pipelineMap);
    const contactedCount = statuses.filter(s => s !== 'New').length;
    statPipelineActive.textContent = contactedCount;
    statContactedBadge.textContent = `${contactedCount} Active Leads`;
  }

  // 6. Active Filter Chips
  function updateTagChips() {
    activeTagChips.innerHTML = '';
    const contactVal = filterContact.value;
    const regionVal = filterRegion.value;
    const serviceVal = filterService.value;
    const pipelineVal = filterPipeline.value;

    if (contactVal !== 'all') {
      addChip(`Contact: ${filterContact.options[filterContact.selectedIndex].text}`, () => {
        filterContact.value = 'all';
        applyFiltersAndSort();
      });
    }
    if (regionVal !== 'all') {
      addChip(`Region: ${regionVal}`, () => {
        filterRegion.value = 'all';
        applyFiltersAndSort();
      });
    }
    if (serviceVal !== 'all') {
      addChip(`Service: ${serviceVal}`, () => {
        filterService.value = 'all';
        applyFiltersAndSort();
      });
    }
    if (pipelineVal !== 'all') {
      addChip(`Pipeline: ${pipelineVal}`, () => {
        filterPipeline.value = 'all';
        applyFiltersAndSort();
      });
    }
  }

  function addChip(label, onRemove) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtml(label)} <button title="Remove filter">&times;</button>`;
    chip.querySelector('button').addEventListener('click', onRemove);
    activeTagChips.appendChild(chip);
  }

  // 7. Event Listeners
  function bindEvents() {
    // Search input
    searchInput.addEventListener('input', () => {
      clearSearchBtn.style.display = searchInput.value ? 'flex' : 'none';
      applyFiltersAndSort();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      applyFiltersAndSort();
    });

    // Dropdown filters
    [filterContact, filterRegion, filterService, filterPipeline, sortSelect].forEach(select => {
      select.addEventListener('change', applyFiltersAndSort);
    });

    // Reset filters
    resetFiltersBtn.addEventListener('click', resetAllFilters);
    document.getElementById('btn-empty-reset').addEventListener('click', resetAllFilters);

    // View toggles
    btnViewGrid.addEventListener('click', () => {
      state.currentView = 'cards';
      btnViewGrid.classList.add('active');
      btnViewTable.classList.remove('active');
      renderLeads();
    });

    btnViewTable.addEventListener('click', () => {
      state.currentView = 'table';
      btnViewTable.classList.add('active');
      btnViewGrid.classList.remove('active');
      renderLeads();
    });

    // Pitch Template Tabs
    pitchTabBtns.forEach(tab => {
      tab.addEventListener('click', () => {
        pitchTabBtns.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activePitchTemplate = tab.getAttribute('data-template');
        renderPitchText();
      });
    });

    // Copy Pitch Button
    btnCopyPitch.addEventListener('click', () => {
      navigator.clipboard.writeText(pitchTextarea.value);
      showToast('Outreach pitch copied to clipboard! Ready to send.', 'success');
    });

    // Modal close
    modalCloseBtn.addEventListener('click', () => {
      pitchModal.style.display = 'none';
    });

    pitchModal.addEventListener('click', (e) => {
      if (e.target === pitchModal) {
        pitchModal.style.display = 'none';
      }
    });

    // Export buttons
    btnExportCsv.addEventListener('click', exportCsv);
    btnExportJson.addEventListener('click', exportJson);
  }

  function resetAllFilters() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    filterContact.value = 'all';
    filterRegion.value = 'all';
    filterService.value = 'all';
    filterPipeline.value = 'all';
    sortSelect.value = 'priority';
    applyFiltersAndSort();
    showToast('Filters reset to default view');
  }

  // 8. Export Helpers
  function exportCsv() {
    const dataToExport = state.filteredLeads;
    if (!dataToExport.length) return;

    const headers = Object.keys(dataToExport[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    dataToExport.forEach(row => {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uk_tree_surgeons_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded CSV with ${dataToExport.length} leads!`);
  }

  function exportJson() {
    const dataToExport = state.filteredLeads;
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uk_tree_surgeons_leads_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded JSON with ${dataToExport.length} leads!`);
  }

  // 9. Toast Notification System
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'error' ? '⚠️' : '✅';
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, 2800);
  }

  // Utility Functions
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return String(num);
  }

  // Start initialization
  initData();
});
