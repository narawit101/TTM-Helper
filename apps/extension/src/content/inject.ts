const PAGE_ALERT_EVENT = "__ttm_helper_page_alert__";

(() => {
  if ((window as any).__ttmHelperAlertBridgeInstalled) return;
  (window as any).__ttmHelperAlertBridgeInstalled = true;
  const originalAlert = window.alert.bind(window);
  window.alert = function (message) {
    try {
      window.dispatchEvent(
        new CustomEvent(PAGE_ALERT_EVENT, {
          detail: String(message ?? "")
        })
      );
    } catch {}
    return originalAlert(message);
  };
})();
