# FYM - Free Your Mind

FYM is a Chrome extension for one simple purpose: save the current web page and receive a reminder for it later.

The reminder can be scheduled for an exact date and time, or after a countdown. FYM stores the page URL, title, detected language and a visual preview, then shows a Chrome notification when the reminder is due.

Chrome Web Store listing:
https://chrome.google.com/webstore/detail/fym-free-your-mind/fgpnbkajfdgggieepmpanicongciddcj?hl=en

## Single Purpose

FYM creates reminders linked to saved web pages.

It does not try to be a general bookmark manager, task manager or note-taking tool. Its only goal is to help users reopen a specific web page at the right moment.

## Features

- Save the active tab URL and title.
- Capture a preview image of the current page.
- Create a reminder by date and time.
- Create a reminder by countdown.
- Show a Chrome notification when the reminder is due.
- Open the saved page from the reminder notification.
- View and delete saved reminders from the options page.
- Localized UI through Chrome i18n.
- Manifest V3 compatible.

## Project Structure

The extension source lives in:

```text
master/fym/
```

Main files:

```text
master/fym/manifest.json       Chrome extension manifest
master/fym/background.js       Service worker for reminder checks and notifications
master/fym/fym.html            Extension popup
master/fym/fym.js              Popup and options page logic
master/fym/options.html        Saved reminders list
master/fym/style.css           Shared styles
master/fym/_locales/           Chrome i18n messages
master/fym/webstore-assets/    Chrome Web Store listing images
```

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the folder:

```text
master/fym/
```

## Build Chrome Web Store ZIP

The Chrome Web Store expects a ZIP file with `manifest.json` at the archive root.

A generated package is available at:

```text
dist/fym-chrome-webstore-v0.3.zip
```

The ZIP contains only the extension runtime files. Web Store listing assets are kept outside the runtime package.

An Opera Add-ons compatible package is also generated at:

```text
dist/fym-opera-addons-v0.3.zip
```

This Opera package excludes `_locales` and uses a plain manifest description to avoid Opera upload validator path issues. The runtime JavaScript keeps English fallbacks for UI and notification strings.

## Permissions

FYM uses a minimal set of permissions for its single purpose.

- `activeTab`: read the current tab only after the user opens the extension, and capture its visible preview.
- `tabs`: read the active tab title and URL, and open a saved URL from a reminder notification.
- `alarms`: check periodically whether a reminder is due.
- `notifications`: display the reminder notification.
- `storage`: save reminders locally in Chrome.

FYM does not use remote code. JavaScript files are packaged inside the extension.

## Privacy

Reminder data is stored locally with `chrome.storage.local`.

Older versions stored reminders in IndexedDB. Version 0.3 automatically migrates existing IndexedDB reminders to `chrome.storage.local` the first time the extension starts, popup opens or options page opens.

Stored data can include:

- Page URL
- Page title
- Detected page language
- Reminder date or countdown
- Captured page preview

FYM does not send this data to a remote server.

## Chrome Web Store Assets

Listing assets are available in:

```text
master/fym/webstore-assets/
```

Included assets:

- `webstore-icon-128.png`
- `fym-icon-512-transparent.png`
- `promo-small-440x280.png`
- `promo-large-920x680.png`
- `marquee-1400x560.png`
- `opera-addons-300x188.png`
- `screenshot-date-1280x800.png`
- `screenshot-countdown-1280x800.png`

The extension icons use PNG transparency outside the rounded square.

## Development Checks

Basic validation commands:

```bash
cd master/fym
node --check background.js
node --check fym.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

## Changelog

### 0.3

- Migrated to Manifest V3.
- Reworked reminder storage with `chrome.storage.local`.
- Fixed page preview capture.
- Improved popup UI and options auto-refresh.
- Added expanded i18n coverage.
- Added new transparent icons and Chrome Web Store assets.
- Added Chrome Web Store-ready ZIP packaging.

### 0.2

- Added plugin screenshots.

### 0.1

- Initial release.
