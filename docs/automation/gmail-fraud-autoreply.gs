/**
 * WHSF Gmail fraud auto-reply (Google Apps Script)
 *
 * Runs inside the info@worldhsfoundation.org Google Workspace account. Every 10 minutes it looks
 * for new inbox emails about funds WHSF supposedly disburses, grants/loans to claim, promotions,
 * prizes, fees, scams or fraud, and sends each sender ONE reply saying WHSF is not involved, asking
 * them to report it to the authorities near them, and linking the "Verify a WHSF employee" page.
 *
 * It only answers people writing from a PERSONAL / PUBLIC mailbox (Gmail, Yahoo, Outlook, iCloud and
 * similar). Business, corporate, organisation, school and any other private-domain email is an
 * exception: it is never auto-replied to and is left for staff. Those threads get the label
 * "WHSF/Fraud not auto-replied (business email)" so nothing is hidden.
 *
 * It never deletes, archives or marks anything as read: staff still see every email.
 * Replied threads get the Gmail label "WHSF/Fraud auto-replied".
 *
 * Setup: see docs/automation/README.md. In short: paste this into script.google.com while signed in
 * as info@worldhsfoundation.org, run setup() once and approve the Gmail permission.
 */

const CONFIG = {
  label: 'WHSF/Fraud auto-replied',
  skippedLabel: 'WHSF/Fraud not auto-replied (business email)',
  lookBack: '2d',                      // only consider recent emails
  maxThreadsPerRun: 30,
  ownDomain: 'worldhsfoundation.org',  // never auto-reply to our own staff
  verifyUrl: 'https://www.worldhsfoundation.org/verify-certificate.html#staff-verification',
  contactUrl: 'https://www.worldhsfoundation.org/contact.html',
  // Gmail search (rough pre-filter); the regex below makes the final decision.
  searchTerms: '{scam fraud fake impersonation impersonating disburse disbursement disbursing payout loan lottery prize winner promotion promo "cash grant" "empowerment fund" "empowerment grant" "registration fee" "processing fee" "activation fee" "clearance fee" beneficiary palliative "claim my grant" "bank details" "account number" "whatsapp group" "identity theft"}'
};

const FRAUD_PATTERN = new RegExp([
  'scam', 'fraud', 'fake', 'impersonat', 'identity theft',
  'disburs', 'payout', 'pay out', 'loan', 'lottery', 'prize', 'winner', 'jackpot',
  'promotion', '\\bpromo\\b', 'cash (grant|gift|support|reward)', 'empowerment (fund|grant|money|cash|program)',
  '(registration|processing|activation|clearance|release) fee', 'beneficiar', 'palliative',
  'claim (my|the|your) (grant|fund|money|prize|reward)', '(grant|fund|money) (approved|awarded|release)',
  'whatsapp group', 'bank (details|account)', 'account number', 'investment opportunit'
].join('|'), 'i');

/**
 * Public / personal mailbox providers. ONLY senders on these domains get the auto-reply.
 * Anything else (a company, charity, school, government or any private custom domain) is treated
 * as a business email and skipped. To also answer another personal provider, add its domain here.
 */
const PERSONAL_MAIL_DOMAINS = new RegExp('^(' + [
  'gmail\\.com', 'googlemail\\.com',
  'yahoo\\.(com|co\\.[a-z]{2}|com\\.[a-z]{2}|[a-z]{2})', 'ymail\\.com', 'rocketmail\\.com',
  '(outlook|hotmail|live)\\.(com|co\\.[a-z]{2}|com\\.[a-z]{2}|[a-z]{2})', 'msn\\.com',
  'icloud\\.com', 'me\\.com', 'mac\\.com',
  'aol\\.com', 'proton\\.me', 'protonmail\\.com', 'pm\\.me',
  'gmx\\.(com|net|[a-z]{2})', 'mail\\.com', 'zoho\\.com', 'zohomail\\.com', 'fastmail\\.com',
  'yandex\\.(com|ru)', 'mail\\.ru', 'qq\\.com', '163\\.com', '126\\.com', 'tutanota\\.com', 'tuta\\.io'
].join('|') + ')$', 'i');

/** Run once by hand: creates the labels and the 10-minute trigger. */
function setup() {
  getOrCreateLabel_();
  getOrCreateLabel_(CONFIG.skippedLabel);
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'replyToFraudEmails')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('replyToFraudEmails').timeBased().everyMinutes(10).create();
  replyToFraudEmails();
}

/** Removes the trigger (turns the automation off). The label and past replies are kept. */
function turnOff() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'replyToFraudEmails')
    .forEach((t) => ScriptApp.deleteTrigger(t));
}

