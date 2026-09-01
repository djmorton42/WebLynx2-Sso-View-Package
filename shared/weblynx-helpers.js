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
 * When the active startAutoUpdate interval config key is present, reschedules the timer.
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

WebLynx.getConfigIntervalMs = function(config, key, fallback) {
  const cfg = config || WebLynx._viewConfig || {};
  let value = Number(cfg[key]);
  if (!Number.isFinite(value) || value <= 0) {
    value = Number((WebLynx._keyValues || {})[key]);
  }
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback != null ? fallback : WebLynx.DEFAULT_UPDATE_INTERVAL_MS;
};

WebLynx.getUpdateIntervalMs = function(config, fallback) {
  return WebLynx.getConfigIntervalMs(config, 'updateInterval', fallback);
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

/** Per-element clock state for rAF interpolation between server syncs. */
WebLynx._raceClockStates = {};

/** Active requestAnimationFrame id for the shared clock loop (null when idle). */
WebLynx._raceClockRafId = null;

/**
 * Parses an API TimeSpan string (HH:MM:SS.fffffff) to milliseconds.
 * @returns {number|null}
 */
WebLynx.parseRaceTimeToMs = function(timeSpanString) {
  if (!timeSpanString) return null;

  const parts = timeSpanString.split(':');
  if (parts.length !== 3) return null;

  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseFloat(parts[2]);
  if (!Number.isFinite(seconds)) return null;

  return Math.round(((hours * 3600) + (minutes * 60) + seconds) * 1000);
};

/**
 * Formats milliseconds as MM:SS.t (matches formatRaceTime tenths display).
 */
WebLynx.formatRaceTimeFromMs = function(totalMs) {
  if (!Number.isFinite(totalMs) || totalMs < 0) return '00:00.0';

  const totalTenths = Math.floor(totalMs / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const hoursComponent = Math.floor(totalSeconds / 3600);
  const minutesComponent = Math.floor((totalSeconds % 3600) / 60);
  const displayMinutes = hoursComponent * 60 + minutesComponent;

  return `${String(displayMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
};

/** Sets textContent only when the value changes (avoids redundant paints). */
WebLynx.setTextIfChanged = function(element, text) {
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
};

WebLynx._ensureRaceClockAnimation = function() {
  if (WebLynx._raceClockRafId != null) return;

  const tick = function(now) {
    WebLynx._raceClockRafId = null;
    let continueAnim = false;

    for (const id of Object.keys(WebLynx._raceClockStates)) {
      const state = WebLynx._raceClockStates[id];
      if (!state.interpolating || !state.element) continue;

      const elapsed = now - state.anchorPerf;
      const text = WebLynx.formatRaceTimeFromMs(state.anchorMs + elapsed);
      WebLynx.setTextIfChanged(state.element, text);
      continueAnim = true;
    }

    if (continueAnim) {
      WebLynx._raceClockRafId = requestAnimationFrame(tick);
    }
  };

  WebLynx._raceClockRafId = requestAnimationFrame(tick);
};

/**
 * Syncs clock anchor from server race-data and runs smooth rAF updates while the race is running.
 *
 * @param {object} data race-data payload
 * @param {string} [clockElementId='race-clock']
 * @param {object} [options]
 * @param {boolean} [options.manageVisibility=true] fade/show logic for broadcast overlays
 */
WebLynx.syncRaceClockFromServer = function(data, clockElementId, options) {
  const id = clockElementId || 'race-clock';
  const opts = options || {};
  const manageVisibility = opts.manageVisibility !== false;
  const clockEl = document.getElementById(id);
  if (!clockEl || !data) return;

  let state = WebLynx._raceClockStates[id];
  if (!state) {
    state = { element: clockEl, anchorMs: 0, anchorPerf: 0, interpolating: false };
    WebLynx._raceClockStates[id] = state;
  }
  state.element = clockEl;

  if (manageVisibility && WebLynx.isRaceArmed(data)) {
    WebLynx._raceClockVisible[id] = false;
    clockEl.classList.remove('visible');
    state.interpolating = false;
    WebLynx.setTextIfChanged(clockEl, WebLynx.formatRaceTime(data.currentTime));
    return;
  }

  const serverMs = WebLynx.parseRaceTimeToMs(data.currentTime);
  const running = WebLynx.isRaceRunning(data.status);
  let visible = true;

  if (manageVisibility) {
    const shouldShow = WebLynx.shouldShowRaceClock(data);
    if (shouldShow !== WebLynx._raceClockVisible[id]) {
      WebLynx._raceClockVisible[id] = shouldShow;
      clockEl.classList.toggle('visible', shouldShow);
    }
    visible = shouldShow;
  }

  if (running && serverMs != null && visible) {
    state.anchorMs = serverMs;
    state.anchorPerf = performance.now();
    state.interpolating = true;
    WebLynx.setTextIfChanged(clockEl, WebLynx.formatRaceTimeFromMs(serverMs));
    WebLynx._ensureRaceClockAnimation();
  } else {
    state.interpolating = false;
    WebLynx.setTextIfChanged(clockEl, WebLynx.formatRaceTime(data.currentTime));
  }
};

WebLynx.updateRaceClockDisplay = function(data, clockElementId) {
  WebLynx.syncRaceClockFromServer(data, clockElementId, { manageVisibility: true });
};

/**
 * Updates a lap-count element with half-lap HTML or plain text as appropriate.
 */
WebLynx.setLapCountElement = function(element, delayedLapsRemaining, raceStatus, halfLapModeEnabled, hasFirstCrossing) {
  if (!element) return;

  const isHalfLap = delayedLapsRemaining !== null &&
    delayedLapsRemaining !== undefined &&
    delayedLapsRemaining % 1 === 0.5 &&
    (raceStatus === 'NotStarted' || raceStatus === 0);

  if (isHalfLap) {
    element.innerHTML = WebLynx.formatLapsDisplayHTML(
      delayedLapsRemaining,
      raceStatus,
      halfLapModeEnabled,
      hasFirstCrossing
    );
    element.classList.add('half-lap');
  } else {
    element.textContent = WebLynx.formatLapsDisplay(
      delayedLapsRemaining,
      raceStatus,
      halfLapModeEnabled,
      hasFirstCrossing
    );
    element.classList.remove('half-lap');
  }
};

/**
 * Keeps container children aligned with an ordered list, updating rows in place.
 * Trailing elements are removed when the list shrinks; new rows are cloned from
 * templateId. Avoids innerHTML clears that force full layout on every poll.
 *
 * @param {HTMLElement} container
 * @param {Array} items ordered list (e.g. active racers)
 * @param {object} options
 * @param {string} [options.templateId='racer-template']
 * @param {string} [options.baseClassName='racer-stack']
 * @param {number} [options.minCountClass=2]
 * @param {number} [options.maxCountClass=10]
 * @param {string} [options.countClassPrefix='racers-']
 * @param {function(HTMLElement, *, object)} options.updateRow (element, item, context)
 * @param {object} [options.context={}]
 */
WebLynx.syncRacerStack = function(container, items, options) {
  if (!container) return;

  const opts = options || {};
  const templateId = opts.templateId || 'racer-template';
  const baseClassName = opts.baseClassName || 'racer-stack';
  const minCountClass = opts.minCountClass != null ? opts.minCountClass : 2;
  const maxCountClass = opts.maxCountClass != null ? opts.maxCountClass : 10;
  const countClassPrefix = opts.countClassPrefix || 'racers-';
  const updateRow = opts.updateRow;
  const context = opts.context || {};
  const count = items.length;

  container.className = baseClassName;
  if (count >= minCountClass && count <= maxCountClass) {
    container.classList.add(countClassPrefix + count);
  }

  while (container.children.length > count) {
    container.removeChild(container.lastChild);
  }

  const template = document.getElementById(templateId);

  for (let i = 0; i < count; i++) {
    let row = container.children[i];
    if (!row) {
      if (template) {
        container.appendChild(template.content.cloneNode(true));
        row = container.children[i];
      } else {
        row = document.createElement('div');
        container.appendChild(row);
      }
    }

    if (typeof updateRow === 'function') {
      updateRow(row, items[i], context);
    }
  }
};

/**
 * Poll by invoking updateFunction on an interval.
 * Starts with the bootstrap interval (default 250ms). After the first successful
 * race-data response, switches to the configured viewConfig interval key from view.properties
 * when that value is present and positive (default key: updateInterval).
 *
 * The next tick is scheduled only after the previous fetch and view callback finish,
 * so fast intervals do not stack overlapping requests (which caused stutter at 100ms).
 *
 * Existing views typically define updateFunction as a zero-arg wrapper that calls
 * WebLynx.updateRaceData(...).
 */
WebLynx.startAutoUpdate = function(
  updateFunction,
  interval = WebLynx.DEFAULT_UPDATE_INTERVAL_MS,
  sortBy = 'place',
  intervalConfigKey = 'updateInterval'
) {
  if (WebLynx._autoUpdate && WebLynx._autoUpdate.timerId != null) {
    clearTimeout(WebLynx._autoUpdate.timerId);
  }

  const state = {
    updateFunction: updateFunction,
    intervalMs: interval || WebLynx.DEFAULT_UPDATE_INTERVAL_MS,
    intervalConfigKey: intervalConfigKey,
    timerId: null
  };

  const scheduleNext = function() {
    state.intervalMs = WebLynx.getConfigIntervalMs(WebLynx._viewConfig, state.intervalConfigKey, state.intervalMs);
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

/** Reschedule the pending tick when the active interval config key changes mid-wait. */
WebLynx._syncAutoUpdateInterval = function() {
  const state = WebLynx._autoUpdate;
  if (!state || typeof state.scheduleNext !== 'function') {
    return;
  }

  const next = WebLynx.getConfigIntervalMs(
    WebLynx._viewConfig,
    state.intervalConfigKey || 'updateInterval',
    state.intervalMs
  );
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
