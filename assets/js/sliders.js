/**
 * sliders.js — Flip-Card & Interactive Slider Logic
 *
 * Formula: Distance (km) = Time (minutes) / Pace (min/km)
 *
 * Slider representations:
 *   #sliderDistance → value in km  (0.1 – 100, step 0.1)
 *   #sliderTime     → value in minutes (1 – 1440, step 1)
 *   #sliderPace     → value in seconds/km (120 – 900, step 1)  [i.e., 2:00–15:00 /km]
 */

import { secondsToPace, secondsToTime, parseSmartInput, presetDistances } from './utils.js';
import { calculatePaceMetrics } from './calculators.js';
import { renderPaceTimeResults, showResultsGrid, clearOldResults, triggerSlideTransition, UIState, enableCalculate } from './ui-controller.js';

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Convert a total number of minutes to HH:MM:SS string */
function minutesToTimeString(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    const s = Math.round((totalMinutes % 1) * 60);
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format seconds into MM:SS pace string */
function secondsToPaceStr(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Parse HH:MM:SS or MM:SS time string into total minutes (float) */
function timeStringToMinutes(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    
    // HH:MM:SS -> H*60 + M + S/60
    if (parts.length === 3) return parts[0] * 60 + parts[1] + (parts[2] || 0) / 60;
    // MM:SS -> M + S/60
    if (parts.length === 2) return parts[0] + (parts[1] || 0) / 60;
    // Just M
    if (parts.length === 1) return parts[0];
    return null;
}

/** Parse MM:SS pace string into seconds (float) */
function paceStringToSeconds(str) {
    if (!str) return null;
    const parts = str.split(':').map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) return null;
    return parts[0] * 60 + parts[1];
}

/** Clamp a value between min and max */
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/** Update the CSS fill gradient of a range input */
function updateSliderFill(input) {
    if (!input) return;
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value) || 0;
    const pct = ((val - min) / (max - min)) * 100;
    input.style.backgroundSize = `${pct}% 100%`;
}

// ──────────────────────────────────────────────────────────
// DOM refs
// ──────────────────────────────────────────────────────────

const flipper      = () => document.getElementById('sidebarFlipper');
const btnFlipBack  = () => document.getElementById('btnFlipToBack');
const btnFlipFront = () => document.getElementById('btnFlipToFront');

const sliderDist   = () => document.getElementById('sliderDistance');
const sliderTime   = () => document.getElementById('sliderTime');
const sliderPace   = () => document.getElementById('sliderPace');

const valDist      = () => document.getElementById('valDistance');
const valTime      = () => document.getElementById('valTime');
const valPace      = () => document.getElementById('valPace');

const minDistLabel = () => document.getElementById('minDistanceLabel');
const maxDistLabel = () => document.getElementById('maxDistanceLabel');
const minTimeLabel = () => document.getElementById('minTimeLabel');
const maxTimeLabel = () => document.getElementById('maxTimeLabel');
const minPaceLabel = () => document.getElementById('minPaceLabel');
const maxPaceLabel = () => document.getElementById('maxPaceLabel');

// ──────────────────────────────────────────────────────────
// State helpers
// ──────────────────────────────────────────────────────────

let timeSliderAnchor = null;

/**
 * Read slider values and update the output labels. Returns the
 * current {distKm, timeMins, paceSecs} so callers can react to changes.
 */
function readSliders() {
    return {
        distKm:    parseFloat(sliderDist().value),
        timeMins:  parseFloat(sliderTime().value),
        paceSecs:  parseFloat(sliderPace().value),
    };
}

function updateOutputLabels({ distKm, timeMins, paceSecs }) {
    valDist().textContent = `${distKm.toFixed(1)} km`;
    valTime().textContent = minutesToTimeString(timeMins);
    valPace().textContent = `${secondsToPaceStr(paceSecs)} /km`;
}

