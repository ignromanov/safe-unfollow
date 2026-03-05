---
layout: default
title: Accessibility Features — Screen Reader, Keyboard, RTL Support
description: Instagram Unfollow Tracker accessibility features. Full keyboard navigation, screen reader support, RTL languages, WCAG 2.1 AA compliance, and high contrast mode.
permalink: /accessibility/
---

# Accessibility Guide - Instagram Unfollow Tracker

## Our Accessibility Commitment

Instagram Unfollow Tracker is designed to be accessible to all users, including those with disabilities. We follow WCAG 2.1 AA guidelines and implement best practices for inclusive design.

## Supported Accessibility Features

### Keyboard Navigation
- **Tab navigation**: Use Tab to move through interactive elements
- **Enter/Space**: Activate buttons and links
- **Arrow keys**: Navigate through lists and menus
- **Escape**: Close modals and clear search
- **Focus indicators**: Clear visual focus indicators on all interactive elements

### Screen Reader Support
- **ARIA labels**: All interactive elements have descriptive labels
- **Semantic HTML**: Proper heading structure and landmarks
- **Alt text**: Descriptive text for all images and icons
- **Live regions**: Dynamic content updates are announced
- **Role attributes**: Clear roles for custom components

### Visual Accessibility
- **High contrast**: Support for high contrast themes
- **Color independence**: Information not conveyed by color alone
- **Scalable text**: Text scales with browser zoom settings
- **Focus indicators**: Clear visual focus indicators
- **Responsive design**: Works on all screen sizes

### Motor Accessibility
- **Large click targets**: Buttons and links are at least 44px
- **Drag & drop alternatives**: File input button as alternative
- **Keyboard shortcuts**: Common actions available via keyboard
- **No time limits**: No time-based interactions that can't be extended

## How to Use Accessibility Features

### Keyboard Navigation
1. **Navigate the interface**: Use Tab to move through elements
2. **Activate buttons**: Press Enter or Space on focused buttons
3. **Open profiles**: Press Enter on account cards to open Instagram
4. **Use filters**: Tab to filter buttons and press Enter to toggle
5. **Search**: Tab to search box and type to search

### Screen Reader Usage
1. **Navigate by headings**: Use screen reader heading navigation
2. **Listen to labels**: All buttons and inputs have descriptive labels
3. **Check live regions**: Dynamic updates are announced automatically
4. **Use landmarks**: Navigate by main, navigation, and content landmarks

### Visual Adjustments
1. **Zoom the page**: Use Ctrl/Cmd + Plus to zoom in
2. **High contrast mode**: Enable in your operating system
3. **Dark mode**: Toggle dark theme for better contrast
4. **Font size**: Adjust browser font size settings

## Browser-Specific Accessibility

### Chrome
- **ChromeVox**: Built-in screen reader support
- **High contrast**: Enable in Settings → Appearance
- **Zoom**: Ctrl + Plus/Minus or Ctrl + Mouse wheel

### Firefox
- **NVDA/JAWS**: Full screen reader compatibility
- **High contrast**: Enable in Settings → General
- **Zoom**: Ctrl + Plus/Minus or Ctrl + Mouse wheel

### Safari
- **VoiceOver**: Built-in screen reader support
- **High contrast**: Enable in System Preferences
- **Zoom**: Cmd + Plus/Minus or Cmd + Mouse wheel

### Edge
- **Narrator**: Built-in screen reader support
- **High contrast**: Enable in Settings → Ease of Access
- **Zoom**: Ctrl + Plus/Minus or Ctrl + Mouse wheel

## Testing Accessibility

### Automated Testing
- **axe-core**: Automated accessibility testing
- **Lighthouse**: Accessibility audit in Chrome DevTools
- **WAVE**: Web accessibility evaluation tool

### Manual Testing
- **Keyboard only**: Test all functionality with keyboard only
- **Screen reader**: Test with actual screen readers
- **High contrast**: Test in high contrast mode
- **Zoom**: Test at 200% zoom level

## Known Limitations

### Current Limitations
- **Complex interactions**: Some advanced filtering may be challenging for screen readers
- **Large datasets**: Very large follower lists may impact performance
- **Mobile accessibility**: Some features work better on desktop

### Planned Improvements
- **Better screen reader support**: Enhanced ARIA labels and descriptions
- **Keyboard shortcuts**: More keyboard shortcuts for power users
- **Mobile accessibility**: Improved mobile screen reader support
- **Voice control**: Support for voice navigation

## Reporting Accessibility Issues

### How to Report
- **GitHub Issues**: [Report accessibility issues](https://github.com/ignromanov/safe-unfollow/issues)
- **Label**: Use the "accessibility" label when reporting
- **Details**: Include your browser, screen reader, and specific issue

### What to Include
- **Browser and version**: Which browser you're using
- **Screen reader**: If using a screen reader, which one
- **Steps to reproduce**: How to reproduce the issue
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens

## Accessibility Resources

### For Users
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [Chrome Accessibility Features](https://support.google.com/chrome/answer/7031754)
- [Firefox Accessibility Features](https://support.mozilla.org/en-US/kb/accessibility-features-firefox)

### For Developers
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)

## Contact & Support

### Accessibility Questions
- **GitHub Issues**: [Ask accessibility questions](https://github.com/ignromanov/safe-unfollow/issues)
- **Discussions**: [Community discussions](https://github.com/ignromanov/safe-unfollow/discussions)

### Accessibility Testing
We welcome feedback from users with disabilities. If you encounter accessibility barriers, please report them so we can improve the experience for everyone.

---

*This accessibility guide is regularly updated to reflect current features and improvements. We're committed to making Instagram Unfollow Tracker accessible to all users.*
