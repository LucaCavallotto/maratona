import { presetDistances, parseSmartInput } from './utils.js';

export const UIState = {
    isCalculated: false,
    currentResults: null
};

export function initCustomDropdowns() {
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    const overlay = document.getElementById('dropdownOverlay');

    if (!dropdowns.length) return;

    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.custom-dropdown-toggle');
        const menu = dropdown.querySelector('.custom-dropdown-menu');

        let focusedItemIndex = -1;
        const items = Array.from(menu.querySelectorAll('.custom-dropdown-item'));

        // Find selecting standard <select> element that's normally hidden
        const hiddenSelect = dropdown.nextElementSibling?.tagName === 'SELECT'
            ? dropdown.nextElementSibling
            : document.getElementById(dropdown.id.replace('Dropdown', ''));

        toggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const isOpening = !menu.classList.contains('show');

            // Close all other dropdowns
            document.querySelectorAll('.custom-dropdown-menu.show').forEach(otherMenu => {
                if (otherMenu !== menu) {
                    otherMenu.classList.remove('show');
                    otherMenu.parentElement.querySelector('.custom-dropdown-toggle').classList.remove('open');
                }
            });

            menu.classList.toggle('show', isOpening);
            toggle.classList.toggle('open', isOpening);
            dropdown.classList.toggle('is-open', isOpening);
            toggle.setAttribute('aria-expanded', isOpening);

            if (isOpening) {
                // Focus the toggle and highlight existing selection
                toggle.focus();
                focusedItemIndex = items.findIndex(item => item.classList.contains('selected'));
                if (focusedItemIndex === -1 && items.length > 0) focusedItemIndex = 0;

                items.forEach((item, index) => {
                    item.classList.toggle('is-highlighted', index === focusedItemIndex);
                    if (index === focusedItemIndex) {
                        setTimeout(() => item.scrollIntoView({ block: 'nearest' }), 10);
                    }
                });

                if (window.innerWidth <= 640 && overlay) {
                    overlay.classList.add('show');
                }
            } else {
                if (window.innerWidth <= 640 && overlay) {
                    overlay.classList.remove('show');
                }
            }
        });

        menu.querySelectorAll('.custom-dropdown-item').forEach(item => {
            item.addEventListener('click', function () {
                menu.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('selected'));
                this.classList.add('selected');

                toggle.textContent = this.textContent;
                hiddenSelect.value = this.getAttribute('data-value');

                menu.classList.remove('show');
                toggle.classList.remove('open');
                dropdown.classList.remove('is-open');
                if (overlay) overlay.classList.remove('show');

                hiddenSelect.dispatchEvent(new Event('change'));

                // Update ARIA
                toggle.setAttribute('aria-expanded', 'false');
                menu.querySelectorAll('.custom-dropdown-item').forEach(i => i.setAttribute('aria-selected', 'false'));
                this.setAttribute('aria-selected', 'true');
            });
        });

        // Keyboard navigation support
        // Clear keyboard focus when mouse takes over for seamless UX
        menu.addEventListener('mousemove', function () {
            if (focusedItemIndex !== -1) {
                items.forEach(item => item.classList.remove('is-highlighted'));
                focusedItemIndex = -1;
            }
        });

        // Removed redundant second click listener as logic is now unified above.

        toggle.addEventListener('keydown', function (e) {
            const isOpen = menu.classList.contains('show');

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation(); // Prevent global shortcuts (like calculate) from receiving this and blurring the input
                if (isOpen && focusedItemIndex >= 0) {
                    items[focusedItemIndex].click();
                    toggle.focus(); // Return focus to toggle
                } else {
                    this.click();
                }
            } else if (e.key === 'Escape') {
                if (isOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    menu.classList.remove('show');
                    toggle.classList.remove('open');
                    dropdown.classList.remove('is-open');
                    if (overlay) overlay.classList.remove('show');
                    toggle.setAttribute('aria-expanded', 'false');
                    items.forEach(item => item.classList.remove('is-highlighted'));
                    toggle.focus();
                }
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
                e.stopPropagation();
                if (isOpen) {
                    e.preventDefault(); // Prevent page scrolling or tabbing away to background elements

                    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
                        focusedItemIndex = (focusedItemIndex + 1) % items.length;
                    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
                        focusedItemIndex = (focusedItemIndex - 1 + items.length) % items.length;
                    }

                    items.forEach((item, index) => {
                        if (index === focusedItemIndex) {
                            item.classList.add('is-highlighted');
                            item.scrollIntoView({ block: 'nearest' });
                        } else {
                            item.classList.remove('is-highlighted');
                        }
                    });
                } else if (e.key === 'ArrowDown') {
                    // Open dropdown if closed
                    e.preventDefault();
                    this.click();
                }
            }
        });
    });

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.custom-dropdown')) {
            document.querySelectorAll('.custom-dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
                if (menu.parentElement) {
                    menu.parentElement.querySelector('.custom-dropdown-toggle').classList.remove('open');
                    menu.parentElement.classList.remove('is-open');
                }
                overlay.classList.remove('show');
            });
        }
    });

    if (overlay) {
        overlay.addEventListener('click', function () {
            document.querySelectorAll('.custom-dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
                if (menu.parentElement) {
                    menu.parentElement.querySelector('.custom-dropdown-toggle').classList.remove('open');
                    menu.parentElement.classList.remove('is-open');
                }
            });
            overlay.classList.remove('show');
        });
    }
}

