const frameCount = 180;
const framePath = (index) => `./assets/frames/ezgif-frame-${String(index).padStart(3, "0")}.jpg`;

const canvas = document.getElementById("trafficCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const cinema = document.querySelector(".cinema");
const nav = document.querySelector(".nav");
const stories = [...document.querySelectorAll(".story")];
const huds = [...document.querySelectorAll(".hud")];
const metrics = document.querySelector(".metrics");
const routeLine = document.getElementById("routeLine");
const routeGlow = document.getElementById("routeGlow");
const routeSvg = document.getElementById("routeSvg");
const ambulanceMarker = document.getElementById("ambulanceMarker");
const signalChip = document.querySelector(".signal-chip");

const trafficStatus = document.getElementById("trafficStatus");
const etaStatus = document.getElementById("etaStatus");
const systemLabel = document.getElementById("systemLabel");
const systemStatus = document.getElementById("systemStatus");
const clearanceStatus = document.getElementById("clearanceStatus");

const images = [];
const requestedFrames = new Set();
const decodedFrames = new Set();
const frameBufferRadius = 18;
let currentFrame = 1;
let targetFrame = 1;
let displayedFrame = 0;
let scrollProgress = 0;
let routeLength = 720;
let ticking = false;
let motionEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFrame();
}

function drawCoverImage(image) {
  if (!image || !image.complete) return;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const scale = Math.max(cw / image.naturalWidth, ch / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (cw - width) / 2;
  const y = (ch - height) / 2;
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(image, x, y, width, height);
}

function drawFrame() {
  const desired = Math.round(currentFrame);
  const image = getNearestReadyFrame(desired);
  if (displayedFrame === desired && image === images[desired - 1]) return;
  displayedFrame = desired;
  drawCoverImage(image);
}

function getNearestReadyFrame(index) {
  if (images[index - 1]?.complete && decodedFrames.has(index)) return images[index - 1];
  for (let offset = 1; offset < frameCount; offset += 1) {
    const before = index - offset;
    const after = index + offset;
    if (before >= 1 && images[before - 1]?.complete && decodedFrames.has(before)) return images[before - 1];
    if (after <= frameCount && images[after - 1]?.complete && decodedFrames.has(after)) return images[after - 1];
  }
  return images.find((image, idx) => image?.complete && decodedFrames.has(idx + 1));
}

function requestFrame(index, priority = "auto") {
  if (index < 1 || index > frameCount || requestedFrames.has(index)) return;
  requestedFrames.add(index);
  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = priority;
  img.src = framePath(index);
  img.onload = async () => {
    try {
      if (img.decode) await img.decode();
    } catch {
      // The browser may already have decoded the image; keep the frame available.
    }
    decodedFrames.add(index);
    if (!displayedFrame) drawFrame();
  };
  images[index - 1] = img;
}

function requestFrameRange(center, radius, priority = "auto") {
  const start = Math.max(1, Math.round(center - radius));
  const end = Math.min(frameCount, Math.round(center + radius));
  for (let index = start; index <= end; index += 1) requestFrame(index, priority);
}

function preloadFrames() {
  requestFrameRange(1, 20, "high");
  requestFrameRange(Math.round(frameCount * 0.32), 12);
  requestFrameRange(Math.round(frameCount * 0.58), 12);
  requestFrameRange(Math.round(frameCount * 0.84), 12);

  const loadRest = () => {
    for (let index = 1; index <= frameCount; index += 1) requestFrame(index, "low");
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadRest, { timeout: 2200 });
  } else {
    window.setTimeout(loadRest, 900);
  }
}

