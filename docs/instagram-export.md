---
layout: default
title: How to Download Instagram Data as JSON (Step-by-Step Guide)
description: Step-by-step guide to download your Instagram data as JSON for follower analysis. Learn the correct format, avoid common mistakes, and analyze unfollowers privately.
permalink: /instagram-export/
last_updated: 2026-03-05
---

# How to Download Your Instagram Data as JSON

This complete guide shows you how to get your Instagram data in the correct format for [Instagram Unfollow Tracker](https://safeunfollow.app). The most important step: **choose JSON format, not HTML**.

## Quick Steps

1. **Go to Meta Accounts Center**: Visit [https://accountscenter.instagram.com/](https://accountscenter.instagram.com/)
2. **Log in** with your Instagram credentials
3. **Navigate to "Your information and permissions"** in the left sidebar
4. **Click "Download your information"**
5. **Configure your download**:
   - Select **"Some of your information"** (not "All of your information")
   - Choose **"Followers and Following"** section only
   - Select **"JSON"** format ← **Critical step!**
   - Set date range to **"All time"**
6. **Submit the request** and wait for Instagram to prepare your data (usually 5-30 minutes)
7. **Download the ZIP file** when you receive the email notification
8. **Upload the ZIP** to [Instagram Unfollow Tracker](https://safeunfollow.app/upload) using the upload button

---

## JSON vs HTML: Why Format Matters

This is the **#1 cause of upload errors** — 74% of failed uploads are caused by choosing the wrong format.

### Comparison Table

| Feature | JSON Format ✅ | HTML Format ❌ |
|---------|---------------|----------------|
| **Works with tracker** | Yes | No |
| **File contents** | `.json` files with structured data | `.html` files for browser viewing |
| **Data structure** | Machine-readable arrays and objects | Human-readable web pages |
| **File size** | Smaller (1-5 MB typical) | Larger (includes styling/markup) |
| **Processing** | Instant parsing | Cannot be parsed by the tracker |

### How to Tell Which Format You Have

**JSON format** — Inside the ZIP you'll see files like:
```
connections/followers_and_following/following.json
connections/followers_and_following/followers_1.json
```

**HTML format** — Inside the ZIP you'll see files like:
```
connections/followers_and_following/following.html
connections/followers_and_following/followers_1.html
```

> **Already downloaded HTML?** You need to re-request your data. Go back to Meta Accounts Center, select JSON format, and submit a new request. The old HTML export won't work.

---

## Detailed Instructions

### Step 1: Access Meta Accounts Center
- Go directly to [https://accountscenter.instagram.com/](https://accountscenter.instagram.com/)
- This is the unified center for all Meta accounts (Instagram, Facebook, etc.)
- Log in with your Instagram credentials

### Step 2: Navigate to Data Download
- Look for **"Your information and permissions"** in the left sidebar
- Click on **"Download your information"**
- This will take you to the data request configuration page

### Step 3: Select Information Type
- Choose **"Some of your information"** to customize your download
- This option allows you to select only the specific data you need instead of downloading everything

### Step 4: Choose Data Section
- Select **ONLY "Followers and Following"** from the available sections
- **Important**: Do not select other sections like posts, messages, or profile information
- These are not needed for unfollow tracking and will make your download larger and slower

### Step 5: Select File Format — JSON

> **This is the most critical step.** Select **JSON** format.

- Look for the format dropdown or toggle on the download configuration page
- Select **"JSON"** — not "HTML"
- JSON and HTML ZIP files look identical from the outside (both are `.zip` files)
- The only way to tell them apart is by opening them and checking the file extensions inside

### Step 6: Set Date Range
- Select **"All time"** to get your complete follower history
- This ensures you have all your followers and following data for accurate tracking

### Step 7: Submit Request
- Review your selections and click **"Submit request"**
- Instagram will process your request — usually takes 5-30 minutes
- You'll receive an email notification when the data is ready

### Step 8: Download and Upload
- Check your email for the download notification (check Spam folder too!)
- Download the ZIP file from the provided link (link expires in 4 days)
- Go to [safeunfollow.app/upload](https://safeunfollow.app/upload) and upload the ZIP file
- Analysis happens instantly, 100% in your browser

---

## File Structure Inside the ZIP

The Instagram data export ZIP contains a specific folder structure. Instagram Unfollow Tracker looks for files at these paths:

```
your-instagram-export.zip
└── connections/
    └── followers_and_following/
        ├── following.json          ← Who you follow
        ├── followers_1.json        ← Your followers (part 1)
        ├── followers_2.json        ← Your followers (part 2, if many)
        ├── followers_3.json        ← (additional parts as needed)
        ├── close_friends.json      ← Close friends list (optional)
        ├── pending_follow_requests.json  ← Pending requests (optional)
        ├── recently_unfollowed_profiles.json  ← Recent unfollows (optional)
        └── restricted_profiles.json     ← Restricted accounts (optional)
```

### What Each File Contains

**`following.json`** — List of accounts you follow:
```json
{
  "relationships_following": [
    {
      "title": "",
      "media_list_data": [],
      "string_list_data": [
        {
          "href": "https://www.instagram.com/username",
          "value": "username",
          "timestamp": 1704067200
        }
      ]
    }
  ]
}
```

**`followers_1.json`** — Your followers list (same structure, key is `"relationships_followers"`).

The tracker reads these JSON arrays, extracts usernames and timestamps, and cross-references them to identify:
- **Unfollowers** — accounts in your following but not in followers
- **Non-mutuals** — accounts you follow that don't follow back
- **Mutuals** — accounts that follow each other

### If Your Structure Differs

If your archive has a different folder structure, the tracker will try to locate files by name anywhere in the ZIP. You can also use the [sample data demo](https://safeunfollow.app/sample) to test the app.

---

## Common Errors and Solutions

### "Wrong Format: HTML" Error
**Problem**: You downloaded your data in HTML format instead of JSON.
**Solution**: Go back to Meta Accounts Center → Download your information → Select **JSON** format → Submit a new request. You cannot convert HTML exports to JSON.

### "No Data Found" Error
**Problem**: The ZIP doesn't contain follower/following data files.
**Solutions**:
1. Make sure you selected **"Followers and Following"** when configuring the export
2. Check that you selected **"Some of your information"** (not "All") and picked the right section
3. Verify the ZIP contains `connections/followers_and_following/` folder

### "Not an Instagram Export" Error
**Problem**: The uploaded file isn't from Instagram's official data export.
**Solution**: Use the [Meta Accounts Center](https://accountscenter.instagram.com/) to request your data. Don't upload random ZIP files or exports from third-party apps.

### File Size Expectations

| What You Selected | Expected Size | Processing Time |
|-------------------|---------------|-----------------|
| Followers and Following only | 1-5 MB | Under 5 seconds |
| All data (everything) | 50-500+ MB | 10-60 seconds |

### Processing Time by Account Size

| Account Size | Filter Speed | Search Speed |
|-------------|-------------|-------------|
| Under 1,000 followers | < 1ms | < 1ms |
| 1,000-10,000 followers | ~2ms | < 1ms |
| 10,000-100,000 followers | ~3ms | ~1ms |
| 100,000-1,000,000+ followers | ~5ms | ~2ms |

---

## Privacy and Security

Your Instagram data export contains personal information. Here's how we handle it:

- **100% local processing** — Your ZIP file is analyzed entirely in your browser
- **No server uploads** — Data never leaves your device
- **No login required** — We never ask for your Instagram password
- **No tracking** — We don't track individual users or store any data
- **Open source** — [View the code on GitHub](https://github.com/ignromanov/safe-unfollow)

> Keep your ZIP file secure and don't share it with others. Delete it after analysis if you prefer.

---

## Ready to Analyze?

1. **Already have your JSON ZIP?** → [Upload it now](https://safeunfollow.app/upload)
2. **Need help downloading?** → [Follow our step-by-step wizard](https://safeunfollow.app/wizard)
3. **Want to try first?** → [Load sample data](https://safeunfollow.app/sample)
