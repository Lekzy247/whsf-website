const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.primary-nav');
const menuLabel = menuButton?.querySelector('.sr-only');

function setMenu(open) {
  if (!menuButton || !navigation) return;
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
  if (menuLabel) menuLabel.textContent = open ? 'Close menu' : 'Open menu';
}

menuButton?.addEventListener('click', () => {
  setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

const fontToggle = document.querySelector('#font-toggle');
const contrastToggle = document.querySelector('#contrast-toggle');

function setPreference(button, className, storageKey) {
  const active = !document.body.classList.contains(className);
  document.body.classList.toggle(className, active);
  button?.setAttribute('aria-pressed', String(active));
  try {
    localStorage.setItem(storageKey, String(active));
  } catch {
    // Some privacy modes block storage; accessibility toggles should still work visually.
  }
}

function getStoredPreference(storageKey) {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

if (getStoredPreference('whsf-large-text') === 'true') {
  document.body.classList.add('large-text');
  fontToggle?.setAttribute('aria-pressed', 'true');
}
if (getStoredPreference('whsf-high-contrast') === 'true') {
  document.body.classList.add('high-contrast');
  contrastToggle?.setAttribute('aria-pressed', 'true');
}

fontToggle?.addEventListener('click', () => setPreference(fontToggle, 'large-text', 'whsf-large-text'));
contrastToggle?.addEventListener('click', () => setPreference(contrastToggle, 'high-contrast', 'whsf-high-contrast'));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

const pathOptions = document.querySelectorAll('.path-option');
const pathLabel = document.querySelector('#path-result-label');
const pathTitle = document.querySelector('#path-result-title');
const pathCopy = document.querySelector('#path-result-copy');
const pathPrimaryAction = document.querySelector('#path-primary-action');
const pathSecondaryAction = document.querySelector('#path-secondary-action');

const pathContent = {
  student: {
    label: 'Student pathway',
    title: 'Start or continue learning with WHSF e-Classroom.',
    copy: 'Explore technology training in robotics, cybersecurity, drone technology, AI, STEM, eHealth and accessibility technology.',
    primaryText: 'Open e-Classroom',
    primaryHref: 'e-classroom.html',
    secondaryText: 'Contact support',
    secondaryHref: 'contact.html',
    interest: 'e-Classroom support'
  },
  volunteer: {
    label: 'Volunteer pathway',
    title: 'Share your time, skills and experience with WHSF.',
    copy: 'Support programme delivery, student mentoring, community outreach, digital skills sessions and events that expand opportunity for girls and young women.',
    primaryText: 'Register interest',
    primaryHref: 'contact.html',
    secondaryText: 'See programmes',
    secondaryHref: 'programs.html',
    interest: 'Volunteering'
  },
  partner: {
    label: 'Partner and sponsor pathway',
    title: 'Build programmes, scholarships and impact with WHSF.',
    copy: 'Schools, companies, foundations and institutions can collaborate on training, sponsorship, equipment, mentorship, research and community innovation.',
    primaryText: 'Start partnership enquiry',
    primaryHref: 'contact.html',
    secondaryText: 'View impact',
    secondaryHref: 'impact-dashboard.html',
    interest: 'Partnership'
  },
  donate: {
    label: 'Donor pathway',
    title: 'Support technology, education and opportunity.',
    copy: 'Your donation helps WHSF expand access to digital learning, mentorship, scholarships, disability inclusion and community programmes.',
    primaryText: 'Donate securely',
    primaryHref: 'https://paypal.com/us/fundraiser/charity/1450337',
    secondaryText: 'Contact WHSF',
    secondaryHref: 'contact.html',
    interest: 'Donation / Sponsorship'
  },
  certificate: {
    label: 'Certificate pathway',
    title: 'Verify a WHSF certificate online.',
    copy: 'Students, schools, partners and employers can confirm certificates using the certificate number shown on the PDF.',
    primaryText: 'Verify certificate',
    primaryHref: 'verify-certificate.html',
    secondaryText: 'Ask for certificate help',
    secondaryHref: 'contact.html',
    interest: 'Certificate help'
  },
  programme: {
    label: 'Programme pathway',
    title: 'Find a WHSF programme that fits your goals.',
    copy: 'Explore ICT Girls Club, TechWomen, robotics, drone technology, cybersecurity, AI, STEM, agriculture and accessibility technology pathways.',
    primaryText: 'View programmes',
    primaryHref: 'programs.html',
    secondaryText: 'Request programme info',
    secondaryHref: 'contact.html',
    interest: 'School / Programme interest'
  }
};

function setContactInterest(value) {
  const interestSelect = document.querySelector('#contact-form select[name="interest"]');
  if (!interestSelect || !value) return;
  const matchingOption = [...interestSelect.options].find((option) => option.textContent === value);
  if (matchingOption) {
    interestSelect.value = matchingOption.value || matchingOption.textContent;
    updateContactGuidance(interestSelect.value);
  }
}

function updatePathResult(path) {
  const content = pathContent[path];
  if (!content) return;
  pathOptions.forEach((button) => button.classList.toggle('active', button.dataset.path === path));
  if (pathLabel) pathLabel.textContent = content.label;
  if (pathTitle) pathTitle.textContent = content.title;
  if (pathCopy) pathCopy.textContent = content.copy;
  if (pathPrimaryAction) {
    pathPrimaryAction.textContent = content.primaryText;
    pathPrimaryAction.href = content.primaryHref;
    if (content.primaryHref.startsWith('http')) {
      pathPrimaryAction.target = '_blank';
      pathPrimaryAction.rel = 'noreferrer';
    } else {
      pathPrimaryAction.removeAttribute('target');
      pathPrimaryAction.removeAttribute('rel');
    }
  }
  if (pathSecondaryAction) {
    pathSecondaryAction.innerHTML = `${content.secondaryText} <span>→</span>`;
    pathSecondaryAction.href = content.secondaryHref;
  }
  setContactInterest(content.interest);
}

pathOptions.forEach((button) => {
  button.addEventListener('click', () => updatePathResult(button.dataset.path));
});

const gallerySlider = document.querySelector('[data-gallery-slider]');
const galleryMainImage = document.querySelector('#gallery-main-image');
const galleryMainLink = document.querySelector('.gallery-main-link');
const galleryCounter = document.querySelector('#gallery-counter');
const galleryTitle = document.querySelector('#gallery-title');
const galleryDescription = document.querySelector('#gallery-description');
const galleryThumbs = [...document.querySelectorAll('.gallery-thumb')];
const galleryPrev = document.querySelector('.gallery-prev');
const galleryNext = document.querySelector('.gallery-next');
let galleryIndex = 0;
let galleryTimer;

function showGallerySlide(index) {
  if (!galleryThumbs.length || !galleryMainImage) return;
  galleryIndex = (index + galleryThumbs.length) % galleryThumbs.length;
  const selected = galleryThumbs[galleryIndex];
  const { src, title, description, alt } = selected.dataset;

  galleryThumbs.forEach((thumb, thumbIndex) => {
    thumb.classList.toggle('active', thumbIndex === galleryIndex);
    thumb.setAttribute('aria-pressed', String(thumbIndex === galleryIndex));
  });

  galleryMainImage.style.opacity = '0';
  window.setTimeout(() => {
    galleryMainImage.src = src;
    galleryMainImage.alt = alt || title || 'WHSF gallery image';
    if (galleryMainLink) galleryMainLink.href = src;
    if (galleryCounter) galleryCounter.textContent = `${galleryIndex + 1} / ${galleryThumbs.length}`;
    if (galleryTitle) galleryTitle.textContent = title || 'WHSF gallery highlight';
    if (galleryDescription) galleryDescription.textContent = description || 'A WHSF programme moment.';
    galleryMainImage.style.opacity = '1';
  }, 120);
}

function startGalleryAutoplay() {
  if (!galleryThumbs.length) return;
  window.clearInterval(galleryTimer);
  galleryTimer = window.setInterval(() => showGallerySlide(galleryIndex + 1), 6500);
}

galleryThumbs.forEach((thumb, index) => {
  thumb.setAttribute('aria-pressed', String(index === 0));
  thumb.addEventListener('click', () => {
    showGallerySlide(index);
    startGalleryAutoplay();
  });
});

galleryPrev?.addEventListener('click', () => {
  showGallerySlide(galleryIndex - 1);
  startGalleryAutoplay();
});

galleryNext?.addEventListener('click', () => {
  showGallerySlide(galleryIndex + 1);
  startGalleryAutoplay();
});

gallerySlider?.addEventListener('mouseenter', () => window.clearInterval(galleryTimer));
gallerySlider?.addEventListener('mouseleave', startGalleryAutoplay);
document.addEventListener('keydown', (event) => {
  if (!gallerySlider) return;
  if (event.key === 'ArrowLeft') showGallerySlide(galleryIndex - 1);
  if (event.key === 'ArrowRight') showGallerySlide(galleryIndex + 1);
});
showGallerySlide(0);
startGalleryAutoplay();

const form = document.querySelector('#contact-form');
const formStatus = document.querySelector('#form-status');
const interestSelect = document.querySelector('#contact-form select[name="interest"]');
const messageField = document.querySelector('#contact-form textarea[name="message"]');
const contactGuidance = document.querySelector('#contact-guidance');

const contactGuidanceContent = {
  Partnership: {
    guidance: 'Tell WHSF what kind of partnership, sponsorship or collaboration you want to explore.',
    placeholder: 'Share your organisation name, partnership idea, country or programme area, and the best way for WHSF to follow up.'
  },
  Volunteering: {
    guidance: 'Tell WHSF the skills, time and location you can offer as a volunteer.',
    placeholder: 'Share your skills, availability, country/city, and the WHSF programme area you want to support.'
  },
  Mentorship: {
    guidance: 'Tell WHSF how you can mentor girls, students or young women in technology, leadership or enterprise.',
    placeholder: 'Share your professional background, mentoring area, availability and preferred learner group.'
  },
  'School / Programme interest': {
    guidance: 'Tell WHSF which school, community or programme group needs support.',
    placeholder: 'Share the school/community name, location, number of learners, programme interest and any urgent needs.'
  },
  'Certificate help': {
    guidance: 'Tell WHSF the certificate number and the issue you want checked.',
    placeholder: 'Share the certificate number, learner name, course title and what needs correction or verification.'
  },
  'Donation / Sponsorship': {
    guidance: 'Tell WHSF the type of support you want to provide.',
    placeholder: 'Share whether you want to donate, sponsor learners, fund equipment, support events or discuss a grant.'
  },
  'e-Classroom support': {
    guidance: 'Tell WHSF what e-Classroom access, course, assignment or certificate issue you need help with.',
    placeholder: 'Share your student email, course name and what happened, such as login, lesson, assignment or certificate issue.'
  },
  'TechBridge / Device Donation': {
    guidance: 'Tell WHSF how you want to support rural learning access, device donation, connectivity, livestream teaching or virtual partner rooms.',
    placeholder: 'Share whether you want to donate laptops/tablets, sponsor connectivity, teach remotely, support sustainable technology, or partner on virtual rooms.'
  },
  'Supporting WHSF': {
    guidance: 'Tell WHSF how you would like to support the mission.',
    placeholder: 'Share whether you want to support programmes, events, outreach, equipment, scholarships or general operations.'
  },
  'WHSF SmartStay': {
    guidance: 'Tell WHSF about your tourism, hospitality, sustainability or accessibility technology interest.',
    placeholder: 'Share your organisation, location, sustainability or accessibility goal, and what support you need.'
  },
  'General enquiry': {
    guidance: 'Tell WHSF what you need and the right team will review it.',
    placeholder: 'Share your question, location and the best way for WHSF to respond.'
  }
};

function updateContactGuidance(value) {
  const content = contactGuidanceContent[value] || {
    guidance: 'Choose an interest area and share a short message. WHSF will review your enquiry and respond by email.',
    placeholder: 'Tell us what you need and how WHSF can help.'
  };
  if (contactGuidance) contactGuidance.textContent = content.guidance;
  if (messageField) messageField.placeholder = content.placeholder;
}

interestSelect?.addEventListener('change', () => updateContactGuidance(interestSelect.value));
updateContactGuidance(interestSelect?.value);

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const name = `${data.get('firstName')} ${data.get('lastName')}`.trim();
  const phone = String(data.get('phone') || '').trim();
  const subject = encodeURIComponent(`WHSF enquiry: ${data.get('interest')}`);
  const body = encodeURIComponent(
    `Name: ${name}\nEmail: ${data.get('email')}\nPhone / WhatsApp: ${phone || 'Not provided'}\nInterest: ${data.get('interest')}\n\nMessage:\n${data.get('message')}`
  );

  if (formStatus) formStatus.textContent = 'Opening your email application. Please review and send the prepared message to WHSF.';
  window.location.href = `mailto:info@worldhsfoundation.org?subject=${subject}&body=${body}`;
});

const techbridgeDonationForm = document.querySelector('#techbridge-donation-form');
const techbridgeDonationStatus = document.querySelector('#techbridge-donation-status');
const techbridgeDonationPanel = document.querySelector('#techbridge-donation');
const techbridgeDonationTriggers = document.querySelectorAll('[data-open-techbridge-form]');

function openTechbridgeDonationForm() {
  if (!techbridgeDonationPanel) return;
  techbridgeDonationPanel.hidden = false;
  techbridgeDonationPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const firstInput = techbridgeDonationPanel.querySelector('input, select, textarea, button');
  window.setTimeout(() => firstInput?.focus(), 400);
}

techbridgeDonationTriggers.forEach((button) => {
  button.addEventListener('click', openTechbridgeDonationForm);
});

if (window.location.hash === '#techbridge-donation') {
  openTechbridgeDonationForm();
}

techbridgeDonationForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!techbridgeDonationForm.reportValidity()) return;

  const data = new FormData(techbridgeDonationForm);
  const subject = encodeURIComponent(`WHSF TechBridge enquiry: ${data.get('supportType')}`);
  const body = encodeURIComponent(
    `TechBridge Device Donation / Partner Interest\n\n` +
    `Name / Organisation: ${data.get('donorName')}\n` +
    `Email: ${data.get('donorEmail')}\n` +
    `Phone / WhatsApp: ${data.get('donorPhone') || 'Not provided'}\n` +
    `Location: ${data.get('donorLocation')}\n` +
    `Support type: ${data.get('supportType')}\n` +
    `Quantity / Sponsorship size: ${data.get('quantity')}\n` +
    `Condition / Support details: ${data.get('condition')}\n\n` +
    `Pickup, shipping or availability note:\n${data.get('logistics')}\n\n` +
    `Message:\n${data.get('donationMessage') || 'No additional message provided.'}\n\n` +
    `Consent: The sender confirmed WHSF may contact them about this TechBridge enquiry.`
  );

  if (techbridgeDonationStatus) techbridgeDonationStatus.textContent = 'Opening your email application. Please review and send the prepared TechBridge message to WHSF.';
  window.location.href = `mailto:info@worldhsfoundation.org?subject=${subject}&body=${body}`;
});

