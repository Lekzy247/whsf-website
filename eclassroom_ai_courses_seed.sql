-- WHSF e-Classroom AI course expansion
-- Run this in Supabase SQL Editor after the main eclassroom schema has been created.
-- Safe to run more than once: courses and lessons use conflict checks.

insert into public.eclassroom_courses
  (title, slug, category, level, summary, learning_outcomes, duration_weeks, delivery_mode, is_published)
values
  (
    'AI for Agriculture',
    'ai-for-agriculture',
    'AI Agriculture',
    'beginner',
    'Develop practical AI-supported tools and knowledge for crop disease detection, soil analysis, weather intelligence, pest monitoring, market price awareness and smart irrigation guidance.',
    array[
      'Explain how AI can support farmers and rural communities',
      'Identify AI use cases for crop disease detection, soil analysis and pest monitoring',
      'Use weather and market information to support better farm decisions',
      'Design a simple smart-farming solution for community use'
    ],
    6,
    'hybrid',
    true
  ),
  (
    'AI for Healthcare',
    'ai-for-healthcare',
    'AI Health',
    'beginner',
    'Explore responsible AI solutions for telemedicine support, maternal health assistants, medical translation, symptom-triage guidance, healthcare worker training and medical education chatbots.',
    array[
      'Describe safe and responsible uses of AI in healthcare education',
      'Understand telemedicine, medical translation and health chatbot concepts',
      'Identify when health information must be referred to qualified professionals',
      'Design a community health education chatbot concept'
    ],
    6,
    'online',
    true
  ),
  (
    'AI Rapid Response',
    'ai-rapid-response',
    'AI Response',
    'beginner',
    'Train learners to use AI responsibly for emergency communication, community coordination, disaster information, urgent support workflows and rapid decision support.',
    array[
      'Understand how AI can support rapid communication and coordination',
      'Create clear emergency messages for different audiences',
      'Identify misinformation risks during urgent events',
      'Design a simple response workflow for a community issue'
    ],
    5,
    'online',
    true
  ),
  (
    'AI Media & Information Communication',
    'ai-media-information-communication',
    'Media AI',
    'beginner',
    'Use AI for media literacy, public-interest communication, misinformation awareness, safe storytelling, content creation, translation and community education.',
    array[
      'Use AI to support clear and ethical communication',
      'Recognize misinformation, manipulated media and unsafe content',
      'Create community education messages in simple language',
      'Apply AI translation and accessibility practices responsibly'
    ],
    5,
    'online',
    true
  )
on conflict (slug) do update
set
  title = excluded.title,
  category = excluded.category,
  level = excluded.level,
  summary = excluded.summary,
  learning_outcomes = excluded.learning_outcomes,
  duration_weeks = excluded.duration_weeks,
  delivery_mode = excluded.delivery_mode,
  is_published = excluded.is_published,
  updated_at = now();

insert into public.eclassroom_lessons
  (course_id, lesson_order, title, lesson_type, content, estimated_minutes, is_published)
