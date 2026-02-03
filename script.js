// Tabbed Navigation Logic
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-links a');

const switchTab = (targetId) => {
    // Remove active from all
    navLinks.forEach(l => {
        l.classList.remove('active');
        if (l.getAttribute('href') === `#${targetId}`) {
            l.classList.add('active');
        }
    });

    sections.forEach(s => {
        s.classList.remove('active-tab');
        s.style.display = 'none';
    });

    // Add active to current
    const targetSection = document.getElementById(targetId);
    if (!targetSection) return;

    targetSection.classList.add('active-tab');

    if (targetId === 'home') {
        targetSection.style.display = 'flex';
    } else {
        targetSection.style.display = 'block';
    }

    // Trigger reveal animations for the specific section content
    const reveals = targetSection.querySelectorAll('.reveal');
    reveals.forEach(r => r.classList.add('active'));

    window.scrollTo(0, 0);
};

// Global click listener for all hash links (nav + buttons)
document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.getAttribute('href') && anchor.getAttribute('href').startsWith('#')) {
        const targetId = anchor.getAttribute('href').substring(1);
        if (document.getElementById(targetId)) {
            e.preventDefault();
            switchTab(targetId);
        }
    }
});

// Sticky Header
const header = document.querySelector('nav');
window.addEventListener("scroll", () => {
    if (window.scrollY > 100) {
        header.classList.add("sticky");
    } else {
        header.classList.remove("sticky");
    }
});

// Project & Tech Insight Modal Logic
const modal = document.getElementById("project-modal");
const modalTitle = document.getElementById("modal-title");
const modalTech = document.getElementById("modal-tech-stack");
const modalDesc = document.getElementById("modal-description");
const closeBtn = document.querySelector(".close-modal");

// Handle Project Clicks
document.querySelectorAll(".view-project").forEach(btn => {
    btn.addEventListener("click", () => {
        modalTitle.innerText = btn.getAttribute("data-title");
        modalTech.innerText = `Focus: ${btn.getAttribute("data-tech")}`;
        modalDesc.innerText = btn.getAttribute("data-desc");
        modal.style.display = "block";
        document.body.style.overflow = "hidden";
    });
});

// Handle Hero Tech Insight Clicks
document.querySelectorAll(".tech-insight").forEach(item => {
    item.addEventListener("click", () => {
        // If it's an expertise card, go to contact page directly
        if (item.classList.contains('expertise-card')) {
            switchTab('contact');
            return;
        }

        modalTitle.innerText = item.getAttribute("data-title");
        modalTech.innerText = "Technical Specialization";
        modalDesc.innerText = item.getAttribute("data-desc");
        modal.style.display = "block";
        document.body.style.overflow = "hidden";
    });
});

closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
});

window.addEventListener("click", (e) => {
    if (e.target == modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
});

// Initialize first reveal on load and home tab
window.addEventListener('load', () => {
    switchTab('home');
});