const yearElement = document.querySelector('#year');
if (yearElement) yearElement.textContent = new Date().getFullYear();

const mobileLoginForm = document.querySelector('#mobile-app-login-form');
const mobileLoginCard = mobileLoginForm?.closest('.mobile-login-card');
const mobileLoginStatus = document.querySelector('#mobile-login-status');
const mobileDashboard = document.querySelector('[data-mobile-dashboard]');
const mobileWelcome = document.querySelector('[data-mobile-welcome]');
const mobileRoleSummary = document.querySelector('[data-mobile-role-summary]');
const mobileSignout = document.querySelector('[data-mobile-signout]');
const authModeButtons = document.querySelectorAll('[data-auth-mode]');
const authSubmitButton = document.querySelector('[data-auth-submit]');
const confirmPasswordWrap = document.querySelector('[data-confirm-password-wrap]');
const createRequiredFields = document.querySelectorAll('[data-create-required]');
const mobileTabs = document.querySelectorAll('[data-mobile-tab]');
const mobilePanels = document.querySelectorAll('[data-mobile-panel]');
const volunteerTasks = document.querySelectorAll('[data-volunteer-tasks] input[type="checkbox"]');
const volunteerProgress = document.querySelector('[data-volunteer-progress]');
const collabNote = document.querySelector('#mobile-collab-note');
const collabStatus = document.querySelector('[data-collab-status]');
const saveCollabNote = document.querySelector('[data-save-collab-note]');
const addImpactUpdate = document.querySelector('[data-add-impact-update]');
const impactFeed = document.querySelector('[data-impact-feed]');
const communityChat = document.querySelector('[data-community-chat]');
const communityChatForm = document.querySelector('[data-community-chat-form]');
const chatRoomButtons = document.querySelectorAll('[data-chat-room]');
const chatRoomShortcuts = document.querySelectorAll('[data-chat-room-shortcut]');
const chatRoomTitle = document.querySelector('[data-chat-room-title]');
const chatRoomDescription = document.querySelector('[data-chat-room-description]');
const adminAnnouncementForm = document.querySelector('[data-admin-announcement-form]');
const requestNotifications = document.querySelector('[data-request-notifications]');
const notificationStatus = document.querySelector('[data-notification-status]');
const mobileSessionKey = 'whsf_mobile_app_session';
const mobileAccountsKey = 'whsf_mobile_app_accounts';
const mobileNoteKey = 'whsf_mobile_app_collaboration_note';
const mobileChatKey = 'whsf_mobile_app_chat_rooms';
const adminAnnouncementCard = document.querySelector('.admin-announcement-card');
const WHSF_MOBILE_SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const WHSF_MOBILE_SUPABASE_ANON_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
const whsfMobileSupabase = mobileLoginForm && window.supabase
  ? window.supabase.createClient(WHSF_MOBILE_SUPABASE_URL, WHSF_MOBILE_SUPABASE_ANON_KEY)
  : null;
