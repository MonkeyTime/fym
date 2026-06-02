const ALERTS_KEY = 'alerts';
const LEGACY_MIGRATION_KEY = 'legacyIndexedDbMigrated';
const LEGACY_DB_NAME = 'fym-db';
const LEGACY_DB_VERSION = 1;
const LEGACY_STORE_NAME = 'alerts';
const NOTIFICATION_PREFIX = 'fym-alert-';
const NOTIFICATION_URLS_KEY = 'notificationUrls';

chrome.runtime.onInstalled.addListener(function() {
  chrome.alarms.create('fym-alert-check', { periodInMinutes: 1 });
  migrateLegacyAlerts(function() {});
});

chrome.runtime.onStartup.addListener(function() {
  chrome.alarms.create('fym-alert-check', { periodInMinutes: 1 });
  migrateLegacyAlerts(function() {});
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'fym-alert-check') {
    notifyDueAlerts();
  }
});

chrome.notifications.onClicked.addListener(function(notificationId) {
  chrome.storage.local.get({ [NOTIFICATION_URLS_KEY]: {} }, function(result) {
    var urls = result[NOTIFICATION_URLS_KEY] || {};
    var url = urls[notificationId];

    if (url) {
      chrome.tabs.create({ url: url });
      delete urls[notificationId];
      chrome.storage.local.set({ [NOTIFICATION_URLS_KEY]: urls });
    }

    chrome.notifications.clear(notificationId);
  });
});

function notifyDueAlerts() {
  migrateLegacyAlerts(function() {
    notifyStoredAlerts();
  });
}

function notifyStoredAlerts() {
  chrome.storage.local.get({ [ALERTS_KEY]: [] }, function(result) {
    var alerts = Array.isArray(result[ALERTS_KEY]) ? result[ALERTS_KEY] : [];
    var now = Date.now();
    var due = [];
    var remaining = [];

    alerts.forEach(function(alert) {
      var alarmTime = new Date(alert.alarm).getTime();

      if (Number.isFinite(alarmTime) && alarmTime - 60000 <= now) {
        due.push(alert);
      } else {
        remaining.push(alert);
      }
    });

    if (!due.length) {
      return;
    }

    chrome.storage.local.set({ [ALERTS_KEY]: remaining }, function() {
      rememberNotificationUrls(due);
      due.forEach(createAlertNotification);
    });
  });
}

function migrateLegacyAlerts(callback) {
  chrome.storage.local.get({ [LEGACY_MIGRATION_KEY]: false, [ALERTS_KEY]: [] }, function(result) {
    if (result[LEGACY_MIGRATION_KEY] || typeof indexedDB === 'undefined') {
      callback();
      return;
    }

    readLegacyIndexedDb(function(legacyAlerts) {
      var currentAlerts = Array.isArray(result[ALERTS_KEY]) ? result[ALERTS_KEY] : [];
      var mergedAlerts = mergeAlerts(currentAlerts, legacyAlerts);

      chrome.storage.local.set({
        [ALERTS_KEY]: mergedAlerts,
        [LEGACY_MIGRATION_KEY]: true
      }, callback);
    });
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

function rememberNotificationUrls(alerts) {
  chrome.storage.local.get({ [NOTIFICATION_URLS_KEY]: {} }, function(result) {
    var urls = result[NOTIFICATION_URLS_KEY] || {};

    alerts.forEach(function(alert) {
      urls[NOTIFICATION_PREFIX + alert.id] = alert.url;
    });

    chrome.storage.local.set({ [NOTIFICATION_URLS_KEY]: urls });
  });
}

function createAlertNotification(alert) {
  var title = alert.title || alert.url || 'FYM';
  var shortTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
  var message = chrome.i18n.getMessage('yourEvent') + ' "' + shortTitle + '" ' +
    chrome.i18n.getMessage('startEvent') + '. ' +
    chrome.i18n.getMessage('infoEvent');

  chrome.notifications.create(NOTIFICATION_PREFIX + alert.id, {
    type: 'basic',
    title: shortTitle,
    message: message,
    iconUrl: 'notify128.png'
  });
}
