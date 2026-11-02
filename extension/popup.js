const keys = ["enabled", "side", "center", "sub"];

// Rileva quanti canali ha l'uscita audio predefinita
let ch = 2;
try {
  const ac = new AudioContext();
  ch = ac.destination.maxChannelCount;
  ac.close();
} catch (e) {}

const mode = document.getElementById("mode");
if (ch >= 8) {
  mode.textContent = "Uscita rilevata: 7.1";
} else if (ch >= 6) {
  mode.textContent = "Uscita rilevata: 5.1";
} else {
  mode.textContent = `Uscita a ${ch} canali: imposta Windows su 5.1 o 7.1`;
  mode.className = "warn";
}

chrome.storage.local.get(keys).then(s => {
  for (const k of keys) {
    const box = document.getElementById(k);
    box.checked = !!s[k];
    box.addEventListener("change", () => chrome.storage.local.set({ [k]: box.checked }));
  }
  if (ch < 8) {
    document.getElementById("side").disabled = true;
    document.getElementById("sideLabel").classList.add("off");
  }
});
