import { normalizeInput, validateTime, secondsToTime, secondsToPace, presetDistances, formatTimeComponent, parseSmartInput } from './utils.js';
import {
    calculateThresholdPace,
    calculateZones,
    estimateRacePace,
    calculatePaceMetrics,
    calculateTimeMetrics,
    calculateDistanceMetrics,
    calculateConverterMetrics
} from './calculators.js';
import {
    initCustomDropdowns,
    hideAllErrors,
    updateDistanceInput,
    updateConverterLabel,
    setLoadingState,
    triggerSlideTransition,
    clearOldResults,
    showResultsGrid,
    renderPaceTimeResults,
    resetUI,
    switchCalcMode,
    UIState,
    resetResultsDisplay,
    enableCalculate
} from './ui-controller.js';
import { initSliders, updateFlipButtonVisibility, flipToFront, flipToBack, isFlipped, syncSlidersToFront, syncFrontToSliders, resetSliders } from './sliders.js';

// Validation Decoupler
function validateInputsForMode(mode) {
    const showError = (id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
        const elBack = document.getElementById(id + 'Back');
        if (elBack) elBack.style.display = 'block';
    };

    if (mode === 'zone') {
        const timeInput = normalizeInput(document.getElementById('time10k').value.trim());
        if (!validateTime(timeInput)) {
            showError('errorZone');
            return false;
        }
    } else if (mode === 'smart') {
        const val = document.getElementById('smartInput').value.trim();
        const parsed = parseSmartInput(val);
        if (parsed.status !== 'complete') {
            showError('errorSmart');
            return false;
        }
    } else if (mode === 'pace') {
        const distanceValue = parseFloat(normalizeInput(document.getElementById('distancePace').value.trim()));
        const timeString = normalizeInput(document.getElementById('timePace').value.trim());
        if (isNaN(distanceValue) || distanceValue <= 0 || !validateTime(timeString)) {
            showError('errorPace');
            return false;
        }
    } else if (mode === 'time') {
        const distanceValue = parseFloat(normalizeInput(document.getElementById('distanceTime').value.trim()));
        const paceString = normalizeInput(document.getElementById('paceTime').value.trim());
        if (isNaN(distanceValue) || distanceValue <= 0 || !validateTime(paceString, false)) {
            showError('errorTime');
            return false;
        }
    } else if (mode === 'distance') {
        const timeString = normalizeInput(document.getElementById('timeDistance').value.trim());
        const paceString = normalizeInput(document.getElementById('paceDistance').value.trim());
        if (!validateTime(timeString) || !validateTime(paceString, false)) {
            showError('errorDistance');
            return false;
        }
    } else if (mode === 'converter') {
        const conversionType = document.getElementById('convType').value;
        const inputString = normalizeInput(document.getElementById('convValue').value.trim());
        if (conversionType === 'distance') {
            const numericValue = parseFloat(inputString);
            if (isNaN(numericValue) || numericValue <= 0) {
                showError('errorConverter');
                return false;
            }
        } else {
            if (!validateTime(inputString, false)) {
                showError('errorConverter');
                return false;
            }
        }
    }
    return true;
}

