# Matrix homeserver and bridges for Bird

Bird shows real chats by reading a Matrix account. A Matrix homeserver with
[mautrix bridges](https://docs.mau.fi/bridges/) copies each app's conversations
(with history) into Matrix rooms; Bird syncs those rooms into **All chats** and
sends your replies back through the bridge.

> **Status:** Bird's side (sign in, background sync, chats, replies, read
> receipts) is covered by automated tests against a fake homeserver
> (`server/test/matrix.test.js`). The files in this folder have **not** been run:
> they're a starting point. Bridge options change between versions, so use each
> bridge's documentation for the details marked below.

## What you need

- Docker (with Compose).
- Accounts on the apps you want to bring in. Bridges log in as **you**, so
  each has its own rules and risks (an app may restrict accounts that use
  unofficial clients).
- Snapchat has no mature bridge; keep using its web app inside Bird.
- Bridged rooms must **not** be end-to-end encrypted. Bird cannot read encrypted
  rooms (it shows "Encrypted message"). The mautrix bridges don't encrypt by
  default; don't turn it on.

## 1. Synapse

```sh
cd infra/matrix
docker run -it --rm -v "$PWD/synapse:/data" \
  -e SYNAPSE_SERVER_NAME=localhost -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate
```

Edit `synapse/homeserver.yaml`:

- Switch `database:` from sqlite to the Postgres service
  (`name: psycopg2`, host `postgres`, user/password/db from `docker-compose.yml`).
- Leave registration closed and create your account once it is running:

```sh
docker compose up -d postgres synapse
docker compose exec synapse register_new_matrix_user -c /data/homeserver.yaml -u you -p 'a-strong-password' -a http://localhost:8008
```

`server_name: localhost` is fine for one computer. If other devices or the
internet should reach it, use a real domain with HTTPS in front (Bird only
accepts `http://` for `localhost`).

## 2. Each bridge you want

For each service (`whatsapp`, `meta`, `discord`, `telegram`, `slack`,
`gmessages`):

1. `docker compose run --rm <service>` — writes `./<service>/config.yaml`, then exits.
2. Edit that file. At minimum (names differ a little per bridge, check its docs):
   homeserver address `http://synapse:8008`, homeserver domain `localhost`, the
   bridge's own database (sqlite is fine to start), and who may use it
   (`permissions`: your Matrix id, e.g. `"@you:localhost": admin`). Telegram
   also needs API id/hash from https://my.telegram.org.
3. `docker compose run --rm <service>` again — writes `./<service>/registration.yaml`.
4. Tell Synapse about it: put the files where Synapse can read them (they're in
   sibling folders, so mount them or copy them into `./synapse/`), then add to
   `homeserver.yaml`:

   ```yaml
   app_service_config_files:
     - /data/whatsapp-registration.yaml
   ```

   and restart Synapse.
5. `docker compose up -d <service>`.

## 3. Log in to each bridge

Sign in to Matrix with any client (Element, or Bird itself — see below) and
start a chat with the bridge bot (for example `@whatsappbot:localhost`). Send
`login` and follow its prompts (a QR code or a code, depending on the app).
Bridges create one room per conversation, with history, and invite you to them.

## 4. Connect Bird

Open Bird, then the profile menu → **Matrix and bridges**, and enter:

- Homeserver: `http://localhost:8008`
- Username and password of your Matrix account.

Bird signs in, keeps an encrypted access token (your password isn't stored),
and starts syncing. Chats appear in **All chats** on the right app (WhatsApp,
Instagram, Messenger, Discord, Telegram, Slack, Google Messages, or Matrix for
rooms that aren't bridged). It automatically accepts room invites that come from
your own homeserver (the bridge bots), and ignores everyone else's.

Notes:

- Bird's server keeps the access token encrypted with a key in
  `server/.secrets/secret.key` (or `BIRD_SECRET_KEY`, 32 bytes, base64). Back it
  up with your database: without it you just sign in to Matrix again.
- Bird imports the most recent 20 messages of each room on first sync, then
  every new message. It does not yet page back through older history (that
  would use the `/messages` endpoint when you scroll up).
- Disconnecting in Bird signs out of the homeserver and deletes the imported
  chats from Bird. It does not touch the bridges or the apps.