let activeChatRoom = 'volunteers';
let mobileAuthMode = 'create';
let currentMobileProfile = null;

const mobileRoleContent = {
  volunteer: {
    label: 'Volunteer',
    summary: 'Volunteer Hub is ready with tasks, reminders and collaboration notes.',
    tab: 'volunteer'
  },
  partner: {
    label: 'Partner',
    summary: 'Partner view is ready for collaboration, impact updates and programme coordination.',
    tab: 'impact'
  },
  student: {
    label: 'Student',
    summary: 'Student view is ready with e-Classroom, certificates and learning support.',
    tab: 'member'
  },
  member: {
    label: 'Member',
    summary: 'Member dashboard is ready with announcements, learning and programme access.',
    tab: 'member'
  },
  donor: {
    label: 'Donor',
    summary: 'Donor Hub is ready with giving, impact reporting and support access.',
    tab: 'donor'
  }
};

const chatRooms = {
  volunteers: {
    title: 'Volunteers room',
    description: 'Coordinate service activities, mentorship and event support.',
    messages: [
      { sender: 'Volunteer coordinator', text: 'Welcome. Use this room to coordinate mentoring, outreach and programme support.', time: '09:00' },
      { sender: 'WHSF team', text: 'Please share availability early so coordinators can plan volunteer assignments.', time: '09:05' }
    ]
  },
  donors: {
    title: 'Donors room',
    description: 'Share campaign updates, giving questions and impact reporting requests.',
    messages: [
      { sender: 'Donor relations', text: 'Welcome. Donors can request updates, campaign details and impact stories here.', time: '09:10' }
    ]
  },
  students: {
    title: 'Students room',
    description: 'Ask learning questions and receive guidance for WHSF e-Classroom.',
    messages: [
      { sender: 'Student support', text: 'Students can ask course questions and receive direction to e-Classroom resources.', time: '09:15' }
    ]
  },
  partners: {
    title: 'Partners room',
    description: 'Coordinate programme support, technology donations and institutional collaboration.',
    messages: [
      { sender: 'Partnership desk', text: 'Partners can discuss collaboration, device donation, training support and programme opportunities.', time: '09:20' }
    ]
  },
  members: {
    title: 'Members room',
    description: 'Follow WHSF announcements, events and member opportunities.',
    messages: [
      { sender: 'WHSF membership', text: 'Members can follow announcements, events, learning opportunities and community updates here.', time: '09:25' }
    ]
  },
  technology: {
    title: 'Technology advancement room',
    description: 'Discuss AI, robotics, cybersecurity, drones, accessibility tools and data skills that can support WHSF programmes.',
    messages: [
      { sender: 'Innovation desk', text: 'Share technology ideas that can improve learning access, disability inclusion, rural outreach and digital skills training.', time: '09:30' },
      { sender: 'Tech mentor', text: 'Suggested topics: AI learning assistants, drone mapping for rural access, robotics clubs, cybersecurity awareness and assistive technology.', time: '09:35' }
    ]
  },
  impact: {
    title: 'Community impact room',
    description: 'Share field stories, measurable outcomes, beneficiary needs, donor updates and programme results.',
    messages: [
      { sender: 'Impact team', text: 'Use this room to collect stories, photos, milestones and evidence of how WHSF programmes are changing lives.', time: '09:40' }
    ]
  },
  trends: {
    title: 'Technology trends room',
    description: 'Track emerging technologies, responsible innovation and skills that girls and young women should learn next.',
    messages: [
      { sender: 'Trend watch', text: 'Share useful technology trends such as AI safety, cloud skills, low-cost devices, accessibility tools, green technology and data literacy.', time: '09:45' }
    ]
  },
  events: {
    title: 'Global tech events room',
    description: 'Share conferences, webinars, hackathons, STEM competitions, awards and training events around the world.',
    messages: [
      { sender: 'Events desk', text: 'Post upcoming tech events, competitions, webinars and innovation showcases that can benefit WHSF learners and partners.', time: '09:50' }
    ]
  },
  exchange: {
    title: 'Student exchange room',
    description: 'Coordinate virtual exchange, mentorship, international classrooms, peer learning and global student exposure.',
    messages: [
      { sender: 'Exchange coordinator', text: 'Use this room for virtual classroom ideas, international mentor sessions, student presentations and cross-country learning links.', time: '09:55' }
    ]
  },
  opportunities: {
    title: 'Scholarships and career opportunities room',
    description: 'Share scholarships, fellowships, internships, grants, entrepreneurship support and career pathways.',
    messages: [
      { sender: 'Opportunities desk', text: 'Share opportunities that can help girls and young women access training, jobs, mentorship, enterprise support and global networks.', time: '10:00' }
    ]
  },
  employment: {
    title: 'Employment opportunities room',
    description: 'Share jobs, internships, apprenticeships, remote work, CV support and workplace readiness resources.',
    messages: [
      { sender: 'Career desk', text: 'Post youth-friendly job openings, internships, remote roles, apprenticeship pathways and interview preparation support.', time: '10:10' },
      { sender: 'WHSF mentor', text: 'Useful topics include CV review, LinkedIn profile building, workplace communication and digital portfolio development.', time: '10:15' }
    ]
  },
  entrepreneurship: {
    title: 'Entrepreneurship room',
    description: 'Support business ideas, social enterprise, digital services, startup mentoring and income-generation pathways.',
    messages: [
      { sender: 'Enterprise mentor', text: 'Share business ideas, startup questions, funding opportunities, digital marketing tips and social enterprise models.', time: '10:20' },
      { sender: 'WHSF innovation', text: 'Girls and young women can explore technology-enabled businesses such as digital services, agritech, e-commerce, repair labs and training services.', time: '10:25' }
    ]
  },
  networking: {
    title: 'Networking room',
    description: 'Build connections with mentors, alumni, partners, donors, volunteers and international supporters.',
    messages: [
      { sender: 'Networking desk', text: 'Introduce yourself, share your skills, ask for mentorship and connect with people who can support your learning or project goals.', time: '10:30' },
      { sender: 'Partner relations', text: 'Partners can use this room to offer mentorship, speaking sessions, workplace exposure and collaborative learning opportunities.', time: '10:35' }
    ]
  },
  safeguarding: {
    title: 'Support and safeguarding room',
    description: 'Raise support needs, accessibility concerns, wellbeing issues and safe participation questions.',
    messages: [
      { sender: 'WHSF support', text: 'Use this room for respectful support requests, accessibility needs and safeguarding-aware programme concerns.', time: '10:05' }
    ]
  }
};

