# WHSF fraud auto-reply

Anyone who writes to WHSF about funds we supposedly disburse, grants or loans to claim, promotions, prizes,
fees, scams or fraud automatically gets a reply that:

- WHSF is **not involved** in disbursing funds, cash grants, loans, empowerment payments, promotions or prizes,
  and never asks for fees or bank details;
- they should not send money or personal details, and should report it to the police or the appropriate
  authority close to them;
- they can **verify any WHSF employee** by name, phone number and official WHSF email:
  https://www.worldhsfoundation.org/verify-certificate.html#staff-verification

**Personal email only (owner rule, 2026-10-12).** The fraud advisory goes only to personal/public mailboxes
(Gmail, Yahoo, Outlook/Hotmail/Live, iCloud, AOL, Proton, GMX, Zoho, Yandex and similar). Business, corporate,
government, school and other private-domain addresses never get it; staff handle those emails themselves.
The lists are `PERSONAL_MAIL_DOMAINS` in the Gmail script and in `api/contact.js`.

There are two parts.

## 1. Website Contact form: already live, nothing to set up

`api/contact.js` checks each enquiry. If the subject is **Fraud / Scam report**, or the message mentions things
like disbursement, payouts, loans, prizes, promotions, fees, bank details, scams or fraud, the sender's
acknowledgement is the fraud advisory above instead of the normal "we received your enquiry" email (personal
email addresses only; business senders get the normal acknowledgement). Staff get the
enquiry with **FRAUD ALERT** in the subject, routed to the safeguarding inbox (`SAFEGUARDING_EMAIL`, or the
default contact inbox if that isn't set).

## 2. Emails sent directly to info@worldhsfoundation.org: one-time setup in Gmail (about 5 minutes)

WHSF email runs on Google Workspace (Gmail), so this part runs inside that account as a free Google Apps Script.
It must be installed by someone signed in as **info@worldhsfoundation.org**.

1. Go to https://script.google.com while signed in as info@worldhsfoundation.org and click **New project**.
2. Name it `WHSF fraud auto-reply`.
3. Delete the sample code, then paste in the whole of `gmail-fraud-autoreply.gs` (this folder).
4. Click **Save**.
5. In the function menu at the top choose **setup**, then click **Run**.
6. Google asks for permission to read and send Gmail on behalf of info@. Review it and click **Allow**.
   (If you see "Google hasn't verified this app", click **Advanced → Go to WHSF fraud auto-reply**.
   It's your own script, running only in your account.)

That's it. Every 10 minutes it checks new inbox emails and replies once per sender per day.

**What it does and doesn't do**

- Replies only to matching emails from the last 2 days, and only to personal/public mailboxes. Business,
  corporate and private-domain emails are never answered; they get the label
  **WHSF/Fraud not auto-replied (business email)** so staff can follow up. It also never replies to
  @worldhsfoundation.org addresses, no-reply senders, mailing lists or other automatic emails.
- Never deletes, archives or marks emails as read. Staff still see and handle every email.
- Adds the Gmail label **WHSF/Fraud auto-replied** to each thread it answered, so you can review them.

**To update an installed script** open the project at https://script.google.com (signed in as info@), select
all the code, paste in the new `gmail-fraud-autoreply.gs` and click **Save**. Then choose **setup** and click
**Run** once (this creates the new label). The 10-minute trigger keeps running.

**To change the wording** edit `htmlReply_` and `plainReply_` in the script and click **Save**.

**To turn it off** choose **turnOff** in the function menu and click **Run** (or delete the project).

**To test it** send an email from a personal (non-WHSF) address to info@worldhsfoundation.org with a subject like
"When will WHSF disburse the empowerment fund?". Within about 10 minutes you should receive the advisory reply.

## Staff records: make sure email checks work

The verify page checks name + phone, and the official email if the visitor enters one. Only staff with an
official email in the staff directory can be confirmed by email (6 of 9 active staff had one on 2026-10-11).
Add missing emails in the Supabase dashboard: Table Editor → `whsf_staff_directory` → `official_email`.