function updateBoundsLabels() {
    const sD = sliderDist(), sT = sliderTime(), sP = sliderPace();
    if (sD && minDistLabel() && maxDistLabel()) {
        minDistLabel().textContent = `${parseFloat(sD.min).toFixed(1)} km`;
        maxDistLabel().textContent = `${parseFloat(sD.max).toFixed(1)} km`;
    }
    if (sT && minTimeLabel() && maxTimeLabel()) {
        minTimeLabel().textContent = minutesToTimeString(parseFloat(sT.min));
        maxTimeLabel().textContent = minutesToTimeString(parseFloat(sT.max));
    }
    if (sP && minPaceLabel() && maxPaceLabel()) {
        minPaceLabel().textContent = `${secondsToPaceStr(parseInt(sP.min))} /km`;
        maxPaceLabel().textContent = `${secondsToPaceStr(parseInt(sP.max))} /km`;
    }
}

// ──────────────────────────────────────────────────────────
// Sync: text inputs → sliders (called when flipping to back)
// ──────────────────────────────────────────────────────────

export function syncFrontToSliders() {
    const mode = document.getElementById('calcMode')?.value;
    if (!mode) return;

    // Use current calculation context values if available first
    let distKm = 10, timeMins = 50, paceSecs = 300;

    // Prioritize existing calculation results
    if (UIState.currentResults) {
        if (UIState.currentResults.distance) distKm = parseFloat(UIState.currentResults.distance);
        
        const timeVal = UIState.currentResults.time || UIState.currentResults.totalTime;
        if (timeVal) {
            const parsedTime = timeStringToMinutes(timeVal);
            if (parsedTime !== null) timeMins = parsedTime;
        }

        if (UIState.currentResults.pace) {
            const parsedPace = paceStringToSeconds(UIState.currentResults.pace);
            if (parsedPace !== null) paceSecs = parsedPace;
        }
    } else {
        // Read values from text inputs based on active mode
        if (mode === 'pace') {
            const d = parseFloat(document.getElementById('distancePace')?.value);
            const t = timeStringToMinutes(document.getElementById('timePace')?.value);
            if (!isNaN(d) && d > 0 && t > 0) {
                distKm = d;
                timeMins = t;
                paceSecs = (t * 60) / d;
            }
        } else if (mode === 'time') {
            const d = parseFloat(document.getElementById('distanceTime')?.value);
            const p = paceStringToSeconds(document.getElementById('paceTime')?.value);
            if (!isNaN(d) && d > 0 && p > 0) {
                distKm = d;
                paceSecs = p;
                timeMins = (d * p) / 60;
            }
        } else if (mode === 'distance') {
            const t = timeStringToMinutes(document.getElementById('timeDistance')?.value);
            const p = paceStringToSeconds(document.getElementById('paceDistance')?.value);
            if (t > 0 && p > 0) {
                timeMins = t;
                paceSecs = p;
                distKm = (t * 60) / p;
            }
        } else if (mode === 'smart') {
            const smartVal = document.getElementById('smartInput')?.value.trim();
            if (smartVal) {
                const parsed = parseSmartInput(smartVal);
                // We extract whatever we have, even if incomplete
                if (parsed.distance) distKm = parsed.distance;
                
                if (parsed.time) {
                    const parsedTime = timeStringToMinutes(parsed.time);
                    if (parsedTime !== null) timeMins = parsedTime;
                }
                
                if (parsed.pace) {
                    const parsedPace = paceStringToSeconds(parsed.pace);
                    if (parsedPace !== null) paceSecs = parsedPace;
                }

                // If two are known, compute the third for the sliders
                if (distKm && timeMins && !parsed.pace && parsed.unknownField === 'pace') {
                    paceSecs = (timeMins * 60) / distKm;
                } else if (distKm && paceSecs && !parsed.time && parsed.unknownField === 'time') {
                    timeMins = (distKm * paceSecs) / 60;
                } else if (timeMins && paceSecs && !parsed.distance && parsed.unknownField === 'distance') {
                    distKm = (timeMins * 60) / paceSecs;
                }
            }
        }
    }

    const sD = sliderDist(), sT = sliderTime(), sP = sliderPace();

    // Dynamically adjust the min and max limits based on +-20% of the inserted values
    if (sD) {
        let minD = Math.max(0.1, distKm * 0.8);
        let maxD = distKm * 1.2;
        sD.min = minD.toFixed(1);
        sD.max = maxD.toFixed(1);
        distKm = clamp(distKm, minD, maxD);
        sD.value = distKm.toFixed(1);
    }
    if (sT) {
        let minT = Math.max(1, Math.round(timeMins * 0.8 * 6) / 6);
        let maxT = Math.round(timeMins * 1.2 * 6) / 6;
        sT.min = minT;
        sT.max = maxT;
        timeMins = clamp(timeMins, minT, maxT);
        sT.value = Math.round(timeMins * 60) / 60; // 1s exact precision
        timeSliderAnchor = parseFloat(sT.value);
    }
    if (sP) {
        let minP = Math.max(90, Math.round(paceSecs * 0.8));
        let maxP = Math.round(paceSecs * 1.2);
        sP.min = minP;
        sP.max = maxP;
        paceSecs = clamp(paceSecs, minP, maxP);
        sP.value = Math.round(paceSecs);
    }

    [sD, sT, sP].forEach(updateSliderFill);
    updateOutputLabels({ distKm, timeMins, paceSecs });
    updateBoundsLabels();
}

