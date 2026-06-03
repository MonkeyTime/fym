(function() {
  'use strict';

  var ALERTS_KEY = 'alerts';
  var LEGACY_MIGRATION_KEY = 'legacyIndexedDbMigrated';
  var LEGACY_DB_NAME = 'fym-db';
  var LEGACY_DB_VERSION = 1;
  var LEGACY_STORE_NAME = 'alerts';
  var legacyMigrationCallbacks = [];
  var legacyMigrationRunning = false;
  var captureInProgress = false;
  var captureCallbacks = [];
  var d = document;

  function $(id) {
    return d.getElementById(id);
  }

  function message(id, fallback) {
    var translated = chrome.i18n.getMessage(id);
    return translated || fallback || id;
  }

  function applyLocale() {
    var language = chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : 'en';
    var rtlLanguages = ['ar', 'fa', 'he', 'iw', 'ur'];
    var baseLanguage = language.split('-')[0].split('_')[0];

    d.documentElement.lang = language.replace('_', '-');
    d.documentElement.dir = rtlLanguages.indexOf(baseLanguage) === -1 ? 'ltr' : 'rtl';
  }

  function getAlerts(callback) {
    migrateLegacyAlerts(function() {
      chrome.storage.local.get({ [ALERTS_KEY]: [] }, function(result) {
        callback(Array.isArray(result[ALERTS_KEY]) ? result[ALERTS_KEY] : []);
      });
    });
  }

  function saveAlerts(alerts, callback) {
    chrome.storage.local.set({ [ALERTS_KEY]: alerts }, callback || function() {});
  }

  function migrateLegacyAlerts(callback) {
    legacyMigrationCallbacks.push(callback);

    if (legacyMigrationRunning) {
      return;
    }

    legacyMigrationRunning = true;

    chrome.storage.local.get({ [LEGACY_MIGRATION_KEY]: false, [ALERTS_KEY]: [] }, function(result) {
      if (result[LEGACY_MIGRATION_KEY] || typeof indexedDB === 'undefined') {
        finishLegacyMigration();
        return;
      }

      readLegacyIndexedDb(function(legacyAlerts) {
        var currentAlerts = Array.isArray(result[ALERTS_KEY]) ? result[ALERTS_KEY] : [];
        var mergedAlerts = mergeAlerts(currentAlerts, legacyAlerts);

        chrome.storage.local.set({
          [ALERTS_KEY]: mergedAlerts,
          [LEGACY_MIGRATION_KEY]: true
        }, finishLegacyMigration);
      });
    });
  }

  function finishLegacyMigration() {
    var callbacks = legacyMigrationCallbacks.slice();

    legacyMigrationCallbacks = [];
    legacyMigrationRunning = false;
    callbacks.forEach(function(callback) {
      callback();
    });
  }

  function readLegacyIndexedDb(callback) {
    var legacyAlerts = [];
    var request = indexedDB.open(LEGACY_DB_NAME, LEGACY_DB_VERSION);

    request.onerror = function() {
      callback([]);
    };

    request.onupgradeneeded = function(event) {
      var database = event.target.result;

      if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        database.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = function(event) {
      var database = event.target.result;
      var transaction;
      var store;
      var cursorRequest;

      if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        database.close();
        callback([]);
        return;
      }

      transaction = database.transaction(LEGACY_STORE_NAME, 'readonly');
      store = transaction.objectStore(LEGACY_STORE_NAME);
      cursorRequest = store.openCursor();

      cursorRequest.onsuccess = function(cursorEvent) {
        var cursor = cursorEvent.target.result;
        var normalized;

        if (!cursor) {
          return;
        }

        normalized = normalizeLegacyAlert(cursor.value);

        if (normalized) {
          legacyAlerts.push(normalized);
        }

        cursor.continue();
      };

      transaction.oncomplete = function() {
        database.close();
        callback(legacyAlerts);
      };

      transaction.onerror = function() {
        database.close();
        callback([]);
      };
    };
  }

  function normalizeLegacyAlert(value) {
    var alarmTime = value && value.alarm ? new Date(value.alarm).getTime() : NaN;

    if (!value || !value.url || !Number.isFinite(alarmTime)) {
      return null;
    }

    return {
      id: 'legacy-' + String(value.id || alarmTime),
      url: value.url,
      title: value.title || value.url,
      lang: value.lang || '',
      date: normalizeLegacyValue(value.date),
      countdown: normalizeLegacyValue(value.countdown),
      preview: normalizeLegacyPreview(value.preview),
      alarm: new Date(alarmTime).toISOString()
    };
  }

  function normalizeLegacyValue(value) {
    return value && value !== 'undefined' ? String(value) : '';
  }

  function normalizeLegacyPreview(preview) {
    if (!preview || preview === 'undefined') {
      return '';
    }

    if (String(preview).indexOf('data:image/') === 0) {
      return preview;
    }

    return 'data:image/jpeg;base64,' + preview;
  }

  function mergeAlerts(currentAlerts, legacyAlerts) {
    var seen = {};
    var merged = [];

    currentAlerts.concat(legacyAlerts).forEach(function(alert) {
      var signature = [alert.url, alert.title, alert.alarm].join('|');

      if (!seen[signature]) {
        seen[signature] = true;
        merged.push(alert);
      }
    });

    return merged;
  }

  function addPublication(url, title, lang, date, countdown, preview, alarm, callback) {
    getAlerts(function(alerts) {
      alerts.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        url: url,
        title: title,
        lang: lang || '',
        date: date || '',
        countdown: countdown || '',
        preview: preview || '',
        alarm: alarm
      });

      saveAlerts(alerts, callback);
    });
  }

  function deletePublication(id, callback) {
    getAlerts(function(alerts) {
      var remaining = alerts.filter(function(alert) {
        return alert.id !== id;
      });

      saveAlerts(remaining, callback);
    });
  }

  function renderAllPublication() {
    var items = $('items');

    if (!items) {
      return;
    }

    getAlerts(function(alerts) {
      items.textContent = '';

      alerts
        .slice()
        .sort(function(a, b) {
          return new Date(a.alarm).getTime() - new Date(b.alarm).getTime();
        })
        .forEach(function(alert) {
          items.appendChild(createAlertRow(alert));
        });
    });
  }

  function createAlertRow(alert) {
    var tr = d.createElement('tr');
    tr.id = 'item-' + alert.id;

    appendCell(tr, alert.id, 'id');
    appendCell(tr, alert.title || '', 'title');
    appendLinkCell(tr, alert.url || '', alert.title || alert.url || '');
    appendCell(tr, alert.lang || '', 'lang');
    appendPreviewCell(tr, alert.preview || '');
    appendCell(tr, alert.date ? new Date(alert.date).toLocaleString() : '', 'date');
    appendCell(tr, alert.countdown ? convertMS(Number(alert.countdown) - Date.now()) : '', 'countdown');
    appendCell(tr, alert.alarm ? new Date(alert.alarm).toLocaleString() : '', 'alarm');
    appendActionCell(tr, alert.id);

    return tr;
  }

  function appendCell(row, value, className) {
    var cell = d.createElement('td');
    cell.className = className;
    cell.textContent = value;
    row.appendChild(cell);
  }

  function appendLinkCell(row, url, title) {
    var cell = d.createElement('td');
    var link = d.createElement('a');

    cell.className = 'url hidden-phone';
    link.href = url;
    link.title = title;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = url;
    cell.appendChild(link);
    row.appendChild(cell);
  }

  function appendPreviewCell(row, preview) {
    var cell = d.createElement('td');
    cell.className = 'preview hidden-phone';

    if (preview) {
      var img = d.createElement('img');
      img.src = preview;
      img.alt = '';
      img.loading = 'lazy';
      cell.appendChild(img);
    }

    row.appendChild(cell);
  }

  function appendActionCell(row, id) {
    var cell = d.createElement('td');
    var button = d.createElement('button');

    cell.className = 'action';
    button.type = 'button';
    button.className = 'fym-link-button del';
    button.dataset.id = id;
    button.textContent = message('delete', 'Delete');
    cell.appendChild(button);
    row.appendChild(cell);
  }

  function initOptionsPage() {
    var table = $('table-list');
    var refreshTimer = null;

    if (!table) {
      return;
    }

    applyLocale();
    d.title = message('optionsTitle', 'Chrome: FYM - options');
    translateTableHeaders();
    startAnimationTime();
    renderAllPublication();
    bindOptionsAutoRefresh();

    table.addEventListener('click', function(evt) {
      var button = evt.target.closest('.del');

      if (!button) {
        return;
      }

      deletePublication(button.dataset.id, function() {
        renderAllPublication();
      });
    });

    function bindOptionsAutoRefresh() {
      chrome.storage.onChanged.addListener(function(changes, areaName) {
        if (areaName === 'local' && changes[ALERTS_KEY]) {
          scheduleOptionsRefresh();
        }
      });

      d.addEventListener('visibilitychange', function() {
        if (!d.hidden) {
          scheduleOptionsRefresh();
        }
      });

      window.addEventListener('focus', scheduleOptionsRefresh);
    }

    function scheduleOptionsRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(renderAllPublication, 50);
    }
  }

  function initPopup() {
    var form = $('alert-form');

    if (!form) {
      return;
    }

    translatePopup();
    setDefaultDateTime();

    $('add').addEventListener('click', addCurrentPage);
    $('clear').addEventListener('click', resetForm);
    $('datetime').addEventListener('click', function() {
      setMode('datetime');
    });
    $('countdown').addEventListener('click', function() {
      setMode('countdown');
    });
    $('url').addEventListener('input', revealDetails);
    form.addEventListener('submit', validateForm);
  }

  function translatePopup() {
    applyLocale();
    d.title = message('popupTitle', 'Chrome: FYM - Home');
    $('reminderDialog').setAttribute('aria-label', message('dialogAddPageReminder', 'Add a page reminder'));
    $('reminderModeTabs').setAttribute('aria-label', message('ariaReminderMode', 'Reminder mode'));
    $('add').textContent = message('btnAdd', 'Add');
    $('add').title = message('titleAddCurrentPage', 'Add current page');
    $('clear').textContent = message('btnClear', 'Clear');
    $('validate').textContent = message('btnValidate', 'Validate');
    $('labelUrl').textContent = message('labelUrl', 'Choose url');
    $('url').placeholder = message('inputUrlPlaceholder', 'Click Add to use the current page or paste a URL');
    $('title').placeholder = message('inputTitle', 'Choose one title');
    $('labelTitle').textContent = message('labelTitle', 'Choose title');
    $('datetime').textContent = message('btnDatetime', 'date & clock');
    $('countdown').textContent = message('btnCountdown', 'countdown');
    $('labelDateTime').textContent = message('labelDateTime', 'Choose by date @ clock');
    $('labelDayCount').textContent = message('labelDayCount', 'Choose in n days, n hours, n mins');
    $('day').placeholder = message('inputPlaceholderDay', 'number of day(s)');
  }

  function translateTableHeaders() {
    Array.prototype.forEach.call(d.querySelectorAll('th[id^="i18n-"]'), function(th) {
      var id = th.id.replace('i18n-', '');
      th.textContent = message(id, id);
    });
  }

  function addCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var tab = tabs && tabs[0];

      if (!tab) {
        showMessage(message('errorCurrentTab', 'Unable to read the current tab.'), true);
        return;
      }

      $('url').value = tab.url || '';
      $('title').value = tab.title || '';
      revealDetails();

      chrome.tabs.detectLanguage(tab.id, function(lang) {
        $('lang').value = lang || '';
      });

      captureTab(tab.windowId);
    });
  }

  function captureTab(windowId) {
    captureInProgress = true;
    $('validate').disabled = true;
    setCaptureStatus(message('captureInProgress', 'Capturing page preview...'));

    chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 70 }, function(dataUrl) {
      if (chrome.runtime.lastError || !dataUrl) {
        $('imgData').value = '';
        setCaptureStatus(message('captureUnavailable', 'Preview unavailable on this page.'));
        finishCapture();
        return;
      }

      resizeCapture(dataUrl, function(resizedDataUrl) {
        $('imgData').value = resizedDataUrl;
        showPreview(resizedDataUrl, message('captureReady', 'Preview captured'));
        finishCapture();
      });
    });
  }

  function finishCapture() {
    var callbacks = captureCallbacks.slice();

    captureInProgress = false;
    captureCallbacks = [];
    $('validate').disabled = false;
    callbacks.forEach(function(callback) {
      callback();
    });
  }

  function afterCapture(callback) {
    if (!captureInProgress) {
      callback();
      return;
    }

    captureCallbacks.push(callback);
  }

  function resizeCapture(dataUrl, callback) {
    var img = new Image();

    img.onload = function() {
      var maxWidth = 320;
      var scale = Math.min(1, maxWidth / img.width);
      var canvas = d.createElement('canvas');
      var width = Math.max(1, Math.round(img.width * scale));
      var height = Math.max(1, Math.round(img.height * scale));
      var ctx;

      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      callback(canvas.toDataURL('image/jpeg', 0.72));
    };

    img.onerror = function() {
      callback(dataUrl);
    };

    img.src = dataUrl;
  }

  function showPreview(dataUrl, status) {
    $('previewImage').src = dataUrl;
    $('capturePreview').hidden = false;
    setCaptureStatus(status);
  }

  function setCaptureStatus(status) {
    $('capturePreview').hidden = false;
    $('captureStatus').textContent = status;
  }

  function revealDetails() {
    $('whenBtnAddIsClicked').hidden = !$('url').value.trim();
  }

  function setMode(mode) {
    var isDateTime = mode === 'datetime';

    $('datetime').classList.toggle('is-active', isDateTime);
    $('countdown').classList.toggle('is-active', !isDateTime);
    $('datetime').setAttribute('aria-selected', String(isDateTime));
    $('countdown').setAttribute('aria-selected', String(!isDateTime));
    $('datetimer').hidden = !isDateTime;
    $('counter').hidden = isDateTime;

    if (isDateTime) {
      $('day').value = '';
      $('count').value = '00:30';
    } else {
      $('date').value = '';
      $('time').value = '';
    }
  }

  function validateForm(evt) {
    var alarmDate;

    evt.preventDefault();

    if (!$('url').reportValidity() || !$('title').reportValidity()) {
      revealDetails();
      return;
    }

    alarmDate = $('datetimer').hidden ? getCountdownAlarm() : getDateTimeAlarm();

    if (!alarmDate || alarmDate.getTime() <= Date.now()) {
      showMessage(message('errorFutureReminder', 'Choose a future date or countdown.'), true);
      return;
    }

    afterCapture(function() {
      addPublication(
        $('url').value.trim(),
        $('title').value.trim(),
        $('lang').value.trim(),
        $('datetimer').hidden ? '' : alarmDate.toISOString(),
        $('datetimer').hidden ? String(alarmDate.getTime()) : '',
        normalizePreview($('imgData').value),
        alarmDate.toISOString(),
        function() {
          showMessage(message('publicationAdded', 'Publication added'), false);
          setTimeout(resetForm, 700);
        }
      );
    });
  }

  function getDateTimeAlarm() {
    var date = $('date').value;
    var time = $('time').value;

    if (!date || !time) {
      return null;
    }

    return new Date(date + 'T' + time);
  }

  function getCountdownAlarm() {
    var day = Number($('day').value || 0);
    var count = $('count').value || '00:00';
    var time = count.split(':');
    var hours = Number(time[0] || 0);
    var minutes = Number(time[1] || 0);
    var milliseconds = (day * 24 * 60 * 60 * 1000) +
      (hours * 60 * 60 * 1000) +
      (minutes * 60 * 1000);

    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
      return null;
    }

    return new Date(Date.now() + milliseconds);
  }

  function resetForm() {
    $('alert-form').reset();
    $('imgData').value = '';
    $('lang').value = '';
    $('previewImage').removeAttribute('src');
    $('capturePreview').hidden = true;
    $('message').hidden = true;
    $('whenBtnAddIsClicked').hidden = true;
    setMode('datetime');
    setDefaultDateTime();
  }

  function normalizePreview(preview) {
    if (!preview || preview === 'undefined') {
      return '';
    }

    if (String(preview).indexOf('data:image/') === 0) {
      return preview;
    }

    return 'data:image/jpeg;base64,' + preview;
  }

  function setDefaultDateTime() {
    var now = new Date(Date.now() + 30 * 60 * 1000);
    $('date').value = now.toISOString().slice(0, 10);
    $('time').value = pad(now.getHours()) + ':' + pad(now.getMinutes());
    $('day').value = '0';
    $('count').value = '00:30';
  }

  function showMessage(text, isError) {
    $('message').textContent = text;
    $('message').classList.toggle('is-error', Boolean(isError));
    $('message').hidden = false;
  }

  function startAnimationTime() {
    var time = $('time');

    if (!time) {
      return;
    }

    time.textContent = new Date().toLocaleString();
    setTimeout(startAnimationTime, 1000);
  }

  function convertMS(ms) {
    var dValue;
    var hValue;
    var mValue;
    var sValue;

    if (!Number.isFinite(ms) || ms <= 0) {
      return '';
    }

    sValue = Math.floor(ms / 1000);
    mValue = Math.floor(sValue / 60);
    sValue = sValue % 60;
    hValue = Math.floor(mValue / 60);
    mValue = mValue % 60;
    dValue = Math.floor(hValue / 24);
    hValue = hValue % 24;

    return [
      dValue ? dValue + ' day' + (dValue > 1 ? 's' : '') : '',
      hValue ? hValue + ' hour' + (hValue > 1 ? 's' : '') : '',
      mValue ? mValue + ' min' + (mValue > 1 ? 's' : '') : '',
      sValue ? sValue + ' sec' + (sValue > 1 ? 's' : '') : ''
    ].filter(Boolean).join(', ');
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  initPopup();
  initOptionsPage();
})();
