/**
 * Start list / results board paint. Same heat: fade out → repaint → fade in when
 * the first place data arrives (no hold). Later result polls update in place.
 *
 *   WebLynx.createStartlistResultsBoard({ resolveLaneColor, demoResultsView, demoRacers });
 */
(function (WebLynx) {
  const STARTLIST_TO_RESULTS_FADE_MS = 500;

  function defaultResolveLaneColor(config, racer) {
    return WebLynx.getLaneColor(config, racer.lane);
  }

  function getLaneBracketStroke(color) {
    const hex = String(color || '').trim().replace(/^#/, '');
    if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(hex)) {
      return 'rgba(255, 255, 255, 0.44)';
    }

    const normalized = hex.length === 3
      ? hex.split('').map((ch) => ch + ch).join('')
      : hex;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.62
      ? 'rgba(0, 0, 0, 0.55)'
      : 'rgba(255, 255, 255, 0.44)';
  }

  WebLynx.createStartlistResultsBoard = function (options) {
    options = options || {};
    const resolveLaneColor = typeof options.resolveLaneColor === 'function'
      ? options.resolveLaneColor
      : defaultResolveLaneColor;
    const demoResultsView = !!options.demoResultsView;
    const demoRacers = options.demoRacers || [];
    const templateId = options.templateId || 'result-template';
    const containerId = options.containerId || 'results-container';
    const raceDetailsBarId = options.raceDetailsBarId || 'race-details-bar';
    const badgeSelector = options.badgeSelector || '.unofficial-indicator';
    const sortBy = options.sortBy || 'place';
    const startlistToResultsFadeMs = Number(options.startlistToResultsFadeMs) > 0
      ? Number(options.startlistToResultsFadeMs)
      : STARTLIST_TO_RESULTS_FADE_MS;

    let lastHasPlaces = null;
    let startlistFadeBusy = false;
    let startlistFadeQueued = null;

    function getTemplate() {
      return document.getElementById(templateId);
    }

    function getContainer() {
      return document.getElementById(containerId);
    }

    function applyTimeCell(timeElement, racer, hasPlaces) {
      const hasAlphaCode = racer.hasPlaceData && WebLynx.isAlphaCode(racer.placeText);

      if (hasPlaces && !hasAlphaCode) {
        const timeDisplay = WebLynx.getResultsRowTimeDisplay(racer);
        timeElement.textContent = timeDisplay.text;
        timeElement.classList.toggle('is-time-pending', timeDisplay.pending);
        timeElement.hidden = false;
        return;
      }

      timeElement.textContent = '';
      timeElement.classList.remove('is-time-pending');
      timeElement.hidden = true;
    }

    function applyRowElement(rowEl, racer, hasPlaces, config) {
      rowEl.dataset.lane = String(racer.lane);

      const positionElement = rowEl.querySelector('.position');
      if (racer.hasPlaceData) {
        positionElement.textContent = racer.placeText;
      } else {
        positionElement.textContent = `Lane ${racer.lane}`;
      }

      const laneColor = resolveLaneColor(config, racer);
      rowEl.querySelector('.lane-color').style.backgroundColor = laneColor;
      rowEl.style.setProperty('--lane-color', laneColor);
      rowEl.style.setProperty('--lane-bracket-stroke', getLaneBracketStroke(laneColor));

      applyTimeCell(rowEl.querySelector('.final-time'), racer, hasPlaces);

      const name = racer.name || '-';
      const affiliation = racer.affiliation || '-';
      WebLynx.fitOverlayText(rowEl.querySelector('.racer-name'), name);
      WebLynx.fitOverlayText(rowEl.querySelector('.affiliation'), affiliation, { minScale: 0.68 });
    }

    function createResultRow(racer, hasPlaces, config) {
      const template = getTemplate();
      const clone = template.content.cloneNode(true);
      const rowEl = clone.querySelector('.result-row');
      applyRowElement(rowEl, racer, hasPlaces, config);
      return clone;
    }

    function setBadgeText(unofficialIndicator, text, hidden) {
      if (!unofficialIndicator) {
        return;
      }
      if (hidden) {
        unofficialIndicator.hidden = true;
        return;
      }
      unofficialIndicator.hidden = false;
      unofficialIndicator.textContent = text;
    }

    function applyContainerLayout(container, racerCount, hasPlaces) {
      container.className = 'results-container';
      if (racerCount >= 1 && racerCount <= 10) {
        container.classList.add(`racers-${racerCount}`);
      }
      container.style.setProperty('--racer-count', String(Math.max(racerCount, 1)));
      container.classList.toggle('startlist-mode', !hasPlaces && racerCount > 0);
    }

    function rebuildBoard(container, sortedRacers, hasPlaces, config, unofficialIndicator, badge) {
      container.innerHTML = '';
      applyContainerLayout(container, sortedRacers.length, hasPlaces);
      setBadgeText(unofficialIndicator, badge.text, badge.hidden);
      sortedRacers.forEach(function (racer) {
        container.appendChild(createResultRow(racer, hasPlaces, config));
      });
    }

    function syncRowsInPlace(container, racers, hasPlaces, config) {
      const byLane = new Map();
      container.querySelectorAll('.result-row').forEach(function (row) {
        byLane.set(row.dataset.lane, row);
      });

      racers.forEach(function (racer) {
        const key = String(racer.lane);
        let rowEl = byLane.get(key);
        if (!rowEl) {
          container.appendChild(createResultRow(racer, hasPlaces, config));
          return;
        }
        applyRowElement(rowEl, racer, hasPlaces, config);
        byLane.delete(key);
      });

      byLane.forEach(function (rowEl) {
        rowEl.remove();
      });

      racers.forEach(function (racer) {
        const row = container.querySelector('.result-row[data-lane="' + racer.lane + '"]');
        if (row) {
          container.appendChild(row);
        }
      });
    }

    function rowsMatchRacers(container, racers) {
      const rows = container.querySelectorAll('.result-row');
      if (rows.length === 0 || rows.length !== racers.length) {
        return false;
      }
      const lanes = new Set(racers.map(function (r) { return String(r.lane); }));
      for (let i = 0; i < rows.length; i++) {
        if (!lanes.has(rows[i].dataset.lane)) {
          return false;
        }
      }
      return true;
    }

    function shouldFadeFromStartlist(container, racers, hasPlaces) {
      if (lastHasPlaces !== false || !hasPlaces) {
        return false;
      }
      return rowsMatchRacers(container, racers);
    }

    function canUpdateRowsInPlace(container, racers, hasPlaces) {
      if (lastHasPlaces === null || lastHasPlaces !== hasPlaces) {
        return false;
      }
      return rowsMatchRacers(container, racers);
    }

    function resolveBadge(hasPlaces, racerCount) {
      if (demoResultsView || hasPlaces) {
        return { text: 'Unofficial Results', hidden: racerCount === 0 };
      }
      if (racerCount > 0) {
        return { text: 'Startlist', hidden: false };
      }
      return { text: '', hidden: true };
    }

    function hasDisplayableRace(data) {
      return demoResultsView || !!(data && data.event);
    }

    function getRaceBodyElements() {
      return [
        document.querySelector('.race-details'),
        document.querySelector('.results-section')
      ];
    }

    function setRaceBodyVisible(visible) {
      getRaceBodyElements().forEach(function (el) {
        if (el) {
          el.hidden = !visible;
        }
      });
    }

    function setRaceBodyFaded(faded) {
      getRaceBodyElements().filter(Boolean).forEach(function (el) {
        el.classList.toggle('is-race-faded-out', !!faded);
      });
    }

    function fadeInRaceBody() {
      const els = getRaceBodyElements().filter(Boolean);
      els.forEach(function (el) { el.classList.add('is-race-faded-out'); });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          els.forEach(function (el) { el.classList.remove('is-race-faded-out'); });
        });
      });
    }

    function clearRaceContent() {
      const container = getContainer();
      if (container) {
        container.innerHTML = '';
        container.className = 'results-container';
        container.style.removeProperty('--racer-count');
        container.classList.remove('startlist-mode');
      }

      const bar = document.getElementById(raceDetailsBarId);
      if (bar) {
        bar.textContent = '';
      }

      const unofficialIndicator = document.querySelector(badgeSelector);
      if (unofficialIndicator) {
        unofficialIndicator.hidden = true;
      }

      setRaceBodyFaded(false);
      lastHasPlaces = null;
      startlistFadeBusy = false;
      startlistFadeQueued = null;
    }

    function runStartlistToResultsFade(payload) {
      startlistFadeBusy = true;
      setRaceBodyFaded(true);

      window.setTimeout(function () {
        rebuildBoard(
          payload.container,
          payload.sortedRacers,
          payload.hasPlaces,
          payload.config,
          payload.unofficialIndicator,
          payload.badge
        );
        lastHasPlaces = payload.hasPlaces;

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            setRaceBodyFaded(false);
            startlistFadeBusy = false;
            if (startlistFadeQueued) {
              const queued = startlistFadeQueued;
              startlistFadeQueued = null;
              paintResults(queued);
            }
          });
        });
      }, startlistToResultsFadeMs);
    }

    function paintResults(data) {
      if (!hasDisplayableRace(data)) {
        clearRaceContent();
        setRaceBodyVisible(false);
        return;
      }

      const revealRaceBody = getRaceBodyElements().some(function (el) { return el && el.hidden; });
      setRaceBodyVisible(true);

      const config = WebLynx.applyViewConfig(data);
      const unofficialIndicator = document.querySelector(badgeSelector);
      const container = getContainer();

      let sortedRacers = WebLynx.sortRacersForDisplay(
        data.racers ? WebLynx.getActiveRacers(data.racers) : [],
        sortBy
      );

      if (demoResultsView && sortedRacers.length === 0) {
        sortedRacers = demoRacers;
        document.getElementById(raceDetailsBarId).textContent = 'Demo - Results Preview';
      } else if (data.event) {
        const eventName = data.event.eventName || 'Race Event';
        const eventNumber = data.event.eventNumber || '';
        document.getElementById(raceDetailsBarId).textContent = eventNumber
          ? `${eventNumber} - ${eventName}`
          : eventName;
      }

      const hasPlaces = sortedRacers.some(function (racer) { return racer.hasPlaceData; });
      const badge = resolveBadge(hasPlaces, sortedRacers.length);

      if (shouldFadeFromStartlist(container, sortedRacers, hasPlaces)) {
        const payload = {
          container: container,
          sortedRacers: sortedRacers,
          hasPlaces: hasPlaces,
          config: config,
          unofficialIndicator: unofficialIndicator,
          badge: badge
        };
        if (startlistFadeBusy) {
          startlistFadeQueued = data;
          return;
        }
        runStartlistToResultsFade(payload);
        return;
      }

      if (canUpdateRowsInPlace(container, sortedRacers, hasPlaces)) {
        syncRowsInPlace(container, sortedRacers, hasPlaces, config);
        applyContainerLayout(container, sortedRacers.length, hasPlaces);
        setBadgeText(unofficialIndicator, badge.text, badge.hidden);
      } else {
        rebuildBoard(container, sortedRacers, hasPlaces, config, unofficialIndicator, badge);
      }

      lastHasPlaces = hasPlaces;

      if (revealRaceBody) {
        fadeInRaceBody();
      }
    }

    return {
      paintResults: paintResults,
      clearRaceContent: clearRaceContent,
      getRaceBodyElements: getRaceBodyElements,
      fadeInRaceBody: fadeInRaceBody,
      resetMorphState: function () {
        lastHasPlaces = null;
        startlistFadeBusy = false;
        startlistFadeQueued = null;
      }
    };
  };
})(window.WebLynx);
