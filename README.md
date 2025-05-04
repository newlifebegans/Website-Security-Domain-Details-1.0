# Website Security & Server Info

A browser extension that analyzes website security features and displays server information including IP address and hostname.

## Features

- Displays website security features (HTTPS, SSL Certificate, Content Security Policy, etc.)
- Shows server information including IP address and hostname
- Visual security indicators with color coding
- Dynamic favicon-based UI that matches the website's branding
- Works across all websites

## Installation

1. Download the extension from the Chrome Web Store or Firefox Add-ons
2. Click "Add to Chrome" or "Add to Firefox"
3. The extension icon will appear in your browser toolbar

## Usage

1. Navigate to any website
2. Click the extension icon in your browser toolbar
3. View the security features and Domain Details
4. Click on Domain Details to copy it to clipboard

## Privacy

This extension:
- Does not collect any personal data
- Does not track browsing history
- Does not send any data to third parties
- Only makes requests to DNS APIs to resolve IP addresses

## Development

### Project Structure
- `manifest.json` - Extension configuration
- `popup.html` - The UI for the extension popup
- `popup.js` - JavaScript for the popup interface
- `background.js` - Background service worker for the extension
- `content.js` - Content script to detect security features
- `icons/` - Extension icons and assets


## License

MIT License 