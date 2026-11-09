# Architecture rules
- Derive new inspection status through `src/lib/inspection-status.ts` so unfit precedence is tested independently of the form.
- Preserve supported Lovable Cloud authentication; do not mint admin links or introduce synthetic shared passwords as substitutes for an unsupported sign-in method.
- Personal Telegram credentials stay in a service-role-only table, encrypted with AES-GCM and account-bound additional data; authenticated server functions derive account identity from middleware, never request payloads.
- Telegram reports use event-time vehicle ownership plus current ownership, with retained deletion events for the final owner; audit actor identity never determines report access.
- Telegram sends aggregate-only messages; unique account/period claims and persisted sending state prohibit blind retries after ambiguous delivery.