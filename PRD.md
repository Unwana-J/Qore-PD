# Exhaustive PRD: Qore Implementation & Project Delivery Platform

## 1. Vision & Purpose
Qore is a mission-critical internal operating system designed for high-stakes project delivery and service implementations. It consolidates financial health, schedule performance, and granular operational tracking into a single "Modern Sovereign" executive dashboard.

---

## 2. User Roles & Permissions Matrix

| Role | Core Purpose | Access Level | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Superadmin** | System Integrity | **Full** | User Management, Global Config, Maintenance Mode, Role Switching (Simulation), Audit Logs. |
| **Executive** | Strategic Oversight | **Read-Only** | Portfolio Analytics, Revenue Totals, Audit Logs, SPI Trends. Cannot edit project data. |
| **Manager** | Operational Lead | **High** | Project Creation, Team Assignment, Package/Service Configuration, PM Management. |
| **IM Lead** | IM Team Oversight | **High** | Approval of Suspension/Extension requests, Team Leaderboards, Operational Filters. |
| **Project Manager** | Execution | **Scoped** | Managing parent projects, Risk Logs, Rebaselining, Approval of IM Mappings. |
| **Implementation Manager** | Technical Delivery | **Scoped** | Milestone tracking for specific services, Issue Logging, Mapping requests. |
| **Finance** | Billing & Audit | **Scoped** | Revenue control, Billing value audits, Currency conversion oversight. |

---

## 3. Functional Requirements

### 3.1. Project Portfolio Management
- **REQ-01: Multi-Currency Revenue Tracking**: System must track revenue in NGN, USD, GBP, and EUR with real-time portfolio aggregation.
- **REQ-02: SPI Calculation**: Schedule Performance Index (SPI) must be calculated as `Progress / ExpectedProgress` based on Baseline vs Target dates.
- **REQ-03: Activity Feed**: Every mutation to a project (status, revenue, dates) must be logged and visible in a chronological feed.
- **REQ-04: Rebaselining**: Supports a formal "Rebaseline" submission to reset project timelines while preserving the original "Contractual Baseline" for variance analysis.

### 3.2. Implementation Management (IM)
- **REQ-05: Milestone Lifecycle**: Each service must support a customizable list of milestones. Progress is calculated as the percentage of completed milestones.
- **REQ-06: Mapping Protocol**: Standalone implementations can be "Mapped" to Projects. This requires a workflow: `IM Request` -> `PM Review` -> `Status: Approved/Rejected`.
- **REQ-07: Issue Log**: Dedicated blocker tracking for implementations. Must support:
    - Categorization (Technical, Client, Third-Party).
    - Impact scoring (Low to High).
    - Lifecycle (Open -> Addressing -> Resolved).
- **REQ-08: Request Workflows**: Formalized requests for "Date Extensions" and "Suspensions" with mandatory justification fields.

### 3.3. Advanced Analytics & Insights
- **REQ-09: IM Leaderboard**: A performance engine that ranks IMs based on:
    - **Volume**: Total active implementations.
    - **Success Rate**: % closed within SLA.
    - **Speed**: Average days to milestone completion.
- **REQ-10: Dynamic Period Filtering**: Users must be able to slice all analytics by:
    - Specific Year (e.g., "Show me 2025 implementations").
    - Custom Date Range (e.g., "Last 7 days" or "Specific Week").

### 3.4. Bulk Data Ingestion
- **REQ-11: Resumable Drafts**: If a user starts a bulk import and closes the browser, the draft must persist (LocalStorage) and offer "Resume" or "Abandon" upon return.
- **REQ-12: Notes-to-Comment Mapping**: The system must automatically parse a "Key Updates" or "Notes" column in CSVs and inject it as the first implementation comment.
- **REQ-13: Validation Preview**: Users must be able to edit rows inline before finalized database insertion.

---

## 4. Core User Flows

### 4.1. Implementation Mapping Flow
1. **Initiation**: IM creates a new Service Implementation (e.g., "Cards").
2. **Request**: IM clicks "Map to Project" and selects a parent Project (e.g., "Global Trust Bank Migration").
3. **Notification**: The assigned PM sees a "Pending Request" on their dashboard.
4. **Action**: PM reviews mapping notes and approves.
5. **Result**: The implementation milestones are now visible within the Project's "Execution" view.

### 4.2. Bulk Import & Comment Flow
1. **Upload**: User uploads a CSV with 50 implementations.
2. **Persistence**: User accidentally refreshes. Modal reappears: "You have a pending draft. Resume?"
3. **Review**: User sees that "Client A" has a note: "Delayed due to API keys". This is automatically mapped to the "Comments" preview.
4. **Finalize**: User clicks "Process Import". The 50 records are created, and the first comment for each implementation is pre-populated with the CSV notes.

### 4.3. Milestone Sync Flow (Settings)
1. **Baseline Update**: Superadmin adds a "Security Audit" milestone to the "Transfers" service in Settings.
2. **Save**: Upon clicking Save, a prompt appears: "Sync with 12 active implementations?".
3. **Sync**: System iterates through all 12 active "Transfers" projects, appends the new milestone, and maintains the order without clearing previously completed steps.

---

## 5. UI/UX Standards
- **Aesthetic**: True Obsidian (#0A0A0B), high-glassmorphism (backdrop-blur-md), and subtle teal/gold accents.
- **Responsive**: Full desktop experience with mobile-adaptive dashboards for Executives.
- **Micro-interactions**: Framer Motion transitions for all modals, hover-states for leaderboard cards, and skeleton loading for analytics.
