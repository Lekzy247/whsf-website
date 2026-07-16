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

function initClassroomMenuDropdown() {
  const toggles = document.querySelectorAll('[data-classroom-menu-toggle]');
  if (!toggles.length) return;

  const closeAll = () => {
    toggles.forEach((toggle) => {
      const dropdown = toggle.closest('.nav-dropdown');
      const panel = dropdown?.querySelector('[data-classroom-menu-panel]');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.classList.remove('is-open');
      if (panel) panel.hidden = true;
    });
  };

  toggles.forEach((toggle) => {
    const dropdown = toggle.closest('.nav-dropdown');
    const panel = dropdown?.querySelector('[data-classroom-menu-panel]');
    if (!panel) return;

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const shouldOpen = toggle.getAttribute('aria-expanded') !== 'true';
      closeAll();
      toggle.setAttribute('aria-expanded', String(shouldOpen));
      toggle.classList.toggle('is-open', shouldOpen);
      panel.hidden = !shouldOpen;
    });

    panel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        closeAll();
        setMenu(false);
      });
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-classroom-menu-toggle], [data-classroom-menu-panel]')) closeAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}

initClassroomMenuDropdown();

function initMobileNavigationFallback() {
  const nav = document.querySelector('#primary-navigation, .primary-nav');
  const toggle = document.querySelector('.menu-toggle');

  nav?.querySelectorAll('a[href]').forEach((link) => {
    if (link.dataset.mobileCloseReady === 'true') return;
    link.dataset.mobileCloseReady = 'true';
    link.addEventListener('click', () => {
      setMenu(false);
      document.querySelectorAll('[data-classroom-menu-toggle]').forEach((dropdownToggle) => {
        dropdownToggle.setAttribute('aria-expanded', 'false');
        dropdownToggle.classList.remove('is-open');
      });
      document.querySelectorAll('[data-classroom-menu-panel]').forEach((panel) => {
        panel.hidden = true;
      });
    });
  });

  if (toggle && nav && toggle.dataset.mobileFallbackReady !== 'true') {
    toggle.dataset.mobileFallbackReady = 'true';
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      nav.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
    });
  }
}

initMobileNavigationFallback();

const whsfSocialLinks = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/worldhsfoundation',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.3 8.9V7.4c0-.7.5-.9.9-.9h2.1V3h-3c-3.3 0-4.1 2.1-4.1 4.1v1.8H7.8v3.8h2.4V21h4.1v-8.3H17l.4-3.8h-3.1Z"/></svg>'
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/worldhsfoundation',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm4.5 3.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 2a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Zm5-2.3a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z"/></svg>'
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/channel/UCiDbbLL3icQI2D90ZTfHFOQ',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2s-.2-1.5-.9-2.1c-.9-.9-1.8-.9-2.3-.9C15.2 4 12 4 12 4h-.1s-3.2 0-6.4.2c-.5 0-1.5 0-2.3.9-.7.6-.9 2.1-.9 2.1S2 9 2 10.8v1.7c0 1.8.3 3.6.3 3.6s.2 1.5.9 2.1c.9.9 2 .8 2.5.9 1.8.2 6.3.3 6.3.3s3.2 0 6.4-.2c.5 0 1.5 0 2.3-.9.7-.6.9-2.1.9-2.1s.3-1.8.3-3.6v-1.7c0-1.9-.3-3.7-.3-3.7ZM10 14.6V8.3l5.7 3.2-5.7 3.1Z"/></svg>'
  },
  {
    name: 'LinkedIn',
    href: 'http://linkedin.com/company/worldhsfoundation',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.8 21H3.1V9h3.7v12ZM5 7.4A2.1 2.1 0 1 1 5 3a2.1 2.1 0 0 1 0 4.4ZM21 21h-3.7v-5.9c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1v6H9.4V9h3.5v1.6h.1c.5-.9 1.7-1.9 3.5-1.9 3.8 0 4.5 2.5 4.5 5.7V21Z"/></svg>'
  }
];

function initHeaderSocialLinks() {
  const navWrap = document.querySelector('.nav-wrap');
  if (!navWrap || navWrap.querySelector('.header-social-links')) return;

  const socialNav = document.createElement('nav');
  socialNav.className = 'header-social-links';
  socialNav.setAttribute('aria-label', 'WHSF social media');
  socialNav.innerHTML = whsfSocialLinks.map((item) => `
    <a href="${item.href}" target="_blank" rel="noreferrer" aria-label="${item.name}">
      ${item.icon}
    </a>
  `).join('');

  const menuToggle = navWrap.querySelector('.menu-toggle');
  if (menuToggle) navWrap.insertBefore(socialNav, menuToggle);
  else navWrap.append(socialNav);
}

initHeaderSocialLinks();

function initFooterSocialLogos() {
  document.querySelectorAll('.social-links').forEach((container) => {
    if (container.dataset.logoReady === 'true') return;
    container.dataset.logoReady = 'true';
    container.querySelectorAll('a').forEach((link) => {
      const text = link.textContent.trim().toLowerCase();
      const social = whsfSocialLinks.find((item) => item.name.toLowerCase() === text);
      if (!social) return;
      link.setAttribute('aria-label', social.name);
      link.innerHTML = `${social.icon}<span>${social.name}</span>`;
    });
  });
}

initFooterSocialLogos();

const homepageMain = document.querySelector('main#main');
const homepageGallery = document.querySelector('#gallery.gallery-section');

if (homepageMain && homepageGallery) {
  homepageGallery.classList.add('home-top-gallery-section');
  homepageMain.insertBefore(homepageGallery, homepageMain.firstElementChild);
}

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

const metricNumbers = [...document.querySelectorAll('.tech-impact-metrics strong[data-count-target]')];

function animateMetricNumber(element) {
  const target = Number(element.dataset.countTarget);
  if (!target || element.dataset.counted === 'true') return;

  element.dataset.counted = 'true';
  const suffix = element.dataset.countSuffix || '';
  const finalText = `${target.toLocaleString()}${suffix}`;
  const duration = 1500;
  const startTime = performance.now();

  function formatNumber(value) {
    return `${Math.round(value).toLocaleString()}${suffix}`;
  }

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatNumber(target * eased);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = finalText;
    }
  }

  element.textContent = formatNumber(0);
  requestAnimationFrame(tick);
}

