// Icon badge: R = rear, S = side, C = center, B = bass (subwoofer)
async function updateBadge() {
  const s = await chrome.storage.local.get(["enabled", "side", "center", "sub"]);
  const text = (s.enabled ? "R" : "") + (s.side ? "S" : "") + (s.center ? "C" : "") + (s.sub ? "B" : "");
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: "#1a7f37" });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);
