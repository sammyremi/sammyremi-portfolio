(() => {
  // Prevent browser scroll restoration mismatch on page reload
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  const TOTAL_FRAMES = 192;
  const images = [];
  let loadedImagesCount = 0;

  const canvas = document.getElementById('scroll-canvas');
  const ctx = canvas.getContext('2d');
  const preloader = document.getElementById('preloader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderPercent = document.getElementById('loader-percent');
  const navbar = document.getElementById('navbar');

  let currentFrameIndex = 0;
  let isLoaded = false;
  let activeScrollAnim = null;

  let cachedSections = [];
  let cachedNavLinks = [];

  // Recalculate section bounds dynamically using absolute page offsets
  function refreshSectionBounds() {
    const sections = document.querySelectorAll('section[id]');
    cachedNavLinks = Array.from(document.querySelectorAll('.nav-link'));

    cachedSections = Array.from(sections).map(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      return {
        id: sec.getAttribute('id'),
        top: top,
        height: height,
      };
    });
  }

  // Format frame file path
  function getFramePath(index) {
    const frameNum = String(index + 1).padStart(4, '0');
    return `./portfolio-frames/frame_${frameNum}.webp`;
  }

  // Preload all 192 WebP images into memory
  function preloadImages() {
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);

      img.onload = () => {
        loadedImagesCount++;
        updateProgress();
      };

      img.onerror = () => {
        loadedImagesCount++;
        updateProgress();
      };

      images.push(img);
    }
  }

  // Update loading progress UI
  function updateProgress() {
    const percent = Math.floor((loadedImagesCount / TOTAL_FRAMES) * 100);
    if (loaderBar) loaderBar.style.width = `${percent}%`;
    if (loaderPercent) loaderPercent.textContent = `${percent}%`;

    if (loadedImagesCount >= TOTAL_FRAMES && !isLoaded) {
      isLoaded = true;
      setTimeout(() => {
        if (preloader) preloader.classList.add('loaded');
        refreshSectionBounds();
        renderOnScroll();
      }, 100);
    }
  }

  // Resize canvas with DPR cap for max GPU speed
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    refreshSectionBounds();
    renderOnScroll();
  }

  // Fast GPU draw
  function renderFrame(frameIdx) {
    const clampedIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(frameIdx)));
    const img = images[clampedIndex];

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = canvas.width / canvas.height;

    let drawWidth, drawHeight;

    if (canvasAspect > imgAspect) {
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgAspect;
    } else {
      drawHeight = canvas.height;
      drawWidth = canvas.height * imgAspect;
    }

    const drawX = (canvas.width - drawWidth) / 2;
    const drawY = (canvas.height - drawHeight) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }

  // Direct 1:1 scroll render engine (Zero latency, perfect sync)
  function renderOnScroll() {
    const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const winHeight = window.innerHeight || document.documentElement.clientHeight;
    const maxScroll = Math.max(1, docHeight - winHeight);

    const scrollFraction = Math.min(1, Math.max(0, scrollTop / maxScroll));
    currentFrameIndex = scrollFraction * (TOTAL_FRAMES - 1);

    // Render exact frame immediately
    renderFrame(currentFrameIndex);

    // Navbar scrolled state
    if (navbar) {
      if (scrollTop > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }

    // Active Section Highlight
    updateActiveNav(scrollTop, winHeight);
  }

  // Active section calculation using 35% trigger line
  function updateActiveNav(scrollTop, winHeight) {
    if (cachedSections.length === 0) return;

    const triggerPoint = scrollTop + (winHeight * 0.35);
    let activeId = null;

    for (let i = 0; i < cachedSections.length; i++) {
      const sec = cachedSections[i];
      if (triggerPoint >= sec.top && triggerPoint < sec.top + sec.height) {
        activeId = sec.id;
        break;
      }
    }

    if (activeId) {
      for (let j = 0; j < cachedNavLinks.length; j++) {
        const link = cachedNavLinks[j];
        if (link.getAttribute('href') === `#${activeId}`) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    }
  }

  // Synchronized Custom Smooth Scroll for Navigation Links using Absolute Coordinates
  function smoothScrollTo(targetY) {
    if (activeScrollAnim) {
      cancelAnimationFrame(activeScrollAnim);
      activeScrollAnim = null;
    }

    const startY = window.scrollY || window.pageYOffset || 0;
    const distance = targetY - startY;
    if (Math.abs(distance) < 2) return;

    const duration = 450; // 450ms clean transition
    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Easing function (easeInOutCubic)
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      window.scrollTo(0, startY + distance * ease);
      renderOnScroll();

      if (progress < 1) {
        activeScrollAnim = requestAnimationFrame(step);
      } else {
        activeScrollAnim = null;
      }
    }

    activeScrollAnim = requestAnimationFrame(step);
  }

  // Click handler for navigation links using ABSOLUTE section top positions
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const cleanId = targetId.replace('#', '');
      const secData = cachedSections.find(s => s.id === cleanId);
      const targetElem = document.querySelector(targetId);

      if (secData || targetElem) {
        const absoluteTop = secData ? secData.top : targetElem.offsetTop;
        const navOffset = 70;
        smoothScrollTo(Math.max(0, absoluteTop - navOffset));
        
        // Close mobile menu if open
        const navMenu = document.getElementById('nav-menu');
        if (navMenu && navMenu.classList.contains('open')) {
          navMenu.classList.remove('open');
        }
      }
    });
  });

  // Mobile Nav Toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }

  // Scroll Event listener - rendering on exact scroll event for 100% 0-latency sync
  window.addEventListener('scroll', renderOnScroll, { passive: true });
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('DOMContentLoaded', refreshSectionBounds);
  window.addEventListener('load', refreshSectionBounds);

  // Lusion-inspired 3D Card Interactive Animation
  function initCardTiltAnimations() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cards = document.querySelectorAll('.glass-card');
    
    cards.forEach(card => {
      let bounds;
      let mouseX = 0;
      let mouseY = 0;
      let targetRotX = 0;
      let targetRotY = 0;
      let currentRotX = 0;
      let currentRotY = 0;
      let targetScale = 1;
      let currentScale = 1;
      let rafId = null;
      let isHovering = false;
      
      const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

      const updateCard = () => {
        currentRotX = lerp(currentRotX, targetRotX, 0.1);
        currentRotY = lerp(currentRotY, targetRotY, 0.1);
        currentScale = lerp(currentScale, targetScale, 0.1);
        
        card.style.transform = `perspective(1000px) rotateX(${currentRotX}deg) rotateY(${currentRotY}deg) scale(${currentScale})`;

        if (!isHovering && Math.abs(currentRotX) < 0.01 && Math.abs(currentRotY) < 0.01 && Math.abs(currentScale - 1) < 0.001) {
          card.style.transform = ``;
          card.classList.remove('is-interactive');
          cancelAnimationFrame(rafId);
          rafId = null;
          return;
        }
        
        rafId = requestAnimationFrame(updateCard);
      };

      card.addEventListener('mouseenter', () => {
        isHovering = true;
        card.classList.add('is-interactive');
        bounds = card.getBoundingClientRect();
        targetScale = 1.02; // Subtle 2% scale
        if (!rafId) {
          rafId = requestAnimationFrame(updateCard);
        }
      });

      card.addEventListener('mousemove', (e) => {
        if (!bounds) return;
        
        // Spotlight tracking
        mouseX = e.clientX - bounds.left;
        mouseY = e.clientY - bounds.top;
        card.style.setProperty('--mouse-x', `${mouseX}px`);
        card.style.setProperty('--mouse-y', `${mouseY}px`);

        // Calculate percentages from center (-1 to 1)
        const xPct = (mouseX / bounds.width) * 2 - 1;
        const yPct = (mouseY / bounds.height) * 2 - 1;
        
        const MAX_ROTATION = 12; // Degrees
        targetRotX = yPct * -MAX_ROTATION;
        targetRotY = xPct * MAX_ROTATION;
      });

      card.addEventListener('mouseleave', () => {
        isHovering = false;
        targetRotX = 0;
        targetRotY = 0;
        targetScale = 1;
      });
      
      window.addEventListener('scroll', () => {
        if (isHovering) bounds = card.getBoundingClientRect();
      }, { passive: true });
    });
  }

  // Scroll-triggered slide-in animations
  function initScrollReveal() {
    const cards = document.querySelectorAll('.glass-card');
    if (!cards.length) return;
    
    // Assign alternating initial hidden classes
    cards.forEach((card, index) => {
      if (index % 2 === 0) {
        card.classList.add('scroll-hidden-left');
      } else {
        card.classList.add('scroll-hidden-right');
      }
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Staggered delay based on index for a cascade effect
          const cardIndex = Array.from(cards).indexOf(entry.target);
          const delay = (cardIndex % 4) * 100; // 0, 100, 200, or 300ms delay
          
          setTimeout(() => {
            entry.target.classList.add('scroll-visible');
          }, delay);
        } else {
          // Hide it again so it animates next time it enters view
          entry.target.classList.remove('scroll-visible');
        }
      });
    }, {
      root: null,
      threshold: 0.1, // Trigger when 10% visible
      rootMargin: "0px 0px -20px 0px"
    });

    cards.forEach(card => observer.observe(card));
  }

  // Initialize
  resizeCanvas();
  preloadImages();
  initCardTiltAnimations();
  initScrollReveal();
})();