function escapeHtml(value) {
  return String(value).replace(/[<>&"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
  }[char]));
}

function formatChatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function loadChatRooms() {
  if (!whsfMobileSupabase || !currentMobileProfile) {
    renderChatRoom(activeChatRoom);
    return;
  }

  const { data, error } = await whsfMobileSupabase
    .from('mobile_app_chat_messages')
    .select('room,sender_name,sender_role,message,message_type,created_at')
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    setMobileLoginStatus(error.message);
    renderChatRoom(activeChatRoom);
    return;
  }

  Object.keys(chatRooms).forEach((roomName) => {
    chatRooms[roomName].messages = [];
  });

  (data || []).forEach((message) => {
    if (!chatRooms[message.room]) return;
    chatRooms[message.room].messages.push({
      sender: message.sender_name,
      text: message.message,
      role: message.sender_role,
      type: message.message_type,
      time: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  renderChatRoom(activeChatRoom);
}

function renderChatRoom(roomName = activeChatRoom) {
  if (!communityChat) return;
  const room = chatRooms[roomName] || chatRooms.volunteers;
  activeChatRoom = roomName;

  if (chatRoomTitle) chatRoomTitle.textContent = room.title;
  if (chatRoomDescription) chatRoomDescription.textContent = room.description;

  chatRoomButtons.forEach((button) => {
    const isActive = button.dataset.chatRoom === roomName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  communityChat.innerHTML = room.messages.map((message) => `
    <article class="${message.type === 'announcement' ? 'chat-announcement' : ''}">
      <strong>${escapeHtml(message.sender)}</strong>
      <p>${escapeHtml(message.text)}</p>
      <time>${escapeHtml(message.time)}</time>
    </article>
  `).join('');
  communityChat.scrollTop = communityChat.scrollHeight;
}

async function addChatMessage(roomName, sender, text, type = 'message') {
  const room = chatRooms[roomName] || chatRooms.volunteers;
  const newMessage = {
    sender,
    text,
    type,
    time: formatChatTime()
  };

  if (whsfMobileSupabase && currentMobileProfile) {
    const { error } = await whsfMobileSupabase
      .from('mobile_app_chat_messages')
      .insert({
        room: roomName,
        sender_id: currentMobileProfile.id,
        sender_name: currentMobileProfile.full_name,
        sender_role: currentMobileProfile.role,
        message: text,
        message_type: type
      });

    if (error) {
      setMobileLoginStatus(error.message);
      return;
    }
  }

  room.messages.push(newMessage);
  renderChatRoom(roomName);
}

function setMobileLoginStatus(message) {
  if (mobileLoginStatus) mobileLoginStatus.textContent = message || '';
}

function ensureMobileSupabase() {
  if (whsfMobileSupabase) return true;
  setMobileLoginStatus('Secure account service is still loading. Please refresh the page and try again.');
  return false;
}

function setMobileAuthMode(mode) {
  mobileAuthMode = mode === 'signin' ? 'signin' : 'create';
  const isCreateMode = mobileAuthMode === 'create';

  authModeButtons.forEach((button) => {
    const isActive = button.dataset.authMode === mobileAuthMode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  if (authSubmitButton) authSubmitButton.textContent = isCreateMode ? 'Create Account' : 'Sign In';
  if (confirmPasswordWrap) confirmPasswordWrap.hidden = !isCreateMode;
  createRequiredFields.forEach((field) => {
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
      field.required = isCreateMode;
    }
  });
  setMobileLoginStatus(isCreateMode ? 'Create your WHSF account to continue.' : 'Sign in with your existing WHSF account.');
}

function activateMobileTab(tabName) {
  mobileTabs.forEach((tab) => {
    const isActive = tab.dataset.mobileTab === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  mobilePanels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.mobilePanel === tabName);
  });
}

function updateVolunteerProgress() {
  if (!volunteerProgress || !volunteerTasks.length) return;
  const completed = Array.from(volunteerTasks).filter((task) => task.checked).length;
  volunteerProgress.textContent = `${completed} of ${volunteerTasks.length} tasks completed`;
}

function renderMobileSession(session) {
  if (!mobileDashboard || !mobileLoginForm || !session) return;

  const roleContent = mobileRoleContent[session.role] || mobileRoleContent.member;
  mobileDashboard.hidden = false;
  mobileDashboard.removeAttribute('hidden');
  mobileDashboard.classList.add('is-active');
  if (mobileLoginCard) mobileLoginCard.hidden = true;
  if (mobileWelcome) mobileWelcome.textContent = `Welcome, ${session.name}`;
  if (mobileRoleSummary) mobileRoleSummary.textContent = `${roleContent.label} access • ${roleContent.summary}`;
  if (adminAnnouncementCard) adminAnnouncementCard.hidden = !session.isAdmin;
  activateMobileTab(roleContent.tab);
  setMobileLoginStatus(`Signed in as ${roleContent.label}.`);
  mobileDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function loadMobileSession() {
  try {
    return JSON.parse(sessionStorage.getItem(mobileSessionKey) || 'null');
  } catch {
    return null;
  }
}

function saveMobileSession(session) {
  try {
    sessionStorage.setItem(mobileSessionKey, JSON.stringify(session));
  } catch {
    setMobileLoginStatus('Signed in for this page session. Browser storage is not available.');
  }
}

async function getMobileProfile(user) {
  if (!whsfMobileSupabase || !user) return null;
  const { data, error } = await whsfMobileSupabase
    .from('mobile_app_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    setMobileLoginStatus(error.message);
    return null;
  }

  return data;
}

async function upsertMobileProfile(user, fullName, role) {
  if (!whsfMobileSupabase || !user) return null;
  const profile = {
    id: user.id,
    full_name: fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'WHSF member',
    email: user.email,
    role: role || user.user_metadata?.role || 'member',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await whsfMobileSupabase
    .from('mobile_app_profiles')
    .upsert(profile)
    .select()
    .single();

  if (error) {
    setMobileLoginStatus(error.message);
    return null;
  }

  return data;
}

function profileToMobileSession(user, profile) {
  const appRole = user?.app_metadata?.role;
  const role = appRole === 'admin' ? 'admin' : profile?.role || user?.user_metadata?.role || 'member';
  return {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'WHSF member',
    email: user.email,
    role,
    isAdmin: role === 'admin',
    signedInAt: new Date().toISOString()
  };
}

mobileLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!mobileLoginForm.reportValidity()) return;
  if (!ensureMobileSupabase()) return;

  const data = new FormData(mobileLoginForm);
  const name = String(data.get('name') || '').trim();
  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = String(data.get('password') || '');
  const passwordConfirm = String(data.get('passwordConfirm') || '');
  const role = String(data.get('role') || '').trim();

  if (!email || !password || password.length < 8) {
    setMobileLoginStatus('Please enter your email and a password of at least 8 characters.');
    return;
  }

  if (mobileAuthMode === 'create') {
    if (!name || !role) {
      setMobileLoginStatus('Please enter your full name and select your role to create an account.');
      return;
    }
    if (password !== passwordConfirm) {
      setMobileLoginStatus('Passwords do not match. Please confirm your password.');
      return;
    }

    setMobileLoginStatus('Creating your secure WHSF account…');
    const { data: authData, error } = await whsfMobileSupabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role
        }
      }
    });

    if (error) {
      setMobileLoginStatus(error.message);
      return;
    }

    if (!authData.session) {
      setMobileLoginStatus('Account created. Please check your email to confirm the account, then sign in.');
      setMobileAuthMode('signin');
      return;
    }

    currentMobileProfile = await upsertMobileProfile(authData.user, name, role);
    if (!currentMobileProfile) return;

    const session = profileToMobileSession(authData.user, currentMobileProfile);
    renderMobileSession(session);
    saveMobileSession(session);
    await loadChatRooms();
    return;
  } else {
    setMobileLoginStatus('Signing in securely…');
    const { data: authData, error } = await whsfMobileSupabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMobileLoginStatus(error.message);
      return;
    }

    currentMobileProfile = await getMobileProfile(authData.user);
    if (!currentMobileProfile) {
      currentMobileProfile = await upsertMobileProfile(authData.user, name, role || 'member');
    }
    if (!currentMobileProfile) return;

    const session = profileToMobileSession(authData.user, currentMobileProfile);
    renderMobileSession(session);
    saveMobileSession(session);
    await loadChatRooms();
  }
});