select c.id, v.lesson_order, v.title, v.lesson_type, v.content, v.estimated_minutes, true
from public.eclassroom_courses c
join (
  values
    ('ai-for-agriculture', 1, 'Welcome to AI for Agriculture', 'reading', 'Meet Farmer Green and learn how responsible AI can help farmers, students and rural communities make better decisions about crops, soil, weather, pests, markets and water use.', 35),
    ('ai-for-agriculture', 2, 'Crop disease detection and pest monitoring', 'reading', 'Explore how images, field observations and AI models can support early detection of crop diseases and pest risks. Learners compare examples and identify when expert support is needed.', 45),
    ('ai-for-agriculture', 3, 'Soil, weather and smart irrigation', 'reading', 'Learn how soil information, weather intelligence and simple sensors can guide irrigation planning, reduce waste and support climate-smart farming.', 45),
    ('ai-for-agriculture', 4, 'Market price information and farmer decisions', 'reading', 'Understand how digital tools can help farmers compare prices, plan sales and reduce exploitation through better access to information.', 35),
    ('ai-for-agriculture', 5, 'Project: design a smart-farming assistant', 'assignment', 'Create a simple AI assistant concept for farmers. Include the problem, target users, data needed, safety concerns and expected community benefit.', 60),

    ('ai-for-healthcare', 1, 'Welcome to AI for Healthcare', 'reading', 'Meet Doctor Hope and learn how AI can support health education while respecting safety, privacy and the role of qualified health professionals.', 35),
    ('ai-for-healthcare', 2, 'Telemedicine and maternal health assistants', 'reading', 'Explore how telemedicine support and maternal health information tools can improve access to trusted guidance, reminders and referrals.', 45),
    ('ai-for-healthcare', 3, 'Medical translation and community health communication', 'reading', 'Learn how AI translation and plain-language summaries can help communities understand health information across languages and literacy levels.', 40),
    ('ai-for-healthcare', 4, 'Symptom guidance, privacy and safety limits', 'reading', 'Understand the difference between health education and medical diagnosis. Learners practice safe referral language and privacy protection.', 45),
    ('ai-for-healthcare', 5, 'Project: community health education chatbot', 'assignment', 'Design a safe health education chatbot concept. Include what it can answer, what it must not answer, privacy safeguards and referral instructions.', 60),

    ('ai-rapid-response', 1, 'Welcome to AI Rapid Response', 'reading', 'Learn how AI can support faster, clearer and more responsible communication during urgent community situations.', 35),
    ('ai-rapid-response', 2, 'Emergency communication and audience mapping', 'reading', 'Practice turning complex information into clear messages for students, parents, volunteers, partners and community leaders.', 40),
    ('ai-rapid-response', 3, 'Misinformation risks during emergencies', 'reading', 'Learn how rumors and fake information spread during urgent events, and how to verify before sharing.', 45),
    ('ai-rapid-response', 4, 'Coordination workflows and response logs', 'reading', 'Design simple workflows for reporting needs, assigning tasks, tracking actions and summarizing updates.', 45),
    ('ai-rapid-response', 5, 'Project: rapid response communication plan', 'assignment', 'Create a response plan for one community situation. Include audience, message templates, verification steps, escalation contacts and follow-up actions.', 60),

    ('ai-media-information-communication', 1, 'Welcome to AI Media and Information Communication', 'reading', 'Meet Cyber Hero and learn how AI can support public-interest communication, digital literacy and safe storytelling.', 35),
    ('ai-media-information-communication', 2, 'Media literacy and misinformation awareness', 'reading', 'Learn how to identify suspicious claims, fake images, manipulated videos, scam links and unreliable sources.', 45),
    ('ai-media-information-communication', 3, 'Safe content creation and community storytelling', 'reading', 'Use AI to draft responsible posts, scripts, captions and community education messages while protecting dignity and privacy.', 45),
    ('ai-media-information-communication', 4, 'Translation, accessibility and inclusive communication', 'reading', 'Explore how AI can help translate, simplify and adapt information for different languages, disabilities and literacy levels.', 40),
    ('ai-media-information-communication', 5, 'Project: public-interest communication campaign', 'assignment', 'Create a short campaign plan using AI responsibly. Include audience, key message, safety checks, accessibility support and success measure.', 60)
) as v(slug, lesson_order, title, lesson_type, content, estimated_minutes)
  on c.slug = v.slug
on conflict (course_id, lesson_order) do update
set
  title = excluded.title,
  lesson_type = excluded.lesson_type,
  content = excluded.content,
  estimated_minutes = excluded.estimated_minutes,
  is_published = excluded.is_published,
  updated_at = now();

insert into public.eclassroom_assignments
  (course_id, title, instructions, max_score)
select c.id, v.title, v.instructions, 100
from public.eclassroom_courses c
join (
  values
    ('ai-for-agriculture', 'Smart agriculture community project', 'Describe an AI-supported agriculture solution for a real community. Include the problem, users, data needed, expected benefit, risks and how the solution should be tested safely.'),
    ('ai-for-healthcare', 'Safe AI health education project', 'Design a health education assistant or awareness tool. Explain what it helps people learn, what it must refer to professionals, and how privacy and safety will be protected.'),
    ('ai-rapid-response', 'Rapid response communication workflow', 'Create a simple AI-supported workflow for one urgent community situation. Include message templates, verification steps, roles, escalation and follow-up reporting.'),
    ('ai-media-information-communication', 'AI media literacy campaign', 'Prepare a public-interest communication plan that teaches people how to identify misinformation, scams or manipulated media using simple language and accessible formats.')
) as v(slug, title, instructions)
  on c.slug = v.slug
where not exists (
  select 1
  from public.eclassroom_assignments a
  where a.course_id = c.id
  and a.title = v.title
);

select
  c.title,
  c.slug,
  count(distinct l.id) as lessons,
  count(distinct a.id) as assignments
from public.eclassroom_courses c
left join public.eclassroom_lessons l on l.course_id = c.id
left join public.eclassroom_assignments a on a.course_id = c.id
where c.slug in (
  'ai-for-agriculture',
  'ai-for-healthcare',
  'ai-rapid-response',
  'ai-media-information-communication'
)
group by c.title, c.slug
order by c.title;