export function hideAllErrors() {
    document.querySelectorAll('.error-text').forEach(e => e.style.display = 'none');
}

export function resetResultsDisplay() {
    const resultsDiv = document.getElementById('results');
    const zoneResults = document.getElementById('zoneResults');
    const paceTimeResults = document.getElementById('paceTimeResults');
    const converterResults = document.getElementById('converterResults');

    if (resultsDiv) resultsDiv.style.display = 'none';
    if (zoneResults) zoneResults.classList.add('hidden');
    if (paceTimeResults) paceTimeResults.classList.add('hidden');
    if (converterResults) converterResults.classList.add('hidden');
}

export function updateDistanceInput(mode) {
    if (mode === 'pace') {
        const preset = document.getElementById('distancePresetPace').value;
        const input = document.getElementById('distancePace');
        if (preset !== 'custom') {
            input.value = preset;
        }
    } else if (mode === 'time') {
        const preset = document.getElementById('distancePresetTime').value;
        const input = document.getElementById('distanceTime');
        if (preset !== 'custom') {
            input.value = preset;
        }
    }
}

export function updateConverterLabel() {
    const type = document.getElementById('convType').value;
    const label = document.querySelector('label[for="convValue"]');
    if (type === 'distance') {
        label.textContent = 'Distance';
    } else {
        label.textContent = 'Pace (MM:SS)';
    }
}

export function setLoadingState(isLoading) {
    const btns = document.querySelectorAll('.calculateBtn');
    btns.forEach(btn => {
        if (isLoading) {
            btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
            btn.innerHTML = '<span class="spinner"></span>';
            btn.disabled = true;
        } else {
            btn.textContent = btn.dataset.originalText || 'Calculate';
            enableCalculate(); // Use conditional logic instead of force enable
        }
    });
}

export async function triggerSlideTransition(appLayout) {
    if (!appLayout.classList.contains('state-results')) {
        appLayout.classList.add('state-results');
        await new Promise(r => setTimeout(r, 600));
    }
}

export async function clearOldResults(appLayout) {
    if (appLayout.classList.contains('results-ready')) {
        appLayout.classList.remove('results-ready');
        await new Promise(r => setTimeout(r, 400));
    }
}

export function showResultsGrid(appLayout) {
    // Force DOM layout recalculation so display: block propagates before opacity fades in
    void appLayout.offsetWidth;

    appLayout.classList.add('results-ready');
    UIState.isCalculated = true;

    document.querySelectorAll('.copyBtn').forEach(btn => btn.disabled = false);
    document.querySelectorAll('.resetBtn').forEach(btn => btn.disabled = false);
    document.querySelectorAll('.calculateBtn').forEach(btn => btn.disabled = true);
}

