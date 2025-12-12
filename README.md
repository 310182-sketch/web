# Better Browse Chrome Extension

Enhance your browsing experience with Focus, Dark, and Reader modes.

## Features

*   **Focus Mode**: Applies a grayscale filter to the page to reduce distractions.
*   **Dark Mode**: Smartly inverts colors to reduce eye strain, while keeping images and videos natural.
*   **Reader Mode**: Increases font size and centers text for a comfortable reading experience.

## Installation

Since this extension is not yet on the Chrome Web Store, you need to install it manually:

1.  Clone or download this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked** in the top left corner.
5.  Select the folder where you downloaded this repository.

## Usage

1.  Click the **Better Browse** icon in your Chrome toolbar (it might be inside the puzzle piece menu).
2.  Use the toggle switches to enable or disable modes:
    *   **Focus Mode**: Toggle grayscale.
    *   **Dark Mode**: Toggle dark theme.
    *   **Reader Mode**: Toggle reading layout.
3.  Settings are automatically saved and applied to the current tab.

## Development

*   `manifest.json`: Extension configuration.
*   `popup.html` & `popup.js`: The user interface.
*   `content.js` & `content.css`: The logic and styles injected into web pages.