authModeButtons.forEach((button) => {
  button.addEventListener('click', () => setMobileAuthMode(button.dataset.authMode));
});

setMobileAuthMode('create');

mobileSignout?.addEventListener('click', async () => {
  if (whsfMobileSupabase) await whsfMobileSupabase.auth.signOut();
  try {
    sessionStorage.removeItem(mobileSessionKey);
  } catch {
    // Browser storage may be unavailable in some privacy modes; the visible session can still be cleared.
  }
  mobileDashboard.hidden = true;
  mobileDashboard.classList.remove('is-active');
  currentMobileProfile = null;
  mobileLoginForm?.reset();
  if (mobileLoginCard) mobileLoginCard.hidden = false;
  setMobileLoginStatus('Signed out successfully.');
  mobileLoginForm?.querySelector('input, select, button')?.focus();
});

mobileTabs.forEach((tab) => {
  tab.addEventListener('click', () => activateMobileTab(tab.dataset.mobileTab));
});

volunteerTasks.forEach((task) => task.addEventListener('change', updateVolunteerProgress));
updateVolunteerProgress();

if (collabNote) {
  try {
    collabNote.value = localStorage.getItem(mobileNoteKey) || '';
  } catch {
    collabNote.value = '';
  }
}

saveCollabNote?.addEventListener('click', () => {
  if (!collabNote) return;
  try {
    localStorage.setItem(mobileNoteKey, collabNote.value.trim());
    if (collabStatus) collabStatus.textContent = 'Collaboration note saved on this device for the pilot.';
  } catch {
    if (collabStatus) collabStatus.textContent = 'Note captured for this session. Browser storage is not available.';
  }
});

