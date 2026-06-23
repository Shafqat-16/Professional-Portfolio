const modal = document.getElementById("project-modal");
const modalTitle = document.getElementById("modal-title");
const modalTech = document.getElementById("modal-tech-stack"); 

const modalDesc = document.getElementById("modal-description");
const closeBtn = document.querySelector(".close-modal");

// Mobile menu toggle
const menuBtn = document.querySelector(".menu-btn");
const navLinksMenu = document.querySelector(".nav-links");
if (menuBtn && navLinksMenu) {
    menuBtn.addEventListener("click", () => {
        menuBtn.classList.toggle("open");
        navLinksMenu.classList.toggle("open");
    });
    navLinksMenu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            menuBtn.classList.remove("open");
            navLinksMenu.classList.remove("open");
        });
    });
}

// Hero signal trace — the page's one orchestrated motion moment.
// A scrolling composite waveform, evoking an oscilloscope / DSP readout.
(function signalTrace() {
    const canvas = document.getElementById("signal-canvas");
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    const accent = "#2DD4BF";
    let w = 0, h = 0, dpr = 1, t = 0, raf = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function wave(yBase, amp, freq, speed, alpha, width) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
            const k = x / w;
            // composite of two sines + slow envelope for an organic, non-repetitive trace
            const y = yBase
                + Math.sin(x * freq + t * speed) * amp * Math.sin(k * Math.PI)
                + Math.sin(x * freq * 0.5 - t * speed * 0.7) * amp * 0.35;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = accent;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function frame() {
        ctx.clearRect(0, 0, w, h);
        const cy = h * 0.62;
        wave(cy, 26, 0.012, 0.045, 0.55, 1.6);
        wave(cy, 16, 0.02, 0.03, 0.18, 1);
        t += 1;
        raf = requestAnimationFrame(frame);
    }

    resize();
    frame();
    let rt;
    window.addEventListener("resize", () => {
        clearTimeout(rt);
        rt = setTimeout(resize, 150);
    });
})();

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

// ---- Make every card clickable ----
// Cards without an explicit data-desc build their popup from their own content.
const CARD_SELECTOR = [
    ".solution-card", ".pillar", ".workflow-step", ".echo-category",
    ".industry-card", ".skill-category", ".edu-card", ".timeline-content",
    ".contact-info-card", ".stat-item", ".cert-list li"
].join(", ");

function openModal() {
    modal.style.display = "block";
    document.body.style.overflow = "hidden";
}

function cardModal(card) {
    // Stat tiles: number + label
    if (card.classList.contains("stat-item")) {
        const num = card.querySelector("h3")?.innerText || "";
        const label = card.querySelector("p")?.innerText || "Metric";
        modalTitle.innerText = label;
        modalTech.innerText = `Metric: ${num}`;
        modalDesc.innerHTML = `<div class="spec-overview"><p><strong>${num}</strong> — ${label}.</p></div>`;
        openModal();
        return;
    }

    const heading = card.querySelector("h3, h4");
    const title = (heading ? heading.innerText : card.innerText.trim().split("\n")[0]) || "Details";
    const subtitle = card.querySelector("h4");
    const tags = [...card.querySelectorAll(".echo-tags span, .project-tags span, .featured-tech-row span")]
        .map(s => s.innerText.trim());
    const paras = [...card.querySelectorAll("p")].map(p => p.innerHTML);
    const lis = [...card.querySelectorAll("ul li")].map(li => li.innerHTML);
    const date = card.querySelector(".edu-info span")?.innerText;

    modalTitle.innerText = title;
    if (tags.length) modalTech.innerText = `Focus: ${tags.join("  ·  ")}`;
    else if (subtitle && subtitle.innerText.trim() !== title.trim()) modalTech.innerText = subtitle.innerText;
    else if (date) modalTech.innerText = date;
    else modalTech.innerText = "Overview";

    let html = "";
    if (paras.length) {
        html += '<div class="spec-overview">';
        paras.forEach(p => html += `<p>${p}</p>`);
        html += "</div>";
    } else if (lis.length) {
        html += `<div class="spec-overview"><p>Core competencies and tools under <strong>${title}</strong>.</p></div>`;
    } else {
        html += `<div class="spec-overview"><p>${title}</p></div>`;
    }
    if (lis.length) {
        html += '<div class="spec-section"><h4>Key Points</h4><ul>';
        lis.forEach(li => html += `<li>${li}</li>`);
        html += "</ul></div>";
    }
    modalDesc.innerHTML = html;
    openModal();
}

document.addEventListener("click", (e) => {
    // Let links, buttons, and the already-wired cards handle their own clicks
    if (e.target.closest("a, button, .tech-insight, .view-project, .modal-content, .menu-btn")) return;

    // Project cards reuse their rich technical breakdown
    const proj = e.target.closest(".project-card");
    if (proj) {
        proj.querySelector(".view-project")?.click();
        return;
    }

    const card = e.target.closest(CARD_SELECTOR);
    if (card) cardModal(card);
});

closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
});

// Close modal on Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "block") {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
});

window.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
});
