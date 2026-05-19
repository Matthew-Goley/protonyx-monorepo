// ─────────────────────────────────────────────
//  Navbar Logo  (all pages)
//
//  Swap between white/black Protonyx logo as the
//  user scrolls out of a dark hero section.
// ─────────────────────────────────────────────
const navbarLogo = document.getElementById("navbarLogo");
const whiteLogo = "/assets/company/protonyx_full_white.png";
const blackLogo = "/assets/company/protonyx_full_black.png";

let currentLogo = null;

if (navbarLogo) {
  new Image().src = whiteLogo;
  new Image().src = blackLogo;

  const darkHeroSection = document.querySelector(".landing-hero, .vector-hero, .products-hero");

  function shouldLogoBeWhite() {
    if (!darkHeroSection) return false;
    return window.scrollY < darkHeroSection.offsetHeight - 80;
  }

  function setLogo(isWhite, animate) {
    const target = isWhite ? "white" : "black";
    if (target === currentLogo) return;

    if (animate) {
      navbarLogo.style.opacity = 0;
      setTimeout(() => {
        navbarLogo.src = isWhite ? whiteLogo : blackLogo;
        currentLogo = target;
        navbarLogo.style.opacity = 1;
      }, 200);
    } else {
      navbarLogo.src = isWhite ? whiteLogo : blackLogo;
      currentLogo = target;
    }
  }

  setLogo(shouldLogoBeWhite(), false);
  window.addEventListener("scroll", () => setLogo(shouldLogoBeWhite(), true));
}


// ─────────────────────────────────────────────
//  Product Card Video Preview  (products listing page)
// ─────────────────────────────────────────────
const vectorCard = document.querySelector(".vector-card");

if (vectorCard) {
  const vectorVideo = vectorCard.querySelector(".preview-video");

  vectorCard.addEventListener("mouseenter", () => {
    vectorVideo.currentTime = 0;
    vectorVideo.play();
  });

  vectorCard.addEventListener("mouseleave", () => {
    vectorVideo.pause();
    vectorVideo.currentTime = 0;
  });
}


// ─────────────────────────────────────────────
//  Menu Overlay  (all pages)
// ─────────────────────────────────────────────
const menuButton = document.querySelector(".navbar-menu-button");
const menuOverlay = document.getElementById("menuOverlay");
const menuCloseButton = document.getElementById("menuCloseButton");
const navbar = document.querySelector(".navbar");

function openMenu() {
  menuOverlay.classList.remove("open");
  void menuOverlay.offsetWidth; // force reflow so transitions restart
  menuOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  if (navbar) navbar.style.opacity = 0;
}

function closeMenu() {
  menuOverlay.classList.remove("open");
  document.body.style.overflow = "";
  if (navbar) navbar.style.opacity = 1;
}

if (menuButton && menuOverlay && menuCloseButton) {
  menuButton.addEventListener("click", openMenu);
  menuCloseButton.addEventListener("click", closeMenu);

  menuOverlay.addEventListener("click", (e) => {
    if (e.target === menuOverlay) closeMenu();
  });
}


// ─────────────────────────────────────────────
//  Scroll fade-in  (landing page sections)
//
//  Any element with .fade-in animates to visible
//  once it enters the viewport. Guarded so pages
//  without .fade-in elements pay nothing.
// ─────────────────────────────────────────────
const fadeTargets = document.querySelectorAll(".fade-in");

if (fadeTargets.length && "IntersectionObserver" in window) {
  const fadeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          fadeObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  fadeTargets.forEach((el) => fadeObserver.observe(el));
}