// Orchestrator Handle
async function handleCalculate(e) {
    if (e) e.preventDefault();

    // Force blur on any active input
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    // Sync sliders TO front inputs before calculation if we are on the back panel
    if (isFlipped()) {
        syncSlidersToFront();
    }

    const mode = document.getElementById('calcMode').value;
    const appLayout = document.querySelector('.app-layout');

    hideAllErrors();

    if (!validateInputsForMode(mode)) {
        return;
    }

    document.querySelectorAll('.success-msg').forEach(msg => msg.style.display = 'none');
    document.querySelectorAll('.copyBtn').forEach(btn => btn.disabled = true);
    document.querySelectorAll('.resetBtn').forEach(btn => btn.disabled = true);

    // Trigger Spinner
    setLoadingState(true);

    // UI Animations Staggering
    await clearOldResults(appLayout);
    resetResultsDisplay();
    await triggerSlideTransition(appLayout);

    // Context Execution via Calculation Layer
    if (mode === 'zone') {
        const timeInput = normalizeInput(document.getElementById('time10k').value.trim());
        const thresholdPace = calculateThresholdPace(timeInput);
        const zones = calculateZones(thresholdPace);
        const races = [
            [5, "5K (3.11 mi)"],
            [10, "10K (6.21 mi)"],
            [21.0975, "Half Marathon (13.11 mi)"],
            [42.195, "Marathon (26.22 mi)"]
        ].map(([distanceInKm, raceName]) => ({
            name: raceName,
            ...estimateRacePace(thresholdPace, distanceInKm)
        }));

        UIState.currentResults = { mode: 'zone', timeInput, thresholdPace, zones, races };

        // Output to specific unique UI elements (Zones isn't natively built on the 2x2 generalized renderer)
        document.getElementById('refTime').innerHTML = `<span class="metric-num">${timeInput}</span>`;
        document.getElementById('refPace').innerHTML = `<span class="metric-num">${secondsToPace(thresholdPace)}</span><span class="metric-unit">/km</span> <span class="metric-sub-value" style="font-size: 13px; margin-top: 2px;"><span class="metric-num">${secondsToPace(thresholdPace * 1.60934)}</span><span class="metric-unit">/mi</span></span>`;

        document.getElementById('zones').innerHTML = zones.map(zone => `
            <div class="zone-card">
                <div class="zone-header">
                    <div>
                        <div class="zone-name">${zone.name}</div>
                        <div class="zone-desc">${zone.description}</div>
                    </div>
                    <div class="zone-pace" style="text-align: right;">
                        <div><span class="metric-num">${zone.lower}</span><span class="metric-unit">/km – </span><span class="metric-num">${zone.upper}</span><span class="metric-unit">/km</span></div>
                        <div class="metric-sub-value" style="font-size: 13px; margin-top: 2px;"><span class="metric-num">${zone.lowerMiles}</span><span class="metric-unit">/mi – </span><span class="metric-num">${zone.upperMiles}</span><span class="metric-unit">/mi</span></div>
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById('races').innerHTML = races.map(racePrediction => {
            return `
                <div class="zone-card race-card">
                    <div>
                        <div class="race-name">${racePrediction.name}</div>
                        <div class="race-time"><span class="metric-num">${secondsToTime(racePrediction.totalSeconds)}</span></div>
                    </div>
                    <div class="race-details">
                        <div class="race-pace" style="text-align: right;">
                            <div><span class="metric-num">${racePrediction.pace}</span><span class="metric-unit">/km</span></div>
                            <div class="metric-sub-value" style="font-size: 12px; margin-top: 1px;"><span class="metric-num">${racePrediction.paceMiles}</span><span class="metric-unit">/mi</span></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('results').style.display = 'block';
        document.getElementById('zoneResults').classList.remove('hidden');

    } else if (mode === 'smart') {
        const val = document.getElementById('smartInput').value.trim();
        const parsed = parseSmartInput(val);
        
        if (parsed.unknownField === 'pace') {
            const payload = calculatePaceMetrics(parsed.distance, parsed.time);
            UIState.currentResults = { mode: 'pace', distance: parsed.distance, distanceLabel: `${parsed.distance} km`, distanceMiles: payload.distanceMiles, paceMinMile: payload.paceMinMile, time: parsed.time, pace: payload.paceString, speedKmH: payload.speedKmH, speedMS: payload.speedMS, speedMpH: payload.speedMpH, splits: payload.splits };
            renderPaceTimeResults(document.getElementById('paceTimeResults'), [
                { label: 'Distance', value: { num: parsed.distance, unit: ' km' }, subValue: { num: payload.distanceMiles, unit: ' mi' } },
                { label: 'Time', value: { num: parsed.time, unit: '' } },
                { label: 'Pace', value: { num: payload.paceString, unit: '/km' }, subValue: { num: payload.paceMinMile, unit: '/mi' } },
                { label: 'Speed', value: { num: payload.speedKmH, unit: ' km/h' }, subValue: [{ num: payload.speedMS, unit: ' m/s' }, { num: payload.speedMpH, unit: ' mph' }] }
            ], payload.splits, 'Pace');
        } else if (parsed.unknownField === 'time') {
            const payload = calculateTimeMetrics(parsed.distance, parsed.pace);
            UIState.currentResults = { mode: 'time', distance: parsed.distance, distanceLabel: `${parsed.distance} km`, distanceMiles: payload.distanceMiles, paceMinMile: payload.paceMinMile, pace: parsed.pace, totalTime: payload.totalTime, speedKmH: payload.speedKmH, speedMS: payload.speedMS, speedMpH: payload.speedMpH, splits: payload.splits };
            renderPaceTimeResults(document.getElementById('paceTimeResults'), [
                { label: 'Distance', value: { num: parsed.distance, unit: ' km' }, subValue: { num: payload.distanceMiles, unit: ' mi' } },
                { label: 'Total Time', value: { num: payload.totalTime, unit: '' } },
                { label: 'Pace', value: { num: parsed.pace, unit: '/km' }, subValue: { num: payload.paceMinMile, unit: '/mi' } },
                { label: 'Speed', value: { num: payload.speedKmH, unit: ' km/h' }, subValue: [{ num: payload.speedMS, unit: ' m/s' }, { num: payload.speedMpH, unit: ' mph' }] }
            ], payload.splits, 'Total Time');
        } else if (parsed.unknownField === 'distance') {
            const payload = calculateDistanceMetrics(parsed.time, parsed.pace);
            UIState.currentResults = { mode: 'distance', time: parsed.time, pace: parsed.pace, distance: payload.distanceValue, distanceLabel: payload.distanceLabel, distanceMiles: payload.distanceMiles, paceMinMile: payload.paceMinMile, speedKmH: payload.speedKmH, speedMS: payload.speedMS, speedMpH: payload.speedMpH, splits: payload.splits };
            renderPaceTimeResults(document.getElementById('paceTimeResults'), [
                { label: 'Distance', value: { num: payload.distanceValue.toFixed(2), unit: ' km' }, subValue: { num: payload.distanceMiles, unit: ' mi' } },
                { label: 'Total Time', value: { num: parsed.time, unit: '' } },
                { label: 'Pace', value: { num: parsed.pace, unit: '/km' }, subValue: { num: payload.paceMinMile, unit: '/mi' } },
                { label: 'Speed', value: { num: payload.speedKmH, unit: ' km/h' }, subValue: [{ num: payload.speedMS, unit: ' m/s' }, { num: payload.speedMpH, unit: ' mph' }] }
            ], payload.splits, 'Distance');
        }
        
        document.getElementById('results').style.display = 'block';

    } else if (mode === 'pace') {
        const distanceString = normalizeInput(document.getElementById('distancePace').value.trim());
        const timeString = normalizeInput(document.getElementById('timePace').value.trim());
        const distanceValue = parseFloat(distanceString);

        const payload = calculatePaceMetrics(distanceValue, timeString);
        UIState.currentResults = { mode: 'pace', distance: distanceValue, distanceLabel: presetDistances[distanceString] || `${distanceValue} km`, distanceMiles: payload.distanceMiles, paceMinMile: payload.paceMinMile, time: timeString, pace: payload.paceString, speedKmH: payload.speedKmH, speedMS: payload.speedMS, speedMpH: payload.speedMpH, splits: payload.splits };

        renderPaceTimeResults(document.getElementById('paceTimeResults'), [
            { label: 'Distance', value: { num: distanceValue, unit: ' km' }, subValue: { num: payload.distanceMiles, unit: ' mi' } },
            { label: 'Time', value: { num: timeString, unit: '' } },
            { label: 'Pace', value: { num: payload.paceString, unit: '/km' }, subValue: { num: payload.paceMinMile, unit: '/mi' } },
            { label: 'Speed', value: { num: payload.speedKmH, unit: ' km/h' }, subValue: [{ num: payload.speedMS, unit: ' m/s' }, { num: payload.speedMpH, unit: ' mph' }] }
        ], payload.splits, 'Pace');

    } else if (mode === 'time') {
        const distanceString = normalizeInput(document.getElementById('distanceTime').value.trim());
        const paceString = normalizeInput(document.getElementById('paceTime').value.trim());
        const distanceValue = parseFloat(distanceString);

        const payload = calculateTimeMetrics(distanceValue, paceString);
        UIState.currentResults = { mode: 'time', distance: distanceValue, distanceLabel: presetDistances[distanceString] || `${distanceValue} km`, distanceMiles: payload.distanceMiles, paceMinMile: payload.paceMinMile, pace: paceString, totalTime: payload.totalTime, speedKmH: payload.speedKmH, speedMS: payload.speedMS, speedMpH: payload.speedMpH, splits: payload.splits };

        renderPaceTimeResults(document.getElementById('paceTimeResults'), [
            { label: 'Distance', value: { num: distanceValue, unit: ' km' }, subValue: { num: payload.distanceMiles, unit: ' mi' } },
            { label: 'Total Time', value: { num: payload.totalTime, unit: '' } },
            { label: 'Pace', value: { num: paceString, unit: '/km' }, subValue: { num: payload.paceMinMile, unit: '/mi' } },
            { label: 'Speed', value: { num: payload.speedKmH, unit: ' km/h' }, subValue: [{ num: payload.speedMS, unit: ' m/s' }, { num: payload.speedMpH, unit: ' mph' }] }
        ], payload.splits, 'Total Time');

    } else if (mode === 'distance') {
        const timeString = normalizeInput(document.getElementById('timeDistance').value.trim());
        const paceString = normalizeInput(document.getElementById('paceDistance').value.trim());

        const payload = calculateDistanceMetrics(timeString, paceString);
        UIState.currentResults = { mode: 'distance', time: timeString, pace: paceString, distance: payload.distanceValue, distanceLabel: payload.distanceLabel, distanceMiles: payload.distanceMiles, paceMinMile: payload.paceMinMile, speedKmH: payload.speedKmH, speedMS: payload.speedMS, speedMpH: payload.speedMpH, splits: payload.splits };

        renderPaceTimeResults(document.getElementById('paceTimeResults'), [
            { label: 'Distance', value: { num: payload.distanceValue.toFixed(2), unit: ' km' }, subValue: { num: payload.distanceMiles, unit: ' mi' } },
            { label: 'Total Time', value: { num: timeString, unit: '' } },
            { label: 'Pace', value: { num: paceString, unit: '/km' }, subValue: { num: payload.paceMinMile, unit: '/mi' } },
            { label: 'Speed', value: { num: payload.speedKmH, unit: ' km/h' }, subValue: [{ num: payload.speedMS, unit: ' m/s' }, { num: payload.speedMpH, unit: ' mph' }] }
        ], payload.splits, 'Distance');

    } else if (mode === 'converter') {
        const conversionType = document.getElementById('convType').value;
        const inputString = normalizeInput(document.getElementById('convValue').value.trim());
        const activeToggle = document.querySelector('.toggle-btn.active');
        const unit = activeToggle ? activeToggle.getAttribute('data-value') : 'km';
        const numericValue = parseFloat(inputString);

        const converterResultsDiv = document.getElementById('converterResults');
        const payload = calculateConverterMetrics(conversionType === 'distance' ? numericValue : inputString, conversionType, unit);

        if (conversionType === 'distance') {
            const resultLabel = unit === 'km' ? `${payload.miles} miles` : `${payload.kilometers} km`;
            const inputLabel = unit === 'km' ? `${numericValue} km` : `${numericValue} miles`;
            UIState.currentResults = { mode: 'converter', type: 'distance', inputLabel, resultLabel };

            converterResultsDiv.innerHTML = `
                <div class="result-grid">
                    <div class="results-section">
                        <div class="section-title">Result</div>
                        <div class="result-card">
                            <div class="result-item">
                                <div class="metric-label">
                                    <svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v4h2V8h2v4h2V8h2v4h2V8h2v8z"/></svg>
                                    Input (${unit === 'km' ? 'Km' : 'Miles'})
                                </div>
                                <div class="metric-value"><span class="metric-num">${numericValue}</span></div>
                            </div>
                        <div class="result-item">
                            <div class="metric-label">
                                 <svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v4h2V8h2v4h2V8h2v4h2V8h2v8z"/></svg>
                                Converted (${unit === 'km' ? 'Miles' : 'Km'})
                            </div>
                            <div class="metric-value"><span class="metric-num">${unit === 'km' ? payload.miles : payload.kilometers}</span></div>
                        </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const inputLabel = `${inputString} /${unit}`;
            const resultLabel = `${payload.resultPace} /${unit === 'km' ? 'mi' : 'km'}`;
            UIState.currentResults = { mode: 'converter', type: 'pace', inputLabel, resultLabel };

            converterResultsDiv.innerHTML = `
                <div class="result-grid">
                    <div class="results-section">
                        <div class="section-title">Result</div>
                        <div class="result-card">
                            <div class="result-item">
                                <div class="metric-label">
                                    <svg class="icon-svg" viewBox="0 0 24 24"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0012 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a8.994 8.994 0 007.03-14.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
                                    Input Pace (/${unit === 'km' ? 'km' : 'mi'})
                                </div>
                                <div class="metric-value"><span class="metric-num">${inputString}</span></div>
                            </div>
                        <div class="result-item">
                            <div class="metric-label">
                                <svg class="icon-svg" viewBox="0 0 24 24"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0012 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a8.994 8.994 0 007.03-14.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
                                Converted Pace (/${unit === 'km' ? 'mi' : 'km'})
                            </div>
                            <div class="metric-value"><span class="metric-num">${payload.resultPace}</span></div>
                        </div>
                        </div>
                    </div>
                </div>
            `;
        }
        document.getElementById('results').style.display = 'block';
        converterResultsDiv.classList.remove('hidden');
    }

    // Trigger Fade-In Response
    setLoadingState(false);
    showResultsGrid(appLayout);
    updateFlipButtonVisibility(mode);

    // Mobile UX: Auto-scroll to results
    if (window.innerWidth <= 640) {
        setTimeout(() => {
            const resultsSection = document.getElementById('results');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300); // Matches transition timings
    }
}

let isAnimatingReset = false;

async function handleReset(e) {
    if (e) e.preventDefault();
    if (isAnimatingReset) return;

    isAnimatingReset = true;

    document.querySelectorAll('.copyBtn').forEach(btn => btn.disabled = true);
    document.querySelectorAll('.resetBtn').forEach(btn => btn.disabled = true);
    document.querySelectorAll('.calculateBtn').forEach(btn => btn.disabled = true);

    const appLayout = document.querySelector('.app-layout');
    const isMobile = window.innerWidth <= 640;

    try {
        // Mobile UX: Scroll back to top FIRST to avoid content jumping
        if (isMobile) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // Wait for scroll to be mostly complete before collapsing results
            await new Promise(r => setTimeout(r, 400));
        }

        // Fade out results first
        if (appLayout && appLayout.classList.contains('results-ready')) {
            await clearOldResults(appLayout);
        }

        // Collapse results container
        resetResultsDisplay();

        // Slide layout back to center
        if (appLayout && appLayout.classList.contains('state-results')) {
            appLayout.classList.remove('state-results');
            // Wait for the slide transition to complete
            await new Promise(r => setTimeout(r, 600));
        }
    } finally {
        isAnimatingReset = false;
        resetUI();
        resetSliders();
        updateFlipButtonVisibility(document.getElementById('calcMode').value);
    }
}

function handleCopy(e) {
    if (e) e.preventDefault();
    if (!UIState.currentResults) return;

    let text = '';
    const currentResults = UIState.currentResults;
    if (currentResults.mode === 'zone') {
        const { timeInput, thresholdPace, zones, races } = currentResults;
        const currentDate = new Date().toLocaleDateString();
        text = `Maratona - ZONE CALCULATOR - ${currentDate}\n\n`;
        text += `10K (6.21 mi) Time: ${timeInput}\n`;
        text += `Threshold Pace: ${secondsToPace(thresholdPace)}/km (${secondsToPace(thresholdPace * 1.60934)}/mi)\n\n`;
        text += `TRAINING ZONES\n`;
        zones.forEach(z => {
            text += `${z.name}: ${z.lower} – ${z.upper}/km (${z.lowerMiles} – ${z.upperMiles}/mi) — ${z.description}\n`;
        });
        text += `\nRACE PREDICTIONS\n`;
        races.forEach(r => {
            text += `${r.name}: ${r.pace}/km (${r.paceMiles}/mi) (${secondsToTime(r.totalSeconds)})\n`;
        });
    } else if (currentResults.mode === 'pace') {
        const { distance, distanceLabel, distanceMiles, time, pace, paceMinMile, splits, speedKmH, speedMS, speedMpH } = currentResults;
        text = `Maratona - PACE CALCULATOR\n\n`;
        text += `Distance: ${distance} km (${distanceMiles} mi)\n`;
        text += `Time: ${time}\n`;
        text += `Pace: ${pace}/km (${paceMinMile}/mi)\n`;
        text += `Speed: ${speedKmH} km/h (${speedMS} m/s | ${speedMpH} mph)\n`;
        if (splits) {
            text += `\nSPLITS\n`;
            splits.forEach(s => {
                // Strip HTML from splits representation
                const strippedKm = s.km.toString().replace(/<[^>]*>?/gm, '');
                const strippedTime = s.time.toString().replace(/<[^>]*>?/gm, '');
                text += `Km ${strippedKm}: ${strippedTime}\n`;
            });
        }
    } else if (currentResults.mode === 'time') {
        const { distanceLabel, distanceMiles, pace, paceMinMile, totalTime, splits, speedKmH, speedMS, speedMpH } = currentResults;
        text = `Maratona - TIME CALCULATOR\n\n`;
        text += `Distance: ${distanceLabel} (${distanceMiles} mi)\n`;
        text += `Total Time: ${totalTime}\n`;
        text += `Pace: ${pace}/km (${paceMinMile}/mi)\n`;
        text += `Speed: ${speedKmH} km/h (${speedMS} m/s | ${speedMpH} mph)\n`;
        if (splits) {
            text += `\nSPLITS\n`;
            splits.forEach(s => {
                const strippedKm = s.km.toString().replace(/<[^>]*>?/gm, '');
                const strippedTime = s.time.toString().replace(/<[^>]*>?/gm, '');
                text += `Km ${strippedKm}: ${strippedTime}\n`;
            });
        }
    } else if (currentResults.mode === 'distance') {
        const { time, pace, paceMinMile, distanceLabel, distanceMiles, splits, speedKmH, speedMS, speedMpH } = currentResults;
        text = `Maratona - DISTANCE CALCULATOR\n\n`;
        text += `Distance: ${distanceLabel} (${distanceMiles} mi)\n`;
        text += `Total Time: ${time}\n`;
        text += `Pace: ${pace}/km (${paceMinMile}/mi)\n`;
        text += `Speed: ${speedKmH} km/h (${speedMS} m/s | ${speedMpH} mph)\n`;
        if (splits) {
            text += `\nSPLITS\n`;
            splits.forEach(s => {
                const strippedKm = s.km.toString().replace(/<[^>]*>?/gm, '');
                const strippedTime = s.time.toString().replace(/<[^>]*>?/gm, '');
                text += `Km ${strippedKm}: ${strippedTime}\n`;
            });
        }
    } else if (currentResults.mode === 'converter') {
        const { type, inputLabel, resultLabel } = currentResults;
        text = `Maratona - CONVERTER\n\n`;
        text += `${type === 'distance' ? 'Distance' : 'Pace'} Conversion\n`;
        text += `${inputLabel} = ${resultLabel}\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
        document.querySelectorAll('.success-msg').forEach(successMsg => {
            successMsg.style.display = 'block';
            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 2500);
        });
    }).catch(err => {
        alert('Failed to copy to clipboard');
    });
}

