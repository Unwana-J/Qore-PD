# Data Backup & Security Guide: Qore Platform

Since the Qore platform is built on **Supabase (PostgreSQL)**, you benefit from enterprise-grade backup and security features out of the box. Below is the recommended strategy for protecting your project data.

---

## 1. Data Backup Strategy

### A. Automatic Daily Backups
Supabase performs automatic daily backups of your entire database. 
- **Retention**: Backups are typically retained for 7 days (Pro plan) or up to 30 days (Enterprise).
- **Restoration**: You can restore your database to any previous day's state via the Supabase Dashboard under **Project Settings > Backups**.

### B. Point-in-Time Recovery (PITR)
For critical production environments, enable **PITR**.
- This allows you to restore your database to a specific second in time (e.g., "restore to exactly 2:14 PM yesterday").
- This is the best protection against accidental "bulk deletes" or data corruption.

### C. Manual Backups (Off-site Storage)
It is a best practice to keep a local or secondary cloud backup. You can export your data using the `pg_dump` utility:
```bash
# Export schema and data
pg_dump -h db.your-project-id.supabase.co -U postgres > qore_backup_$(date +%F).sql
```
*Note: You will need your Database Password found in Project Settings.*

---

## 2. Data Protection & Security

### A. Row Level Security (RLS) — CRITICAL
All tables in the Qore platform (projects, service_extensions, notifications) have **RLS enabled**.
- **What it does**: It ensures that even if someone has your API key, they can only see data they are explicitly permitted to see based on their role.
- **Verification**: Ensure that every new table created in the future also has RLS enabled via the Supabase SQL Editor.

### B. Database Role Management
The app uses a `profiles` table to manage roles (Superadmin, PM, IM, etc.).
- **Protection**: Internal checks in `api.ts` and UI-level logic prevent unauthorized roles from accessing sensitive methods (like `config.update` or `users.delete`).
- **Audit Logs**: Every major action is logged in the `audit_logs` table, providing a "paper trail" for all data mutations.

### C. Connection Security
- **SSL**: All connections between the app and Supabase are encrypted via SSL.
- **API Keys**: Your `anon` key is safe for client-side use because of RLS. However, never expose your `service_role` key in the frontend code.

---

## 3. Disaster Recovery Checklist

1. **Test Restores**: Once a quarter, attempt to restore a backup to a "test" Supabase project to ensure the backup files are valid.
2. **Rotate Passwords**: Change your Database Password and JWT Secret every 6–12 months.
3. **Monitor Audit Logs**: Regularly review the `audit_logs` view in the app for suspicious bulk edits or unauthorized role changes.

---

## 4. How to perform an immediate manual backup
1. Go to the **Supabase Dashboard**.
2. Navigate to the **SQL Editor**.
3. While Supabase doesn't have a "Download CSV" button for the whole DB, you can go to the **Table Editor**, select a table, and click **Export > Export as CSV**.
4. Repeat for the `projects`, `profiles`, and `service_extensions` tables.
