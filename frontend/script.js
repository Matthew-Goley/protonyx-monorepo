// ─────────────────────────────────────────────
//  Hero Video Rotation  (landing page)
// ─────────────────────────────────────────────
const heroVideoSources = [
  "assets/video/1vector_demo.mp4",
  "assets/video/2city.mp4",
  "assets/video/3codingdemo.mp4",
  "assets/video/4stockmarket.mp4",
  "assets/video/5codingdemo.mp4"
];

let currentHeroVideoIndex = 0;
const heroVideo = document.getElementById("heroVideo");

if (heroVideo) {
  // create a second video element stacked on top
  const nextVideo = heroVideo.cloneNode(true);
  nextVideo.removeAttribute("id");
  nextVideo.style.opacity = "0";
  nextVideo.style.transition = "opacity 0.4s ease";
  heroVideo.style.transition = "opacity 0.4s ease";
  heroVideo.parentElement.style.position = "relative";
  nextVideo.style.position = "absolute";
  nextVideo.style.inset = "0";
  nextVideo.style.width = "100%";
  nextVideo.style.height = "100%";
  nextVideo.style.objectFit = heroVideo.style.objectFit || "cover";
  heroVideo.parentElement.appendChild(nextVideo);

  let frontVideo = heroVideo;
  let backVideo = nextVideo;

  setInterval(() => {
    currentHeroVideoIndex = (currentHeroVideoIndex + 1) % heroVideoSources.length;
    backVideo.src = heroVideoSources[currentHeroVideoIndex];

    backVideo.addEventListener("canplaythrough", function onReady() {
    backVideo.removeEventListener("canplaythrough", onReady);
    backVideo.currentTime = 0;
    backVideo.play();
    backVideo.style.opacity = "1";
    setTimeout(() => {
      frontVideo.src = backVideo.src;
      frontVideo.currentTime = 0;
      frontVideo.play();
      backVideo.style.opacity = "0";
    }, 450);
  }, { once: true });

    backVideo.load();
  }, 4000);
}


// ─────────────────────────────────────────────
//  Navbar Logo  (all pages)
// ─────────────────────────────────────────────
const navbarLogo = document.getElementById("navbarLogo");
const whiteLogo = "/assets/company/protonyx_full_white.png";
const blackLogo = "/assets/company/protonyx_full_black.png";

let currentLogo = null;

if (navbarLogo) {
  new Image().src = whiteLogo;
  new Image().src = blackLogo;

  const darkHeroSection = document.querySelector(".hero, .vector-hero, .products-hero");

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
//  Product Card Video Preview  (home + products pages)
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
