// Scritta sull'icona: P = posteriori, L = laterali, C = centrale, S = subwoofer
async function updateBadge() {
  const s = await chrome.storage.local.get(["enabled", "side", "center", "sub"]);
  const text = (s.enabled ? "P" : "") + (s.side ? "L" : "") + (s.center ? "C" : "") + (s.sub ? "S" : "");
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: "#1a7f37" });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);
