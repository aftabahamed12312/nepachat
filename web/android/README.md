# NepaChat for Galaxy Store

This directory packages the live NepaChat PWA as an Android Trusted Web Activity (TWA). The Android app opens `https://nepachat.aftabahamedbhat.com.np/`; web releases continue to deploy through Cloudflare Pages.

## Prepare the Android project

Requirements: Node.js 18 or newer, Java Development Kit (JDK), and the Android SDK/build tools. Bubblewrap can offer to install the Android build dependencies the first time it runs.

From this directory:

```powershell
npm run initialize
```

In Bubblewrap's setup prompts:

- Set the Android application ID to **`nepachat.aftabahmedbhat.com.np`** exactly. This is the permanent ID selected for the store listing; do not change it for later releases.
- Keep the launcher name as **NepaChat** and the start URL as `/`.
- Create a new signing key and protect its passwords. Keep the keystore and passwords out of Git and make secure backups; losing the key can prevent future updates.
- Accept the Android SDK license prompts if Bubblewrap installs the build tools.

Initialization and update automatically apply the Galaxy Store Install Referrer SDK to `app/build.gradle` and `LauncherActivity.java`. The patch also pins Android Browser Helper to 2.6.2 because it supports the project's Android API 21 minimum; newer 2.7.4 requires API 24. The patch is idempotent; `npm run build` reapplies it before packaging. The generated `twa-manifest.json` and Android project are the source for subsequent releases. Keep the non-secret project files under version control.

On first launch, the native app requests the Galaxy Store install referrer once. On success it saves the referrer URL, click timestamp, and install timestamp in private app storage; this implementation does not transmit them to NepaChat's server. If Galaxy Store is temporarily unavailable, it retries no more than once per 24 hours. Review and disclose this local attribution data in the app privacy policy before publishing.

## Build a store package

```powershell
npm run build
```

Bubblewrap produces a signed Android App Bundle and APK in this directory. Upload the package format currently accepted by Galaxy Store Seller Portal. Before each update, increment the Android version code; keep the same application ID and signing key.

Install and test the APK on a Galaxy phone before submission. Verify sign-in, push notifications, camera and microphone permissions, video calls, file uploads, back navigation, and external links. TWA fullscreen verification requires the website/app association below; without it, Android may show browser UI.

## Verify the website and app

After creating the app signing key, obtain its SHA-256 certificate fingerprint. Publish this file at:

`https://nepachat.aftabahamedbhat.com.np/.well-known/assetlinks.json`

Replace the fingerprint placeholder with the actual colon-separated SHA-256 value. If the store signs or re-signs the distributed app, use the certificate fingerprint for the signer users will receive.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "nepachat.aftabahmedbhat.com.np",
      "sha256_cert_fingerprints": ["REPLACE_WITH_RELEASE_CERTIFICATE_SHA256"]
    }
  }
]
```

Check that the public URL returns the JSON (not an HTML page or redirect) and that the package ID and fingerprint match the signed app. Keep the association file available for future app updates.

## Galaxy Store submission

Create or sign in to a Samsung Seller Portal account, create a Galaxy Store app listing with the same application ID, complete the required app details and age/content ratings, and upload the signed package. Prepare store screenshots, a support contact, and a public privacy-policy URL for the app's account and messaging data. Samsung reviews the app and decides whether to approve it; packaging does not guarantee acceptance.
 