export function enableCalculate() {
    const mode = document.getElementById('calcMode')?.value;
    const flipper = document.getElementById('sidebarFlipper');
    const isFlipped = flipper && flipper.classList.contains('flipped');
    
    let isValid = false;
    let hasValue = false;

    if (isFlipped) {
        // On the back face, we only enable Reset if a calculation was performed
        // or if we want to allow resetting sliders to defaults. 
        // For simplicity and matching user expectation of "erasing/resetting":
        isValid = true;
        hasValue = true; // Sliders always have a numeric value
    } else {
        if (mode === 'zone') {
            const val = document.getElementById('time10k').value.trim();
            isValid = val !== '';
            hasValue = isValid;
        } else if (mode === 'smart') {
            const val = document.getElementById('smartInput').value.trim();
            const parsed = parseSmartInput(val);
            isValid = parsed.status === 'complete';
            hasValue = val !== '';
        } else if (mode === 'pace') {
            const d = document.getElementById('distancePace').value.trim();
            const t = document.getElementById('timePace').value.trim();
            isValid = d !== '' && t !== '';
            hasValue = d !== '' || t !== '';
        } else if (mode === 'time') {
            const d = document.getElementById('distanceTime').value.trim();
            const p = document.getElementById('paceTime').value.trim();
            isValid = d !== '' && p !== '';
            hasValue = d !== '' || p !== '';
        } else if (mode === 'distance') {
            const t = document.getElementById('timeDistance').value.trim();
            const p = document.getElementById('paceDistance').value.trim();
            isValid = t !== '' && p !== '';
            hasValue = t !== '' || p !== '';
        } else if (mode === 'converter') {
            const val = document.getElementById('convValue').value.trim();
            isValid = val !== '';
            hasValue = isValid;
        }
    }

    // A calculation has been done if UIState.isCalculated is true
    const shouldEnableReset = hasValue || UIState.isCalculated;

    document.querySelectorAll('.calculateBtn').forEach(btn => btn.disabled = !isValid);
    document.querySelectorAll('.resetBtn').forEach(btn => {
        btn.disabled = !shouldEnableReset;
    });
}

export function renderPaceTimeResults(container, metrics, splits, highlightLabel = null) {
    const splitsHtml = `
        <div class="splits-section">
            <div class="section-title">Splits</div>
            <div class="splits-table">
                <div class="split-row header">
                    <div class="split-col">Km</div>
                    <div class="split-col">Time</div>
                </div>
                ${splits.map((split, index) => `
                    <div class="split-row animate-card" style="animation-delay: ${(metrics.length + index) * 0.05}s;">
                        <div class="split-col">${split.km}</div>
                        <div class="split-col">${split.time}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const iconMap = {
        'Distance': '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v4h2V8h2v4h2V8h2v4h2V8h2v8z"/></svg>',
        'Pace': '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0012 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a8.994 8.994 0 007.03-14.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>',
        'Time': '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
        'Speed': '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M2.5 11h14.8c.6 0 1.1-.5 1.1-1.1s-.5-1.1-1.1-1.1-1.1.5-1.1 1.1h-2.2c0-1.8 1.5-3.3 3.3-3.3s3.3 1.5 3.3 3.3-1.5 3.3-3.3 3.3H2.5v-2.2zm0 4.4h11.2c.6 0 1.1-.5 1.1-1.1s-.5-1.1-1.1-1.1-1.1.5-1.1 1.1H10.4c0-1.8 1.5-3.3 3.3-3.3s3.3 1.5 3.3 3.3-1.5 3.3-3.3 3.3H2.5v-2.2zm0-8.8h7.5c.6 0 1.1-.5 1.1-1.1S10.6 4.4 10 4.4s-1.1.5-1.1 1.1H6.7C6.7 3.7 8.2 2.2 10 2.2s3.3 1.5 3.3 3.3-1.5 3.3-3.3 3.3H2.5V6.6z"/></svg>',
        'Total Time': '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>'
    };

    const metricsHtml = metrics.map((metric, index) => {
        const valueNum = typeof metric.value === 'object' ? metric.value.num : metric.value;
        const valueUnit = typeof metric.value === 'object' ? metric.value.unit : '';
        const icon = iconMap[metric.label] || '';

        let subValuesHtml = '';
        if (metric.subValue) {
            const subs = Array.isArray(metric.subValue) ? metric.subValue : [metric.subValue];
            subValuesHtml = subs.map(sv => {
                const subValNum = typeof sv === 'object' ? sv.num : sv;
                const subValUnit = typeof sv === 'object' ? sv.unit : '';
                return `<span class="metric-sub-value"><span class="metric-num">${subValNum}</span><span class="metric-unit">${subValUnit}</span></span>`;
            }).join('');
        }

        const isHighlighted = highlightLabel && metric.label && metric.label.toLowerCase() === highlightLabel.toLowerCase();
        const highlightClass = isHighlighted ? ' is-highlighted' : '';

        return `
            <div class="result-item${highlightClass} animate-card" style="animation-delay: ${index * 0.05}s;">
                <div class="metric-label">
                    ${icon}
                    ${metric.label}
                </div>
                <div class="metric-value">
                    <span class="metric-num">${valueNum}</span><span class="metric-unit">${valueUnit}</span>
                    ${subValuesHtml}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="result-grid">
            <div class="results-section">
                <div class="section-title">Results</div>
                <div class="result-card">
                    ${metricsHtml}
                </div>
            </div>
            ${splitsHtml}
        </div>
    `;

    document.getElementById('results').style.display = 'block';
    container.classList.remove('hidden');
    // Ensure parent results container is visible
    void container.offsetHeight;
}

export function resetUI(skipLayoutReset = false) {
    UIState.currentResults = null;
    UIState.isCalculated = false;

    document.getElementById('time10k').value = '';
    
    const smartInput = document.getElementById('smartInput');
    if (smartInput) smartInput.value = '';
    const smartInlineHint = document.getElementById('smartInlineHint');
    if (smartInlineHint) {
        smartInlineHint.textContent = 'Hint: Distance (00.00) or ? then "," to proceed';
        smartInlineHint.style.color = 'var(--text-placeholder)';
        smartInlineHint.style.opacity = '0.8';
    }

    // Reset hidden selects
    document.getElementById('distancePresetPace').value = 'custom';
    document.getElementById('distancePace').value = '';
    document.getElementById('timePace').value = '';

    document.getElementById('distancePresetTime').value = 'custom';
    document.getElementById('distanceTime').value = '';
    document.getElementById('paceTime').value = '';

    document.getElementById('timeDistance').value = '';
    document.getElementById('paceDistance').value = '';

    document.getElementById('convType').value = 'distance';
    document.getElementById('convValue').value = '';

    // Reset Dropdown Toggles Visually
    const pToggle = document.getElementById('distancePresetPaceToggle');
    if (pToggle) pToggle.textContent = 'Custom';
    const tToggle = document.getElementById('distancePresetTimeToggle');
    if (tToggle) tToggle.textContent = 'Custom';
    const cToggle = document.getElementById('convTypeToggle');
    if (cToggle) cToggle.textContent = 'Distance';

    // Reset Unit Toggles
    document.querySelectorAll('.unit-toggle').forEach(container => {
        container.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-value') === 'km');
        });
    });

    hideAllErrors();
    document.querySelectorAll('.success-msg').forEach(msg => msg.style.display = 'none');

    if (!skipLayoutReset) {
        resetResultsDisplay();
    }

    document.querySelectorAll('.copyBtn').forEach(btn => btn.disabled = true);
    document.querySelectorAll('.resetBtn').forEach(btn => btn.disabled = true);

    // Calculate button should only enable if fields are filled (e.g. if presets auto-filled them)
    enableCalculate();

    updateDistanceInput(document.getElementById('calcMode').value);

    if (!skipLayoutReset) {
        const appLayout = document.querySelector('.app-layout');
        if (appLayout) {
            appLayout.classList.remove('state-results', 'results-ready');
        }
    }
}

