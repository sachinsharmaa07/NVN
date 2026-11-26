# Auth0 setup (about 20 minutes)

You do this once, in the Auth0 dashboard. The domain, client ID and API identifier are public values.
The one exception is the Machine-to-Machine client secret (step 6): it goes only in `server/.env`. Menu names can differ a little as Auth0 changes its dashboard.

Use a separate **dev tenant** (for example `nivaran-dev`). Make another one for production later.

## 1. Create the tenant

1. Sign up at auth0.com (free plan is enough).
2. Create a tenant. Pick the region closest to your users. The name becomes your domain, like
   `nivaran-dev.us.auth0.com`. Copy it: this is `AUTH0_DOMAIN`.

## 2. Create the web app

1. **Applications > Applications > Create Application**. Name it `Nivaran Web`, type **Single Page Web Applications**.
2. On its **Settings** tab, copy the **Client ID**.
3. Set these three fields to `http://localhost:5173` (add your real site later, comma separated):
   - Allowed Callback URLs
   - Allowed Logout URLs
   - Allowed Web Origins
4. Scroll to **Refresh Token Rotation** and turn **Rotation** on (reuse of an old refresh token then
   revokes the family). Set the inactivity lifetime to 7 days. The app asks for refresh tokens and keeps
   them in memory, never in localStorage.
5. Under **Advanced Settings > Grant Types**, make sure **Authorization Code** and **Refresh Token** are ticked.
6. Save.

## 3. Create the API

1. **Applications > APIs > Create API**. Name `Nivaran API`, Identifier `https://api.nivaran.in`
   (any name you like; it is never called, only compared), signing algorithm **RS256**.
   The identifier is `AUTH0_AUDIENCE`.
2. On the API's **Settings** tab: set **Token Expiration** to `3600` seconds and turn on **Allow Offline Access**.
3. You do not need to turn on RBAC. Roles live in our own database (see below).

## 4. Turn on sign-in methods

1. **Authentication > Social > Google** (connection name `google-oauth2`): switch it on and enable it for `Nivaran Web`.
   Auth0's built-in Google keys are fine for development. Before launch you must use your own Google OAuth client.
2. **Authentication > Passwordless > Email** (connection name `email`): switch it on, set it to send a
   **code** (not a magic link) of 6 digits, and enable it for `Nivaran Web`. The app asks for this
   connection by name, so do not rename it. Typing the code proves the address, so these users arrive
   verified, as Google sign-ins do. Disable the `Username-Password-Authentication` database connection
   for `Nivaran Web`: there are no passwords.
3. **No automatic account linking.** Do not add any Action, rule or extension that links accounts with
   the same email. Someone who signs up by email and someone who signs in with Google using the same
   address stay two separate Auth0 users (and two Nivaran users). Linking by email can hand one person's
   account to another. Also turn on **Security > Attack Protection** (brute-force, suspicious IP throttling).

## 5. Add our claims to the token

The server needs the user's email, name, picture, whether the email is verified, and whether this
sign-in used MFA. Add a small Action:

1. **Actions > Library > Create Action > Build from scratch**. Name `Add Nivaran claims`, trigger **Login / Post Login**.
2. Paste this and click **Deploy**:

```js
exports.onExecutePostLogin = async (event, api) => {
  const ns = "https://nivaran.in/"; // must match CLAIM_NAMESPACE in server/src/services/userService.js
  const mfaDone = (event.authentication?.methods ?? []).some((m) => m.name === "mfa");

  // Admins (level 4 and up) have app_metadata.mfa_required = true, set by the server on promotion.
  // Make them enroll and answer an MFA challenge. (Not possible on a silent refresh-token exchange.)
  const isRefresh = event.transaction?.protocol === "oauth2-refresh-token";
  if (event.user.app_metadata?.mfa_required === true && !mfaDone && !isRefresh) {
    api.multifactor.enable("any", { allowRememberBrowser: false });
  }

  api.accessToken.setCustomClaim(`${ns}email`, event.user.email);
  api.accessToken.setCustomClaim(`${ns}name`, event.user.name);
  api.accessToken.setCustomClaim(`${ns}picture`, event.user.picture);
  api.accessToken.setCustomClaim(`${ns}email_verified`, event.user.email_verified === true);
  api.accessToken.setCustomClaim(`${ns}mfa`, mfaDone);
};
```

