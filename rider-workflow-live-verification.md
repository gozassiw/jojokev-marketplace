# Rider workflow live verification

The new Vercel production deployment URL `https://jojokev-marketplace-kteyhaa6d-hut6.vercel.app` is serving the new rider workflow.

Verified routes:

- `/rider` redirects anonymous visitors to `/login?next=/rider`, confirming the protected rider workspace route exists.
- `/rider/register` loads successfully and displays the rider application form with phone number, vehicle type, vehicle plate number, buyer-code safety warning, and submit action.

The deployment was created through the authenticated Vercel deployment service with deployment URL `jojokev-marketplace-kteyhaa6d-hut6.vercel.app`. The main alias still needs a final alias/production verification after the asynchronous deployment completes.

A second deployment containing the admin rider-list fallback was created at `https://jojokev-marketplace-5xtmane21-hut6.vercel.app` and was still showing **Deployment is building** at 20:53 UTC when checked. The prior production deployment remains live while this corrected build completes.