// ──────────────────────────────────────────────────────────
// Sync: sliders → text inputs (called when flipping back to front)
// ──────────────────────────────────────────────────────────

export function syncSlidersToFront() {
    const { distKm, timeMins, paceSecs } = readSliders();
    const paceStr = secondsToPaceStr(paceSecs);
    const timeStr = minutesToTimeString(timeMins);

    // Write into all three modes' inputs so switching modes works naturally
    document.getElementById('distancePace').value = distKm.toFixed(2);
    document.getElementById('timePace').value      = timeStr;

    document.getElementById('distanceTime').value = distKm.toFixed(2);
    document.getElementById('paceTime').value      = paceStr;

    document.getElementById('timeDistance').value  = timeStr;
    document.getElementById('paceDistance').value  = paceStr;

    // Also update the Smart Input if we are in Smart mode
    const smartInput = document.getElementById('smartInput');
    if (smartInput && UIState.currentResults) {
        // We need to know which field was the unknown one to preserve the '?'
        // UIState.currentResults.mode for 'smart' entries holds the target metric
        let d = distKm.toFixed(2);
        let t = timeStr;
        let p = paceStr;

        if (UIState.currentResults.mode === 'distance') d = '?';
        else if (UIState.currentResults.mode === 'time') t = '?';
        else if (UIState.currentResults.mode === 'pace') p = '?';

        smartInput.value = `${d}, ${t}, ${p}`;
    }
}

// ──────────────────────────────────────────────────────────
// Real-time slider calculation
// ──────────────────────────────────────────────────────────

/** Which slider was last touched — used to decide which value is "fixed" */
let lastTouched = 'pace'; // 'distance' | 'time' | 'pace'
let isSliderInteracted = false;

/**
 * Recompute the "third" variable and update slider + output.
 * Rules:
 *   slide Distance → time fixed, recompute pace
 *   slide Time     → distance fixed, recompute pace
 *   slide Pace     → distance fixed, recompute time
 */