3. **Actions > Triggers > post-login**: drag `Add Nivaran claims` into the flow between Start and Complete, then **Apply**.
4. **Check that the Action also runs on refresh-token exchange.** Auth0 runs post-login Actions when a
   refresh token is exchanged, which is how `email_verified` and `mfa` stay fresh without a new login.
   Verify it once: sign in, verify the email (or turn MFA on for a test user), wait for the access token
   to expire (or set the API's token lifetime to 300 seconds for the test) and confirm the next
   `GET /api/me` shows the new value without signing in again. If it does not, check **Monitoring > Logs**
   for the Action run on the token exchange.

Roles, scope and status are **not** in the token. They live in MongoDB (`users.role`, `cityId`,
`departmentId`, `stateCode`, `status`), so a promotion or suspension takes effect on the user's very
next request. For admins the server fails closed: a level 4+ user without the `mfa` claim gets 403
`MFA_REQUIRED` on admin routes.

## 6. Create the Machine-to-Machine app (MFA flag)

The server calls Auth0's Management API to set the `mfa_required`
flag when someone becomes an admin. This app is a **secret**: keep it server-side only.

1. **Applications > Applications > Create Application**. Name `Nivaran Server`, type **Machine to Machine Applications**.
2. Authorize it for the **Auth0 Management API** and tick **only** these two permissions:
   - `update:users`
   - `update:users_app_metadata`

   Nothing else (no read, create or delete scopes). If you add more, the app can do more than it needs.
3. Copy its **Client ID** and **Client Secret** into `server/.env` (next step). Never put them in
   `client/.env`, in a commit, or in a log.

## 7. Fill in the settings

`server/.env`

```text
AUTH0_DOMAIN=nivaran-dev.us.auth0.com
AUTH0_AUDIENCE=https://api.nivaran.in
AUTH0_M2M_CLIENT_ID=<Client ID of Nivaran Server>
AUTH0_M2M_CLIENT_SECRET=<Client Secret of Nivaran Server>   # secret
SUPER_ADMIN_EMAIL=<your email>                              # used once, by the bootstrap script
```

`client/.env`

```text
VITE_AUTH0_DOMAIN=nivaran-dev.us.auth0.com
VITE_AUTH0_CLIENT_ID=<the Client ID from step 2>
VITE_AUTH0_AUDIENCE=https://api.nivaran.in
```

Domain is the host only: no `https://`, no trailing slash. Restart `npm run dev`.
Optional client setting: `VITE_SUPPORT_CONTACT` (see the README).

## 8. Try it, and the manual test checklist

Run these in order against your dev tenant. Tick each when it behaves as described.

1. **Google login.** Open http://localhost:5173, click **Sign in**, choose Google. You land back on the
   page you were on. `GET /api/me` (Network tab) returns 200 with `"role": "citizen"` and
   `"emailVerified": true`. A `users` document exists in `nivaran_dev`.
2. **Unverified email.** A token whose `email_verified` is not `true` gets 403 `EMAIL_NOT_VERIFIED` from
   the API; the app shows a toast and opens the sign-in sheet. Signing in again with Google or an email
   code gives a verified token. There is no verify page and no resend.
3. **Profile edit.** Open Profile, change your name, language and default pincode, save. The header and
   the next `GET /api/me` show the new values. Sending `role` in the request is rejected (400).
4. **Bootstrap the super admin.** Sign in once with the account whose email is `SUPER_ADMIN_EMAIL`
   (email verified), then run `npm run bootstrap:super-admin -w server`. It prints the masked email,
   `citizen -> super_admin` and exits 0. Run it again: "already super_admin", no change, exit 0.
   Before the first sign-in it exits 2; with an unverified email it exits 4.
   Sign out and in again and enroll MFA when asked. **Admin > Users** now opens.
5. **Promote a test account to city_admin and confirm MFA is required.** Sign in once with a second
   account. As super admin, open Admin > Users, change that user's role to `city_admin`, pick a city,
   enter a reason. In Auth0 (User Management > Users > that user) `app_metadata.mfa_required` is
   `true`. With the test account's old session, `GET /api/admin/users` returns 403 `MFA_REQUIRED`.
   Sign out and in as the test account: Auth0 makes it enroll MFA, and then the Users page opens and
   lists only users in its own city. Another city's user id returns 404. The AuditLog has a
   `user.role_change` row with your reason.
6. **Suspend and confirm the next request is blocked.** As the admin, suspend a third test account with a
   reason. In that account's still-open browser, click anything that calls the API: it answers 403
   `SUSPENDED` and the app shows the Suspended page with your reason. Reactivate it and reload: access is back.

## If something goes wrong

| You see | Usually means |
| --- | --- |
| Auth0 page says "Callback URL mismatch" | Step 2.3: the URL is missing or has a typo (check `http` vs `https`, the port, no trailing slash) |
| `GET /api/me` returns 401 `UNAUTHENTICATED` | `AUTH0_AUDIENCE` or `AUTH0_DOMAIN` on the server differs from the client's, or the API identifier differs from step 3 |
| 401 `TOKEN_CLAIMS_MISSING` | The Action in step 5 is not deployed or not in the post-login flow |
| 503 `AUTH_NOT_CONFIGURED` | The server's `.env` has no `AUTH0_DOMAIN` or `AUTH0_AUDIENCE` (or, for role changes, no M2M values) |
| 503 `AUTH_PROVIDER_UNAVAILABLE` | Auth0 (keys or Management API) is unreachable or the M2M app lacks the two scopes. Check the server log for `auth0.mgmt.misconfigured` |
| 403 `MFA_REQUIRED` for an admin | The token has no `mfa` claim: sign out and in and finish MFA, and check the Action sets `${ns}mfa` |
| No Sign in button at all | The client's `.env` is missing one of the three `VITE_AUTH0_*` values |
| Signed in, but Report sends you to Verify your email | Your email is not verified yet. Open the link Auth0 emailed you, then press "I've verified it" |
| Bootstrap script exits 2 / 4 / 5 | 2: sign in once first. 4: verify the email. 5: Auth0 flag failed; check the M2M values and scopes, then rerun |
