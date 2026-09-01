/**
 * WebLynx Shared Helper Functions
 *
 * Views read live race data from GET /api/race/race-data. Configuration comes from
 * data.viewConfig (nested) and data.keyValues (flat), published from view.properties
 * and the Event Title / Subtitle UI — not from server-injected VIEW_CONFIG.
 *
 * Usage:
 *   <script src="/views/shared/weblynx-helpers.js"></script>
 *   WebLynx.formatTime(data.currentTime);
 */

window.WebLynx = window.WebLynx || {};

/** Last viewConfig applied from a race-data response (used by finishedText helpers). */
WebLynx._viewConfig = {};

/** Last flat keyValues from a race-data response (fallback for updateInterval). */
WebLynx._keyValues = {};

/** Active auto-update timer state (interval adopts viewConfig.updateInterval). */
WebLynx._autoUpdate = null;

/** Bootstrap poll interval until viewConfig.updateInterval is available. */
WebLynx.DEFAULT_UPDATE_INTERVAL_MS = 250;

/**
 * Remember and return nested viewConfig from a race-data payload.
 * When updateInterval is present, reschedules any active startAutoUpdate timer.
 * @param {object|null} data
 * @returns {object}
 */
WebLynx.applyViewConfig = function(data) {
  if (data && data.keyValues && typeof data.keyValues === 'object') {
    WebLynx._keyValues = data.keyValues;
  }
  if (data && data.viewConfig && typeof data.viewConfig === 'object') {
    WebLynx._viewConfig = data.viewConfig;
  }
  WebLynx._syncAutoUpdateInterval();
  return WebLynx._viewConfig || {};
};

/**
 * @param {object|null} data optional race-data; falls back to last applied config
 * @returns {object}
 */
WebLynx.getViewConfig = function(data) {
  if (data && data.viewConfig) {
    return data.viewConfig;
  }
  return WebLynx._viewConfig || {};
};

WebLynx.getUpdateIntervalMs = function(config, fallback) {
  const cfg = config || WebLynx._viewConfig || {};
  let value = Number(cfg.updateInterval);
  if (!Number.isFinite(value) || value <= 0) {
    value = Number((WebLynx._keyValues || {}).updateInterval);
  }
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback != null ? fallback : WebLynx.DEFAULT_UPDATE_INTERVAL_MS;
};

WebLynx.getLaneColor = function(config, lane) {
  const cfg = config || WebLynx._viewConfig || {};
  return (cfg.laneColors && (cfg.laneColors[lane] ?? cfg.laneColors[String(lane)]))
    || cfg.defaultLaneColor
    || '#333333';
};

WebLynx.getStrokeColor = function(config, lane) {
  const cfg = config || WebLynx._viewConfig || {};
  return (cfg.laneStrokeColors && (cfg.laneStrokeColors[lane] ?? cfg.laneStrokeColors[String(lane)]))
    || cfg.defaultLaneStrokeColor
    || cfg.defaultStrokeColor
    || '#ffffff';
};

WebLynx.getFinishedText = function(config) {
  const cfg = config || WebLynx._viewConfig || {};
  return cfg.finishedText != null && cfg.finishedText !== '' ? cfg.finishedText : '-';
};

/**
 * Fill meet title / subtitle elements from viewConfig (Event Title / Subtitle UI).
 */
WebLynx.applyMeetIdentity = function(data, titleElementId, subtitleElementId) {
  const config = WebLynx.applyViewConfig(data);
  const titleEl = document.getElementById(titleElementId || 'meet-title');
  const subtitleEl = document.getElementById(subtitleElementId || 'event-subtitle');
  if (titleEl) {
    titleEl.textContent = config.meetTitle || '';
  }
  if (subtitleEl) {
    subtitleEl.textContent = config.eventSubtitle || '';
  }
  return config;
};

/**
 * Relay overlays: map a color name found in the racer name to a lane color.
 */
