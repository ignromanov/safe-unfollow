---
layout: default
title: Fix Instagram Upload Errors: JSON, HTML and Wrong File
description: Solve common Instagram data upload errors. Fix JSON vs HTML format issues, wrong file structure, and "no data found" errors step by step.
permalink: /troubleshooting/
last_updated: 2026-09-03
---

# Troubleshooting Guide - Instagram Unfollow Tracker

## Common Issues & Solutions

### Upload Issues

#### "No data found" Error
**Problem**: The app shows "No data found" after uploading your ZIP file.

**Solutions**:
1. **The format is not the cause**: both JSON and HTML exports have been read since August 2026. If you already have an export, upload it — do not request a new one to change its format.
2. **Verify data selection**: Confirm you selected "Followers and Following" section
3. **Check file structure**: Your ZIP should contain files like:
   ```
   connections/followers_and_following/
   ├── following.json
   ├── followers_1.json
   └── followers_2.json (if you have many followers)
   ```
4. **Try sample data**: Click "Load sample" to test if the app works
5. **Re-download data**: Request a new export from Instagram

#### "Invalid file format" Error
**Problem**: The app rejects your ZIP file.

**Solutions**:
1. **Check file extension**: Ensure the file ends with `.zip`
2. **Verify file integrity**: Try re-downloading the ZIP from Instagram
3. **Check file size**: Very large files (>100MB) may cause issues
4. **Browser compatibility**: Try a different browser (Chrome recommended)

#### Upload takes too long
**Problem**: The upload process seems to hang or take forever.

**Solutions**:
1. **Check file size**: Large files (20k+ accounts) may take 5-10 seconds
2. **Close other tabs**: Free up browser memory
3. **Use desktop browser**: Mobile browsers may be slower
4. **Check internet connection**: Ensure stable connection for initial page load

### Processing Issues

#### Slow processing
**Problem**: The app takes a long time to process your data.

**Solutions**:
1. **Account size**: Large accounts (10k+ followers) naturally take longer
2. **Browser performance**: Use Chrome or Firefox for best performance
3. **Close other tabs**: Free up memory and CPU resources
4. **Wait patiently**: Processing 50k accounts can take up to 10 seconds

#### "Out of memory" Error
**Problem**: Browser runs out of memory during processing.

**Solutions**:
1. **Close other tabs**: Free up browser memory
2. **Restart browser**: Clear memory and try again
3. **Use desktop**: Desktop browsers have more memory
4. **Split data**: If possible, use a smaller date range for export

#### Incomplete results
**Problem**: Some accounts are missing from the results.

**Solutions**:
1. **Check export completeness**: Ensure you selected "All time" date range
2. **Verify file structure**: Check that all follower files are present
3. **Account status**: Some accounts may have been deleted or made private
4. **Export timing**: The data is a snapshot from when you requested it

### Display Issues

#### Accounts not showing
**Problem**: Expected accounts don't appear in the results.

**Solutions**:
1. **Check filters**: Ensure no filters are hiding the accounts
2. **Clear search**: Make sure search box is empty
3. **Check all badges**: Look in different badge categories
4. **Account status**: Accounts may be in different categories than expected

#### Incorrect counts
**Problem**: The numbers don't match what you see in Instagram.

**Solutions**:
1. **Export timing**: Instagram data changes constantly
2. **Account changes**: Accounts may have been deleted or made private
3. **Data snapshot**: The export shows the state when you requested it
4. **Instagram updates**: Live Instagram data may differ from export

#### UI not loading properly
**Problem**: The interface doesn't display correctly.

**Solutions**:
1. **Refresh page**: Try reloading the page
2. **Clear cache**: Clear browser cache and cookies
3. **Try different browser**: Test in Chrome, Firefox, or Safari
4. **Check JavaScript**: Ensure JavaScript is enabled
5. **Disable extensions**: Try disabling browser extensions

### Browser-Specific Issues

#### Chrome Issues
**Problem**: App doesn't work properly in Chrome.

**Solutions**:
1. **Update Chrome**: Ensure you're using Chrome 90+
2. **Clear cache**: Clear browsing data
3. **Disable extensions**: Try incognito mode
4. **Check settings**: Ensure JavaScript is enabled

#### Firefox Issues
**Problem**: App doesn't work properly in Firefox.

**Solutions**:
1. **Update Firefox**: Ensure you're using Firefox 88+
2. **Clear cache**: Clear browsing data
3. **Disable extensions**: Try private browsing mode
4. **Check settings**: Ensure JavaScript is enabled

#### Safari Issues
**Problem**: App doesn't work properly in Safari.

**Solutions**:
1. **Update Safari**: Ensure you're using Safari 14+
2. **Clear cache**: Clear browsing data
3. **Check settings**: Ensure JavaScript is enabled
4. **Try Chrome**: Safari may have compatibility issues

#### Mobile Browser Issues
**Problem**: App doesn't work well on mobile.

**Solutions**:
1. **Use desktop**: Mobile browsers have limitations
2. **Try Chrome Mobile**: Best mobile browser support
3. **Check memory**: Close other apps to free up memory
4. **Wait longer**: Mobile processing may be slower

### Data Issues

#### Missing follower files
**Problem**: Some follower files are missing from the export.

**Solutions**:
1. **Check export settings**: Ensure you selected "All time" date range
2. **Re-request export**: Request a new export from Instagram
3. **Contact Instagram**: If files are consistently missing
4. **Check file names**: Instagram may use different naming conventions

#### Corrupted data
**Problem**: The app shows errors when processing data.

**Solutions**:
1. **Re-download**: Get a fresh export from Instagram
2. **Check file integrity**: Ensure the ZIP file isn't corrupted
3. **Try different browser**: Test in another browser
4. **Report issue**: File a bug report with details

#### Unexpected data format
**Problem**: The app can't parse your data format.

**Solutions**:
1. **Check format**: Ensure you selected JSON format
2. **Check date range**: Use "All time" for complete data
3. **Check selection**: Only select "Followers and Following"
4. **Report issue**: File a bug report with sample data

## Getting Help

### When to Report Issues
Report issues if:
- The app crashes or shows errors
- Data is clearly incorrect
- The interface doesn't work properly
- You've tried all troubleshooting steps

### How to Report Issues
1. **GitHub Issues**: [Create an issue](https://github.com/ignromanov/safe-unfollow/issues)
2. **Include details**:
   - Browser and version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if helpful

### What Information to Include
- **Browser**: Chrome 95, Firefox 94, etc.
- **OS**: Windows 11, macOS 12, etc.
- **Account size**: Approximate number of followers/following
- **Error messages**: Exact error text
- **Steps**: What you did before the issue occurred

### Community Support
- **GitHub Discussions**: [Ask questions](https://github.com/ignromanov/safe-unfollow/discussions)
- **FAQ**: Check [Frequently Asked Questions](/docs/faq)
- **User Guide**: See [User Guide](/docs/user-guide)

## Prevention Tips

### Best Practices
1. **Use recent exports**: Download fresh data for accurate results
2. **Complete data**: Select "All time" when downloading
3. **Either format**: JSON and HTML exports are both read; JSON is what the export guide selects
4. **Desktop browser**: Use Chrome or Firefox on desktop
5. **Close other tabs**: Free up memory for better performance

### Regular Maintenance
1. **Clear browser cache**: Regularly clear browsing data
2. **Update browser**: Keep your browser updated
3. **Check extensions**: Disable problematic extensions
4. **Monitor memory**: Close unused tabs and applications

---

*This troubleshooting guide is regularly updated based on user feedback and common issues. If you don't find your issue here, please report it so we can help you and improve the guide.*