addImpactUpdate?.addEventListener('click', () => {
  if (!impactFeed) return;
  const update = document.createElement('article');
  update.innerHTML = '<span>New pilot update</span><strong>Draft impact update added.</strong><p>Use this space for WHSF coordinators to publish programme stories, field photos, training updates and donor-visible progress.</p>';
  impactFeed.prepend(update);
});

communityChatForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!communityChatForm.reportValidity() || !communityChat) return;
  if (!currentMobileProfile) {
    setMobileLoginStatus('Please sign in before sending chat messages.');
    return;
  }

  const data = new FormData(communityChatForm);
  const message = String(data.get('message') || '').trim();
  const sender = currentMobileProfile.full_name || 'WHSF community member';
  if (!message) return;

  await addChatMessage(activeChatRoom, sender, message);
  communityChatForm.reset();
});

chatRoomButtons.forEach((button) => {
  button.addEventListener('click', () => renderChatRoom(button.dataset.chatRoom));
});

chatRoomShortcuts.forEach((button) => {
  button.addEventListener('click', () => renderChatRoom(button.dataset.chatRoomShortcut));
});

adminAnnouncementForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!adminAnnouncementForm.reportValidity()) return;
  if (!currentMobileProfile || currentMobileProfile.role !== 'admin') {
    setMobileLoginStatus('Only WHSF admin accounts can send announcements.');
    return;
  }
  const data = new FormData(adminAnnouncementForm);
  const announcement = String(data.get('announcement') || '').trim();
  if (!announcement) return;

  const rows = Object.keys(chatRooms).map((roomName) => ({
    room: roomName,
    sender_id: currentMobileProfile.id,
    sender_name: currentMobileProfile.full_name,
    sender_role: currentMobileProfile.role,
    message: announcement,
    message_type: 'announcement'
  }));

  const { error } = await whsfMobileSupabase
    .from('mobile_app_chat_messages')
    .insert(rows);

  if (error) {
    setMobileLoginStatus(error.message);
    return;
  }

  await loadChatRooms();
  adminAnnouncementForm.reset();
});

