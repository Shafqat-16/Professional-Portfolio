const modal = document.getElementById("project-modal");
const modalTitle = document.getElementById("modal-title");
const modalTech = document.getElementById("modal-tech-stack");
const modalDesc = document.getElementById("modal-description");
const closeBtn = document.querySelector(".close-modal");

// Sticky Header
const header = document.querySelector('nav');
window.addEventListener("scroll", () => {
    header.classList.toggle("sticky", window.scrollY > 100);
});


// Active nav link via IntersectionObserver
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
            });
        }
    });
}, { rootMargin: '-30% 0px -60% 0px' });

sections.forEach(s => sectionObserver.observe(s));

// Reveal animations on scroll
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0, rootMargin: '0px 0px -60px 0px' });

function activateVisibleReveals() {
    document.querySelectorAll('.reveal:not(.active)').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add('active');
            revealObserver.unobserve(el);
        }
    });
}

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Run synchronously now (script is at bottom of body, DOM is ready)
activateVisibleReveals();
// Run again after images/fonts finish loading (layout may shift)
window.addEventListener('load', activateVisibleReveals);

// Smooth scroll for hash links
document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.getAttribute('href') && anchor.getAttribute('href').startsWith('#')) {
        const targetId = anchor.getAttribute('href').substring(1);
        const target = document.getElementById(targetId);
        if (target) {
            e.preventDefault();
            if (modal.style.display === "block") {
                modal.style.display = "none";
                document.body.style.overflow = "auto";
            }
            target.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Project Clicks
document.querySelectorAll(".view-project").forEach(btn => {
    btn.addEventListener("click", () => {
        modalTitle.innerText = btn.getAttribute("data-title");
        modalTech.innerText = `Focus: ${btn.getAttribute("data-tech")}`;
        modalDesc.innerHTML = btn.getAttribute("data-desc");
        modal.style.display = "block";
        document.body.style.overflow = "hidden";
    });
});

// Tech Insight Clicks
document.querySelectorAll(".tech-insight").forEach(item => {
    item.addEventListener("click", () => {
        modalTitle.innerText = item.getAttribute("data-title");
        modalTech.innerText = `Focus: ${item.getAttribute("data-tech")}`;
        modalDesc.innerHTML = item.getAttribute("data-desc");
        modal.style.display = "block";
        document.body.style.overflow = "hidden";
    });
});

closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
});

window.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
});