function replyToFraudEmails() {
  const label = getOrCreateLabel_();
  const skippedLabel = getOrCreateLabel_(CONFIG.skippedLabel);
  const query = 'in:inbox newer_than:' + CONFIG.lookBack + ' -label:"' + CONFIG.label + '" ' +
    '-label:"' + CONFIG.skippedLabel + '" -from:' + CONFIG.ownDomain + ' ' + CONFIG.searchTerms;
  const threads = GmailApp.search(query, 0, CONFIG.maxThreadsPerRun);
  const repliedTo = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');

  threads.forEach((thread) => {
    const message = thread.getMessages()[0];
    const from = message.getFrom();
    const address = (from.match(/<([^>]+)>/) || [null, from])[1].trim().toLowerCase();

    if (!isSafeToReply_(message, address)) { thread.addLabel(label); return; }

    const text = message.getSubject() + '\n' + message.getPlainBody();
    if (!FRAUD_PATTERN.test(text)) return; // search matched loosely; leave it for staff

    // Exception: business, corporate and other private-domain email is never auto-replied to.
    if (!isPersonalMailbox_(address) || !isPersonalMailbox_(replyAddress_(message, address))) {
      thread.addLabel(skippedLabel);
      return;
    }

    // At most one auto-reply per sender per day.
    const key = 'r:' + address;
    if (repliedTo.getProperty(key) === today) { thread.addLabel(label); return; }

    const name = (from.split('<')[0] || '').replace(/"/g, '').trim().split(' ')[0] || 'there';
    thread.reply(plainReply_(name), {
      htmlBody: htmlReply_(name),
      name: 'World Humanitarian Support Foundation'
    });
    repliedTo.setProperty(key, today);
    thread.addLabel(label);
  });
}

function isSafeToReply_(message, address) {
  if (!address || address.endsWith('@' + CONFIG.ownDomain)) return false;
  if (/(no-?reply|mailer-daemon|postmaster|bounce|notifications?)@/i.test(address)) return false;
  const headers = message.getHeader('Auto-Submitted') + ' ' + message.getHeader('Precedence') + ' ' + message.getHeader('List-Unsubscribe');
  if (/auto-(generated|replied)|bulk|junk|list/i.test(headers) || message.getHeader('List-Unsubscribe')) return false;
  return true;
}

/** True only when the address is on a public / personal mailbox provider (Gmail, Yahoo, Outlook ...). */
function isPersonalMailbox_(address) {
  const at = String(address || '').lastIndexOf('@');
  if (at < 1) return false;
  return PERSONAL_MAIL_DOMAINS.test(address.slice(at + 1).trim().toLowerCase());
}

/** The address a reply would actually go to: Reply-To when set, otherwise the sender. */
function replyAddress_(message, fallback) {
  const replyTo = (message.getReplyTo() || '').trim();
  if (!replyTo) return fallback;
  return (replyTo.match(/<([^>]+)>/) || [null, replyTo])[1].trim().toLowerCase();
}

function getOrCreateLabel_(name) {
  const labelName = name || CONFIG.label;
  return GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
}

function htmlReply_(name) {
  const button = 'display:inline-block;padding:12px 20px;border-radius:10px;background:#7b2142;color:#ffffff;font-weight:600;text-decoration:none';
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#160d1d;max-width:600px">' +
    '<p>Hello ' + escape_(name) + ',</p>' +
    '<p>Thank you for contacting World Humanitarian Support Foundation (WHSF). This is an automatic reply.</p>' +
    '<p><strong>Important:</strong> WHSF is <strong>not involved</strong> in disbursing funds, cash grants, loans or empowerment payments to individuals, and does not run promotions, prizes or "opportunity" payouts. WHSF never asks anyone to pay a fee or share bank details to receive any benefit. Any message, page or group claiming otherwise is not from WHSF.</p>' +
    '<p>If someone has contacted you about this, please <strong>do not send money or personal or financial information</strong>, and report it to the police or the appropriate authority (for example, a cybercrime or consumer-protection unit) close to you.</p>' +
    '<p>To protect yourself from fraud, identity theft or misrepresentation, verify anyone who says they work for WHSF. Check their <strong>name, phone number and official WHSF email</strong>:</p>' +
    '<p><a href="' + CONFIG.verifyUrl + '" style="' + button + '">Verify a WHSF employee</a></p>' +
    '<p style="font-size:13px;color:#5b4d55">Or open this link: <a href="' + CONFIG.verifyUrl + '">' + CONFIG.verifyUrl + '</a></p>' +
    '<p>Official WHSF contacts: <a href="https://www.worldhsfoundation.org">www.worldhsfoundation.org</a> and <a href="mailto:info@worldhsfoundation.org">info@worldhsfoundation.org</a>. To report suspected fraud to us, use <a href="' + CONFIG.contactUrl + '">our Contact page</a>.</p>' +
    '<p>World Humanitarian Support Foundation</p></div>';
}

function plainReply_(name) {
  return 'Hello ' + name + ',\n\n' +
    'Thank you for contacting World Humanitarian Support Foundation (WHSF). This is an automatic reply.\n\n' +
    'Important: WHSF is not involved in disbursing funds, cash grants, loans or empowerment payments to individuals, and does not run promotions, prizes or "opportunity" payouts. WHSF never asks anyone to pay a fee or share bank details to receive any benefit. Any message, page or group claiming otherwise is not from WHSF.\n\n' +
    'If someone has contacted you about this, do not send money or personal or financial information, and report it to the police or the appropriate authority (for example, a cybercrime or consumer-protection unit) close to you.\n\n' +
    'Verify anyone who says they work for WHSF by name, phone number and official WHSF email:\n' + CONFIG.verifyUrl + '\n\n' +
    'Official WHSF contacts: www.worldhsfoundation.org and info@worldhsfoundation.org.\n\n' +
    'World Humanitarian Support Foundation';
}

function escape_(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
}