renderChatRoom(activeChatRoom);

requestNotifications?.addEventListener('click', async () => {
  if (!notificationStatus) return;

  if (!('Notification' in window)) {
    notificationStatus.textContent = 'This browser does not support notification prompts.';
    return;
  }

  const permission = await Notification.requestPermission();
  notificationStatus.textContent =
    permission === 'granted'
      ? 'Notifications allowed. WHSF can use alerts for important reminders and programme updates.'
      : 'Notifications were not enabled. Users can still receive updates through the WHSF website and email.';
});

async function restoreMobileSupabaseSession() {
  if (!whsfMobileSupabase || !mobileLoginForm) {
    renderChatRoom(activeChatRoom);
    return;
  }

  const { data } = await whsfMobileSupabase.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    renderChatRoom(activeChatRoom);
    return;
  }

  currentMobileProfile = await getMobileProfile(user);
  if (!currentMobileProfile) {
    currentMobileProfile = await upsertMobileProfile(user, user.user_metadata?.full_name, user.user_metadata?.role || 'member');
  }
  if (!currentMobileProfile) return;

  const session = profileToMobileSession(user, currentMobileProfile);
  renderMobileSession(session);
  saveMobileSession(session);
  await loadChatRooms();
}

restoreMobileSupabaseSession();