function updateScrollState() {
  const rect = cinema.getBoundingClientRect();
  const available = cinema.offsetHeight - window.innerHeight;
  scrollProgress = clamp(-rect.top / available);
  const frameCurve = smoothstep(0, 1, scrollProgress);
  targetFrame = 1 + frameCurve * (frameCount - 1);
  requestFrameRange(targetFrame, frameBufferRadius, scrollProgress < 0.12 ? "high" : "auto");

  const focusX = lerp(50, 52, smoothstep(0.04, 0.34, scrollProgress)) + lerp(0, -1.2, smoothstep(0.64, 0.92, scrollProgress));
  const focusY = lerp(58, 52, smoothstep(0.04, 0.42, scrollProgress)) + lerp(0, -3.4, smoothstep(0.62, 0.92, scrollProgress));
  const cameraScale = lerp(1.035, 1.18, smoothstep(0.03, 0.38, scrollProgress)) - lerp(0, 0.07, smoothstep(0.78, 1, scrollProgress));
  const cameraY = `${lerp(0, -16, smoothstep(0.08, 0.44, scrollProgress)) + lerp(0, 10, smoothstep(0.82, 1, scrollProgress))}px`;
  const cameraX = `${lerp(0, -10, smoothstep(0.14, 0.54, scrollProgress)) + lerp(0, 8, smoothstep(0.76, 1, scrollProgress))}px`;
  document.documentElement.style.setProperty("--camera-scale", cameraScale.toFixed(3));
  document.documentElement.style.setProperty("--camera-x", cameraX);
  document.documentElement.style.setProperty("--camera-y", cameraY);
  document.documentElement.style.setProperty("--focus-x", `${focusX.toFixed(2)}%`);
  document.documentElement.style.setProperty("--focus-y", `${focusY.toFixed(2)}%`);
  document.documentElement.style.setProperty("--focus-opacity", lerp(0.2, 0.46, smoothstep(0.1, 0.34, scrollProgress)).toFixed(3));

  const routeReveal = smoothstep(0.48, 0.76, scrollProgress);
  const routeOpacity = smoothstep(0.34, 0.5, scrollProgress) * (1 - smoothstep(0.94, 1, scrollProgress) * 0.28);
  document.documentElement.style.setProperty("--route-opacity", routeOpacity.toFixed(3));
  document.documentElement.style.setProperty("--route-offset", (routeLength * (1 - routeReveal)).toFixed(2));
  document.documentElement.style.setProperty("--marker-opacity", (smoothstep(0.3, 0.44, scrollProgress) * (1 - smoothstep(0.84, 0.96, scrollProgress))).toFixed(3));
  document.documentElement.style.setProperty("--detection-opacity", (smoothstep(0.3, 0.42, scrollProgress) * (1 - smoothstep(0.6, 0.75, scrollProgress))).toFixed(3));
  document.documentElement.style.setProperty("--pulse-opacity", lerp(0.18, 0.48, smoothstep(0.12, 0.34, scrollProgress)).toFixed(3));
  document.documentElement.style.setProperty("--hud-opacity", smoothstep(0.08, 0.18, scrollProgress).toFixed(3));
  const metricsOpacity = smoothstep(0.7, 0.8, scrollProgress) * (1 - smoothstep(0.88, 0.96, scrollProgress));
  document.documentElement.style.setProperty("--metrics-opacity", metricsOpacity.toFixed(3));
  document.documentElement.style.setProperty("--signal-opacity", (smoothstep(0.61, 0.68, scrollProgress) * (1 - smoothstep(0.92, 1, scrollProgress))).toFixed(3));

  stories.forEach((story, index) => {
    const center = index / (stories.length - 1);
    const distance = Math.abs(scrollProgress - center);
    const opacity = 1 - smoothstep(0.055, 0.14, distance);
    const y = lerp(34, 0, opacity);
    story.style.setProperty("--story-opacity", opacity.toFixed(3));
    story.style.setProperty("--story-y", `${y.toFixed(1)}px`);
    story.classList.toggle("active", opacity > 0.35);
  });

  nav.classList.toggle("scrolled", window.scrollY > 40);
  huds.forEach((hud) => hud.classList.toggle("visible", scrollProgress > 0.08));
  metrics.classList.toggle("visible", scrollProgress > 0.72);
  signalChip.classList.toggle("active", scrollProgress > 0.61);
  signalChip.classList.toggle("clear", scrollProgress > 0.7);
  signalChip.querySelector("strong").textContent = scrollProgress > 0.7 ? "Green" : "Red";

  if (scrollProgress < 0.32) {
    trafficStatus.textContent = "Heavy Congestion";
    etaStatus.textContent = "ETA +03:42";
    systemLabel.textContent = "Ambulance Status";
    systemStatus.textContent = "Blocked";
    clearanceStatus.textContent = "Clearance Required";
  } else if (scrollProgress < 0.5) {
    trafficStatus.textContent = "Density 94%";
    etaStatus.textContent = "Route Analysis";
    systemLabel.textContent = "Ambulance Detected";
    systemStatus.textContent = "Analyzing";
    clearanceStatus.textContent = "Lane Mapping";
  } else if (scrollProgress < 0.72) {
    trafficStatus.textContent = "Route Found";
    etaStatus.textContent = "Clearance 87%";
    systemLabel.textContent = "Emergency Corridor";
    systemStatus.textContent = "Opening";
    clearanceStatus.textContent = "ETA Saved 03:18";
  } else {
    trafficStatus.textContent = "Path Clear";
    etaStatus.textContent = "Signal Priority";
    systemLabel.textContent = "Live Response";
    systemStatus.textContent = "Moving";
    clearanceStatus.textContent = "Concept Demonstration";
  }
}

