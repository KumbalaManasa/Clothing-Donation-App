// Local-dev delivery stub for out-of-band account-recovery messages
// (password reset codes/links). This is a different concern from spec.md's
// "notifications are never sent via push/SMS/email" scope decision — that's
// about the in-app donation-flow notifications (claimed/picked_up/etc.); a
// password reset has to reach the user somehow, and there's no real
// email/SMS provider account configured for local development (same
// no-cloud-account posture as Task 13A's local image storage and the
// verifyNgo stub). Production wiring to a real provider is a Task 13B
// concern — routes only ever call sendMessage(), never a provider SDK
// directly, so that swap doesn't touch route code later.
//
// For local testing this logs the message to the backend console AND lets
// the caller also return the raw secret in the API response when not in
// production, so the whole flow is testable through the browser alone.
function sendMessage({ to, channel, subject, body }) {
  console.log(`\n[DEV MESSAGE — ${channel.toUpperCase()} to ${to}]\n${subject}\n${body}\n`);
}

module.exports = { sendMessage };
