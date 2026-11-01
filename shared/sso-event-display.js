/**
 * SSO-specific FinishLynx event title formatting (not used by stock WebLynx2 views).
 *
 * Trailing "(n + m)" on eventName is shown on a second line as "Advancement (n + m)".
 */
(function () {
  var ADVANCEMENT_SUFFIX = /\s*\((\d+(?:\s*\+\s*\d+)+)\)\s*$/;

  function splitAdvancement(eventName) {
    var raw = eventName == null ? '' : String(eventName);
    var match = raw.match(ADVANCEMENT_SUFFIX);
    if (!match) {
      return { baseName: raw.trim(), advancement: null };
    }
    return {
      baseName: raw.replace(ADVANCEMENT_SUFFIX, '').trim(),
      advancement: match[1].replace(/\s+/g, ' ').trim()
    };
  }

  function formatEventHeading(eventNumber, eventName, fallbackTitle) {
    var split = splitAdvancement(eventName);
    var title = split.baseName || fallbackTitle || '';
    var line1 = eventNumber ? String(eventNumber) + ' - ' + title : title;
    if (!split.advancement) {
      return line1;
    }
    return line1 + '\nAdvancement (' + split.advancement + ')';
  }

  function applyEventHeading(element, eventNumber, eventName, fallbackTitle) {
    if (!element) {
      return;
    }
    element.textContent = formatEventHeading(eventNumber, eventName, fallbackTitle);
  }

  window.SsoEventDisplay = {
    splitAdvancement: splitAdvancement,
    formatEventHeading: formatEventHeading,
    applyEventHeading: applyEventHeading
  };
})();
