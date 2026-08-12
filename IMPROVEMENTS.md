# Improvements & backlog

Living log of **UI/flow changes** shipped in this repo and **backend work** still needed for production-grade behavior.

Update this file whenever you ship frontend improvements or identify API/DB gaps.

---

## How to use this file

| Section | What goes here |
|---------|----------------|
| **Shipped (frontend)** | Done UI/flow changes with date and files touched |
| **Shipped (backend)** | Done API/DB changes (when someone works on `server/`) |
| **Backend backlog** | API/DB work required later; link to frontend that depends on it |
| **Ideas / later** | Nice-to-haves not yet committed |

---

## Shipped — frontend

### 2026-08-12 — Brand lockup in sidebar only

**Goal:** CollegeDunia logo + name live in the dark left pane, not the white top bar. Official lockup on a white plate (same as login); collapse in the sidebar footer.

**Files:** `src/components/layout/AppShell.tsx`, `src/index.css`

---

### 2026-08-12 — Pie charts: labels always visible

**Goal:** Name, count, and % visible without hovering.

**Files:** `src/components/charts/chartTheme.ts`, `CampaignAnalytics.tsx`, `AnalyticsSuite.tsx`

---

### 2026-08-12 — CSV required field hint

**Goal:** Show the one mandatory CSV column without extra UI.

**Behavior:** Bold line `Required: phone_number` on campaign upload surfaces.

**Files:** `src/pages/InstitutePage.tsx`, `src/components/channel/ChannelWorkspace.tsx`, `src/index.css`

---

### 2026-08-12 — Login screen visual polish

**Goal:** Tighter hierarchy and standard login interactions on the sign-in card only.

**Behavior**

- Brand line “CollegeDunia CRM” above role title; 44px inputs/button; primary-tinted role toggle with icons.
- Password focused when email is prefilled; Left/Right arrows switch Institute/Admin.
- Spinner on Sign in; toggle/fields disabled while busy.

**Files:** `src/pages/LoginPage.tsx`, `src/index.css`

---

### 2026-08-12 — Login screen UX polish

**Goal:** Standard sign-in patterns: clearer hierarchy, password visibility, error/caps feedback.

**Behavior**

- Title/hint change with Institute vs Admin.
- Show/hide password; Caps Lock warning; fields disabled while signing in.
- Error shown as an alert banner. Footer explains how to get access (no fake forgot-password).

**Files:** `src/pages/LoginPage.tsx`, `src/index.css`

---

### 2026-08-12 — Login: institute user default (left)

**Goal:** Primary audience first. Institute users are the common login; admin is secondary.

**Behavior**

- Segmented control: **Institute user** (left, default) · **Admin** (right).
- Remembers last selected role and last email per role in `localStorage`.
- Clears password when switching roles.
- Radiogroup semantics (`role="radiogroup"` / `role="radio"`).

**Files:** `src/pages/LoginPage.tsx`

---

### 2026-08-12 — Institute nav: one Dashboard item

**Goal:** Stop showing Home and Dashboard as two active links to the same page for institute users.

**Behavior**

- Institute login: sidebar shows **Dashboard** only (no Home).
- Admin login: **Home** = institute picker; **Dashboard** = selected institute.
- Institute dashboard breadcrumb no longer links to `/admin`.

**Files:** `src/components/layout/AppShell.tsx`, `src/pages/InstitutePage.tsx`, `src/components/channel/ChannelWorkspace.tsx`

---

### 2026-08-12 — Fix Vercel build after merging `main`

**Goal:** Restore a clean campaign modal footer after teammate merged analytics into this branch.

**Cause:** Merge of `main` (analytics page) into `feat/institute-draft-campaign-flow` duplicated/broke JSX in `InstitutePage.tsx` Run Campaign footer. Vercel preview failed (`tsc`).

**Fix:** Reconstructed the footer (Close + Run Campaign). Local `npm run build` passes.

**Files:** `src/pages/InstitutePage.tsx`

---

### 2026-08-12 — Campaign modal: horizontal stepper + flow UX

**Goal:** Clearer setup progress (industry-style stepper), summary of campaign state, remove Voicebot nav from modal.

**Behavior**

