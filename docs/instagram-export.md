---
layout: default
title: "Instagram Data Export: ZIP Guide and followers_1.json"
description: "How to request your Instagram data export as a ZIP, choose JSON or HTML, and read what followers_1.json and pending_follow_requests.html hold."
permalink: /instagram-export/
last_updated: 2026-11-09
---

# How to Download Your Instagram Data as a ZIP (JSON or HTML)

[SafeUnfollow](https://safeunfollow.app) reads the Instagram data export in both formats, JSON and HTML. This guide shows how to request the export from Meta and what each file inside the ZIP holds. The most important step is to **select only "Followers and following"**, because an export without it has nothing to analyze. For the format, **choose JSON**. HTML exports also work, but JSON is the format SafeUnfollow reads most reliably.

## Quick Steps

1. **Open Meta Accounts Center**: Visit [https://accountscenter.instagram.com/](https://accountscenter.instagram.com/) and click **"Create export"**
2. **Choose your Instagram profile** from the list of connected accounts
3. **Select "Export to device"** — this keeps your data private
4. **Select only "Followers and following"**: Customize › Clear all › check ONLY "Followers and following" ← **Critical step!**
5. **Set date range to "All time"** for your complete follower history
6. **Change format to JSON** (HTML also works; JSON is read most reliably)
7. **Review and click "Start export"** — verify: Followers and following, All time, JSON
8. **Wait for the email** (usually 5-30 minutes) and **download the ZIP file**
9. **Upload the ZIP** to [Instagram Unfollow Tracker](https://safeunfollow.app/upload) using the upload button

---

## JSON vs HTML: Why Format Matters

Choosing HTML instead of JSON has historically been the **#1 cause of upload errors**. The tracker now reads HTML exports through a built-in converter, but JSON remains the format it reads most reliably.

### Comparison Table

| Feature | JSON Format ✅ | HTML Format ⚠️ |
|---------|---------------|----------------|
| **Works with tracker** | Yes — read directly | Usually — read via a built-in converter |
| **File contents** | `.json` files with structured data | `.html` files for browser viewing |
| **Data structure** | Machine-readable arrays and objects | Human-readable web pages |
| **File size** | Smaller (1-5 MB typical) | Larger (includes styling/markup) |
| **Processing** | Read directly | Converted first; may fail on unusual exports |

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

> **Already downloaded HTML?** Try uploading it — the tracker reads HTML exports too. If it cannot find your follower lists inside, re-request the export in JSON: Meta Accounts Center › Create export › Select your profile › Export to device › Only "Followers and following" › All time › Format: JSON.

---

## Detailed Instructions

### Step 1: Open the Instagram Export Page
- Go directly to [https://accountscenter.instagram.com/](https://accountscenter.instagram.com/)
- This is the unified center for all Meta accounts (Instagram, Facebook, etc.)
- Log in with your Instagram credentials if asked, then click **"Create export"**

### Step 2: Choose Your Instagram Profile
- Select your Instagram account from the list of connected profiles in the Accounts Center

### Step 3: Select "Export to device"
- Choose to export directly to your device
- This keeps your data private and secure

### Step 4: Select Only "Followers and following"

> **This is the most critical step.** An export without it has no follower data to analyze.

- Click **"Customize"** › Clear all › check **ONLY "Followers and following"**
- Do not select other sections like posts, messages, or profile information
- These are not needed for unfollow tracking and will make your download larger and slower

### Step 5: Set Date Range to "All time"
- Click **"Date range"** › Select **"All time"** › Save
- This ensures you have your complete follower history for accurate tracking

### Step 6: Change Format to JSON
- Click **"Format"** › Select **"JSON"**
- HTML exports also work, but JSON is the format the tracker reads most reliably
- JSON and HTML ZIP files look identical from the outside (both are `.zip` files)
- The only way to tell them apart is by opening them and checking the file extensions inside

### Step 7: Review & Start Export
- Verify your settings show: **Followers and following, All time, JSON**
- Click **"Start export"**

### Step 8: Wait for Email & Download
- Instagram emails you when ready (usually 5-30 minutes; check Spam folder too!)
- Download the ZIP file from the provided link (link expires in 4 days)

### Step 9: Upload Your File
- Go to [safeunfollow.app/upload](https://safeunfollow.app/upload) and upload the ZIP file
- The analysis runs in your browser

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

An HTML export holds the same files with `.html` in place of `.json` (`followers_1.html`, `pending_follow_requests.html`), and SafeUnfollow reads those too.

### File reference

| File (`.json` or `.html`) | What it holds |
|---|---|
| `followers_1`, `followers_2`, … | The accounts that follow you. A large account is split across several numbered files, and SafeUnfollow reads them together |
| `following` | The accounts you follow |
| `pending_follow_requests` | Follow requests you sent that have not been accepted. Instagram's app has no screen for them |
| `recently_unfollowed_profiles` | Accounts you unfollowed recently, as Instagram recorded them |
| `close_friends` | Your Close Friends list |
| `restricted_profiles` | Accounts you restricted |

SafeUnfollow extracts the usernames and the dates the export recorded, then compares the lists:
- **Not following back**: accounts you follow that are missing from your followers
- **Mutuals**: accounts that appear in both lists
- **Recently unfollowed**: read from `recently_unfollowed_profiles`, never inferred

### If Your Structure Differs

If your archive has a different folder structure, the tracker will try to locate files by name anywhere in the ZIP. You can also use the [sample data demo](https://safeunfollow.app/sample) to test the app.

---

## Common Errors and Solutions

### "We couldn't read this export" (HTML) Error
**Problem**: This is an HTML export, and the tracker could not find your follower lists inside it.
**Solution**: Ask Instagram for the same export in JSON: Meta Accounts Center › Create export › Select your profile › Export to device › Only **"Followers and following"** › All time › Format: **JSON**. That version is the one the tracker reads most reliably.

### "No Data Found" Error
**Problem**: The ZIP doesn't contain follower/following data files.
**Solutions**:
1. Make sure you selected **"Followers and following"** when configuring the export (Customize › Clear all › check only it)
2. Verify the ZIP contains `connections/followers_and_following/` folder

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

⚠️ Filter speed and search speed are design targets, not measurements — no benchmark harness
exists in this repo, and the only 1M-scale test mocks IndexedDB entirely and asserts a 500ms
ceiling.

One end-to-end figure is measured: SafeUnfollow was tested on a synthetic export of 1,000,000
accounts, about 21 seconds from choosing the file to results, in desktop Chrome (November 2026).
That was one desktop run, and no phone has been tested at that size.

---

## Privacy and Security

Your Instagram data export contains personal information. Here's how we handle it:

- **100% local processing** — Your ZIP file is analyzed entirely in your browser
- **Never sent to a server** — your export is read in your browser and stays there
- **No login required** — We never ask for your Instagram password
- **Your export stays out of ads and analytics** — the site shows Google ads and runs analytics that record page views and your export's account count and size, never a username; you can switch analytics off in the footer, and your ZIP reaches neither
- **Open source** — [View the code on GitHub](https://github.com/ignromanov/safe-unfollow)

> Keep your ZIP file secure and don't share it with others. Delete it after analysis if you prefer.

---

## Ready to Analyze?

1. **Already have your JSON ZIP?** → [Upload it now](https://safeunfollow.app/upload)
2. **Need help downloading?** → [Follow our step-by-step guide](https://safeunfollow.app/upload?guide=1)
3. **Want to try first?** → [Load sample data](https://safeunfollow.app/sample)
