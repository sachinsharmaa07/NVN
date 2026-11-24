# Auth0 setup (about 20 minutes)

You do this once, in the Auth0 dashboard. Nothing here is a secret: the domain, client ID and API
identifier are public values. Menu names can differ a little as Auth0 changes its dashboard.

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
4. Scroll to **Refresh Token Rotation** and turn **Rotation** on. Set the inactivity lifetime to 7 days.
5. Under **Advanced Settings > Grant Types**, make sure **Authorization Code** and **Refresh Token** are ticked.
6. Save.

## 3. Create the API

1. **Applications > APIs > Create API**. Name `Nivaran API`, Identifier `https://api.nivaran.in`
   (any name you like; it is never called, only compared), signing algorithm **RS256**.
   The identifier is `AUTH0_AUDIENCE`.
2. On the API's **Settings** tab: set **Token Expiration** to `3600` seconds and turn on **Allow Offline Access**.
3. You do not need to turn on RBAC. Roles live in our own database (see below).

## 4. Turn on sign-in methods

1. **Authentication > Social > Google**: switch it on and enable it for `Nivaran Web`.
   Auth0's built-in Google keys are fine for development. Before launch you must use your own Google OAuth client.
2. **Authentication > Database**: keep `Username-Password-Authentication` enabled for `Nivaran Web`.
   Auth0 sends the verification email when someone signs up with email and password.
   Google sign-ins arrive already verified.

## 5. Add our claims to the token

The server needs the user's email and whether it is verified. Add a small Action:

1. **Actions > Library > Create Action > Build from scratch**. Name `Add Nivaran claims`, trigger **Login / Post Login**.
2. Paste this and click **Deploy**:

```js
exports.onExecutePostLogin = async (event, api) => {
  const ns = "https://nivaran.in/"; // must match CLAIM_NAMESPACE in server/src/services/userService.js
  api.accessToken.setCustomClaim(`${ns}email`, event.user.email);
  api.accessToken.setCustomClaim(`${ns}name`, event.user.name);
  api.accessToken.setCustomClaim(`${ns}email_verified`, event.user.email_verified === true);
};
```

3. **Actions > Triggers > post-login**: drag `Add Nivaran claims` into the flow between Start and Complete, then **Apply**.

Roles are not in the token. They live in MongoDB (`users.role`), so you can promote or suspend someone
without touching Auth0, and it takes effect on their very next request.

## 6. Fill in the settings

`server/.env`

```text
AUTH0_DOMAIN=nivaran-dev.us.auth0.com
AUTH0_AUDIENCE=https://api.nivaran.in
```

`client/.env`

```text
VITE_AUTH0_DOMAIN=nivaran-dev.us.auth0.com
VITE_AUTH0_CLIENT_ID=<the Client ID from step 2>
VITE_AUTH0_AUDIENCE=https://api.nivaran.in
```

Domain is the host only: no `https://`, no trailing slash. Restart `npm run dev`.

## 7. Try it

1. Open http://localhost:5173 and click **Sign in**. After Google, you land back on the page you were on.
2. In the browser's Network tab, `GET /api/me` should return 200 with `"role": "citizen"`.
3. A `users` document now exists in your `nivaran_dev` database.
4. To make yourself the first admin, edit your user's `role` to `super_admin` in Atlas (Browse Collections).
   There is no other way on purpose: nobody can grant themselves a role through the app.

## If something goes wrong

| You see | Usually means |
| --- | --- |
| Auth0 page says "Callback URL mismatch" | Step 2.3: the URL is missing or has a typo (check `http` vs `https`, the port, no trailing slash) |
| `GET /api/me` returns 401 `UNAUTHENTICATED` | `AUTH0_AUDIENCE` or `AUTH0_DOMAIN` on the server differs from the client's, or the API identifier differs from step 3 |
| 401 `TOKEN_CLAIMS_MISSING` | The Action in step 5 is not deployed or not in the post-login flow |
| 503 `AUTH_NOT_CONFIGURED` | The server's `.env` has no `AUTH0_DOMAIN` or `AUTH0_AUDIENCE` yet |
| No Sign in button at all | The client's `.env` is missing one of the three `VITE_AUTH0_*` values |
| Signed in, but Report sends you to Verify your email | Your email is not verified yet. Open the link Auth0 emailed you, then press "I've verified it" |
| "Resend the email" says it can't yet | Expected for now: it needs a machine-to-machine app, added in a later step |