function animate() {
  const easing = motionEnabled ? 0.14 : 1;
  currentFrame += (targetFrame - currentFrame) * easing;
  drawFrame();
  requestAnimationFrame(animate);
}

function requestScrollUpdate() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateScrollState();
    ticking = false;
  });
}

function initRoute() {
  if (!routeLine || !routeGlow || !routeSvg || !ambulanceMarker) return;
  routeLength = routeLine.getTotalLength();
  routeLine.style.setProperty("--route-length", routeLength);
  routeGlow.style.setProperty("--route-length", routeLength);
  routeSvg.style.setProperty("--route-length", routeLength);
  document.documentElement.style.setProperty("--route-length", routeLength);

  const markerMotion = () => {
    const offset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--route-offset")) || routeLength;
    const point = routeLine.getPointAtLength(clamp((routeLength - offset) / routeLength) * routeLength);
    ambulanceMarker.setAttribute("cx", point.x.toFixed(1));
    ambulanceMarker.setAttribute("cy", point.y.toFixed(1));
    requestAnimationFrame(markerMotion);
  };
  markerMotion();
}

function initCommandCenter() {
  const engage = document.getElementById("engageCorridor");
  const state = document.getElementById("corridorState");
  const eta = document.getElementById("routeEta");
  const readiness = document.getElementById("readinessMetric");
  const refresh = document.getElementById("refreshQueue");
  if (!engage) return;

  engage.addEventListener("click", () => {
    const active = engage.classList.toggle("active");
    engage.textContent = active ? "Release corridor" : "Engage corridor";
    state.textContent = active ? "Engaged" : "Standby";
    state.style.color = active ? "#68d3a0" : "#d6aa66";
    eta.textContent = active ? "05:24 min" : "08:42 min";
    readiness.innerHTML = active ? "96<span>%</span>" : "87<span>%</span>";
    document.querySelectorAll(".signal-pill").forEach((pill, index) => {
      if (active && index < 2) { pill.textContent = "CLEAR"; pill.className = "signal-pill green"; }
    });
  });

  refresh.addEventListener("click", () => {
    refresh.textContent = "Updated";
    window.setTimeout(() => { refresh.textContent = "Refresh"; }, 1200);
  });
}

window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
  motionEnabled = !event.matches;
});
let resizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    resizeCanvas();
    updateScrollState();
  }, 80);
});
window.addEventListener("scroll", requestScrollUpdate, { passive: true });

preloadFrames();
resizeCanvas();
initRoute();
initCommandCenter();
updateScrollState();
animate();