WebLynx.getLaneColorFromRacerName = function(config, racerName) {
  const cfg = config || WebLynx._viewConfig || {};
  const colorName = WebLynx.extractColorNameFromRacerName(cfg, racerName);
  if (!colorName) {
    return cfg.defaultLaneColor || '#333333';
  }

  const laneColorNames = cfg.laneColorNames || {};
  for (const [laneIndex, configuredColorName] of Object.entries(laneColorNames)) {
    if (String(configuredColorName).toUpperCase() === colorName) {
      return (cfg.laneColors && cfg.laneColors[laneIndex]) || cfg.defaultLaneColor || '#333333';
    }
  }

  return cfg.defaultLaneColor || '#333333';
};

WebLynx.extractColorNameFromRacerName = function(config, racerName) {
  if (!racerName) {
    return null;
  }

  const nameUpper = racerName.toUpperCase();
  const teamMatch = nameUpper.match(/TEAM\s+([A-Z\s]+)/);
  if (teamMatch) {
    return teamMatch[1].trim();
  }

  const laneColorNames = (config || {}).laneColorNames || {};
  const colorNames = Object.values(laneColorNames).map(name => String(name).toUpperCase());

  let bestMatch = null;
  let bestMatchLength = 0;
  for (const colorName of colorNames) {
    if (nameUpper.includes(colorName) && colorName.length > bestMatchLength) {
      bestMatch = colorName;
      bestMatchLength = colorName.length;
    }
  }
  return bestMatch;
};

/**
 * Time Formatting Functions
 */

WebLynx.formatTime = function(timeSpanString) {
  if (!timeSpanString) return '00:00.000';

  const parts = timeSpanString.split(':');
  if (parts.length !== 3) return '00:00.000';

  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const secondsParts = parts[2].split('.');
  const seconds = parseInt(secondsParts[0]) || 0;

  let milliseconds = 0;
  if (secondsParts[1]) {
    const fractionalPart = secondsParts[1].padEnd(7, '0');
    milliseconds = Math.floor(parseInt(fractionalPart.substring(0, 3)) || 0);
  }

  const totalMinutes = hours * 60 + minutes;
  const formattedMinutes = totalMinutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');
  const formattedMilliseconds = milliseconds.toString().padStart(3, '0');

  return `${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
};

WebLynx.formatRaceTime = function(timeSpanString) {
  if (!timeSpanString) return '00:00.0';

  const parts = timeSpanString.split(':');
  if (parts.length !== 3) return '00:00.0';

  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const secondsParts = parts[2].split('.');
  const seconds = parseInt(secondsParts[0]) || 0;

  let tenths = 0;
  if (secondsParts[1]) {
    const fractionalPart = secondsParts[1].padEnd(7, '0');
    tenths = Math.floor(parseInt(fractionalPart.substring(0, 1)) || 0);
  }

  const totalMinutes = hours * 60 + minutes;
  const formattedMinutes = totalMinutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');

  return `${formattedMinutes}:${formattedSeconds}.${tenths}`;
};

/**
 * Lap Display Functions
 */

WebLynx.formatLapsDisplay = function(lapsRemaining, raceStatus, halfLapModeEnabled, hasFirstCrossing) {
  if (lapsRemaining === null || lapsRemaining === undefined) {
    return '-';
  }

  let displayValue = lapsRemaining;
  const finishedText = WebLynx.getFinishedText();

  if (halfLapModeEnabled) {
    if (raceStatus === 'NotStarted' || raceStatus === 0) {
      displayValue = lapsRemaining;
    } else if (lapsRemaining % 1 === 0.5) {
      displayValue = Math.floor(lapsRemaining);
    } else {
      displayValue = lapsRemaining - 1;
      if (displayValue < 0) {
        return finishedText;
      }
    }
  } else {
    displayValue = lapsRemaining - 1;
    if (displayValue < 0) {
      return finishedText;
    }
  }

  if (raceStatus === 'Running' || raceStatus === 'Paused' || raceStatus === 'Finished' ||
      raceStatus === 1 || raceStatus === 2 || raceStatus === 3) {
    return Math.floor(displayValue).toString();
  }

  if (displayValue % 1 === 0.5) {
    const wholePart = Math.floor(displayValue);
    return wholePart + ' 1/2';
  }

  return displayValue.toString();
};

WebLynx.formatLapsDisplayHTML = function(lapsRemaining, raceStatus, halfLapModeEnabled, hasFirstCrossing) {
  if (lapsRemaining === null || lapsRemaining === undefined) {
    return '-';
  }

  let displayValue = lapsRemaining;
  const finishedText = WebLynx.getFinishedText();

  if (halfLapModeEnabled) {
    if (raceStatus === 'NotStarted' || raceStatus === 0) {
      displayValue = lapsRemaining;
    } else if (lapsRemaining % 1 === 0.5) {
      displayValue = Math.floor(lapsRemaining);
    } else {
      displayValue = lapsRemaining - 1;
      if (displayValue < 0) {
        return finishedText;
      }
    }
  } else {
    displayValue = lapsRemaining - 1;
    if (displayValue < 0) {
      return finishedText;
    }
  }

  if (raceStatus === 'Running' || raceStatus === 'Paused' || raceStatus === 'Finished' ||
      raceStatus === 1 || raceStatus === 2 || raceStatus === 3) {
    return Math.floor(displayValue).toString();
  }

  if (displayValue % 1 === 0.5) {
    const wholePart = Math.floor(displayValue);
    return `${wholePart}<span class="half-lap-fraction">1/2</span>`;
  }

  return displayValue.toString();
};

/**
 * Race Data Functions
 */

/** True while a race-data fetch (and view callback) is in progress. */
WebLynx._raceDataInFlight = false;

WebLynx.fetchRaceData = function(sortBy = 'place') {
  return fetch(`/api/race/race-data?sortBy=${sortBy}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    });
};

