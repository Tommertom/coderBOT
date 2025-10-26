// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// Tab switching for Docker configuration
document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", function () {
    const targetTab = this.getAttribute("data-tab");

    // Remove active class from all buttons and contents
    document
      .querySelectorAll(".tab-button")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((content) => content.classList.remove("active"));

    // Add active class to clicked button and corresponding content
    this.classList.add("active");
    document.getElementById(targetTab).classList.add("active");
  });
});

// Add scroll animation to sections
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

// Observe all sections
document.querySelectorAll("section").forEach((section) => {
  section.style.opacity = "0";
  section.style.transform = "translateY(20px)";
  section.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  observer.observe(section);
});

// Add bounce animation to CTA buttons on hover
document.querySelectorAll(".cta-button").forEach((button) => {
  button.addEventListener("mouseenter", function () {
    this.style.animation = "bounce 0.5s ease";
  });

  button.addEventListener("animationend", function () {
    this.style.animation = "";
  });
});

// Add CSS for bounce animation dynamically
const style = document.createElement("style");
style.textContent = `
    @keyframes bounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-5px) scale(1.05); }
    }
`;
document.head.appendChild(style);

// Track email clicks
document
  .querySelectorAll('a[href^="mailto:hello@shippi.art"]')
  .forEach((link) => {
    link.addEventListener("click", () => {
      console.log("Waitlist email clicked");
      // You could add analytics tracking here
    });
  });

// Add parallax effect to hero section
let lastScrollY = window.scrollY;

window.addEventListener(
  "scroll",
  () => {
    const hero = document.querySelector(".hero");
    const scrollY = window.scrollY;

    if (scrollY < window.innerHeight) {
      hero.style.transform = `translateY(${scrollY * 0.5}px)`;
      hero.style.opacity = 1 - (scrollY / window.innerHeight) * 0.5;
    }

    lastScrollY = scrollY;
  },
  { passive: true }
);

// Add pulse effect to important highlights
setInterval(() => {
  const highlights = document.querySelectorAll(".highlight");
  highlights.forEach((highlight) => {
    highlight.style.transition = "transform 0.3s ease";
    highlight.style.transform = "scale(1.05)";
    setTimeout(() => {
      highlight.style.transform = "scale(1)";
    }, 300);
  });
}, 3000);

console.log("shippi.art - Ship code with good vibes! 🚀");
