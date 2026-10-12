# Accept WHSF donations with Stripe

WHSF uses a **Stripe Payment Link**: a donation page hosted by Stripe. Donors pay there by card,
Apple Pay or Google Pay (and more, depending on country). Nothing secret is placed on the website and
card details never touch worldhsfoundation.org, so it adds no security risk to the site.

Plan agreed 2026-10-11: Stripe becomes the main **Donate** option; PayPal stays as a second option on the
Donate page.

---

## Step 1: Create the WHSF Stripe account (about 15 minutes)

Do this yourself, signed in as WHSF (not a personal or Gelllez account; WHSF and Gelllez are separate).

1. Go to https://dashboard.stripe.com/register and sign up with **info@worldhsfoundation.org**.
2. Choose **United States** as the country (WHSF is a registered California 501(c)(3)).
3. Business type: **Nonprofit organization**. Enter WHSF's legal name, **EIN**, address
   (11535 Western Ave, Torrance, CA 90501) and website (https://www.worldhsfoundation.org).
4. Add the representative's details and the **WHSF bank account** for payouts.
5. Turn on **two-step verification** (Settings → Personal details → Two-step authentication).
6. Wait for Stripe to verify the account (often minutes, sometimes 1–2 business days).

Never send passwords, bank numbers or Stripe secret keys (they start with `sk_`) by chat or email.
The website does not need any key.

## Step 2: Ask for the nonprofit discount

Stripe offers discounted processing to registered 501(c)(3) charities that mainly take donations.
Contact Stripe support (Dashboard → Help → Contact support) and ask for **nonprofit pricing**;
have the EIN and IRS determination letter ready. Approval is Stripe's decision.

## Step 3: Create the donation Payment Link

1. Dashboard → **Payment Links** → **+ New**.
2. Choose **Customers choose what to pay** (a "pay what you want" amount).
   - Currency: **USD**. Suggested amount: e.g. $50. Minimum: e.g. $5.
3. Product name: **Donation to World Humanitarian Support Foundation**.
   Description: *Your gift funds devices, training, mentors and certificates for girls and young women.
   WHSF is a 501(c)(3) charity; US donations are tax deductible.*
4. Under **Options**:
   - **Collect customers' addresses**: on (needed for tax receipts).
   - **Collect phone numbers**: optional.
   - Add a custom field "Dedicate this gift (optional)" if you like.
5. **After payment** → **Don't show confirmation page** → **Redirect customers to your website**:
   `https://www.worldhsfoundation.org/donor-portal.html?thanks=1`
6. Click **Create link** and copy the link. It looks like `https://donate.stripe.com/...` or
   `https://buy.stripe.com/...`.

Optional: for **monthly giving**, create a second Payment Link with a recurring price (e.g. $10/$25/$50
per month).

## Step 4: Receipts and branding

- Settings → **Branding**: upload the WHSF logo and set the brand colour to `#7B2142`.
- Settings → **Customer emails**: turn on **Successful payments** receipts.
- Add the receipt wording: "World Humanitarian Support Foundation is a 501(c)(3) charity. No goods or
  services were provided in exchange for this gift."

## Step 5: Send the link

Send the **Payment Link URL** (not any key). It is a public link, safe to share. I will then:

- point every **Donate** button on the site to it,
- keep PayPal as a second option on the Donate page,
- show a thank-you message when donors return to `donor-portal.html?thanks=1`,
- test it with a live link check (no payment made).

## Step 6: Test before announcing

Stripe has a **Test mode** (toggle top-right of the Dashboard). Create the same Payment Link in test mode
and pay with card `4242 4242 4242 4242`, any future date, any CVC to see the full flow without real money.
Then switch back to live mode.