if (metricNumbers.length) {
  const metricObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateMetricNumber(entry.target);
          metricObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.35 }
  );

  metricNumbers.forEach((number) => metricObserver.observe(number));

  setTimeout(() => {
    metricNumbers.forEach((number) => {
      const rect = number.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        animateMetricNumber(number);
      }
    });
  }, 700);
}

const pathOptions = document.querySelectorAll('.path-option');
const pathLabel = document.querySelector('#path-result-label');
const pathTitle = document.querySelector('#path-result-title');
const pathCopy = document.querySelector('#path-result-copy');
const pathPrimaryAction = document.querySelector('#path-primary-action');
const pathSecondaryAction = document.querySelector('#path-secondary-action');

const pathContent = {
  student: {
    label: 'Student pathway',
    title: 'Start or continue learning with WHSF e-learning.',
    copy: 'Explore technology training in robotics, cybersecurity, drone technology, AI, STEM, eHealth and accessibility technology.',
    primaryText: 'Open e-learning',
    primaryHref: 'e-classroom.html',
    secondaryText: 'Contact support',
    secondaryHref: 'contact.html',
    interest: 'e-learning support'
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
const galleryScrollText = document.querySelector('#gallery-scroll-text');
const galleryThumbs = [...document.querySelectorAll('.gallery-thumb')];
const galleryPrev = document.querySelector('.gallery-prev');
const galleryNext = document.querySelector('.gallery-next');
let galleryIndex = 0;
let galleryTimer;
const galleryImageCache = new Map();

if (galleryMainLink) {
  galleryMainLink.removeAttribute('href');
  galleryMainLink.removeAttribute('target');
  galleryMainLink.removeAttribute('rel');
  galleryMainLink.addEventListener('click', (event) => event.preventDefault());
  galleryMainLink.addEventListener('contextmenu', (event) => event.preventDefault());
}

if (galleryMainImage) {
  galleryMainImage.draggable = false;
  galleryMainImage.addEventListener('contextmenu', (event) => event.preventDefault());
}

function preloadGalleryImage(src) {
  if (!src) return Promise.resolve(false);
  if (galleryImageCache.has(src)) return galleryImageCache.get(src);
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
  galleryImageCache.set(src, promise);
  return promise;
}

async function showGallerySlide(index) {
  if (!galleryThumbs.length || !galleryMainImage) return;
  galleryIndex = (index + galleryThumbs.length) % galleryThumbs.length;
  const requestedIndex = galleryIndex;
  const selected = galleryThumbs[galleryIndex];
  const { src, fallback, title, description, alt, scroll, tone } = selected.dataset;
  if (gallerySlider) {
    gallerySlider.dataset.galleryTone = tone || 'wine';
  }

  galleryThumbs.forEach((thumb, thumbIndex) => {
    thumb.classList.toggle('active', thumbIndex === galleryIndex);
    thumb.setAttribute('aria-pressed', String(thumbIndex === galleryIndex));
  });

  galleryMainImage.style.opacity = '0.35';
  galleryMainImage.removeAttribute('data-using-fallback');
  const srcWorks = await preloadGalleryImage(src);
  if (requestedIndex !== galleryIndex) return;
  const fallbackWorks = !srcWorks && fallback ? await preloadGalleryImage(fallback) : false;
  if (requestedIndex !== galleryIndex) return;
  const imageSrc = srcWorks ? src : fallbackWorks ? fallback : src;
  galleryMainImage.onerror = () => {
    if (fallback && !galleryMainImage.dataset.usingFallback) {
      galleryMainImage.dataset.usingFallback = 'true';
      galleryMainImage.src = fallback;
      return;
    }
    galleryMainImage.style.opacity = '1';
  };
  galleryMainImage.onload = () => {
    galleryMainImage.style.opacity = '1';
  };
  galleryMainImage.src = imageSrc;
  galleryMainImage.alt = alt || title || 'WHSF gallery image';
  if (galleryMainLink) galleryMainLink.setAttribute('aria-label', galleryMainImage.alt);
  if (galleryCounter) galleryCounter.textContent = `Technology for humanity · ${galleryIndex + 1} / ${galleryThumbs.length}`;
  if (galleryTitle) galleryTitle.textContent = title || 'WHSF gallery highlight';
  if (galleryDescription) galleryDescription.textContent = description || 'A WHSF programme moment.';
  if (galleryScrollText) {
    galleryScrollText.textContent = scroll || 'AI for Good • Digital inclusion • STEM education • Responsible technology • Sustainable development';
  }
}

function startGalleryAutoplay() {
  if (!galleryThumbs.length) return;
  window.clearInterval(galleryTimer);
  galleryTimer = window.setInterval(() => showGallerySlide(galleryIndex + 1), 3000);
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
galleryThumbs.forEach((thumb) => {
  preloadGalleryImage(thumb.dataset.src);
  preloadGalleryImage(thumb.dataset.fallback);
});
showGallerySlide(0);
startGalleryAutoplay();

const form = document.querySelector('#contact-form');
const formStatus = document.querySelector('#form-status');
const interestSelect = document.querySelector('#contact-form select[name="interest"]');
const messageField = document.querySelector('#contact-form textarea[name="message"]');
const contactGuidance = document.querySelector('#contact-guidance');

const fraudAwarenessMessage = 'Fraud awareness: Scammers have misused the WHSF name, logo and images to create fraudulent Facebook pages and WhatsApp groups. WHSF is not offering financial promotions. Please report suspicious activity to your local authorities.';
const fraudConcernPattern = /(fraud|scam|fake|whatsapp|facebook|promotion|employee|number|impersonat|telegram|investment|cash grant|payment request|financial promotion)/i;
const publicFinancialAidPattern = /(financial assistance|financial help|money assistance|cash assistance|medical bill|medical bills|hospital bill|hospital bills|school fees|school fee|tuition assistance|pay my fees|pay fees|rent assistance|personal aid|individual aid|send me money|help me with money|need money)/i;

function isFraudConcern(interest, message) {
  return interest === 'Fraud / Scam report' || fraudConcernPattern.test(`${interest} ${message}`);
}

function isPublicFinancialAidRequest(interest, message) {
  return interest === 'General enquiry' && publicFinancialAidPattern.test(message);
}

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
  'e-learning support': {
    guidance: 'Tell WHSF what e-learning access, course, assignment or certificate issue you need help with.',
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
  'Fraud / Scam report': {
    guidance: `${fraudAwarenessMessage} If someone contacts you through WhatsApp, Facebook, a fake employee profile or a suspicious number requesting money or promising financial promotion, treat it as a scam and report it to the appropriate authorities.`,
    placeholder: 'Share the suspicious WhatsApp number, Facebook page link, fake employee name, phone number, promotion message or screenshot description. Do not send money or share personal or financial information.'
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
  const interest = String(data.get('interest') || 'General enquiry');
  const message = String(data.get('message') || '');
  const financialAidRequest = isPublicFinancialAidRequest(interest, message);
  const fraudConcern = !financialAidRequest && isFraudConcern(interest, message);
  const subject = encodeURIComponent(
    fraudConcern ? 'WHSF fraud/scam report' :
    financialAidRequest ? 'WHSF enquiry: financial assistance information' :
    `WHSF enquiry: ${interest}`
  );
  const fraudAutoReply = fraudConcern
    ? `FRAUD / SCAM AWARENESS AUTO-REPLY\n\nThank you for contacting WHSF. Based on your enquiry, please be aware:\n\n${fraudAwarenessMessage}\n\nWHSF is not offering financial promotions, investment payments, WhatsApp cash grants, Facebook promotions or unofficial aid through personal numbers. If someone is using a WhatsApp number, fake Facebook page, fake employee name or fake phone number to request money or promise benefits, it does not come from WHSF.\n\nPlease do not send money or share personal, banking or identity information. Report the matter to your local authorities, the platform involved, and your bank or mobile-money provider if any payment details were shared.\n\n---\n\n`
    : '';
  const financialAidAutoReply = financialAidRequest
    ? `PUBLIC ASSISTANCE NOTICE\n\nThank you for contacting World Humanitarian Support Foundation. WHSF is committed to helping communities through technology education, digital inclusion, e-learning learning, skills development, mentorship, innovation programmes and community capacity building.\n\nPlease note that WHSF does not provide direct financial assistance to the public for personal bills, medical bills, school fees, rent, cash requests or individual emergency payments. Our support model focuses on expanding access to learning, technology skills, digital tools, verified certificates, youth empowerment, women-in-technology pathways and community development programmes.\n\nIf you need urgent medical, welfare, school-fee or emergency financial support, please contact appropriate local government agencies, registered social services, verified community charities, hospitals, schools, faith/community support organisations or emergency authorities in your area.\n\nYou are welcome to explore WHSF e-learning, technology programmes, digital literacy opportunities and public learning resources through our official website.\n\n---\n\n`
    : '';
  const body = encodeURIComponent(
    `${fraudAutoReply}${financialAidAutoReply}Name: ${name}\nEmail: ${data.get('email')}\nPhone / WhatsApp: ${phone || 'Not provided'}\nInterest: ${interest}\n\nMessage:\n${message}`
  );

  if (formStatus) {
    formStatus.textContent = fraudConcern
      ? 'Fraud awareness: WHSF is not offering financial promotions. Do not send money or personal information. Please report suspicious activity to the appropriate authorities. Opening your email application now.'
      : financialAidRequest
      ? 'WHSF does not provide direct financial assistance for personal bills, medical bills or school fees. WHSF supports the public through technology education, digital inclusion and learning programmes. Opening your email application now.'
      : 'Opening your email application. Please review and send the prepared message to WHSF.';
  }
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
    summary: 'Student view is ready with e-learning, certificates and learning support.',
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
    description: 'Ask learning questions and receive guidance for WHSF e-learning.',
    messages: [
      { sender: 'Student support', text: 'Students can ask course questions and receive direction to e-learning resources.', time: '09:15' }
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
    status: profile?.status || 'active',
    isAdmin: role === 'admin',
    signedInAt: new Date().toISOString()
  };
}

async function stopBlockedMobileUser() {
  currentMobileProfile = null;
  try {
    sessionStorage.removeItem(mobileSessionKey);
  } catch {
    // Browser storage may be unavailable; signing out still protects the visible session.
  }
  if (whsfMobileSupabase) await whsfMobileSupabase.auth.signOut();
  if (mobileDashboard) {
    mobileDashboard.hidden = true;
    mobileDashboard.classList.remove('is-active');
  }
  if (mobileLoginCard) mobileLoginCard.hidden = false;
  setMobileLoginStatus('This WHSF app account is currently blocked. Please contact WHSF support if you believe this is a mistake.');
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
    if (currentMobileProfile.status === 'blocked') {
      await stopBlockedMobileUser();
      return;
    }

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
  if (currentMobileProfile.status === 'blocked') {
    await stopBlockedMobileUser();
    return;
  }

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

const whsfAssistantAnswers = [
  {
    keys: ['certificate', 'verify certificate', 'certificate verification', 'certificate number', 'pdf certificate'],
    title: 'Certificate verification',
    answer: 'You can verify a WHSF e-learning certificate by entering the certificate number on the verification page. If a certificate is valid, the portal shows the learner, course, issue date and download link when available.',
    link: 'verify-certificate.html',
    linkText: 'Open certificate verification'
  },
  {
    keys: ['employee', 'staff', 'staff verification', 'employee verification', 'identity', 'phone number'],
    title: 'Employee / Staff verification',
    answer: 'Use Employee / Staff verification to confirm WHSF staff identity. First name, last name and phone number with country code are required. The portal checks the submitted details against WHSF records and shows whether the person is verified.',
    link: 'verify-certificate.html#staff-verification',
    linkText: 'Open staff verification'
  },
  {
    keys: ['privacy', 'privacy policy', 'data', 'cookies', 'cookie', 'personal information', 'data processing'],
    title: 'Privacy Policy',
    answer: 'WHSF has a Privacy Policy explaining how the website, e-learning, mobile app, donations, certificate verification, staff verification and contact services handle information. You can also manage cookie preferences from Privacy settings in the footer.',
    link: 'privacy-policy.html',
    linkText: 'Read Privacy Policy'
  },
  {
    keys: ['safeguarding', 'child protection', 'child safety', 'abuse', 'report concern', 'protection policy'],
    title: 'Child Safeguarding Policy',
    answer: 'WHSF has a Child Safeguarding Policy for children, girls, students, young women, vulnerable people, staff, volunteers and partners. If someone is in immediate danger, contact local emergency services first, then notify WHSF.',
    link: 'child-safeguarding-policy.html',
    linkText: 'Read Safeguarding Policy'
  },
  {
    keys: ['conference', 'opportunity', 'calendar', 'events', 'ecosoc events', 'un events', 'women in tech events', 'grant', 'travel support', 'speaking opportunity'],
    title: 'Conference & Opportunity Automation Hub',
    answer: 'WHSF’s Global Tech & UN Opportunity Calendar tracks relevant UN/ECOSOC events, technology conferences, AI and digital inclusion events, youth and women-in-tech opportunities, deadlines, speaking calls and grant or travel-support opportunities.',
    link: 'opportunities.html',
    linkText: 'Open Opportunity Calendar'
  },
  {
    keys: ['innovation building', 'support building', 'fundraising dashboard', 'devices donated', 'corporate partners', 'construction milestones', 'building project'],
    title: 'Innovation Support Building',
    answer: 'The WHSF Innovation Support Building page presents a project-support dashboard concept with total project cost, funds raised, devices donated, construction milestones, corporate partners and beneficiaries.',
    link: 'innovation-support-building.html',
    linkText: 'Open Innovation Support Building'
  },
  {
    keys: ['student projects', 'students building', 'smart waste', 'recycling', 'iot', 'smart village', 'digital health', 'disaster management', 'ai education'],
    title: 'Student Innovation Projects',
    answer: 'WHSF Student Innovation Projects include smart waste and recycling technology, IoT innovation, AI for education, digital health, disaster management and smart village technology. Students can build apps, sensors, AI tools, monitoring systems and humanitarian coordination solutions.',
    link: 'student-projects.html',
    linkText: 'Open Student Projects'
  },
  {
    keys: ['e-classroom', 'classroom', 'course', 'student', 'lesson', 'assignment', 'certificate course', 'learning'],
    title: 'WHSF e-learning',
    answer: 'The WHSF e-learning supports training in robotics, cybersecurity, drone technology, AI, data center management, project management, eHealth, STEM, accessibility technology, AI for Agriculture, AI for Healthcare, Girls in AI Africa, AI Rapid Response and AI Media & Information Communication. Learners can view lessons, submit assignments, track progress and receive certificates.',
    link: 'e-classroom.html',
    linkText: 'Open e-learning'
  },
  {
    keys: ['admin', 'teacher', 'teacher dashboard', 'course management', 'students'],
    title: 'Teacher/Admin dashboard',
    answer: 'Authorized WHSF staff can manage courses, students, lessons, assignments and certificates through the e-learning admin dashboard. Admin or teacher access must be approved by WHSF.',
    link: 'e-classroom-admin.html',
    linkText: 'Open admin dashboard'
  },
  {
    keys: ['fraud', 'scam', 'fake', 'fake whatsapp', 'whatsapp scam', 'fake facebook', 'facebook page', 'fake employee', 'fake number', 'financial promotion', 'promotion', 'impersonation', 'investment scam'],
    title: 'Fraud awareness',
    answer: 'Scammers have misused the WHSF name, logo and images to create fraudulent Facebook pages and WhatsApp groups. WHSF is not offering financial promotions, investment payments, WhatsApp cash grants, Facebook promotions or unofficial aid through personal numbers. If someone is using a WhatsApp number, fake Facebook page, fake employee name or fake number to request money or promise benefits, it does not come from WHSF. Do not send money or personal information. Report suspicious activity to your local authorities and to the platform involved.',
    link: 'contact.html',
    linkText: 'Report suspicious activity'
  },
  {
    keys: ['donate', 'donation', 'paypal', 'support', 'sponsor', 'give'],
    title: 'Donations and sponsorship',
    answer: 'WHSF accepts donations through the official PayPal charity link. Donors can also contact WHSF about sponsorship, programme support, devices, connectivity and learner support.',
    link: 'https://paypal.com/us/fundraiser/charity/1450337',
    linkText: 'Donate through PayPal'
  },
  {
    keys: ['partner', 'partnership', 'sponsor', 'collaboration', 'university', 'company', 'donor'],
    title: 'Partnerships',
    answer: 'WHSF works with partners, donors, schools, universities, companies and volunteers to expand technology education, digital inclusion, mentorship, devices, career pathways and community impact.',
    link: 'contact.html',
    linkText: 'Contact WHSF'
  },
  {
    keys: ['program', 'programme', 'programs', 'girls in ict', 'techwomen', 'robotics', 'drone', 'stem', 'cybersecurity', 'ai'],
    title: 'Technology programmes',
    answer: 'WHSF programmes include Girls in ICT Club, TechWomen, robotics, drone technology, AI and digital skills, cybersecurity, STEM, climate-smart technology and practical pathways for girls and young women.',
    link: 'programs.html',
    linkText: 'Explore programmes'
  },
  {
    keys: ['mobile app', 'app', 'volunteer hub', 'donor hub', 'member dashboard', 'chat', 'community'],
    title: 'WHSF Mobile App',
    answer: 'The WHSF Mobile App portal helps donors, volunteers, partners, students and members stay connected with impact updates, collaboration chat, volunteer tasks, donor information, member dashboards and announcements.',
    link: 'mobile-app.html',
    linkText: 'View mobile app under Innovation'
  },
  {
    keys: ['impact', 'metrics', 'report', 'dashboard', 'sdg', 'data', 'statistics'],
    title: 'Impact dashboard',
    answer: 'The WHSF impact dashboard presents public metrics including girls impacted, young women empowered, course pathways, certificates, programme performance and reporting indicators for partners and donors.',
    link: 'impact-dashboard.html',
    linkText: 'View impact dashboard'
  },
  {
    keys: ['contact', 'help', 'support', 'email', 'phone', 'whatsapp', 'issue'],
    title: 'Contact and support',
    answer: 'For direct help, use the Contact & Support page. You can request programme support, e-learning help, certificate assistance, partnership information, donation guidance or safeguarding support.',
    link: 'contact.html',
    linkText: 'Open Contact & Support'
  },
  {
    keys: ['volunteer', 'mentor', 'teach', 'remote teacher', 'livestream'],
    title: 'Volunteers and mentors',
    answer: 'Volunteers and mentors can support WHSF through teaching, mentorship, technology training, career guidance, device support, content support, events and community outreach.',
    link: 'contact.html',
    linkText: 'Volunteer or mentor'
  },
  {
    keys: ['accessibility', 'disabled', 'disability', 'voice', 'screen reader', 'inclusive'],
    title: 'Accessibility and inclusion',
    answer: 'WHSF supports disability inclusion and accessible technology through inclusive learning design, voice-enabled support ideas, assistive technology awareness, digital inclusion and accessible website controls such as larger text and high contrast.',
    link: 'programs.html',
    linkText: 'View inclusion programmes'
  }
];

function normalizeAssistantText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+#\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getAssistantAnswer(question) {
  const normalized = normalizeAssistantText(question);
  if (!normalized) {
    return {
      title: 'How can I help?',
      answer: 'Ask about certificates, staff verification, e-learning, programmes, donations, partnerships, mobile app, volunteering or WHSF impact.',
      link: 'contact.html',
      linkText: 'Contact WHSF'
    };
  }

  const scored = whsfAssistantAnswers
    .map((item) => ({
      item,
      score: item.keys.reduce((total, key) => normalized.includes(normalizeAssistantText(key)) ? total + key.length : total, 0)
    }))
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].item;

  return {
    title: 'WHSF support',
    answer: 'I can help with WHSF public information including programmes, e-learning, certificate verification, employee/staff verification, partnerships, donations, volunteering, mobile app support and impact reporting. For a personal case, please contact WHSF directly.',
    link: 'contact.html',
    linkText: 'Chat with WHSF support'
  };
}

function addAssistantMessage(container, content, type = 'bot') {
  const message = document.createElement('div');
  message.className = `whsf-chat-message ${type}`;
  if (typeof content === 'string') {
    message.textContent = content;
  } else {
    message.append(content);
  }
  container.append(message);
  container.scrollTop = container.scrollHeight;
}

function createAssistantResponse(answer) {
  const wrapper = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = answer.title;
  const text = document.createElement('p');
  text.textContent = answer.answer;
  const link = document.createElement('a');
  link.href = answer.link;
  link.textContent = answer.linkText;
  if (answer.link.startsWith('http')) {
    link.target = '_blank';
    link.rel = 'noreferrer';
  }
  wrapper.append(title, text, link);
  return wrapper;
}

function initWhsfAssistant() {
  if (document.querySelector('.whsf-chatbot')) return;

  const chatbot = document.createElement('aside');
  chatbot.className = 'whsf-chatbot';
  chatbot.setAttribute('aria-label', 'WHSF public help assistant');
  chatbot.innerHTML = `
    <button class="whsf-chatbot-toggle" type="button" aria-expanded="false">
      <span aria-hidden="true">💬</span><span>Chat Us</span>
    </button>
    <section class="whsf-chatbot-panel" hidden>
      <div class="whsf-chatbot-head">
        <div><strong>WHSF Assistant</strong><span>Public answers for visitors</span></div>
        <button class="whsf-chatbot-close" type="button" aria-label="Close WHSF Assistant">×</button>
      </div>
      <div class="whsf-chatbot-messages" aria-live="polite"></div>
      <div class="whsf-chat-quick" aria-label="Quick questions">
        <button type="button" data-question="How do I verify a certificate?">Certificate</button>
        <button type="button" data-question="How do I verify WHSF staff?">Staff</button>
        <button type="button" data-question="How do I join e-learning?">e-learning</button>
        <button type="button" data-question="How can I partner with WHSF?">Partner</button>
        <button type="button" data-question="How can I donate?">Donate</button>
      </div>
      <form class="whsf-chat-form">
        <input type="text" name="question" placeholder="Ask about WHSF..." autocomplete="off" />
        <button type="submit">Send</button>
      </form>
      <p class="whsf-chat-note">This assistant gives public website guidance. For private records, payments, safeguarding or urgent issues, contact WHSF directly.</p>
    </section>
  `;

  document.body.append(chatbot);

  const toggle = chatbot.querySelector('.whsf-chatbot-toggle');
  const panel = chatbot.querySelector('.whsf-chatbot-panel');
  const close = chatbot.querySelector('.whsf-chatbot-close');
  const messages = chatbot.querySelector('.whsf-chatbot-messages');
  const form = chatbot.querySelector('.whsf-chat-form');
  const input = chatbot.querySelector('input[name="question"]');

  const openAssistant = () => {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (!messages.dataset.ready) {
      addAssistantMessage(messages, createAssistantResponse(getAssistantAnswer('')));
      messages.dataset.ready = 'true';
    }
    window.setTimeout(() => input.focus(), 100);
  };

  const closeAssistant = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  };

  const ask = (question) => {
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion) return;
    addAssistantMessage(messages, cleanQuestion, 'user');
    addAssistantMessage(messages, createAssistantResponse(getAssistantAnswer(cleanQuestion)));
    input.value = '';
  };

  toggle.addEventListener('click', () => {
    if (panel.hidden) openAssistant();
    else closeAssistant();
  });

  close.addEventListener('click', closeAssistant);

  chatbot.querySelectorAll('[data-question]').forEach((button) => {
    button.addEventListener('click', () => {
      openAssistant();
      ask(button.dataset.question);
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });
}

initWhsfAssistant();

function initAiAssistantActions() {
  const response = document.querySelector('#ai-action-response');
  const buttons = document.querySelectorAll('[data-ai-action]');
  if (!response || !buttons.length) return;

  const aiTimestamp = () => new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const markdownToSafeHtml = (value) => escapeHtml(value || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');

  const renderAiResponse = (action, options = {}) => {
    const {
      live = false,
      loading = false,
      error = '',
      answer = ''
    } = options;

    const statusLabel = loading ? 'Searching trusted sources' : (live ? 'Live AI search result' : 'Live AI guidance preview');
    const statusText = error || action.status;
    const trustedText = answer ? 'Live AI search completed using current web information and trusted-source guidance.' : action.update;
    const nextText = answer ? 'Review the links and official sources before applying, sharing, donating or acting on any information.' : action.next;

    response.innerHTML = `
      <div class="ai-response-topline">
        <span>${statusLabel}</span>
        <time>${aiTimestamp()}</time>
      </div>
      <strong>${action.title}</strong>
      ${loading ? '<p class="ai-loading-note">Searching live opportunity and information sources now…</p>' : ''}
      ${answer ? `<div class="ai-live-answer"><p>${markdownToSafeHtml(answer)}</p></div>` : `<p>${action.message}</p>`}
      <div class="ai-response-detail">
        <article><b>Status update</b><span>${escapeHtml(statusText)}</span></article>
        <article><b>Trusted-source direction</b><span>${escapeHtml(trustedText)}</span></article>
        <article><b>Recommended next step</b><span>${escapeHtml(nextText)}</span></article>
      </div>
      <div class="ai-response-tags" aria-label="Relevant AI assistant tags">
        ${action.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}
      </div>
    `;
  };

  const actions = {
    grant: {
      title: 'AI Grant & Scholarship Finder',
      status: 'Opportunity scan prepared',
      message: 'I would search trusted scholarship, grant, fellowship, internship, STEM competition and study-abroad sources, then filter results for girls, young women, ICT Girls Club, TechWomen and WHSF learners.',
      update: 'Recommended checks: official university pages, government scholarship portals, UN/UNESCO education opportunities, STEM competition organizers, fellowship pages and verified foundation websites.',
      next: 'Use only official application links, check deadlines, confirm eligibility and avoid any opportunity asking for unofficial WhatsApp payments.',
      chips: ['Scholarships', 'Grants', 'Fellowships', 'Internships', 'STEM competitions']
    },
    tech: {
      title: 'AI Tech Opportunity Monitor',
      status: 'Tech opportunity monitor ready',
      message: 'I would track hackathons, technology conferences, women-in-tech programmes, AI training, cloud events, cybersecurity bootcamps and digital inclusion opportunities.',
      update: 'Relevant sources include IEEE events, Women in Tech Global, ITU AI for Good, Devpost, Eventbrite, Microsoft, Google, AWS, Cisco and verified nonprofit technology event pages.',
      next: 'Prioritize free or virtual events, youth/women-focused programmes, speaking opportunities and opportunities with travel or grant support.',
      chips: ['Hackathons', 'AI training', 'Cybersecurity', 'Cloud events', 'Digital inclusion']
    },
    agriculture: {
      title: 'AI Agriculture Knowledge Assistant',
      status: 'Agriculture guide generated',
      message: 'I would provide plain-language climate-smart agriculture guidance using verified agriculture, weather-awareness, farm-safety and crop-information resources.',
      update: 'Useful checks include local agriculture extension services, FAO resources, climate-smart agriculture guidance, verified weather agencies and university agriculture publications.',
      next: 'For farm decisions, confirm local soil, weather and crop conditions with a qualified local agriculture expert before acting.',
      chips: ['Crop guidance', 'Farm safety', 'Weather awareness', 'Climate-smart agriculture', 'Rural learning']
    },
    health: {
      title: 'AI Health Information Verifier',
      status: 'Health information safety check',
      message: 'I would help explain health information safely by pointing to trusted public-health sources and separating general awareness from medical decision-making.',
      update: 'Trusted references should include ministries of health, WHO, UNICEF, CDC-style public-health guidance, licensed hospitals and qualified medical professionals.',
      next: 'This tool does not diagnose or prescribe. For symptoms, treatment, pregnancy, child health or emergencies, consult a qualified health professional immediately.',
      chips: ['Public health', 'Prevention', 'Child health', 'Nutrition awareness', 'Medical referral']
    },
    scam: {
      title: 'AI Scam Detection Center',
      status: 'Suspicious message review ready',
      message: 'I would check suspicious scholarships, fake certificates, phishing links, false job offers, crypto scams, donation fraud, fake WHSF pages and manipulated media for warning signs.',
      update: 'Red flags include payment requests, pressure to act fast, unofficial WhatsApp-only communication, mismatched domains, copied logos, fake staff names and requests for banking or identity details.',
      next: 'Do not pay or share personal information. Verify through official WHSF website links and report suspected fraud to the platform and appropriate local authorities.',
      chips: ['Scholarship scams', 'Fake jobs', 'Phishing', 'Donation fraud', 'Impersonation']
    },
    news: {
      title: 'AI Tech News Curator',
      status: 'Technology update digest ready',
      message: 'I would summarize useful technology news in AI, robotics, drones, cybersecurity, cloud, data centers and digital inclusion for WHSF learners and staff.',
      update: 'The digest should focus on learning value: what changed, why it matters, beginner-friendly explanation and how WHSF learners can apply it.',
      next: 'Use this for weekly learning updates, e-learning discussion prompts, programme content and mentor briefing notes.',
      chips: ['AI news', 'Robotics', 'Drones', 'Cybersecurity', 'Cloud']
    },
    whatsapp: {
      title: 'WhatsApp Information Assistant',
      status: 'WhatsApp support flow prepared',
      message: 'I would guide users through short mobile-friendly answers such as “Is this scholarship real?”, “Where can I learn cybersecurity?” or “How do I report a suspicious message?”',
      update: 'The safest first version can use approved WHSF answers, fraud warnings, certificate/staff verification links, e-learning links and simple escalation guidance.',
      next: 'When connected later, WhatsApp Business or an approved messaging provider can deliver these answers without exposing private personal numbers.',
      chips: ['Mobile support', 'Low bandwidth', 'Verified answers', 'Fraud warning', 'Learning guidance']
    },
    translation: {
      title: 'Multilingual AI Translation',
      status: 'Community translation guidance ready',
      message: 'I would simplify WHSF programme, safety and learning messages into accessible English and prepare translation support for Yoruba, Hausa, Igbo and Pidgin English.',
      update: 'Best use cases include parent messages, rural outreach, learner instructions, safety notices, opportunity summaries and digital-literacy guidance.',
      next: 'Important health, legal, safeguarding or official notices should still be reviewed by a fluent human speaker before publication.',
      chips: ['Yoruba', 'Hausa', 'Igbo', 'Pidgin English', 'Plain language']
    }
  };

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = actions[button.dataset.aiAction];
      if (!action) return;
      renderAiResponse(action, { loading: true });
      response.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      try {
        const apiResponse = await fetch('/api/ai-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: button.dataset.aiAction })
        });
        const data = await apiResponse.json().catch(() => ({}));

        if (!apiResponse.ok) {
          renderAiResponse(action, {
          error: data.error || 'Live AI search is not available right now. Showing WHSF guidance preview instead.'
          });
          return;
        }

        renderAiResponse(action, {
          live: true,
          answer: data.answer || ''
        });
      } catch {
        renderAiResponse(action, {
          error: 'Live AI search could not connect right now. Showing WHSF guidance preview instead.'
        });
      }
    });
  });
}

