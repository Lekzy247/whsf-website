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
  localStorage.setItem(storageKey, String(active));
}

if (localStorage.getItem('whsf-large-text') === 'true') {
  document.body.classList.add('large-text');
  fontToggle?.setAttribute('aria-pressed', 'true');
}
if (localStorage.getItem('whsf-high-contrast') === 'true') {
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
    secondaryHref: '#contact',
    interest: 'e-Classroom support'
  },
  volunteer: {
    label: 'Volunteer pathway',
    title: 'Share your time, skills and experience with WHSF.',
    copy: 'Support programme delivery, student mentoring, community outreach, digital skills sessions and events that expand opportunity for girls and young women.',
    primaryText: 'Register interest',
    primaryHref: '#contact',
    secondaryText: 'See programmes',
    secondaryHref: '#programs',
    interest: 'Volunteering'
  },
  partner: {
    label: 'Partner and sponsor pathway',
    title: 'Build programmes, scholarships and impact with WHSF.',
    copy: 'Schools, companies, foundations and institutions can collaborate on training, sponsorship, equipment, mentorship, research and community innovation.',
    primaryText: 'Start partnership enquiry',
    primaryHref: '#contact',
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
    secondaryHref: '#contact',
    interest: 'Donation / Sponsorship'
  },
  certificate: {
    label: 'Certificate pathway',
    title: 'Verify a WHSF certificate online.',
    copy: 'Students, schools, partners and employers can confirm certificates using the certificate number shown on the PDF.',
    primaryText: 'Verify certificate',
    primaryHref: 'verify-certificate.html',
    secondaryText: 'Ask for certificate help',
    secondaryHref: '#contact',
    interest: 'Certificate help'
  },
  programme: {
    label: 'Programme pathway',
    title: 'Find a WHSF programme that fits your goals.',
    copy: 'Explore ICT Girls Club, TechWomen, robotics, drone technology, cybersecurity, AI, STEM, agriculture and accessibility technology pathways.',
    primaryText: 'View programmes',
    primaryHref: '#programs',
    secondaryText: 'Request programme info',
    secondaryHref: '#contact',
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
