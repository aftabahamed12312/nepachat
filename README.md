# NepaChat — React + Node + MongoDB

## Run locally (Docker)
    cp .env.example .env      # set JWT_SECRET and SMTP settings
    docker compose up --build
Open http://localhost:5173 · API http://localhost:4000/api/health · MongoDB on :27017

Sign-up sends a six-digit email code that expires after 10 minutes; after verification, sign in with the new account. For production, configure Resend (`RESEND_API_KEY` and a verified sender in `RESEND_FROM`); Gmail API and SMTP are supported as fallback providers. The app indicates when email verification is not configured and reports a delivery error instead of pretending an email was sent. Local development enables `OTP_DEV_MODE=true`, which displays the code in the signup notice when no mail provider is configured. Keep this off outside local development. Render Free blocks outbound SMTP ports.

Features: verified accounts with username, email, and password; profile editing with profile pictures; automatic light/dark appearance matching the device theme, including navigation tabs; companion devices can sign in with account credentials or be linked by QR code (one primary and up to four companions), with session revocation; real-time chat with sent, delivered, and read checks; friend requests with accept/reject and a private Activity feed shared only between accepted friends; R2-backed image/video attachments; one-to-one audio/video calls with minimize, split-screen, call history, and optional push alerts; opt-in, timed Google Maps live-location sharing; and installable phone PWA support. Location is visible only in its chat and automatically expires. Calls need camera/microphone permission and an HTTPS origin (localhost is also allowed); configure TURN for restrictive networks.

To sign in on a new device, enter the account email/username and password; successful credentials create a companion session without requiring a QR scan. QR linking is an optional alternative: on the new device choose **Or link this device with a QR code**, then on an already signed-in device open **Linked devices**, scan the QR code, and approve. Accounts allow one primary plus four companions; unlink a device under **Linked devices** to free a slot. Pairing QR codes expire after five minutes, and unlinking a device revokes its API and socket session. Linked devices share the existing account and server-synced chat history. Phone-number identity and SMS verification are not included. Messages are not end-to-end encrypted with the Signal Protocol; do not treat this companion-device feature as providing Signal-style encryption.

Calls use browser WebRTC for SDP negotiation, trickle ICE, and DTLS-SRTP media encryption, with STUN and optional TURN relay configuration. Browser-managed DTLS-SRTP encrypts call media in transit, but NepaChat does not add independent peer identity verification or Signal Protocol call encryption. During a call, users can mute the microphone, enable browser-supported noise suppression and echo cancellation, turn video off, switch between available cameras, and view a connection-quality estimate based on WebRTC statistics.

The local Docker setup seeds one verified demo account on first startup: `nepa_demo` / `nepa-demo@example.test` with password `local-demo-only-2026`. This fixed credential is for local development only. For a different seed, set `SEED_USERNAME`, `SEED_EMAIL`, and `SEED_PASSWORD`; the account is not modified on later starts. Never use the demo password in production. To seed a deployed API, configure those three Wrangler secrets separately.

## Deploy to AWS Elastic Beanstalk and Amplify Hosting

The repository includes a root `Dockerfile` for the API and an `amplify.yml` monorepo build specification for the web app.

1. Push the repository to GitHub. Do not include `.env`, API keys, passwords, or other secrets.
2. Create a MongoDB Atlas database and allow connections from the AWS deployment. Keep the database credentials private.
3. In the AWS Elastic Beanstalk console, create an application and a Docker web-server environment. Upload the repository source bundle with the root `Dockerfile`, or connect the Git repository using the AWS-supported deployment flow. Ensure the source bundle includes the `server` directory and its package lock. Wait for the environment health check and copy its HTTPS URL.
4. In the Elastic Beanstalk environment configuration, set `PORT=4000`, `MONGO_URL`, a long random `JWT_SECRET`, `OWNER_EMAIL`, `OTP_DEV_MODE=false`, and `CORS_ORIGIN`. For production email, add `RESEND_API_KEY` and `RESEND_FROM`; use secure environment values or AWS Secrets Manager/Systems Manager Parameter Store references for secrets. Do not put credentials in the source bundle. Configure optional `R2_*` values if uploads need persistent object storage; the container filesystem is ephemeral. Set `CORS_ORIGIN` to the exact Amplify app origin once it is known (for initial setup, it can temporarily be `*`, then restrict it and restart the API).
5. In AWS Amplify Hosting, create a new app connected to the GitHub repository and select the desired branch. Set the required monorepo environment variable `AMPLIFY_MONOREPO_APP_ROOT=web`, plus `VITE_API_URL` to the Elastic Beanstalk API origin (for example, `https://your-api.elasticbeanstalk.com`, without a trailing slash). The committed `amplify.yml` builds the `web` app and publishes `web/dist`.
6. After Amplify provides its HTTPS app domain, update Elastic Beanstalk `CORS_ORIGIN` to that exact origin (and any custom frontend domain), then restart/redeploy the API. If you use `nepachat.aftabahamedbhat.com.np` as the frontend custom domain, add that exact HTTPS origin to CORS and configure its DNS/certificate in Amplify.
7. Test `https://<API-origin>/api/health` and `/api/config`, then open the Amplify URL and test signup, email delivery, uploads, and a chat/call.

Elastic Beanstalk and Amplify are separate services: deploy the API first and the web app second. Production account registration needs a verified Resend sender and the corresponding environment variables; the API health endpoint alone does not prove email delivery is configured.

