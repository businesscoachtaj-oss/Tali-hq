# Tali voice server

Speaks Tali HQ replies in Tali's real voice (the same Kokoro blend as her videos) for Pro users.
The app never talks to this directly: the `tali-voice` edge function calls it and caches the MP3.

## Put it online (Railway, about 5 minutes)

1. Sign in at railway.com with GitHub.
2. New Project, Deploy from GitHub repo, pick `Tali-hq`.
3. In the service settings set Root Directory to `voice-server`. Railway finds the Dockerfile.
4. Variables: add `VOICE_KEY` with a long random value (a password generator is fine).
5. Settings, Networking, Generate Domain. Copy the https address.
6. Give Claude the address. Claude saves it and the key as the Supabase secrets
   `TALI_VOICE_URL` and `TALI_VOICE_KEY`, and voice switches on for Pro users.

It needs about 1 GB of memory. Check it is up by opening `<address>/health`.
