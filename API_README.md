# Qore Platform: API Documentation

This document provides a comprehensive overview of the internal API endpoints and methods used within the Qore Implementation & Project Delivery Platform. All methods are part of the global `api` object and utilize Supabase for data persistence and real-time updates.

---

## 1. Project Management (`api.projects`)

| Method | Description |
| :--- | :--- |
| `getAll()` | Retrieves all projects, ordered by creation date. |
| `getPaginated(page, pageSize, filters)` | Fetches a subset of projects with server-side filtering (state, PM, search, portfolio, etc.) and pagination. |
| `getById(id)` | Retrieves a single project by its unique ID. |
| `create(projectData)` | Inserts a new project into the database. |
| `update(project)` | Updates an existing project record. |
| `createBulk(toAdd, toUpdate)` | Performs a batch operation to insert new projects and update existing ones (used during bulk import). |
| `deleteByIds(ids)` | Batch deletes projects by their IDs. |

---

## 2. Implementation Management (`api.serviceExtensions`)

| Method | Description |
| :--- | :--- |
| `getAll()` | Retrieves all implementation service extensions. |
| `getByIM(imName)` | Fetches implementations assigned to a specific Implementation Manager. |
| `getByProject(projectId)` | Retrieves approved implementations linked to a parent project. |
| `create(extData)` | Creates a new standalone implementation. |
| `createBulk(extensions)` | Batch inserts multiple implementations. |
| `updateMilestones(id, milestones, status, ...)` | Updates progress for an implementation and syncs status back to the linked project. |
| `reassign(id, newIM, ...)` | Reassigns an implementation to a new IM and logs assignment history. |
| `syncMilestones(serviceName, milestones)` | **Propagates baseline milestone changes** from settings to all active implementations of that service. |
| `addComment(id, author, content)` | Adds a comment to an implementation and triggers notifications for relevant parties. |
| `addIssue(id, desc, impact, category)` | Logs a new blocker/issue for the implementation. |
| `updateIssue(id, issueId, updates)` | Updates or resolves an existing issue. |

### Mapping & Suspension Workflows
| Method | Description |
| :--- | :--- |
| `requestMapping(id, projectId, notes)` | IM requests to link an implementation to a parent project. |
| `approveMapping(id, approvedBy)` | PM approves a mapping, syncing service states and IM assignments. |
| `rejectMapping(id, comment)` | PM rejects a mapping request with a mandatory reason. |
| `unmapFromProject(id, comment, ...)` | Detaches an implementation from a project. |
| `requestExtension(id, request)` | IM requests a new target closure date. |
| `approveExtension(id, approvedBy)` | Approves a date extension and logs history. |
| `requestSuspension(id, reason, ...)` | IM requests to pause implementation activity. |
| `approveSuspension(id, resolvedBy)` | Finalizes suspension and updates status. |
| `freezeByProject(projectId)` | Automatically suspends all implementations linked to a project when the project is suspended. |

---

## 3. User & Access Management (`api.users` & `api.invites`)

| Method | Description |
| :--- | :--- |
| `users.getAll()` | Retrieves all user profiles and calculates "Inactive" status based on 90-day activity. |
| `users.update(userId, updates)` | Updates user role, name, or status. |
| `users.delete(userId, email)` | Fully removes a user and their pending invites. |
| `users.resetPassword(email)` | Triggers a Supabase password reset flow. |
| `invites.getAll()` | Fetches all pending system invitations (Superadmin only). |
| `invites.send(email, role, name)` | Creates a new invitation record in the database. |
| `invites.delete(id)` | Cancels a pending invitation. |

---

## 4. Notifications (`api.notifications`)

| Method | Description |
| :--- | :--- |
| `getAll(userId)` | Retrieves all unread and read notifications for a user. |
| `markAsRead(id)` | Marks a specific notification as read. |
| `markAllAsRead(userId)` | Marks all pending notifications for a user as read. |
| `clearAll(userId)` | Deletes all notification records for a user. |
| `create(userId, msg, type, ...)` | Creates a single notification for a user. |
| `createMany(list)` | Batch creates notifications for multiple recipients (e.g., when a comment is added). |

---

## 5. System Configuration & Auditing (`api.config` & `api.audit`)

| Method | Description |
| :--- | :--- |
| `config.get()` | Retrieves the global application configuration (SLA thresholds, currencies, service baselines). |
| `config.update(config)` | Updates global settings (Superadmin only). |
| `audit.addLog(log)` | Manually injects an entry into the system audit trail. |
| `audit.getLogs()` | Retrieves all audit logs for compliance review. |

---

## 6. Weekly Performance Digests (`api.digests` & `api.implementationDigests`)

| Method | Description |
| :--- | :--- |
| `getHistorical()` | Fetches past weekly performance reports. |
| `save(digest)` | Generates and persists a new weekly digest for portfolio or implementation performance. |
