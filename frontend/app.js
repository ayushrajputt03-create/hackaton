/* Live comparison module. The landing page remains unchanged; dashboard.html loads this file. */
const API_BASE = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
  ? "http://127.0.0.1:5000/api"
  : "/api";
let currentMode = "ai";

const FALLBACK_COMPARE = { fixed: { wait_time: 33.13 }, ai: { wait_time: 28.61 }, improvement_percent: 13.64 };
const FALLBACK_WAVE = { junctions: [{ offset_seconds: 0 }, { offset_seconds: 32 }, { offset_seconds: 64 }] };
const FALLBACK_SAVINGS = { fuel_saved_liters: 11.76, co2_saved_kg: 27.17 };

function modulePanel() {
  if (document.getElementById("liveModules")) return;
  const panel = document.createElement("section");
  panel.id = "liveModules";
  panel.style.cssText = "position:fixed;right:354px;bottom:18px;z-index:900;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;box-shadow:0 8px 24px #0001;font:11px Inter,system-ui;display:flex;gap:10px;align-items:center;max-width:calc(100vw - 24px);flex-wrap:wrap";
  panel.innerHTML = '<strong>AI Optimization</strong><button id="aiMode" type="button">Loading...</button><span id="comparison">Comparison loading...</span><span id="savings">Fuel / CO2 loading...</span><span id="waveState">Green wave loading...</span>';
  document.body.appendChild(panel);
  const button = document.getElementById("aiMode");
  button.style.cssText = "border:0;border-radius:999px;padding:7px 10px;background:#17191c;color:#fff;cursor:pointer;font-size:10px";
  button.onclick = async () => {
    currentMode = currentMode === "ai" ? "fixed" : "ai";
    button.disabled = true;
    try {
      await fetch(`${API_BASE}/toggle-mode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: currentMode === "ai" }) });
      await refreshModuleData();
    } catch (error) { console.error("Mode toggle failed", error); button.textContent = "Backend offline"; }
    finally { button.disabled = false; }
  };
}

function renderDemoModule() {
  const button = document.getElementById("aiMode");
  const selected = FALLBACK_COMPARE[currentMode];
  if (button) button.textContent = currentMode === "ai" ? "AI ON" : "FIXED ON";
  const comparison = document.getElementById("comparison");
  if (comparison) comparison.textContent = `${currentMode === "ai" ? "AI" : "Fixed"} wait ${selected.wait_time}s · AI ${FALLBACK_COMPARE.improvement_percent}% faster · demo data`;
  const savings = document.getElementById("savings");
  if (savings) savings.textContent = `Fuel ${FALLBACK_SAVINGS.fuel_saved_liters} L · CO2 ${FALLBACK_SAVINGS.co2_saved_kg} kg · demo data`;
  const wave = document.getElementById("waveState");
  if (wave) wave.textContent = `Green wave: 3 junctions · offsets 0s -> 32s -> 64s · demo data`;
}

async function refreshModuleData() {
  try {
    const [comparison, mode, savings, wave, traffic] = await Promise.all([
      fetch(`${API_BASE}/compare-modes`, { mode: "cors" }).then((response) => { if (!response.ok) throw new Error(`compare HTTP ${response.status}`); return response.json(); }),
      fetch(`${API_BASE}/toggle-mode`, { mode: "cors" }).then((response) => response.json()),
      fetch(`${API_BASE}/savings`, { mode: "cors" }).then((response) => response.json()),
      fetch(`${API_BASE}/green-wave`, { mode: "cors" }).then((response) => response.json()),
      fetch(`${API_BASE}/traffic-status?mode=${currentMode}`, { mode: "cors" }).then((response) => response.json())
    ]);
    currentMode = mode.enabled ? "ai" : "fixed";
    const selected = comparison[currentMode];
    document.getElementById("aiMode").textContent = currentMode === "ai" ? "AI ON" : "FIXED ON";
    document.getElementById("comparison").textContent = `${currentMode === "ai" ? "AI" : "Fixed"} wait ${selected.wait_time}s · AI ${comparison.improvement_percent}% faster`;
    document.getElementById("savings").textContent = `Fuel ${savings.fuel_saved_liters} L · CO2 ${savings.co2_saved_kg} kg`;
    document.getElementById("waveState").textContent = `Green wave: ${wave.junctions.length} junctions · offsets ${wave.junctions.map((item) => `${item.offset_seconds}s`).join(" -> ")}`;
    document.querySelectorAll(".module-card").forEach((card, index) => { const live = traffic.junctions[index]; const tag = card.querySelector(".tag"); if (live && tag) tag.textContent = `${currentMode.toUpperCase()} · wait ${live.estimated_wait_time_seconds}s`; });
    const chart = window.waitChart;
    if (chart && chart.data?.datasets?.[0]) { chart.data.datasets[0].data = [comparison.fixed.wait_time, comparison.ai.wait_time]; chart.update(); }
  } catch (error) {
    console.error("Traffic comparison refresh failed", error);
    renderDemoModule();
    document.querySelectorAll(".module-card").forEach((card) => { const tag = card.querySelector(".tag"); if (tag) tag.textContent = `${currentMode.toUpperCase()} · demo mode`; });
  }
}

modulePanel();
renderDemoModule();
refreshModuleData();
window.setInterval(refreshModuleData, 10000);
