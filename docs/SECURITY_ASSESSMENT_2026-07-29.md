# Leak Alert Security Assessment — July 29, 2026

Target: DCWD Leak Alert development portal and its application API

Method: Non-destructive HTTP inspection, public client artifact review,
controlled authentication checks, CORS checks, unauthenticated API requests,
and Maestro browser authorization tests.

## Executive result

Security recommendation: **Remediation required before production**

Confirmed findings: 5  
Needs confirmation: 2  
Positive controls verified: 3

## SEC-2026-001 — Browser security headers are absent

Severity: High  
Status: Confirmed

Steps to reproduce:

1. Request `https://dev-myportal.davao-water.gov.ph/gis/leak/`.
2. Inspect the successful `200 OK` response headers.

Expected: The application supplies an appropriate Content-Security-Policy,
Strict-Transport-Security, frame-ancestors or X-Frame-Options,
X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

Actual: None of these headers were present.

Impact: Browser protections against content injection, clickjacking, protocol
downgrade, MIME confusion, and unnecessary browser capabilities are weakened.

## SEC-2026-002 — HTTPS canonicalization redirects through HTTP

Severity: Medium  
Status: Confirmed

Steps to reproduce:

1. Request `https://dev-myportal.davao-water.gov.ph/gis/leak`.
2. Inspect the `Location` response header.
3. Request the resulting HTTP trailing-slash URL.

Expected: HTTPS canonicalization remains on HTTPS and redirects directly to the
canonical HTTPS trailing-slash URL.

Actual: HTTPS redirects to
`http://dev-myportal.davao-water.gov.ph/gis/leak/`; HTTP then redirects back to
the non-trailing-slash HTTPS URL.

Impact: Clients following redirects may enter a redirect loop and are directed
toward an insecure scheme.

## SEC-2026-003 — Complete source map is publicly exposed

Severity: High  
Status: Confirmed

Steps to reproduce:

1. Request the JavaScript source-map URL referenced by the deployed bundle.
2. Inspect the returned map.

Expected: Production deployments omit source maps or restrict them to
authorized diagnostic systems.

Actual: An unauthenticated request returned an 8,000,586-byte source map with
1,406 source files and all 1,406 `sourcesContent` entries. It exposes original
authentication, API, image, dispatch, repair, routing, and state-management
source code.

Impact: Attackers can efficiently map endpoints, authentication behavior,
privileged workflows, and implementation weaknesses.

## SEC-2026-004 — Authentication tokens and user data use localStorage

Severity: High  
Status: Confirmed by deployed source

Steps to reproduce:

1. Inspect the deployed source map.
2. Review `components/Endpoints/Api.ts`, `stores/loginStore.ts`, and `App.tsx`.

Expected: Long-lived authentication material is stored in Secure, HttpOnly,
appropriately SameSite cookies, with server-controlled expiration and logout.

Actual: Access tokens, refresh tokens, username, access level, and serialized
user data are read from or written to `localStorage`. The client independently
sets a 24-hour `token_expiry`.

Impact: Any successful script injection can read and exfiltrate the tokens and
user profile. Client-side role and login state are also easier to manipulate.

## SEC-2026-005 — Server technology versions are disclosed

Severity: Low  
Status: Confirmed

Steps to reproduce:

1. Request the portal and API.
2. Inspect response headers.

Expected: Server headers do not disclose precise implementation versions.

Actual: The portal returns `Server: nginx/1.28.0`; the API returns
`X-Powered-By: ASP.NET`.

## SEC-2026-006 — Login throttling is not externally observable

Severity: Medium  
Status: Needs confirmation with the identity-service owner

Steps to reproduce:

1. Send six login attempts using a deliberately invalid QA username.
2. Compare status codes and response times.

Expected: Repeated failures produce documented throttling, progressive delay,
or a rate-limit response without enabling account enumeration.

Actual: All six attempts returned HTTP `400` in approximately 0.03–0.06 seconds,
without a rate-limit status or observable delay.

Note: Six attempts are insufficient to prove that no upstream or account-based
protection exists. Higher-volume testing was intentionally not performed.

## SEC-2026-007 — Public Google Maps API key needs restriction verification

Severity: Medium  
Status: Needs confirmation

Steps to reproduce:

1. Inspect the public application JavaScript.
2. Locate the Google Maps loader URL.

Expected: A browser-exposed Maps key is restricted to approved HTTP referrers,
required APIs only, and an appropriate quota.

Actual: A Maps API key is present in the public bundle, as expected for a
browser integration. Its provider-side restrictions could not be verified from
the client.

## Positive controls verified

- An unauthenticated leak-report API request returned `401 Unauthorized`.
- A request using an unapproved hostile Origin returned `403 Forbidden`.
- Common API exposure paths for `.env`, `.git/config`, and Swagger returned
  `404`; the portal's apparent `200` responses for similar paths were the
  generic SPA fallback, not the requested sensitive files.

## Testing not performed

The following require a maintenance window or additional infrastructure:

- denial-of-service, sustained rate-limit, and account-lockout testing;
- destructive or high-volume active scanning and fuzzing;
- malware and executable upload testing;
- authenticated API role-matrix testing with separate server-verified role
  tokens;
- database verification and source-code-assisted penetration testing.

No credentials, access tokens, refresh tokens, customer data, or webhook values
are included in this report.
