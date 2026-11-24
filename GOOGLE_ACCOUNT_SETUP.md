# Complete Guide: Setting Up the App with Another Google Account

This guide explains step-by-step how to completely configure this application with another Google account.

---

## 📌 Table of Contents
1. [Overview & Requirements](#overview--requirements)
2. [Choose Your Setup Option](#choose-your-setup-option)
   - [Option A: Full Setup under a New Google Cloud Account (Recommended for Complete Separation)](#option-a-full-setup-under-a-new-google-cloud-account)
   - [Option B: Quick Access Setup (Using Existing Cloud Credentials)](#option-b-quick-access-setup)
3. [Setting Up Google Drive (Required for Both Options)](#setting-up-google-drive)
4. [Updating Your Local Configuration (`.env`)](#updating-your-local-configuration-env)
5. [Starting the App & Verifying](#starting-the-app--verifying)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## 1. Overview & Requirements

The application interacts with Google services in three distinct ways:
1. **Google OAuth 2.0 (`VITE_GOOGLE_CLIENT_ID`)**: Authenticates users and requests permission to read and manage Google Drive files (`drive.file`, `drive.readonly`) and verify the user's email address.
2. **YouTube Data API v3 (`VITE_YOUTUBE_API_KEY`)**: Fetches video metadata, playlists, channels, and search results.
3. **Whitelisted Access (`VITE_ALLOWED_EMAILS`)**: Restricts login strictly to permitted Google accounts.
4. **Google Drive "Vault" Folder**: Looks for a folder named `videos` on Google Drive, and inside it parses any video files and/or a `links.txt` containing YouTube URLs.

---

## Option A: Full Setup under a New Google Cloud Account

Use this if you want the other Google account to own its own Google Cloud project, OAuth Client ID, and YouTube API Key.

### Step 1: Create a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/) and sign in with the **new Google account**.
2. Click the project dropdown at the top left and select **New Project**.
3. Name your project (e.g., `YouTube-Vault-App`) and click **Create**.
4. Make sure your newly created project is selected in the top bar.

---

### Step 2: Enable Required APIs
1. In the Cloud Console, search for or navigate to **APIs & Services > Library**.
2. Search for and enable the following two APIs:
   - **YouTube Data API v3** &rarr; Click **Enable**.
   - **Google Drive API** &rarr; Click **Enable**.

---

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** (unless you are using Google Workspace for an organization) and click **Create**.
3. Fill in the **App Information**:
   - **App name**: `YouTube Vault` (or any name you like)
   - **User support email**: Select your new Google account email
   - **Developer contact information**: Enter your new Google account email
   - Click **Save and Continue**.
4. **Scopes**:
   - Click **Add or Remove Scopes**.
   - Add the following scopes:
     - `.../auth/userinfo.email`
     - `.../auth/drive.readonly`
     - `.../auth/drive.file`
   - Click **Update** and then **Save and Continue**.
5. **Test Users**:
   - Since the app is in "Testing" publishing status, **only registered test users can sign in**.
   - Click **+ Add Users**.
   - Enter the new Google account email (and any other emails you want to grant access).
   - Click **Add**, then **Save and Continue**.
6. Review the summary and click **Back to Dashboard**.

---

### Step 4: Create OAuth 2.0 Web Client ID
1. Navigate to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** at the top &rarr; select **OAuth client ID**.
3. In **Application type**, choose **Web application**.
4. Set **Name** (e.g., `Web Client`).
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - `http://localhost:5173`
   - *(Optional)* `http://localhost:3000` (if you run on alternative ports)
   - *(Optional)* Your production URL if deployed (e.g., `https://your-domain.com`)
6. Under **Authorized redirect URIs**, click **+ Add URI** and add:
   - `http://localhost:5173`
7. Click **Create**.
8. A modal appears showing your **Client ID** (it ends with `.apps.googleusercontent.com`).
   - **Copy this Client ID**; you will put it into `VITE_GOOGLE_CLIENT_ID`.

---

### Step 5: Create a YouTube API Key
1. Still on the **APIs & Services > Credentials** page:
2. Click **+ Create Credentials** at the top &rarr; select **API key**.
3. A modal appears showing your new API Key (starts with `AIzaSy...`).
4. *(Recommended)* Click **Edit API Key**:
   - Under **API restrictions**, select **Restrict key**.
   - Check **YouTube Data API v3**.
   - Click **Save**.
5. **Copy this API Key**; you will put it into `VITE_YOUTUBE_API_KEY`.

---

## Option B: Quick Access Setup
*(If you want to keep the existing Cloud Console project, but allow another Google account to use the app)*

If you already have working credentials and just want another Google account to log into the app:
1. In the existing Google Cloud Console project:
   - Go to **APIs & Services > OAuth consent screen**.
   - Under **Test users**, click **+ Add Users**.
   - Add the new Google account's email address and click **Save**.
2. Open your local `.env` file:
   - Add the new email to `VITE_ALLOWED_EMAILS` (comma-separated):
     ```bash
     VITE_ALLOWED_EMAILS=first.email@gmail.com,other.account@gmail.com
     ```
3. Complete the [Setting Up Google Drive](#setting-up-google-drive) section below for the new account.

---

## 3. Setting Up Google Drive

The application looks for a folder named **`videos`** in the signed-in user's Google Drive.

1. Open [Google Drive](https://drive.google.com/) while signed in with the **new Google account**.
2. In **My Drive**, create a new folder named exactly:
   ```text
   videos
   ```
   *(Must be lowercase: `videos`)*
3. Inside this `videos` folder, you can add content in either (or both) of the following ways:
   - **A. Text file of YouTube Links (`links.txt`)**:
     - Create a plain text file named `links.txt`.
     - Paste YouTube video links (or video IDs), one URL per line:
       ```text
       https://www.youtube.com/watch?v=dQw4w9WgXcQ
       https://youtu.be/5NV6Rdv1a3I
       ```
     - Upload `links.txt` into the `videos` folder.
   - **B. Direct Video Files**:
     - Upload MP4, WebM, or MKV video files directly into the `videos` folder.
4. *(Optional)* When you create custom playlists or mark favorites within the app, the app will automatically create and sync a `playlists.json` file inside this folder.

---

## 4. Updating Your Local Configuration (`.env`)

In your project root directory, edit the `.env` file:

```env
# 1. Google OAuth Client ID (from Option A Step 4, or existing)
VITE_GOOGLE_CLIENT_ID=your-new-client-id.apps.googleusercontent.com

# 2. YouTube Data API v3 Key (from Option A Step 5, or existing)
VITE_YOUTUBE_API_KEY=AIzaSyYourNewApiKeyHere

# 3. Whitelisted Google Account(s) (comma-separated list of allowed emails)
VITE_ALLOWED_EMAILS=newaccount@gmail.com
```

> **Note:** If you want to permit multiple accounts, separate them with commas:
> `VITE_ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com`

---

## 5. Starting the App & Verifying

1. **Clear Previous Session**:
   - Open your browser's Developer Tools (`F12` or `Cmd + Option + I`).
   - Go to **Application > Storage**.
   - Clear **Local Storage**, **Session Storage**, and **Service Workers** (to remove any cached tokens from the previous account).
2. **Restart the Dev Server**:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.
4. Click **Continue with Google** and choose the **new Google account**.
5. Grant permissions for Google Drive and profile access.
6. The app will:
   - Check your email against `VITE_ALLOWED_EMAILS`.
   - Scan Google Drive for your `videos` folder and parse `links.txt` or video files.
   - Fetch YouTube data using your `VITE_YOUTUBE_API_KEY`.

---

## 6. Troubleshooting Common Issues

| Error Message / Behavior | Cause | Solution |
| :--- | :--- | :--- |
| **`Access denied: Unauthorized Google account.`** | The email logged in does not match `VITE_ALLOWED_EMAILS`. | Ensure the email is added to `VITE_ALLOWED_EMAILS` in `.env`, and restart the dev server. |
| **`Access blocked: app has not completed the Google verification process`** or **Error 403: access_denied** | The app is in "Testing" mode and the new email is not a Test User. | Go to Cloud Console &rarr; **OAuth consent screen** &rarr; **Test users** &rarr; Add the new Google email. |
| **`Origin mismatch` / `redirect_uri_mismatch`** | `http://localhost:5173` is missing from Authorized Origins. | In Google Cloud Console &rarr; **Credentials** &rarr; Edit OAuth Client ID &rarr; Add `http://localhost:5173` to **Authorized JavaScript origins**. |
| **`Google Sign-In failed. Please try again.`** | Invalid `VITE_GOOGLE_CLIENT_ID` or pop-up was blocked. | Check that `VITE_GOOGLE_CLIENT_ID` in `.env` is exact. Ensure browser allows pop-ups for localhost. |
| **Drive Vault shows 0 videos** | The `videos` folder is missing or incorrectly named. | Ensure there is a folder named `videos` (exact match, lowercase) in Google Drive with video files or a `links.txt` file inside. |
| **YouTube videos do not load / quota errors** | `VITE_YOUTUBE_API_KEY` is invalid or YouTube Data API v3 is not enabled. | Verify YouTube Data API v3 is enabled in Google Cloud Console, and verify your API key restrictions. |
