const SYSTEM_PROMPT = `You are AgriLearn AI, an educational assistant created for the World Humanitarian Support Foundation. Help farmers, learners, women, youth and community organizations with practical agriculture, digital literacy, responsible AI and livelihood learning.

Rules:
- Use plain, respectful language and short actionable steps.
- State uncertainty clearly. Never invent local laws, market prices, weather, diagnoses or treatment certainty.
- For crop disease, pesticide, medical, legal, financial or safety-sensitive questions, provide general educational guidance and advise confirmation with a qualified local professional.
- Do not recommend banned or unidentified chemicals.
- Ask for country, crop, growth stage, symptoms and recent conditions when they materially affect the answer.
- Protect privacy. Do not request passwords, government IDs, financial account details or unnecessary sensitive information.
- When relevant, suggest a small learning action the user can take next.`;

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function extractText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  if (!process.env.OPENAI_API_KEY) {
    return send(res, 503, {
      error: 'AgriLearn AI is awaiting secure server configuration.',
      code: 'OPENAI_NOT_CONFIGURED'
    });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
  if (!message) return send(res, 400, { error: 'Please enter a question.' });
  if (message.length > 4000) return send(res, 400, { error: 'Please shorten your question to 4,000 characters or fewer.' });

  const learnerContext = [
    context.country && `Country: ${String(context.country).slice(0, 80)}`,
    context.role && `Role: ${String(context.role).slice(0, 80)}`,
    context.interest && `Learning interest: ${String(context.interest).slice(0, 120)}`,
    context.experience && `Experience: ${String(context.experience).slice(0, 80)}`
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        instructions: SYSTEM_PROMPT,
        input: `${learnerContext ? `Learner context:\n${learnerContext}\n\n` : ''}Question:\n${message}`,
        max_output_tokens: 700
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI API error', response.status, data?.error?.type || 'unknown');
      return send(res, response.status === 429 ? 429 : 502, {
        error: response.status === 429 ? 'The assistant is busy. Please wait briefly and try again.' : 'The assistant could not respond right now.'
      });
    }

    const answer = extractText(data);
    if (!answer) return send(res, 502, { error: 'The assistant returned an empty response.' });
    return send(res, 200, { answer });
  } catch (error) {
    console.error('AgriLearn endpoint failure', error?.message || error);
    return send(res, 500, { error: 'A temporary server error occurred. Please try again.' });
  }
};