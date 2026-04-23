# MVP App Structure

This is the recommended structure for the first usable version of SkinSignal.

## Product Goal

Build a lightweight SaaS-style workflow for dermatology and aesthetic clinics that handles:

- Google review monitoring
- AI review reply drafts
- WhatsApp review request campaigns
- private feedback capture
- incoming enquiry tracking
- basic reporting

## Recommended Tech Direction

Use a simple web app first.

- Frontend: Next.js or React
- Backend: Node.js API routes or Supabase
- Database: Supabase Postgres
- Auth: email/password magic link for clinic staff
- Messaging: WhatsApp Cloud API or Twilio
- AI: OpenAI for reply drafts and summaries

## Suggested Folder Structure

```text
skinsignal/
  app/
    login/
    dashboard/
    reviews/
    patients/
    campaigns/
    enquiries/
    settings/
  components/
    layout/
    dashboard/
    reviews/
    campaigns/
    forms/
  lib/
    ai/
    whatsapp/
    google/
    db/
    utils/
  data/
    sample/
  public/
    brand/
  docs/
    prompts/
    onboarding/
  scripts/
```

## Core Screens For Version 1

### 1. Login

Used by clinic owner or front-desk manager.

### 2. Dashboard

Show:

- average rating
- new reviews this month
- pending replies
- review requests sent
- private complaints captured
- WhatsApp enquiries

### 3. Reviews

Show:

- list of incoming reviews
- source
- rating
- sentiment
- AI draft reply
- approve / edit / mark done

### 4. Patients

Show:

- uploaded patient list
- visit date
- review request status
- response status

### 5. Campaigns

Show:

- WhatsApp templates
- request batches
- sent counts
- click-through performance

### 6. Enquiries

Show:

- incoming lead name
- source
- status
- follow-up stage
- booked / not booked

### 7. Settings

Show:

- clinic details
- Google review link
- WhatsApp number
- business hours
- staff roles

## Data Model

### clinics

- id
- name
- niche
- city
- whatsapp_number
- google_review_link
- created_at

### users

- id
- clinic_id
- name
- email
- role

### reviews

- id
- clinic_id
- source
- reviewer_name
- rating
- review_text
- sentiment
- ai_reply
- status
- created_at

### patients

- id
- clinic_id
- name
- phone
- visit_date
- review_request_status
- feedback_status

### campaigns

- id
- clinic_id
- type
- template_name
- sent_count
- delivered_count
- clicked_count
- created_at

### enquiries

- id
- clinic_id
- name
- phone
- source
- intent
- status
- assigned_to
- created_at

### feedback_items

- id
- clinic_id
- patient_id
- score
- message
- status
- created_at

## MVP Workflow

1. Staff uploads recent patient list.
2. Review request messages are triggered through WhatsApp.
3. Happy patients are sent to Google review link.
4. Unhappy patients are routed to private feedback form.
5. New Google reviews are imported or logged manually at first.
6. AI drafts a reply for each review.
7. Clinic staff approves and sends responses.
8. Enquiries are tracked and followed up.

## Manual First, Automation Second

For your first few clients, some steps can be manual:

- manual review import
- manual WhatsApp batch sending
- manual approval before every reply
- manual booking status updates

This is fine for early revenue.

## Build Order

### Phase 1

- login screen
- dashboard
- reviews page
- AI reply generation

### Phase 2

- patient upload
- WhatsApp campaign page
- private feedback capture

### Phase 3

- enquiry tracker
- booking workflow
- reports export

## Immediate Next Build

If we keep building in this workspace, the next implementation order should be:

1. landing page
2. dashboard UI
3. reviews page
4. patient upload page
5. campaign page