initAiAssistantActions();

function initWhsfPolicyLinks() {
  const footerBottom = document.querySelector('.footer-bottom');
  if (!footerBottom || footerBottom.querySelector('.footer-policy-links')) return;

  const policyLinks = document.createElement('nav');
  policyLinks.className = 'footer-policy-links';
  policyLinks.setAttribute('aria-label', 'Website policies');
  policyLinks.innerHTML = `
    <a href="privacy-policy.html">Privacy Policy</a>
    <a href="child-safeguarding-policy.html">Child Safeguarding Policy</a>
    <a href="opportunities.html">Opportunity Calendar</a>
    <a href="innovation-support-building.html">Innovation Building</a>
    <a href="student-projects.html">Student Projects</a>
  `;

  const backToTop = footerBottom.querySelector('a[href="#top"]');
  if (backToTop) footerBottom.insertBefore(policyLinks, backToTop);
  else footerBottom.append(policyLinks);
}

initWhsfPolicyLinks();

function initOpportunityHub() {
  const filters = document.querySelectorAll('[data-opportunity-filter]');
  const cards = document.querySelectorAll('[data-opportunity-tags]');
  if (!filters.length || !cards.length) return;

  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      const value = filter.dataset.opportunityFilter;
      filters.forEach((button) => button.classList.toggle('active', button === filter));
      cards.forEach((card) => {
        const tags = String(card.dataset.opportunityTags || '').split(/\s+/);
        card.hidden = value !== 'all' && !tags.includes(value);
      });
    });
  });
}