// ----------------------------------------------------------------------------
// Core Interactions Bootstrapper
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initCustomDropdowns();
    updateDistanceInput(document.getElementById('calcMode').value);
    initSliders();
    updateFlipButtonVisibility(document.getElementById('calcMode').value);

    // Event Attachment Architecture
    document.querySelectorAll('.calculateBtn').forEach(btn => btn.addEventListener('click', handleCalculate));
    document.querySelectorAll('.resetBtn').forEach(btn => btn.addEventListener('click', handleReset));
    document.querySelectorAll('.copyBtn').forEach(btn => btn.addEventListener('click', handleCopy));

    // Smart Input Dynamic Listener
    const smartInput = document.getElementById('smartInput');
    if (smartInput) {
        smartInput.addEventListener('input', function(e) {
            const val = this.value;
            const smartInlineHint = document.getElementById('smartInlineHint');
            
            if (val.trim() === '') {
                smartInlineHint.textContent = 'Hint: Distance';
            } else {
                const commas = (val.match(/,/g) || []).length;
                if (commas === 0) {
                    smartInlineHint.textContent = 'Hint: Distance';
                } else if (commas === 1) {
                    smartInlineHint.textContent = 'Hint: Time';
                } else if (commas === 2) {
                    smartInlineHint.textContent = 'Hint: Pace';
                } else {
                    smartInlineHint.textContent = '';
                }
            }
        });
    }

    // Dropdown Form Triggers
    document.getElementById('calcMode').addEventListener('change', async function () {
        const newMode = this.value;
        const appLayout = document.querySelector('.app-layout');
        const hasResults = appLayout && (appLayout.classList.contains('state-results') || appLayout.classList.contains('results-ready'));

        // Always flip back to front when mode changes
        flipToFront();
        switchCalcMode(newMode, hasResults);
        updateFlipButtonVisibility(newMode);

        if (hasResults) {
            if (isAnimatingReset) return;
            isAnimatingReset = true;

            document.querySelectorAll('.copyBtn').forEach(btn => btn.disabled = true);
            document.querySelectorAll('.resetBtn').forEach(btn => btn.disabled = true);
            enableCalculate();

            if (appLayout.classList.contains('results-ready')) {
                await clearOldResults(appLayout);
            }
            resetResultsDisplay();

            if (appLayout.classList.contains('state-results')) {
                appLayout.classList.remove('state-results');
                await new Promise(r => setTimeout(r, 600));
            }

            isAnimatingReset = false;
            enableCalculate();
        }
    });

    document.getElementById('convType').addEventListener('change', updateConverterLabel);

    document.getElementById('distancePresetPace').addEventListener('change', () => {
        updateDistanceInput('pace');
        enableCalculate();
    });
    document.getElementById('distancePresetTime').addEventListener('change', () => {
        updateDistanceInput('time');
        enableCalculate();
    });

    // Enable Calculate on any input change
    document.querySelectorAll('.input-field, select').forEach(el => {
        el.addEventListener('input', enableCalculate);
        el.addEventListener('change', enableCalculate);

        // Auto-formatting for time fields on blur
        if (el.tagName === 'INPUT' && (el.placeholder.includes(':') || el.id.toLowerCase().includes('time') || el.id.toLowerCase().includes('pace'))) {
            el.addEventListener('blur', function () {
                const originalValue = this.value.trim();
                if (originalValue) {
                    const formattedValue = formatTimeComponent(originalValue);
                    if (formattedValue !== originalValue) {
                        this.value = formattedValue;
                        // Trigger input event to re-validate and enable buttons
                        this.dispatchEvent(new Event('input'));
                    }
                }
            });
        }
    });

    // Toggle Button Logic (Unit Converter)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            this.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            enableCalculate();
        });
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', function (e) {
        // Only ignore R and C if user is typing in an input or textarea
        const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
        const isInputFocus = ['input', 'textarea', 'select'].includes(targetTag);

        if (e.key === 'Enter') {
            const calcBtn = document.querySelectorAll('.calculateBtn')[0];
            if (calcBtn && !calcBtn.disabled) {
                e.preventDefault();

                // Visual feedback on all calculate buttons
                document.querySelectorAll('.calculateBtn').forEach(btn => {
                    btn.classList.add('active-shortcut');
                    setTimeout(() => btn.classList.remove('active-shortcut'), 200);
                });

                handleCalculate(e);
            }
        } else if (e.key && e.key.toLowerCase() === 'r' && !isInputFocus) {
            const resetBtn = document.querySelectorAll('.resetBtn')[0];
            if (resetBtn && !resetBtn.disabled) {
                e.preventDefault();
                // Visual feedback on all reset buttons
                document.querySelectorAll('.resetBtn').forEach(btn => {
                    btn.classList.add('active-shortcut');
                    setTimeout(() => btn.classList.remove('active-shortcut'), 200);
                });

                handleReset(e);
            }
        } else if (e.key && e.key.toLowerCase() === 'c' && !isInputFocus) {
            const copyBtn = document.querySelectorAll('.copyBtn')[0]; // Target one of the copy buttons
            if (copyBtn && !copyBtn.disabled) {
                e.preventDefault();
                // Visual feedback on all copy buttons
                document.querySelectorAll('.copyBtn').forEach(btn => {
                    btn.classList.add('active-shortcut');
                    setTimeout(() => btn.classList.remove('active-shortcut'), 200);
                });

                handleCopy(e);
            }
        } else if (e.key && e.key.toLowerCase() === 'f' && !isInputFocus) {
            // Check if flip is allowed for current mode
            const mode = document.getElementById('calcMode').value;
            if (['pace', 'time', 'distance'].includes(mode)) {
                e.preventDefault();
                if (isFlipped()) {
                    flipToFront();
                } else {
                    flipToBack();
                }
            }
        }
    });
});
