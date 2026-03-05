---
layout: default
title: Privacy Policy — Your Data Never Leaves Your Device
description: Instagram Unfollow Tracker privacy policy. 100% local processing, no data collection, no tracking cookies. Your Instagram data never leaves your browser.
permalink: /privacy/
last_updated: 2026-01-16
---

# Privacy Policy - Instagram Unfollow Tracker

## Our Privacy Commitment

**Instagram Unfollow Tracker is designed with privacy as the core principle.** This document explains in plain English how we handle your data (spoiler: we don't collect any).

## What We Do NOT Do

### ❌ No Personal Data Collection
- We don't collect any personal information
- We don't track individual user behavior
- We don't use tracking cookies
- We don't store your Instagram data on any server

### ❌ No Server Processing
- Your data never leaves your device
- No servers process your Instagram export
- No cloud storage or databases involved
- No network requests after the initial page load

### ❌ No Invasive Third-Party Services
- No Google Analytics, Facebook Pixel, or similar invasive tracking
- No external APIs processing your Instagram data
- No data sharing with third parties
- No advertising or marketing integrations

## What We DO

### ✅ Local Processing Only
- Your Instagram ZIP file is processed entirely in your browser
- All calculations happen on your device using JavaScript
- Results are displayed locally and never transmitted

### ✅ Local Storage (IndexedDB)
- Your Instagram data is stored locally in IndexedDB for fast access
- Filter preferences are stored in LocalStorage
- All data stays on your device and never leaves
- You can clear this data anytime through browser settings or by uploading new data

### ✅ Privacy-Respecting Analytics
We use minimal, privacy-focused analytics to improve the app:
- **Umami Analytics** — anonymous page view counts, no personal data, GDPR-compliant

**What we track:**
- Page views (anonymous counts)
- Performance metrics (load times)
- Error rates (to fix bugs)

**What we DON'T track:**
- Your Instagram data or usernames
- Individual user behavior or sessions
- Personal identifiers or IP addresses
- Any content from your uploads

### ✅ Open Source Transparency
- All code is publicly available on GitHub
- You can review exactly what the app does
- No hidden functionality or secret data collection
- Community can audit and verify our privacy claims

## Technical Details

### How It Works
1. You upload your Instagram Data Download ZIP file
2. The app extracts and processes the JSON files in your browser
3. Results are calculated locally and displayed
4. No data is sent anywhere or stored permanently

### Browser Storage
- **IndexedDB**: Stores your Instagram data locally for fast filtering (~5MB for 1M accounts)
- **LocalStorage**: Stores filter preferences and theme choice
- **Memory**: Active data during filtering operations

### Network Activity
- **Initial Load**: Downloads the app files (HTML, CSS, JavaScript)
- **Analytics**: Minimal anonymous requests to Umami (page views only)
- **No Data Upload**: Your Instagram data is NEVER sent anywhere

## Your Rights

### You Control Your Data
- Your Instagram data never leaves your device
- You can delete the ZIP file anytime
- You can clear browser storage anytime
- You can use the app offline after initial load

### You Can Verify
- Review the source code on GitHub
- Deploy your own version
- Modify the code for your needs
- No hidden functionality

## Third-Party Hosting

### Vercel Hosting
- The live app is hosted on Vercel (safeunfollow.app)
- Vercel may collect standard web server logs (IP addresses, timestamps)
- No personal Instagram data is collected or transmitted

### Self-Hosting
If you deploy your own version:
- Check your hosting provider's privacy policies
- This project contains no tracking by default
- You control what analytics (if any) to add

## Data Security

### Your Instagram Export
- Contains personal information (usernames, profile URLs)
- Keep the ZIP file secure on your device
- Don't share it with others
- Delete it when no longer needed

### Browser Security
- Use a modern, updated browser
- Clear browser data regularly if desired
- Use private/incognito mode if preferred

## Contact & Questions

### Privacy Questions
- **GitHub Issues**: [Report privacy concerns](https://github.com/ignromanov/safe-unfollow/issues)
- **Security**: See [SECURITY.md](https://github.com/ignromanov/safe-unfollow/blob/main/SECURITY.md) for security-related issues

### Verification
- **Source Code**: [GitHub Repository](https://github.com/ignromanov/safe-unfollow)
- **Live Demo**: [Try the app](https://safeunfollow.app)

## Changes to This Policy

This privacy policy may be updated to reflect changes in the app or legal requirements. Changes will be posted on GitHub with clear version history.

**Last Updated**: January 2026
**Version**: 1.5

---

*This privacy policy is written in plain English to be easily understood. The app is designed to be as private as possible - your data stays on your device, period.*
