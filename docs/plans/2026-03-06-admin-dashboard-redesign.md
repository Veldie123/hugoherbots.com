# Admin Dashboard Redesign — Iteratief

**Datum:** 2026-03-06
**Status:** Goedgekeurd, implementatie gestart

## Context

Het admin dashboard is non-functioneel (API endpoint mismatch, data-structuur mismatch, nep-scores). Hugo wil een dashboard met — in volgorde: acties, platform gezondheid, coachees, content kwaliteit, bugs, user feedback.

## 4 Fasen

### Fase 1: Dashboard werkend maken
- Fix API endpoint (`/api/admin/dashboard-stats`)
- Map backend data naar frontend interface
- Verwijder nep-score, vervang Revenue KPI met Analyses

### Fase 2: Action Center
- Nieuwe sectie bovenaan: pending corrections, ongelezen notificaties, nieuwe signups
- Data bronnen bestaan al (admin_notifications, admin_corrections)

### Fase 3: Coachee Overzicht
- Lijst van users met sessie count, gem. score, laatst actief
- Start < 20 users (individueel), schaalt naar 100+

### Fase 4: Bug tracking + Feedback
- 3 nieuwe DB tabellen: platform_feedback, platform_nps, frontend_errors
- 3 user-facing widgets: SessionRating, FeedbackButton, NPSSurvey
- Dashboard sectie met feedback stats

## Beslissingen
- Iteratief ipv volledige herontwerp (user keuze)
- Revenue KPI vervangen door Analyses (geen Stripe integratie)
- Feedback: micro (per sessie) + macro (NPS elke 4 weken)
- Bug tracking: automatisch (error boundary) + handmatig (feedback widget)