const pwaInstallButtons = document.querySelectorAll('[data-install-pwa]');
const pwaInstallStatus = document.querySelector('[data-pwa-install-status]');
let deferredPwaPrompt;

function updatePwaInstallStatus(message) {
  if (pwaInstallStatus && message) pwaInstallStatus.textContent = message;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(() => updatePwaInstallStatus('WHSF App is ready for browser installation where supported.'))
      .catch(() => updatePwaInstallStatus('WHSF App install support is preparing. Please try again after publishing.'));
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPwaPrompt = event;
  pwaInstallButtons.forEach((button) => {
    button.hidden = false;
    button.disabled = false;
  });
  updatePwaInstallStatus('Tap Install WHSF App to add it to this device.');
});

pwaInstallButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    if (!deferredPwaPrompt) {
      updatePwaInstallStatus('If the install prompt does not appear, use your browser menu and choose Add to Home Screen or Install app.');
      return;
    }

    deferredPwaPrompt.prompt();
    const result = await deferredPwaPrompt.userChoice;
    deferredPwaPrompt = null;
    updatePwaInstallStatus(
      result.outcome === 'accepted'
        ? 'Thank you. WHSF App has been added to this device.'
        : 'Install was not completed. You can try again from your browser install menu.'
    );
  });
});

window.addEventListener('appinstalled', () => {
  deferredPwaPrompt = null;
  updatePwaInstallStatus('WHSF App installed successfully.');
});
