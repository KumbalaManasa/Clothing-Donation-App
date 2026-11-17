# Local HTTPS dev certificate

`navigator.geolocation` ("Use my current location") only works in a browser
**secure context** — `https://` or `http://localhost` specifically. A plain
`http://192.168.x.x:5173` LAN address can never satisfy that, no matter what
application code does. This self-signed cert lets both the frontend (Vite)
and backend (Express) serve HTTPS on the LAN so GPS actually works for
everyone on the WiFi, not just on this machine.

Local development uses HTTP by default. The frontend and backend use these
files only when started with `DEV_HTTPS=1`; this is an opt-in for testing
secure-context features such as geolocation. The certificate is self-signed,
so a browser will warn when opening either HTTPS origin. Do not use this
development certificate in production.

## Regenerating

The cert/key are gitignored (per-machine, tied to your current LAN IP) and
expire after 825 days. Regenerate with:

```bash
# find your current LAN IPv4 first (ipconfig on Windows, ifconfig/ip addr on mac/Linux)
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 \
  -keyout Code/certs/dev-key.pem -out Code/certs/dev-cert.pem \
  -days 825 -nodes -subj "/CN=donation-app-local" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:<YOUR-LAN-IP>"
```

(Drop `MSYS_NO_PATHCONV=1` outside Git Bash on Windows.)

## Using it

Set `DEV_HTTPS=1` in the environment for both the backend and frontend, then
restart them. Visit `https://<YOUR-LAN-IP>:5173` to test geolocation over the
LAN. Without that opt-in, both servers use HTTP.

**Every visitor (including you, first time) will see a "Your connection
isn't private" warning** — that's expected for a self-signed cert. Click
"Advanced" → "Proceed" once per browser/device, for both the frontend
(`:5173`) and backend (`:4000`) origins. This is a one-time click, not a
recurring problem, and it goes away entirely once the app is deployed with a
real hosting provider's certificate.
