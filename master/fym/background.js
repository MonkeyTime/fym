const ALERTS_KEY = 'alerts';
const NOTIFICATION_PREFIX = 'fym-alert-';
const NOTIFICATION_URLS_KEY = 'notificationUrls';

chrome.runtime.onInstalled.addListener(function() {
  chrome.alarms.create('fym-alert-check', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(function() {
  chrome.alarms.create('fym-alert-check', { periodInMinutes: 1 });
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
