const courses = [
  {
    id: 'climate-smart-farming',
    title: 'Introduction to Climate-Smart Farming',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    level: 'Beginner',
    duration: '4 weeks',
    description: 'Learn practical approaches to soil health, water management, resilient crops and sustainable farm planning.',
    image: 'assets/home/ai-for-agriculture-web.jpg'
  },
  {
    id: 'crop-health-ai',
    title: 'AI for Crop Health and Disease Detection',
    category: 'ai',
    categoryLabel: 'AI & Digital Skills',
    level: 'Beginner',
    duration: '3 weeks',
    description: 'Understand how images, mobile tools and responsible AI can support early crop-health decisions.',
    image: 'assets/programs/girls-agriculture-climate-smart.png'
  },
  {
    id: 'digital-skills',
    title: 'Essential Digital Skills for Rural Entrepreneurs',
    category: 'ai',
    categoryLabel: 'AI & Digital Skills',
    level: 'Beginner',
    duration: '4 weeks',
    description: 'Build confidence with online communication, digital safety, productivity tools and mobile business services.',
    image: 'assets/home/stem-education-underserved-web.jpg'
  },
  {
    id: 'agribusiness-foundations',
    title: 'Agribusiness Foundations',
    category: 'business',
    categoryLabel: 'Agribusiness',
    level: 'Beginner',
    duration: '5 weeks',
    description: 'Turn agricultural ideas into viable ventures through pricing, record keeping, marketing and customer discovery.',
    image: 'assets/home/community-learning.jpg'
  },
  {
    id: 'data-for-farming',
    title: 'Using Data for Better Farm Decisions',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    level: 'Intermediate',
    duration: '3 weeks',
    description: 'Use simple farm records, weather information and performance indicators to improve planning and productivity.',
    image: 'assets/gallery/project-02.jpg'
  },
  {
    id: 'sdgs-community',
    title: 'SDGs and Community Impact',
    category: 'sdg',
    categoryLabel: 'Sustainable Development',
    level: 'Beginner',
    duration: '3 weeks',
    description: 'Connect local agriculture, inclusion and entrepreneurship projects to the Sustainable Development Goals.',
    image: 'assets/programs/ict-girls-club-certificates.jpg'
  }
];

const grid = document.getElementById('course-grid');
const empty = document.getElementById('course-empty');
const searchInput = document.getElementById('course-search');
const categorySelect = document.getElementById('course-category');
const levelSelect = document.getElementById('course-level');

function renderCourses() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  const level = levelSelect.value;

  const filtered = courses.filter((course) => {
    const matchesText = `${course.title} ${course.description} ${course.categoryLabel}`.toLowerCase().includes(query);
    const matchesCategory = category === 'all' || course.category === category;
    const matchesLevel = level === 'all' || course.level === level;
    return matchesText && matchesCategory && matchesLevel;
  });

  grid.innerHTML = filtered.map((course) => `
    <article class="course-card">
      <img src="${course.image}" alt="${course.title}" loading="lazy">
      <div class="course-body">
        <span class="course-tag">${course.categoryLabel}</span>
        <h2>${course.title}</h2>
        <p>${course.description}</p>
        <div class="course-meta"><span>${course.level}</span><span>${course.duration}</span></div>
        <div class="course-actions">
          <a class="button" href="/agrilearn-ai/login?course=${encodeURIComponent(course.id)}">Enroll</a>
          <a class="button button-secondary" href="/agrilearn-ai?course=${encodeURIComponent(course.id)}">Course overview</a>
        </div>
      </div>
    </article>
  `).join('');

  empty.hidden = filtered.length !== 0;
}

[searchInput, categorySelect, levelSelect].forEach((control) => {
  control.addEventListener('input', renderCourses);
  control.addEventListener('change', renderCourses);
});

renderCourses();