## Deploy to Render and Cloudflare Pages
1. Push this project to a GitHub repository. Keep `.env` out of Git; `.gitignore` excludes it.
2. Create a MongoDB Atlas database and allow network access from Render. Copy its connection string.
3. In Render, create a **Blueprint** from the repository. `render.yaml` configures the Docker API service and health check. Set `MONGO_URL` and `CORS_ORIGIN`. For email, set `RESEND_API_KEY` and `RESEND_FROM` after verifying a sender domain with Resend; alternatively, use Gmail API OAuth credentials below. `JWT_SECRET` is generated by Render; `OTP_DEV_MODE` stays off in production.
4. Wait for the Render service health check, then confirm its URL, normally `https://nepachat-api.onrender.com`. Update `VITE_API_URL` in `web/.env.production` if Render assigned another URL.
5. From `web`, run `npm install`, `npx wrangler login`, and `npm run deploy`. This uploads the built static app to Cloudflare Pages project `nepachat`.

The local demo accounts and fixed passwords are for development only. Do not configure those seed credentials on a public service. In production, set `OWNER_EMAIL=aftabaha12@gmail.com` in Render to promote the matching account to admin. Public sign-up remains available and requires email verification; admins can also create verified accounts from **Create account** and permanently delete accounts from **View users**. Deleting an account removes its chats and messages for every participant, friendships, activity posts, calls, location shares, device sessions, and account-owned media. The signed-in admin cannot delete their own account, the configured owner account cannot be deleted, and the last admin is protected.

Image and MP4/WebM video attachments up to 25 MB work without R2: the API stores them on its local filesystem. In Docker Compose, files are stored in the persistent `chat-uploads` volume mounted at `/app/uploads`, and the local Vite server proxies both uploads and downloads to the API. To choose a different directory, set `UPLOADS_DIR`.

For a deployed service, local filesystem uploads are only durable if the host provides persistent storage. Render's default filesystem is ephemeral, so files can disappear on redeploy or instance replacement. To use local storage on Render, attach a persistent disk, set its mount path (for example `/var/data`) and set `UPLOADS_DIR=/var/data/uploads`. Alternatively, configure a Cloudflare R2 bucket and S3 API token with object read/write and list permissions by setting `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`; with R2 configured, uploads use the bucket and downloads use signed URLs.

For device notifications for calls, messages, friend requests, and activity posts, the API creates a VAPID key pair on first startup and stores it in the private `systemSettings` collection in MongoDB. Keep the MongoDB database persistent and private; do not delete that settings record, since existing browser subscriptions depend on the same key pair. To provide your own stable pair instead, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and optionally `VAPID_SUBJECT` in the API environment. Users must tap **Enable device notifications** and grant browser permission. The app must run over HTTPS; on iOS, install NepaChat to the Home Screen to receive Web Push notifications. For reliable calls across restrictive networks, configure Cloudflare TURN as described below.

## Production Environment Template
Add these values in Render's environment settings. Never put real database passwords, SMTP passwords, or tokens in this README, Git, or the Cloudflare frontend environment.

```dotenv
MONGO_URL=mongodb+srv://<database-user>:<url-encoded-password>@<cluster-host>/nepachat?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=<generated-by-render>
CORS_ORIGIN=https://nepachat.pages.dev
OWNER_EMAIL=aftabaha12@gmail.com
GMAIL_OAUTH_CLIENT_ID=<google-oauth-client-id>
GMAIL_OAUTH_CLIENT_SECRET=<google-oauth-client-secret>
GMAIL_OAUTH_REFRESH_TOKEN=<google-oauth-refresh-token>
GMAIL_FROM=aftabaha12@gmail.com
RESEND_API_KEY=<resend-api-key>
RESEND_FROM="NepaChat <verify@your-verified-domain.example>"
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=<r2-bucket-name>
# Optional: omit to let the API create and persist a VAPID key pair in MongoDB.
VAPID_PUBLIC_KEY=<web-push-public-key>
VAPID_PRIVATE_KEY=<web-push-private-key>
VAPID_SUBJECT=mailto:admin@nepachat.pages.dev
TURN_KEY_ID=<cloudflare-turn-key-uid>
TURN_API_TOKEN=<cloudflare-turn-key-secret>
OTP_DEV_MODE=false
```

For Resend, verify your sending domain in the Resend dashboard, create an API key, and set `RESEND_API_KEY` plus `RESEND_FROM` to a sender address on that verified domain. Delivery tries Resend first, then Gmail API, then SMTP; errors are logged per provider, and the API reports a send failure if all configured providers reject the message. For Gmail fallback, enable the Gmail API in Google Cloud, create an OAuth client, authorize the `https://www.googleapis.com/auth/gmail.send` scope with offline access, then set these values as Render environment secrets. `GMAIL_FROM` must match the authorized Gmail account. Render Free blocks SMTP ports `25`, `465`, and `587`, so prefer the Resend API or Gmail HTTPS API in production. Create the R2 bucket/access key and Cloudflare TURN key before setting their corresponding secrets. VAPID environment values are optional when the API can write to MongoDB. Atlas's downloaded environment file calls its URI `MONGODB_URI`; set that value as `MONGO_URL` in Render. URL-encode reserved characters in the database password. Rotate credentials if they have been shared or committed.

For reliable calls, create a Cloudflare Realtime TURN key in the Cloudflare dashboard. Set its returned `uid` as Render's `TURN_KEY_ID` and its returned `key` as `TURN_API_TOKEN`. The API requests fresh 48-hour ICE credentials for authenticated callers; the long-lived TURN key never reaches the browser. Cloudflare documents 1,000 GB of free TURN egress, with usage-based charges beyond that.

Live Maps sharing is opt-in per chat, can be stopped by the sharer, and automatically expires after 15 minutes, 1 hour, or 8 hours. Location is available only to participants in that chat while the share is active.
