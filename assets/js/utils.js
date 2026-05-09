export const presetDistances = {
    '5': '5K',
    '10': '10K',
    '21.0975': 'Half Marathon',
    '42.195': 'Marathon'
};

export function normalizeInput(str) {
    return str.replace(',', '.');
}

export function validateTime(timeStr, allowHours = true) {
    if (!timeStr || typeof timeStr !== 'string') return false;

    // Ensure the string only contains digits and colons
    if (!/^[\d:]+$/.test(timeStr)) return false;

    const parts = timeStr.split(':');
    if (!allowHours && parts.length !== 2) return false;
    if (allowHours && (parts.length !== 2 && parts.length !== 3)) return false;

    // Every part must have at least 1 digit.
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].length === 0) return false;
    }

    try {
        if (parts.length === 2) {
            const [mm, ss] = parts.map(Number);
            return !isNaN(mm) && !isNaN(ss) && ss < 60 && mm >= 0 && ss >= 0;
        } else {
            const [hh, mm, ss] = parts.map(Number);
            return !isNaN(hh) && !isNaN(mm) && !isNaN(ss) && ss < 60 && mm < 60 && hh >= 0 && mm >= 0 && ss >= 0;
        }
    } catch {
        return false;
    }
}

export function timeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
}

export function secondsToPace(seconds) {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function secondsToTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (seconds >= 3600) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

export function formatTimeComponent(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return timeStr;

    // Only process if it contains colons and digits
    if (!/^[\d:]+$/.test(timeStr)) return timeStr;

    const parts = timeStr.split(':');
    // We only format if it has 2 or 3 parts (MM:SS or HH:MM:SS)
    if (parts.length < 2 || parts.length > 3) return timeStr;

    const formattedParts = parts.map(part => {
        // Pad single digits with leading zero
        if (part.length === 1 && /^\d$/.test(part)) {
            return `0${part}`;
        }
        return part;
    });

    return formattedParts.join(':');
}

export function parseSmartInput(inputString) {
    if (!inputString || typeof inputString !== 'string') return { status: 'incomplete' };
    
    // Normalize input
    const normalized = inputString.replace(/;/g, ',').replace(/[^\d:,.\s?]/g, '');
    
    const parts = normalized.split(',').map(p => p.trim());
    if (parts.length === 0) return { status: 'incomplete' };

    // Identify what we have based on indices
    const distancePart = parts[0];
    const timePart = parts.length > 1 ? parts[1] : undefined;
    const pacePart = parts.length > 2 ? parts[2] : undefined;
    
    let unknownCount = 0;
    let unknownField = null;
    
    const fields = [
        { name: 'distance', val: distancePart },
        { name: 'time', val: timePart },
        { name: 'pace', val: pacePart }
    ];
    
    let distance = null;
    let time = null;
    let pace = null;

    for (const field of fields) {
        if (field.val === '?') {
            unknownCount++;
            unknownField = field.name;
        } else if (field.val && field.val !== '') {
            if (field.name === 'distance') {
                distance = parseFloat(field.val.replace(',', '.'));
            } else if (field.name === 'time') {
                time = formatTimeComponent(field.val);
            } else if (field.name === 'pace') {
                pace = formatTimeComponent(field.val);
            }
        }
    }

    if (parts.length < 3) return { status: 'incomplete', partsCount: parts.length };
    
    if (unknownCount !== 1) return { status: 'invalid', message: 'Exactly one question mark (?) is required' };
    
    // Validate known fields
    if (unknownField === 'distance') {
        if (!validateTime(time) || !validateTime(pace, false)) return { status: 'invalid' };
    } else if (unknownField === 'time') {
        if (isNaN(distance) || distance <= 0 || !validateTime(pace, false)) return { status: 'invalid' };
    } else if (unknownField === 'pace') {
        if (isNaN(distance) || distance <= 0 || !validateTime(time)) return { status: 'invalid' };
    }

    return {
        status: 'complete',
        unknownField,
        distance,
        time,
        pace
    };
}
