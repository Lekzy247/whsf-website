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
  if (matchingOption) interestSelect.value = matchingOption.value || matchingOption.textContent;
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

const form = document.querySelector('#contact-form');
const formStatus = document.querySelector('#form-status');

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const name = `${data.get('firstName')} ${data.get('lastName')}`.trim();
  const subject = encodeURIComponent(`WHSF enquiry: ${data.get('interest')}`);
  const body = encodeURIComponent(
    `Name: ${name}\nEmail: ${data.get('email')}\nInterest: ${data.get('interest')}\n\n${data.get('message')}`
  );

  if (formStatus) formStatus.textContent = 'Opening your email application…';
  window.location.href = `mailto:info@worldhsfoundation.org?subject=${subject}&body=${body}`;
});

document.querySelector('#year').textContent = new Date().getFullYear();
