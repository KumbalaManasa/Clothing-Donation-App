# Clothing Donation App — Idea Document

## 1. Problem Statement
Many people have unused, wearable clothes sitting idle at home, while many others nearby genuinely need them. There's no simple, trustworthy, and transparent way to connect the two — most existing donation processes are opaque (you drop clothes off and never know where they end up) or informal (random WhatsApp groups, no accountability).

## 2. Core Idea
A mobile/web app that connects **Donors** with **Volunteers/NGOs**, who then deliver clothes to **Receivers** — with visible status tracking at every step, so donors get a real sense of impact and the whole chain stays accountable.

## 3. Who It's For
| Role | Description |
|---|---|
| **Donor** | Anyone with unused clothes to give away |
| **Volunteer / NGO** | Verified individuals or organizations who collect and distribute clothes |
| **Receiver** | Person in need who receives the clothes (does not need to use the app directly) |

## 4. Core User Flow (5 Steps)
1. **Listing Created** — Donor adds photos, category, condition, and pickup/drop-off location.
2. **Claimed** — Verified volunteer/NGO browses nearby listings and claims one they can collect.
3. **Picked Up** — Volunteer collects clothes from donor; status updates to "Picked up."
4. **Distributed** — Volunteer hands clothes to a receiver (with consent); records first name + general area, optional photo.
5. **Delivered** — Status changes to "Delivered"; donor receives a confirmation note closing the loop.

## 5. Key Features (MVP)
- **Auth & Roles**: Donor, Volunteer/NGO (verified), Admin
- **Donor Flow**
  - Create listing (photos, category, condition, pickup/drop-off, location)
  - Track status of each donation (Listed → Claimed → Picked up → Delivered)
  - Receive confirmation note on delivery
- **Volunteer/NGO Flow**
  - Verification process (manual/admin-approved or document upload)
  - Browse/filter nearby listings (by location, category)
  - Claim a listing
  - Update status at pickup and delivery
  - Record receiver's first name, general area, optional handover photo
- **Notifications**
  - Status change alerts to donor (claimed, picked up, delivered)
- **Admin/NGO Verification Panel**
  - Approve/reject volunteer or NGO accounts
  - Basic moderation of listings

## 6. Trust & Transparency Principles
- Full visibility of status at every step for the donor
- Only minimal, non-identifying receiver info is captured (first name + general area) — privacy-respecting by design
- Optional photo proof adds confidence without being mandatory or invasive
- Only verified volunteers/NGOs can claim and distribute donations

## 7. Nice-to-Have / Future Scope
- In-app chat between donor and volunteer for pickup coordination
- Map view of nearby listings and NGOs
- Impact dashboard for donors (e.g., "You've helped 12 people this year")
- Ratings/reviews for volunteers and NGOs
- Category-based tagging (e.g., winter wear, kids' clothes, formal wear)
- Multi-item bulk donation listings
- SMS/WhatsApp notifications for low-connectivity users
- Gamification/badges for active donors and volunteers

## 8. Out of Scope (for MVP)
- Payments or monetary donations
- Direct receiver accounts/login
- Real-time GPS tracking of volunteers
- Multi-language support (can be phase 2)

## 9. Suggested Tech Direction (for vibe coding)
- **Frontend**: React (web) or React Native (mobile)
- **Backend**: Node.js/Express or Firebase (fast to prototype)
- **Database**: PostgreSQL (relational — good fit for status workflows) or Firestore for rapid MVP
- **Storage**: Cloud storage for photos (S3, Firebase Storage, or Cloudinary)
- **Auth**: Firebase Auth / Clerk / Auth0 for quick setup

## 10. Open Questions to Resolve in spec.md
- How is volunteer/NGO verification actually performed? (manual review, ID upload, org registration number?)
- Is location captured as GPS coordinates, address, or general area/pincode?
- Can a donor cancel a listing after it's claimed?
- What happens if a volunteer claims but never picks up (timeout/reassignment)?
- Single-item vs multi-item listings — one listing per clothing piece or a bundle?
- Is there a rating/feedback loop for volunteers or NGOs?
- What's the notification channel — push, SMS, email, or in-app only?