- Horizontal 3-step stepper: Create campaign → Add leads → Run campaign.
- Summary strip: course, status, lead counts, created date.
- Phase callout: upload / ready / running / completed.
- Removed **Voicebot** button from campaign modal footer.
- Green **Sample CSV** button in upload panel.

**Files**

| File | Change |
|------|--------|
| `src/components/channel/CampaignSetupFlow.tsx` | Stepper + summary header |
| `src/pages/InstitutePage.tsx` | Modal layout, footer |
| `src/index.css` | Stepper and callout styles |


**Goal:** Institute users can save empty draft campaigns (no leads required at create). Unused drafts can be removed. Clearer create → upload → run flow.

**Behavior**

- Create campaign with name + course only → status `draft`, no leads required.
- Create with CSV → status `ready` when leads exist.
- **Delete** only unused drafts: `status === 'draft'`, zero active leads, never pushed to Convin.
- No delete once leads are added or campaign has been run.
- Delete from campaign list (trash icon) or campaign modal footer.

**Files**

| File | Change |
|------|--------|
| `src/utils/campaignDraft.ts` | `isUnusedDraftCampaign`, local hide via `localStorage` |
| `src/context/AppContext.tsx` | `deleteDraftCampaign`, filter hidden IDs on CRM poll |
| `src/pages/InstitutePage.tsx` | Delete UI, 3-step empty-campaign flow, create modal UX |
| `src/index.css` | Campaign row, flow steps, modal footer, create modal styles |

**Limitation (frontend-only delete)**

- Draft is hidden in the UI + `localStorage` key `cd-crm-hidden-draft-campaigns`.
- Row still exists in Postgres until backend delete exists (see backlog below).
- Other browsers/devices still see the draft.

---

## Shipped — backend

_None for draft-delete work (intentionally frontend-only)._

---

## Backend backlog

Items below are **not implemented** in `server/` yet. Frontend may work partially without them (same browser / session only).

### P1 — Delete unused draft campaigns (DB)

**Why:** Frontend delete is cosmetic; drafts remain in `crm_campaigns` and reappear on new browser or after clearing site data.

**Suggested API**

```
DELETE /api/crm/campaigns/:id
```

**Rules (match frontend `isUnusedDraftCampaign`)**

- Allow only when `status = 'draft'`
- No rows in `crm_leads` for that `campaign_id` (or only archived — prefer zero leads)
- Never allow if any lead was successfully pushed to Convin

**Frontend follow-up after API exists**

1. Add `deleteCrmCampaign(id)` in `src/services/crm.ts`
2. Call it from `deleteDraftCampaign` in `AppContext.tsx`
3. Remove or keep `localStorage` hide as fallback for offline/errors

**Files to touch (backend)**

- `server/src/crm.js` — `deleteCrmCampaign(id)` with guards
- `server/src/index.js` — route + auth
- `server/src/docs.js` — document endpoint

---

### P2 — Live lead status sync from webhooks

**Why:** Convin webhooks update Postgres (`/webhooks/convin`), but the React app does not poll CRM/analytics to refresh lead `clientStatus`, recordings, or minutes after a run.

**Options**

- `GET /api/crm/campaigns/:id` refresh (already exists?) on interval or after run
- Or dedicated `GET /api/crm/campaigns/:id/sync` merging webhook state

**Frontend follow-up**

- Poll or refetch after voicebot run completes
- Optionally subscribe if websockets added later

---

### P3 — Campaign delete audit / soft-delete (optional)

**Why:** Hard delete may be undesirable for ops; soft-delete with `deleted_at` preserves history.

**Alternative to P1** if compliance matters:

- `PATCH /api/crm/campaigns/:id` with `deleted: true` for drafts only
- Filter deleted rows in `listCrmCampaigns`

---

## Ideas / later (not scoped)

- Email / SMS / WhatsApp channel send integrations (UI shells exist today)
- Real audio playback for recordings (currently demo UI)
- Pause/resume campaign calling Convin APIs (today local status only)
- Admin: delete institute drafts across tenants

---

## Changelog template (copy for new entries)

```markdown
### YYYY-MM-DD — Short title

**Goal:** …

**Behavior:** …

**Files:** …

**Backend needed:** Yes/No — link to backlog item
```
