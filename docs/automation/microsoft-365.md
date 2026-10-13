# WHSF and Microsoft 365 (Teams, Bookings, Power Automate)

WHSF has a Microsoft 365 nonprofit account. The website uses it in two ways.

## 1. Microsoft Bookings: video-call ID checks on the Forum

Members who choose "Video call" for their age check book a short Microsoft Teams call with a WHSF moderator.

1. Sign in at https://outlook.office.com/bookings with a WHSF Microsoft 365 admin account
   (if Bookings is missing: Microsoft 365 admin center → Settings → Org settings → Bookings → allow).
2. **Create a shared booking page** named `WHSF Forum ID verification`, with WHSF's time zone and working hours.
3. **Add a service**: `ID verification video call`, 15 minutes, 10 minutes buffer, **Online meeting: On**
   (this adds a unique Teams link to every booking). Assign the moderators who will run the calls.
4. In the booking form ask only for name and email. **Never ask for ID numbers or ID photos in Bookings**:
   members upload those on the Forum, where they are deleted after the decision.
5. **Publish** the booking page and copy its link. Send it to the developer to place in the Forum
   (`VIDEO_CALL_BOOKING_URL` in `forum.js`).

## 2. Teams channel alerts (Teams Workflows)

The website posts a card to a WHSF Teams channel when:
- a member submits an ID check (`api/forum-id-alert.js`),
- a new Forum event or advert is waiting for approval (`api/forum-review-alert.js`, one alert per item),
- someone sends a fraud report through the Contact form (`api/contact.js`).
Email alerts keep working as before.

Setup (about 10 minutes):
1. In Microsoft Teams, open the WHSF team and add a channel, e.g. `Forum alerts`.
2. On the channel, choose **⋯ → Workflows** and pick the template
   **"Post to a channel when a webhook request is received"**. Name it `WHSF website alerts`,
   confirm the team and channel, and click **Add workflow**.
3. Copy the web address it shows. Treat it like a password: anyone with it can post to the channel.
4. In Vercel → the WHSF website project → **Settings → Environment Variables**, add
   `TEAMS_ALERT_WEBHOOK_URL` = that address (Production), save, then **Redeploy** the latest deployment.
5. Test: submit a test event in the Forum (or a Contact form message with the subject "Fraud / Scam report");
   a card should appear in the channel within a few seconds.

To stop the alerts, delete the workflow in Teams (Workflows app) or remove the Vercel variable.
