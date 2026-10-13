// Posts a staff alert card to WHSF's Microsoft Teams channel through a Teams Workflows webhook
// ("Post to a channel when a webhook request is received"). The webhook address is a secret that the
// owner adds in Vercel as TEAMS_ALERT_WEBHOOK_URL; without it this does nothing.
// Files starting with "_" in /api are helpers, not public endpoints.

export function teamsConfigured() {
  return /^https:\/\/\S+$/.test(String(process.env.TEAMS_ALERT_WEBHOOK_URL || ''));
}

// facts: [[label, value], ...]; link: { title, url } (optional)
export async function postToTeams(title, facts = [], link = null, note = '') {
  if (!teamsConfigured()) return false;
  const body = [
    { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true },
    { type: 'FactSet', facts: facts.filter(([, v]) => v).map(([t, v]) => ({ title: String(t), value: String(v).slice(0, 500) })) }
  ];
  if (note) body.push({ type: 'TextBlock', text: note, wrap: true, isSubtle: true, size: 'Small' });
  const card = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body,
    actions: link ? [{ type: 'Action.OpenUrl', title: link.title, url: link.url }] : []
  };
  try {
    const response = await fetch(process.env.TEAMS_ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card }] }),
      signal: AbortSignal.timeout(8000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