export function switchCalcMode(mode, skipLayoutReset = false) {
    // Set data-mode attribute for CSS mode-specific styling (like height optimization)
    const sidebar = document.getElementById('mainSidebar');
    if (sidebar) {
        sidebar.setAttribute('data-mode', mode);
    }

    // Toggle Calculator Bodies
    document.getElementById('zoneInputs').classList.add('hidden');
    document.getElementById('smartInputs').classList.add('hidden');
    document.getElementById('paceInputs').classList.add('hidden');
    document.getElementById('timeInputs').classList.add('hidden');
    document.getElementById('distanceInputs').classList.add('hidden');
    document.getElementById('converterInputs').classList.add('hidden');

    // Toggle Header Hints
    document.querySelectorAll('.input-hint').forEach(hint => hint.classList.add('hidden'));

    if (mode === 'zone') {
        document.getElementById('zoneInputs').classList.remove('hidden');
        document.getElementById('hintZone').classList.remove('hidden');
    } else if (mode === 'smart') {
        document.getElementById('smartInputs').classList.remove('hidden');
        document.getElementById('hintSmart').classList.remove('hidden');
    } else if (mode === 'pace') {
        document.getElementById('paceInputs').classList.remove('hidden');
        document.getElementById('hintPace').classList.remove('hidden');
    } else if (mode === 'time') {
        document.getElementById('timeInputs').classList.remove('hidden');
        document.getElementById('hintTime').classList.remove('hidden');
    } else if (mode === 'distance') {
        document.getElementById('distanceInputs').classList.remove('hidden');
        document.getElementById('hintDistance').classList.remove('hidden');
    } else if (mode === 'converter') {
        document.getElementById('converterInputs').classList.remove('hidden');
        document.getElementById('hintConverter').classList.remove('hidden');
        updateConverterLabel();
    }
    resetUI(skipLayoutReset);
}