WebLynx.updateRaceData = function(callback, sortBy = 'place') {
  if (WebLynx._raceDataInFlight) {
    return;
  }

  WebLynx._raceDataInFlight = true;
  WebLynx.fetchRaceData(sortBy)
    .then(data => {
      WebLynx.applyViewConfig(data);
      callback(data);
    })
    .catch(error => {
      console.error('Error fetching race data:', error);
      callback(null, error);
    })
    .finally(function() {
      WebLynx._raceDataInFlight = false;
      WebLynx._scheduleAutoUpdateTick();
    });
};

WebLynx.getStatusInfo = function(raceStatus) {
  const statusMap = {
    'NotStarted': { text: 'Ready', class: 'notstarted' },
    'Running': { text: 'Running', class: 'running' },
    'Paused': { text: 'Paused', class: 'paused' },
    'Finished': { text: 'Finished', class: 'finished' },
    '0': { text: 'Ready', class: 'notstarted' },
    '1': { text: 'Running', class: 'running' },
    '2': { text: 'Paused', class: 'paused' },
    '3': { text: 'Finished', class: 'finished' }
  };

  return statusMap[raceStatus] || { text: raceStatus || 'Unknown', class: 'notstarted' };
};

WebLynx.isRaceRunning = function(raceStatus) {
  return raceStatus === 'Running' || raceStatus === 1;
};

WebLynx.isAlphaCode = function(placeText) {
  if (!placeText || placeText.trim() === '') {
    return false;
  }
  return isNaN(parseInt(placeText.trim()));
};

WebLynx.getActiveRacers = function(racers) {
  return racers.filter(racer => racer.lane > 0);
};

/**
 * Race clock fade in/out (hidden at 0:00 on start list, fades in when running, fades out
 * when all racers report 0 laps remaining — no fade-out if lap data is unavailable).
 */
WebLynx._raceClockVisible = {};

WebLynx.isClockAtZero = function(currentTime) {
  if (!currentTime) return true;

  const parts = currentTime.split(':');
  if (parts.length !== 3) return true;

  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseFloat(parts[2]) || 0;

  return hours === 0 && minutes === 0 && seconds === 0;
};