initOpportunityHub();

const WHSF_CONSENT_KEY = 'whsf_cookie_consent_v1';

function initWhsfCookieConsent() {
  if (document.querySelector('.whsf-consent-banner')) return;

  const defaultConsent = {
    necessary: true,
    analytics: false,
    external: false,
    social: false,
    updatedAt: ''
  };

  const readConsent = () => {
    try {
      return { ...defaultConsent, ...JSON.parse(localStorage.getItem(WHSF_CONSENT_KEY) || '{}') };
    } catch {
      return defaultConsent;
    }
  };

  const saveConsent = (preferences) => {
    const nextConsent = { ...defaultConsent, ...preferences, updatedAt: new Date().toISOString() };
    localStorage.setItem(WHSF_CONSENT_KEY, JSON.stringify(nextConsent));
    document.documentElement.dataset.whsfConsent = 'saved';
    return nextConsent;
  };

  const footerBottom = document.querySelector('.footer-bottom');
  if (footerBottom && !footerBottom.querySelector('[data-open-consent]')) {
    const privacyLink = document.createElement('button');
    privacyLink.type = 'button';
    privacyLink.className = 'footer-privacy-link';
    privacyLink.dataset.openConsent = 'true';
    privacyLink.textContent = 'Privacy settings';
    footerBottom.append(privacyLink);
  }

  const banner = document.createElement('section');
  banner.className = 'whsf-consent-banner';
  banner.setAttribute('aria-label', 'Cookie and data processing consent');
  banner.hidden = Boolean(localStorage.getItem(WHSF_CONSENT_KEY));
  banner.innerHTML = `
    <div class="whsf-consent-copy">
      <span>Privacy choices</span>
      <h2>Consent to Cookies & Data Processing</h2>
      <p>
        WHSF uses necessary website functions and may use similar technologies to improve access, integrate content such as videos or external services, understand website performance and support secure public services such as e-learning, certificate verification, staff verification, donations and contact forms. You can accept all, reject non-essential processing or manage your preferences. Your choice is voluntary and can be changed using “Privacy settings” at the bottom of the website.
      </p>
    </div>
    <div class="whsf-consent-actions">
      <button class="button button-small" type="button" data-consent-accept>Accept</button>
      <button class="button button-small button-secondary" type="button" data-consent-reject>Reject all</button>
      <button class="text-button" type="button" data-consent-manage>Manage preferences</button>
    </div>
  `;

  const modal = document.createElement('section');
  modal.className = 'whsf-consent-modal';
  modal.setAttribute('aria-label', 'Manage privacy preferences');
  modal.hidden = true;
  modal.innerHTML = `
    <div class="whsf-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="whsf-consent-title">
      <div class="whsf-consent-dialog-head">
        <div>
          <span>WHSF privacy settings</span>
          <h2 id="whsf-consent-title">Manage preferences</h2>
        </div>
        <button type="button" class="whsf-consent-close" aria-label="Close privacy settings" data-consent-close>×</button>
      </div>
      <form class="whsf-consent-form">
        <label>
          <input type="checkbox" checked disabled />
          <span><strong>Necessary</strong><small>Required for core website navigation, security, form display and saved privacy choice.</small></span>
        </label>
        <label>
          <input type="checkbox" name="analytics" />
          <span><strong>Analytics</strong><small>Helps WHSF understand page performance and improve public services.</small></span>
        </label>
        <label>
          <input type="checkbox" name="external" />
          <span><strong>External content</strong><small>Allows embedded content and services such as videos, maps, learning tools and donation links.</small></span>
        </label>
        <label>
          <input type="checkbox" name="social" />
          <span><strong>Social media</strong><small>Supports social media integration and public sharing features when used.</small></span>
        </label>
        <div class="whsf-consent-dialog-actions">
          <button class="button" type="submit">Save preferences</button>
          <button class="button button-secondary" type="button" data-consent-modal-reject>Reject all</button>
        </div>
      </form>
    </div>
  `;

  document.body.append(banner, modal);

  const openPreferences = () => {
    const consent = readConsent();
    modal.querySelector('[name="analytics"]').checked = Boolean(consent.analytics);
    modal.querySelector('[name="external"]').checked = Boolean(consent.external);
    modal.querySelector('[name="social"]').checked = Boolean(consent.social);
    modal.hidden = false;
  };

  const closePreferences = () => {
    modal.hidden = true;
  };

  const hideBanner = () => {
    banner.hidden = true;
  };

  banner.querySelector('[data-consent-accept]').addEventListener('click', () => {
    saveConsent({ analytics: true, external: true, social: true });
    hideBanner();
  });

  banner.querySelector('[data-consent-reject]').addEventListener('click', () => {
    saveConsent({ analytics: false, external: false, social: false });
    hideBanner();
  });

  banner.querySelector('[data-consent-manage]').addEventListener('click', openPreferences);

  modal.querySelector('[data-consent-close]').addEventListener('click', closePreferences);

  modal.querySelector('[data-consent-modal-reject]').addEventListener('click', () => {
    saveConsent({ analytics: false, external: false, social: false });
    hideBanner();
    closePreferences();
  });

  modal.querySelector('.whsf-consent-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    saveConsent({
      analytics: data.has('analytics'),
      external: data.has('external'),
      social: data.has('social')
    });
    hideBanner();
    closePreferences();
  });

  document.querySelectorAll('[data-open-consent]').forEach((button) => {
    button.addEventListener('click', openPreferences);
  });
}

