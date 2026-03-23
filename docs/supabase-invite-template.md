## Supabase Invite Email Template (Qore PD)

Use this in Supabase Dashboard -> Authentication -> Email Templates -> Invite user.

Subject:

`You are invited to Qore PD Tracker`

Body (HTML):

```html
<h2>Welcome to Qore PD Tracker</h2>
<p>Hello,</p>
<p>You have been invited to join your team workspace on Qore PD Tracker.</p>
<p>This invite link is valid for <strong>7 days</strong>.</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:10px 16px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;">
    Accept Invite
  </a>
</p>
<p>If the button does not work, copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>
<p>If you were not expecting this invite, you can ignore this message.</p>
<p>— Qore PD Team</p>
```

Notes:

- Configure your SMTP sender in Supabase if you want a fully branded "from" address.
- Ensure `INVITE_REDIRECT_URL` is set in your `invite-user` Edge Function settings.