WebLynx.isRaceArmed = function(data) {
  const notStarted = data.status === 'NotStarted' || data.status === 0;
  return notStarted || WebLynx.isClockAtZero(data.currentTime);
};

WebLynx.allRacersHaveNoLapsRemaining = function(racers) {
  const activeRacers = WebLynx.getActiveRacers(racers);
  if (activeRacers.length === 0) return false;

  return activeRacers.every(racer => {
    const laps = racer.lapsRemaining;
    if (laps === null || laps === undefined) return false;
    return laps <= 0;
  });
};

WebLynx.shouldShowRaceClock = function(data) {
  if (!WebLynx.isRaceRunning(data.status)) return false;
  if (WebLynx.isClockAtZero(data.currentTime)) return false;
  if (WebLynx.allRacersHaveNoLapsRemaining(data.racers)) return false;
  return true;
};

WebLynx.updateRaceClockDisplay = function(data, clockElementId) {
  const id = clockElementId || 'race-clock';
  const clockEl = document.getElementById(id);
  if (!clockEl) return;

  if (WebLynx.isRaceArmed(data)) {
    WebLynx._raceClockVisible[id] = false;
    clockEl.classList.remove('visible');
  }

  clockEl.textContent = WebLynx.formatRaceTime(data.currentTime);

  const shouldShow = WebLynx.shouldShowRaceClock(data);
  if (shouldShow === WebLynx._raceClockVisible[id]) return;

  WebLynx._raceClockVisible[id] = shouldShow;
  clockEl.classList.toggle('visible', shouldShow);
};

/**
 * Poll by invoking updateFunction on an interval.
 * Starts with the bootstrap interval (default 250ms). After the first successful
 * race-data response, switches to data.viewConfig.updateInterval from view.properties
 * when that value is present and positive.
 *
 * The next tick is scheduled only after the previous fetch and view callback finish,
 * so fast intervals do not stack overlapping requests (which caused stutter at 100ms).
 *
 * Existing views typically define updateFunction as a zero-arg wrapper that calls
 * WebLynx.updateRaceData(...).
 */
WebLynx.startAutoUpdate = function(updateFunction, interval = WebLynx.DEFAULT_UPDATE_INTERVAL_MS, sortBy = 'place') {
  if (WebLynx._autoUpdate && WebLynx._autoUpdate.timerId != null) {
    clearTimeout(WebLynx._autoUpdate.timerId);
  }

  const state = {
    updateFunction: updateFunction,
    intervalMs: interval || WebLynx.DEFAULT_UPDATE_INTERVAL_MS,
    timerId: null
  };

  const scheduleNext = function() {
    state.intervalMs = WebLynx.getUpdateIntervalMs(WebLynx._viewConfig, state.intervalMs);
    state.timerId = setTimeout(function() {
      state.timerId = null;
      state.updateFunction();
    }, state.intervalMs);
  };

  state.scheduleNext = scheduleNext;
  WebLynx._autoUpdate = state;

  // Initial load; further ticks are scheduled when updateRaceData finishes.
  state.updateFunction();

  return state.timerId;
};

/** Called from updateRaceData.finally to queue the next poll. */
WebLynx._scheduleAutoUpdateTick = function() {
  const state = WebLynx._autoUpdate;
  if (!state || typeof state.scheduleNext !== 'function') {
    return;
  }
  if (state.timerId != null) {
    return;
  }
  state.scheduleNext();
};

/** Reschedule the pending tick when viewConfig.updateInterval changes mid-wait. */
WebLynx._syncAutoUpdateInterval = function() {
  const state = WebLynx._autoUpdate;
  if (!state || typeof state.scheduleNext !== 'function') {
    return;
  }

  const next = WebLynx.getUpdateIntervalMs(WebLynx._viewConfig, state.intervalMs);
  if (next === state.intervalMs) {
    return;
  }

  state.intervalMs = next;
  if (state.timerId != null) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
  state.scheduleNext();
};