initWhsfCookieConsent();

const WHSF_NEWSLETTER_SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const WHSF_NEWSLETTER_SUPABASE_ANON_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';

function initWhsfNewsletterSubscribe() {
  const footer = document.querySelector('.site-footer');
  if (!footer || footer.querySelector('[data-whsf-newsletter]')) return;

  const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (currentPage === 'index.html') return;

  const newsletter = document.createElement('div');
  newsletter.className = 'shell footer-newsletter';
  newsletter.setAttribute('data-whsf-newsletter', 'true');
  newsletter.innerHTML = `
    <div class="footer-newsletter-copy">
      <span>WHSF newsletter</span>
      <h2>Stay connected to technology, learning and opportunity updates.</h2>
      <p>Subscribe for WHSF e-learning news, STEM opportunities, AI and digital inclusion updates, safe online learning guidance and community impact stories. New subscriptions are reviewed by WHSF before communication is sent.</p>
    </div>
    <form class="footer-newsletter-form" data-whsf-newsletter-form>
      <label>
        <span>First name</span>
        <input type="text" name="first_name" autocomplete="given-name" placeholder="Your first name" />
      </label>
      <label>
        <span>Email address</span>
        <input type="email" name="email" autocomplete="email" placeholder="you@example.com" required />
      </label>
      <label>
        <span>Country</span>
        <input type="text" name="country" autocomplete="country-name" placeholder="Country" />
      </label>
      <button class="button" type="submit">Subscribe</button>
      <p class="newsletter-status" data-whsf-newsletter-status aria-live="polite"></p>
    </form>
  `;

  const socialLinks = footer.querySelector('.social-links');
  const footerBottom = footer.querySelector('.footer-bottom');
  footer.insertBefore(newsletter, socialLinks || footerBottom || null);

  const form = newsletter.querySelector('[data-whsf-newsletter-form]');
  const status = newsletter.querySelector('[data-whsf-newsletter-status]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const firstName = String(data.get('first_name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const country = String(data.get('country') || '').trim();

    if (!email) {
      status.textContent = 'Please enter your email address.';
      status.className = 'newsletter-status is-error';
      return;
    }

    status.textContent = 'Submitting your newsletter request...';
    status.className = 'newsletter-status';

    try {
      const response = await fetch(`${WHSF_NEWSLETTER_SUPABASE_URL}/rest/v1/rpc/whsf_newsletter_subscribe`, {
        method: 'POST',
        headers: {
          apikey: WHSF_NEWSLETTER_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${WHSF_NEWSLETTER_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_first_name: firstName,
          p_last_name: '',
          p_email: email,
          p_country: country,
          p_phone_number: ''
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || 'The newsletter request could not be saved yet.');
      }

      status.textContent = payload.message || 'Thank you. Your WHSF newsletter request has been received for administrator review.';
      status.className = 'newsletter-status is-success';
      form.reset();
    } catch (error) {
        status.textContent = 'Newsletter signup is temporarily unavailable. Please try again later or contact WHSF support.';
      status.className = 'newsletter-status is-error';
    }
  });
}

initWhsfNewsletterSubscribe();

function initPartnerSponsorEnquiryForm() {
  const form = document.querySelector('#partner-enquiry-form');
  const status = document.querySelector('#partner-enquiry-status');
  if (!form || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const support = data.getAll('support').join(', ') || 'Not specified';
    const organization = String(data.get('organization') || '').trim();
    const email = String(data.get('email') || '').trim();
    const country = String(data.get('country') || '').trim();
    const partnershipType = String(data.get('partnership_type') || '').trim();
    const message = String(data.get('message') || '').trim();

    if (!organization || !email || !country || !partnershipType || !message || !data.get('consent')) {
      status.textContent = 'Please complete all required fields and accept the consent statement.';
      status.className = 'form-status is-error';
      return;
    }

    const subject = `WHSF Partner/Sponsor Enquiry - ${partnershipType}`;
    const body = [
      'New WHSF Partner/Sponsor Enquiry',
      '',
      `Organization / Name: ${organization}`,
      `Email: ${email}`,
      `Country: ${country}`,
      `Partnership type: ${partnershipType}`,
      `Estimated support: ${support}`,
      '',
      'Message:',
      message,
      '',
      'Consent: The sender agreed that WHSF may use this information to respond to the partnership enquiry.'
    ].join('\n');

    const mailto = `mailto:info@worldhsfoundation.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Thank you. Your enquiry is ready to send to WHSF. Please send the prepared email from your mail app.';
    status.className = 'form-status is-success';
    window.location.href = mailto;
  });
}

initPartnerSponsorEnquiryForm();