function recomputeSliders(changed) {
    lastTouched = changed;
    isSliderInteracted = true;
    enableCalculate();

    // If the user manually scrubs the Time slider, enforce 10-second granular steps relative to its anchor!
    if (changed === 'time') {
        let sT = sliderTime();
        let val = parseFloat(sT.value);
        if (timeSliderAnchor !== null) {
            let delta = val - timeSliderAnchor;
            let snappedDelta = Math.round(delta * 6) / 6;
            sT.value = timeSliderAnchor + snappedDelta;
        } else {
            timeSliderAnchor = val;
            sT.value = val;
        }
    }

    let { distKm, timeMins, paceSecs } = readSliders();
    const mode = document.getElementById('calcMode')?.value || 'pace';

    // Determine which variable mathematically depends on the others based on selected mode
    let dependentVar = 'pace';
    if (mode === 'pace') dependentVar = 'pace';
    else if (mode === 'time') dependentVar = 'time';
    else if (mode === 'distance') dependentVar = 'distance';

    // If the user drags the dependent variable itself, we must fix one and recompute another
    if (changed === dependentVar) {
        if (dependentVar === 'pace') dependentVar = 'time';
        else if (dependentVar === 'time') dependentVar = 'pace';
        else if (dependentVar === 'distance') dependentVar = 'time'; // fix pace, change time
    }

    if (dependentVar === 'pace') {
        // Recompute pace
        if (distKm > 0) {
            paceSecs = (timeMins * 60) / distKm;
            let sP = sliderPace();
            let minP = parseFloat(sP.min);
            let maxP = parseFloat(sP.max);
            
            // Expand boundaries dynamically instead of clamping
            if (paceSecs < minP) sP.min = Math.floor(paceSecs);
            if (paceSecs > maxP) sP.max = Math.ceil(paceSecs);
            
            sP.value = Math.round(paceSecs);
        }
    } else if (dependentVar === 'time') {
        // Recompute time
        timeMins = (distKm * paceSecs) / 60;
        timeMins = Math.round(timeMins * 60) / 60; // 1-second precision
        let sT = sliderTime();
        let minT = parseFloat(sT.min);
        let maxT = parseFloat(sT.max);
        
        // Expand boundaries dynamically instead of clamping, snapping to 10s grid
        if (timeMins < minT) sT.min = Math.floor(timeMins * 6) / 6;
        if (timeMins > maxT) sT.max = Math.ceil(timeMins * 6) / 6;
        
        sT.value = timeMins; // Programmable value retains 1s precision
        timeSliderAnchor = timeMins;
    } else if (dependentVar === 'distance') {
        // Recompute distance
        if (paceSecs > 0) {
            distKm = (timeMins * 60) / paceSecs;
            let sD = sliderDist();
            let minD = parseFloat(sD.min);
            let maxD = parseFloat(sD.max);
            
            // Expand boundaries dynamically instead of clamping
            if (distKm < minD) sD.min = Math.max(0.1, Math.floor(distKm * 10) / 10).toFixed(1);
            if (distKm > maxD) sD.max = (Math.ceil(distKm * 10) / 10).toFixed(1);
            
            sD.value = distKm.toFixed(2);
        }
    }

    // Process new boundaries and visually refresh the slider fills
    updateBoundsLabels();
    [sliderDist(), sliderTime(), sliderPace()].forEach(updateSliderFill);

    // Update visible labels
    updateOutputLabels({
        distKm:   parseFloat(sliderDist().value),
        timeMins: parseFloat(sliderTime().value),
        paceSecs: parseFloat(sliderPace().value),
    });

    // Removed runSliderCalculation() call from here — 
    // user wants to manually click 'Calculate' to see results.
}

// Trigger live calculation
async function runSliderCalculation() {
    // This is still needed for when internal slider logic wants a preview,
    // but the actual manual calculation is now gated by the button click
    // as per user request.
    const distKm   = parseFloat(sliderDist().value);
    const timeMins = parseFloat(sliderTime().value);
    const timeStr  = minutesToTimeString(timeMins);

    if (!distKm || distKm <= 0) return;

    const appLayout = document.querySelector('.app-layout');

    try {
        const payload = calculatePaceMetrics(distKm, timeStr);

        UIState.currentResults = {
            mode: 'pace',
            distance: distKm,
            distanceLabel: presetDistances[String(distKm)] || `${distKm} km`,
            distanceMiles: payload.distanceMiles,
            paceMinMile: payload.paceMinMile,
            time: timeStr,
            pace: payload.paceString,
            speedKmH: payload.speedKmH,
            speedMS: payload.speedMS,
            speedMpH: payload.speedMpH,
            splits: payload.splits,
        };

        renderPaceTimeResults(document.getElementById('paceTimeResults'), [
            { label: 'Distance', value: { num: distKm.toFixed(2), unit: ' km' }, subValue: { num: payload.distanceMiles, unit: ' mi' } },
            { label: 'Time',     value: { num: timeStr, unit: '' } },
            { label: 'Pace',     value: { num: payload.paceString, unit: '/km' }, subValue: { num: payload.paceMinMile, unit: '/mi' } },
            { label: 'Speed',    value: { num: payload.speedKmH, unit: ' km/h' }, subValue: [{ num: payload.speedMS, unit: ' m/s' }, { num: payload.speedMpH, unit: ' mph' }] },
        ], payload.splits, 'Pace');

        // Expand results panel if not already shown
        if (!appLayout.classList.contains('state-results')) {
            await triggerSlideTransition(appLayout);
        }

        // Make results visible
        document.getElementById('results').style.display = 'block';
        document.getElementById('paceTimeResults').classList.remove('hidden');

        showResultsGrid(appLayout);

        // Enable copy/reset buttons
        document.querySelectorAll('.copyBtn').forEach(btn => btn.disabled = false);
        document.querySelectorAll('.resetBtn').forEach(btn => btn.disabled = false);
        document.querySelectorAll('.calculateBtn').forEach(btn => btn.disabled = true);

    } catch (err) {
        console.warn('[Slider calc error]', err);
    }
}

