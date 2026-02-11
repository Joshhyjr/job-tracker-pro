

# Job Application Tracker — Implementation Plan

## Overview
A responsive single-page app to track job applications, seeded with the 75 records from your Excel file. All data persists in browser localStorage with export capabilities.

---

## Data Model
Each application record will have these fields (mapped from your Excel):
- **id** (auto-generated)
- **Job Title**, **Company Name**, **Location**
- **Current Status** — dropdown: Applied, Interview, Offer, Rejected, No Response, Withdrawn
- **Response Status** — dropdown: No response yet, Auto-reply received, Human reply received, Interview scheduled, Offer received, Rejected
- **Follow Ups** — Yes/No
- **Date Applied**, **Follow-Up Date**
- **Notes**
- **Activity Log** — array of timestamped entries (status changes, follow-up notes)

All 75 rows from the Excel will be embedded as the initial seed data on first load.

---

## Screens

### 1. Dashboard (Home)
- **Metric cards**: Total applications, applied this week, applied this month, overdue follow-ups
- **Status breakdown** as colored cards or a donut chart (Applied, Interview, Offer, Rejected, No Response, Withdrawn)
- **Weekly trend** bar chart using Recharts
- **Quick filter** chips: This week · Last 2 weeks · This month
- Clicking a status card navigates to the Applications List filtered by that status

### 2. Applications List
- **Searchable table** — search across Job Title, Company, Location, Notes
- **Default sort**: Date Applied (newest first)
- **Filter chips**: Current Status, Response Status, Location, Follow-up Needed
- Each row is clickable → opens Application Detail
- Bulk status indicator with color-coded badges

### 3. Application Detail (slide-over panel or dedicated page)
- All fields displayed in a clean card layout
- **Quick actions**:
  - Edit any field inline
  - One-click status update buttons (Mark Rejected, Mark Offer, etc.)
  - Add follow-up log entry (date + note)
- **Activity timeline** showing status changes and follow-up notes in chronological order

### 4. Add / Edit Application Form
- Form with all fields, pre-populated dropdown options matching the Excel's status lists
- Validation: dates must be valid, URL-format check on any link fields
- Save updates localStorage immediately

### 5. Follow-ups Page
- Lists applications that are:
  - Status "Applied" or "No Response" with Date Applied > 7 days ago and no follow-up done
  - Have a Follow-Up Date that is due or overdue
- Each row has a **"Copy Follow-Up Message"** button with two template options:
  - **Email template**: Short professional follow-up referencing Company, Role, and Date Applied
  - **LinkedIn template**: Shorter, conversational version
- One-click copy to clipboard with a toast confirmation

---

## Navigation
- **Top navigation bar** with app title and links: Dashboard · Applications · Follow-ups · Add New
- Responsive: collapses to hamburger menu on mobile

## Design
- Clean, modern UI using the existing shadcn/ui components (cards, tables, badges, dialogs, forms)
- Color-coded status badges for quick scanning
- Light/dark mode support via existing theme setup
- Fully responsive for desktop and mobile

## Storage & Export
- **localStorage** for all data persistence — works offline, no backend needed
- **Export buttons**: "Export CSV" and "Export XLSX" to download current data
- Seed data loads only on first visit; subsequent visits use saved data

