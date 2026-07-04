const ACTIONS = {
  grant: {
    title: 'AI Grant & Scholarship Finder',
    query:
      'Find current scholarships, grants, fellowships, internships, STEM competitions and study-abroad opportunities relevant to girls, young women, African students, ICT Girls Club and TechWomen learners.'
  },
  tech: {
    title: 'AI Tech Opportunity Monitor',
    query:
      'Find current hackathons, technology conferences, women-in-tech programmes, AI training, cloud events, cybersecurity bootcamps and digital inclusion opportunities relevant to students, mentors, volunteers and programme coordinators.'
  },
  agriculture: {
    title: 'AI Agriculture Knowledge Assistant',
    query:
      'Find trusted climate-smart agriculture learning resources, crop information, weather awareness, farm safety and verified agriculture guidance for rural girls, farmers and community agriculture projects.'
  },
  health: {
    title: 'AI Health Information Verifier',
    query:
      'Find trusted public health information sources for community health awareness, prevention education, child health, nutrition and safe referral guidance. Do not provide diagnosis or treatment.'
  },
  scam: {
    title: 'AI Scam Detection Center',
    query:
      'Find current guidance for identifying suspicious scholarships, fake certificates, phishing links, false job offers, crypto scams, donation fraud, manipulated media and NGO impersonation attempts.'
  },
  news: {
    title: 'AI Tech News Curator',
    query:
      'Find current useful technology updates in AI, robotics, drones, cybersecurity, cloud, data centers and digital inclusion for learners and nonprofit technology programmes.'
  },
  whatsapp: {
    title: 'WhatsApp Information Assistant',
    query:
      'Prepare mobile-first guidance for common public questions such as verifying scholarships, finding cybersecurity learning resources, reporting suspicious WhatsApp messages and using official WHSF verification links.'
  },
  translation: {
    title: 'Multilingual AI Translation',
    query:
      'Prepare simplified community communication guidance in plain English with translation support considerations for Yoruba, Hausa, Igbo and Nigerian Pidgin for rural outreach and parent communication.'
  }
};

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }

  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === 'string') return data.output_text.trim();

  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }

  return parts.join('\n').trim();
}

function buildPrompt(actionKey, userQuestion = '') {
  const action = ACTIONS[actionKey];
  const today = new Date().toISOString().slice(0, 10);
  const extra = String(userQuestion || '').trim();

  return `
You are the WHSF AI Assistant Suite for World Humanitarian Support Foundation.
Today is ${today}.

User selected: ${action.title}
Task: ${action.query}
${extra ? `Additional request from visitor: ${extra}` : ''}

Use live web search and respond for a public NGO website visitor.
Prioritize official, trusted, and current sources.
Do not send the visitor to a contact form.
Do not claim WHSF endorsement unless the source is official WHSF.

For health: provide public awareness only, no diagnosis, prescription, or treatment decisions.
For scam detection: provide red flags and verification steps, not legal conclusions.
For opportunities: include deadlines only when found in the source.

Return concise Markdown with these sections:
1. Summary
2. Live update
3. Trusted sources to check
4. Recommended next steps
5. Safety note
`.trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({
      error: 'AI search is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy.'
    }));
    return;
  }

  const body = await parseBody(req);
  const actionKey = String(body.action || '').trim();
  const action = ACTIONS[actionKey];

  if (!action) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Unknown AI assistant action.' }));
    return;
  }

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: buildPrompt(actionKey, body.question),
        tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
        tool_choice: 'required'
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      res.statusCode = openaiResponse.status;
      res.end(JSON.stringify({
        error: data?.error?.message || 'AI search request failed.'
      }));
      return;
    }

    const answer = extractOpenAiText(data);
    res.statusCode = 200;
    res.end(JSON.stringify({
      action: actionKey,
      title: action.title,
      answer: answer || 'AI search completed, but no summary was returned.',
      generatedAt: new Date().toISOString(),
      live: true
    }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'AI search could not run right now. Please try again shortly.'
    }));
  }
};