// ──────────────────────────────────────────────────────────
// Flip toggle
// ──────────────────────────────────────────────────────────

export const isFlipped = () => flipper()?.classList.contains('flipped');

export function flipToBack() {
    if (isFlipped()) return;
    isSliderInteracted = false; // Reset interaction flag when entering sliders
    syncFrontToSliders();
    flipper().classList.add('flipped');
    // If already calculated, run slider calc immediately for live preview
    if (UIState.isCalculated || UIState.currentResults) {
        runSliderCalculation();
    }
}

export function flipToFront() {
    if (!isFlipped()) return;
    
    // Only sync back if the user actually modified something on the sliders side
    if (isSliderInteracted) {
        syncSlidersToFront();
    }
    
    flipper().classList.remove('flipped');
    isSliderInteracted = false;
}

/** Reset sliders to default values and clear interaction state */
export function resetSliders() {
    const distKm = 10;
    const timeMins = 50;
    const paceSecs = 300;

    const sD = sliderDist(), sT = sliderTime(), sP = sliderPace();
    if (sD) {
        sD.min = 0.1;
        sD.max = 100;
        sD.value = distKm.toFixed(1);
    }
    if (sT) {
        sT.min = 1;
        sT.max = 1440;
        sT.value = timeMins;
        timeSliderAnchor = timeMins;
    }
    if (sP) {
        sP.min = 120;
        sP.max = 900;
        sP.value = paceSecs;
    }

    [sD, sT, sP].forEach(updateSliderFill);
    updateOutputLabels({ distKm, timeMins, paceSecs });
    updateBoundsLabels();
    isSliderInteracted = false;
}

// ──────────────────────────────────────────────────────────
// Show/hide the flip button based on calculator mode
// ──────────────────────────────────────────────────────────

export function updateFlipButtonVisibility(mode) {
    const btn = btnFlipBack();
    if (!btn) return;

    const SLIDER_MODES = ['pace', 'time', 'distance', 'smart'];
    if (SLIDER_MODES.includes(mode) && UIState.isCalculated) {
        btn.classList.add('show');
        btn.classList.remove('hidden');
    } else {
        btn.classList.remove('show');
        // Auto-flip back if currently on back for a mode that doesn't support sliders
        flipToFront();
    }
}

// ──────────────────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────────

export function initSliders() {
    // Set initial fill on load
    [sliderDist(), sliderTime(), sliderPace()].forEach(updateSliderFill);

    // Initial output labels
    updateOutputLabels(readSliders());
    updateBoundsLabels();

    // Slider input listeners
    sliderDist().addEventListener('input', () => recomputeSliders('distance'));
    sliderTime().addEventListener('input', () => recomputeSliders('time'));
    sliderPace().addEventListener('input', () => recomputeSliders('pace'));

    // Flip buttons
    btnFlipBack().addEventListener('click', flipToBack);
    btnFlipFront().addEventListener('click', flipToFront);
}
