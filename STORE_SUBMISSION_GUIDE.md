# 📱 ClickTabs Mobile: Store Submission & CI/CD Release Guide

This guide explains how to use the automated GitHub Actions CI/CD workflow to build Android & iOS apps on every push, and how to submit them to **Google Play Store** and **Apple App Store**.

---

## 🔑 1. Android Production Keystore Details

A secure 2048-bit RSA PKCS12 keystore has been generated for your Google Play Store releases:

- **File location**: `mobile/clicktabs-release.jks` *(ignored by git for security)*
- **Alias**: `clicktabs`
- **Keystore Password**: `ClickTabs@2026#MobileKey`
- **Key Password**: `ClickTabs@2026#MobileKey`
- **Validity**: 10,000 days (~27 years)

> ⚠️ **CRITICAL BACKUP**: Save a copy of `mobile/clicktabs-release.jks` in a secure location (e.g., 1Password, Google Drive, or offline backup). If this keystore is lost, Google Play Store will not allow you to update your app!

---

## ⚙️ 2. GitHub Secrets Setup

In your GitHub repository, go to:
👉 **Settings > Secrets and variables > Actions > New repository secret**

Add the following secrets:

| Secret Name | Value | Purpose |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | `https://click-tabs.com` | Sets production API endpoint during build |
| `ANDROID_KEYSTORE_BASE64` | Content of `mobile/clicktabs-release.jks.base64.txt` | Decodes the production keystore for signing |
| `ANDROID_KEYSTORE_PASSWORD` | `ClickTabs@2026#MobileKey` | Keystore password |
| `ANDROID_KEY_ALIAS` | `clicktabs` | Key alias |
| `ANDROID_KEY_PASSWORD` | `ClickTabs@2026#MobileKey` | Key password |

*To copy the base64 string quickly on your Mac:*
```bash
pbcopy < /Users/enamul/Desktop/click-tabs/mobile/clicktabs-release.jks.base64.txt
```

---

## 🚀 3. How to Trigger Automated Builds & GitHub Releases

### Option A: Push a Version Tag (Recommended)
Whenever you are ready to publish a new release:
```bash
cd /Users/enamul/Desktop/click-tabs/mobile
git add .
git commit -m "Release v1.0.0: Store compliance & production build"
git push origin main

# Create and push a tag:
git tag v1.0.0
git push origin v1.0.0
```
This automatically triggers the workflow `.github/workflows/build-release.yml`.

### Option B: One-Click Trigger in GitHub UI
1. Go to your repository on GitHub: `https://github.com/clicktabs/mobile-app/actions`
2. Select **"Build & Release Mobile Apps"** from the left sidebar.
3. Click **"Run workflow"**, enter the version (e.g. `1.0.0`), and click Run.

### 📦 Output of the Workflow:
When the workflow completes, it creates a new **GitHub Release** containing:
1. `clicktabs-v1.0.0.apk` ➔ Standalone Android APK for direct phone download/sideloading.
2. `clicktabs-v1.0.0.aab` ➔ Android App Bundle for Google Play Console submission.
3. `clicktabs-v1.0.0.ipa` ➔ iOS Distribution package for iPhone & iPad.

---

## 🤖 4. Google Play Store Submission Steps

1. Log in to [Google Play Console](https://play.google.com/console).
2. Click **Create app**:
   - App name: **Click Tabs**
   - Default language: **English (United States)**
   - App or game: **App**
   - Free or paid: **Free** (B2B SaaS / agency platform)
3. Go to **Production > Create new release**.
4. Upload `clicktabs-v1.0.0.aab` (downloaded from your GitHub Release).
5. **Data Safety Form**:
   - **Location**: Approximate & Precise location collected for Electronic Visit Verification (EVV) clock-in/out.
   - **Personal Info**: Name, email used for staff and patient authentication.
   - **Photos**: Profile picture and clinical document attachments.
6. **Privacy Policy**: Provide link to your privacy policy (e.g. `https://click-tabs.com/privacy`).

---

## 🍏 5. Apple App Store Submission Steps

1. Log in to [Apple Developer Portal](https://developer.apple.com) & [App Store Connect](https://appstoreconnect.apple.com).
2. Verify your App Identifier matches `com.clicktabs.mobile`.
3. Create a new app record in App Store Connect with bundle ID `com.clicktabs.mobile`.
4. Upload the build via TestFlight or Transporter app.
5. **App Review Information**:
   - Provide demo credentials for a testing clinician/caregiver account.
   - In the **Review Notes**, include:
     > *"Click Tabs is an enterprise clinical workforce platform. User accounts are created and managed by healthcare agency administrators. Self-service account deletion is restricted to ensure patient visit records comply with HIPAA and CMS medical retention regulations."*
