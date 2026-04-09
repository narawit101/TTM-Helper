import { TtmPresetMessage, TtmPageState, TtmRunReport, SeatCandidate, StepMarker } from "@/types";

const ZONE_MARKER_KEY = "__ttm_helper_zone_click__";
const SEAT_MARKER_KEY = "__ttm_helper_seat_pick__";
const ZONE_INDEX_KEY = "__ttm_helper_zone_index__";
const SEAT_SKIP_KEY = "__ttm_helper_seat_skip__";
const ZONE_FALLBACK_KEY = "__ttm_helper_zone_fallback__";
const STEP_WAIT_MS = 100;
const ZONE_OVERLAY_ID = "__ttm_zone_debug_overlay__";

const STATE_PREFIX = "__ttm_v1_";

function safeSessionGet(key: string) {
  try {
    return window.localStorage.getItem(`${STATE_PREFIX}${key}`) ?? window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch { }
  try {
    window.localStorage.setItem(`${STATE_PREFIX}${key}`, value);
  } catch { }
}

function safeSessionRemove(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch { }
  try {
    window.localStorage.removeItem(`${STATE_PREFIX}${key}`);
  } catch { }
}

export function resetTtmSession() {
  try {
    const toRemoveLocal: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STATE_PREFIX)) toRemoveLocal.push(k);
    }
    for (const k of toRemoveLocal) {
      window.localStorage.removeItem(k);
    }

    const toRemoveSession: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith("__ttm_helper")) toRemoveSession.push(k);
    }
    for (const k of toRemoveSession) {
      window.sessionStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function compactText(value: string) {
  return normalizeText(value).replace(/[^a-z0-9\u0E00-\u0E7F]+/gi, "");
}

function pageText() {
  return normalizeText(document.body?.innerText ?? "");
}

function includesAny(text: string, candidates: string[]) {
  return candidates.some((candidate) => text.includes(normalizeText(candidate)));
}

function visible(node: Element | null | undefined) {
  if (!(node instanceof Element)) {
    return false;
  }

  if (node.closest(`#${ZONE_OVERLAY_ID}, [data-ttm-debug]`)) {
    return false;
  }

  const style = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function clickElement(element: Element | null | undefined) {
  if (!(element instanceof Element)) {
    return false;
  }

  if (element.tagName === "AREA") {
    return clickMapArea(element);
  }

  const target =
    element.closest("[onclick], button, a, area, [role='button'], [data-zone], [data-section]") ??
    element;

  if (target.tagName === "AREA") {
    return clickMapArea(target);
  }

  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  if (target instanceof HTMLElement || target instanceof SVGElement) {
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    }
  }

  dispatchMouseSequence(target, rect.left + rect.width / 2, rect.top + rect.height / 2);

  if ((target as any).click) {
    try { (target as any).click(); } catch { }
  } else {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  return true;
}

function clickAtCenter(element: Element | null | undefined) {
  if (!(element instanceof Element)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  const pointTarget = document.elementFromPoint(x, y) ?? element;
  return clickElement(pointTarget);
}

function getLinkedMapImage(area: Element) {
  const mapElement = area.parentElement instanceof HTMLMapElement ? area.parentElement : null;
  if (!mapElement?.name) {
    return null;
  }

  return document.querySelector<HTMLImageElement>(`img[usemap="#${mapElement.name}"]`);
}

function getAreaClientPoint(area: Element) {
  const image = getLinkedMapImage(area);
  const coords = (area.getAttribute("coords") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  if (!image || coords.length < 2) {
    return null;
  }

  const rect = image.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const naturalWidth = image.naturalWidth || rect.width;
  const naturalHeight = image.naturalHeight || rect.height;
  const scaleX = rect.width / naturalWidth;
  const scaleY = rect.height / naturalHeight;

  let centerX = coords[0] ?? 0;
  let centerY = coords[1] ?? 0;

  if (coords.length >= 4) {
    const xs = coords.filter((_, index) => index % 2 === 0);
    const ys = coords.filter((_, index) => index % 2 === 1);
    centerX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    centerY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  }

  return {
    image,
    x: rect.left + centerX * scaleX,
    y: rect.top + centerY * scaleY
  };
}

function describeArea(area: Element) {
  const coords = area.getAttribute("coords") ?? "";
  const shape = area.getAttribute("shape") ?? "";
  const point = getAreaClientPoint(area);

  return [
    `shape=${shape || "unknown"}`,
    `coords=${coords || "none"}`,
    point ? `point=${Math.round(point.x)},${Math.round(point.y)}` : "point=unresolved"
  ].join(" ");
}

function getElementCenter(element: Element) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function dispatchSeatSequence(target: Element, clientX: number, clientY: number) {
  if (target instanceof HTMLElement || target instanceof SVGElement) {
    target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window, clientX, clientY }));
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window, clientX, clientY }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window, clientX, clientY }));
  }
}

function invokeInlineAction(target: Element) {
  // บังคับไม่ให้รัน inline script ตรงๆ ซึ่งมักจะโดนระบบตรวจจับ (WAF) บล็อก
  // การปล่อยให้เบราว์เซอร์จัดการคลิกเองผ่าน native event จะปลอดภัยกว่า
  return false;
}

function dispatchMouseSequence(target: Element, clientX: number, clientY: number) {
  if (target instanceof HTMLElement || target instanceof SVGElement) {
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window, clientX, clientY }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window, clientX, clientY }));
  }
}

function clickMapArea(area: Element) {
  const point = getAreaClientPoint(area);
  let triggered = false;

  if (area instanceof HTMLAreaElement) {
    try {
      area.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
      area.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      area.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      area.click();
      triggered = true;
    } catch {
      // ignore direct area click failures
    }
  }

  if (!point) {
    return triggered;
  }

  point.image.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  const pointTarget = document.elementFromPoint(point.x, point.y) ?? point.image;
  dispatchMouseSequence(pointTarget, point.x, point.y);
  if (pointTarget instanceof HTMLElement) {
    try { pointTarget.click(); } catch { /* ignore */ }
  }
  return true;
}

function elementSearchText(node: Element) {
  const htmlNode = node instanceof HTMLElement ? node : null;

  return normalizeText(
    [
      node.textContent ?? "",
      node.getAttribute("title") ?? "",
      node.getAttribute("aria-label") ?? "",
      node.getAttribute("href") ?? "",
      node.getAttribute("onclick") ?? "",
      node.getAttribute("alt") ?? "",
      node.getAttribute("data-original-title") ?? "",
      node.getAttribute("data-title") ?? "",
      node.getAttribute("id") ?? "",
      htmlNode?.dataset?.zone ?? "",
      htmlNode?.dataset?.section ?? "",
      htmlNode?.dataset?.seat ?? "",
      htmlNode?.dataset?.row ?? "",
      htmlNode?.dataset?.place ?? "",
      node.getAttribute("class") ?? "",
      node.outerHTML.slice(0, 500)
    ].join(" ")
  );
}

type ClickableMatch = {
  target: Element;
  text: string;
  exactHit: boolean;
  area: number;
};

function scanClickableByTexts(candidates: string[], exact = false) {
  const normalized = candidates.map((candidate) => compactText(candidate)).filter(Boolean);
  const nodes = Array.from(
    document.querySelectorAll<Element>(
      [
        "button",
        "a",
        "div",
        "span",
        "area",
        "img",
        "[role='button']",
        "[onclick]",
        "[title]",
        "[aria-label]",
        "[data-zone]",
        "[data-section]",
        "svg g",
        "svg path",
        "svg rect",
        "svg circle",
        "svg ellipse",
        "svg polygon",
        "svg polyline",
        "svg text",
        "svg tspan"
      ].join(", ")
    )
  );

  return nodes
    .map((node) => {
      if (!visible(node)) {
        return null;
      }

      const text = compactText(elementSearchText(node));
      if (!text) {
        return null;
      }

      const hit = normalized.find((candidate) =>
        exact ? text === candidate : text.includes(candidate)
      );

      if (!hit) {
        return null;
      }

      const target =
        node.closest("[onclick], button, a, area, [role='button'], [data-zone], [data-section], g") ??
        node.parentElement ??
        node;
      const rect = target.getBoundingClientRect();

      return {
        target,
        text,
        exactHit: text === hit,
        area: rect.width * rect.height
      } satisfies ClickableMatch;
    })
    .filter((match): match is ClickableMatch => Boolean(match))
    .sort((left, right) => {
      if (left.exactHit !== right.exactHit) {
        return Number(right.exactHit) - Number(left.exactHit);
      }

      return left.area - right.area;
    });
}

function findClickableByTexts(candidates: string[], exact = false) {
  return scanClickableByTexts(candidates, exact)[0]?.target ?? null;
}

function findContainerByLabel(labelIncludes: string[]) {
  const labels = Array.from(document.querySelectorAll("label, span, div, td, th"));
  const match = labels.find((node) => {
    const text = normalizeText(node.textContent ?? "");
    return labelIncludes.some((label) => text.includes(normalizeText(label)));
  });

  return match?.closest("div, section, form, table, tr") ?? null;
}

function setInputValue(container: Element | null, value: string) {
  if (!container) {
    return false;
  }

  const input =
    container.querySelector<HTMLInputElement>("input") ??
    container.querySelector<HTMLTextAreaElement>("textarea");

  if (!input) {
    return false;
  }

  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setSelectValueByText(container: Element | null, value: string) {
  if (!container || !value) {
    return false;
  }

  const wanted = normalizeText(value);
  const select = container.querySelector<HTMLSelectElement>("select");

  if (select) {
    const option = Array.from(select.options).find((item) => {
      const text = normalizeText(item.textContent ?? "");
      const optionValue = normalizeText(item.value ?? "");
      return text.includes(wanted) || optionValue === wanted || optionValue.includes(wanted);
    });

    if (!option) {
      return false;
    }

    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const trigger =
    container.querySelector<HTMLElement>("[role='combobox']") ??
    container.querySelector<HTMLElement>("button");

  if (!trigger) {
    return false;
  }

  trigger.click();

  const optionCandidates = Array.from(
    document.querySelectorAll<HTMLElement>("[role='option'], li, button, div")
  );
  const match = optionCandidates.find((node) =>
    normalizeText(node.textContent ?? "").includes(wanted)
  );

  match?.click();
  return Boolean(match);
}

function fillRepeatedInputs(labelPrefix: string, values: string[]) {
  values.forEach((value, index) => {
    const container = findContainerByLabel([
      `${labelPrefix} #${index + 1}`,
      `${labelPrefix} ${index + 1}`
    ]);
    setInputValue(container, value);
  });
}

function readMarker(key: string) {
  try {
    const raw = safeSessionGet(key);
    return raw ? (JSON.parse(raw) as StepMarker) : null;
  } catch {
    return null;
  }
}

function writeMarker(storageKey: string, key: string, retries = 0, phase = "", seats: string[] = []) {
  try {
    safeSessionSet(
      storageKey,
      JSON.stringify({ key, at: Date.now(), href: window.location.href, retries, phase, seats } satisfies StepMarker)
    );
  } catch {
    // ignore storage failures
  }
}

function clearMarker(storageKey: string) {
  try {
    safeSessionRemove(storageKey);
  } catch {
    // ignore storage failures
  }
}

function recentlyMarked(storageKey: string, key: string, waitMs = STEP_WAIT_MS) {
  const marker = readMarker(storageKey);
  return Boolean(
    marker &&
    marker.key === key &&
    marker.href === window.location.href &&
    Date.now() - marker.at < waitMs
  );
}

function getMarkerRetryCount(storageKey: string, key: string) {
  const marker = readMarker(storageKey);

  if (!marker || marker.key !== key || marker.href !== window.location.href) {
    return 0;
  }

  return marker.retries ?? 0;
}

function getMarker(storageKey: string, key: string) {
  const marker = readMarker(storageKey);

  if (!marker || marker.key !== key || marker.href !== window.location.href) {
    return null;
  }

  return marker;
}

function readSkippedSeats(zone: string) {
  try {
    const raw = safeSessionGet(`${SEAT_SKIP_KEY}:${zone}`);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return parsed.map((item) => String(item).toUpperCase());
  } catch {
    return [];
  }
}

function writeSkippedSeats(zone: string, seats: string[]) {
  try {
    safeSessionSet(`${SEAT_SKIP_KEY}:${zone}`, JSON.stringify(seats));
  } catch {
    // ignore storage failures
  }
}

function addSkippedSeats(zone: string, seats: string[], logs: string[]) {
  if (!zone || !seats.length) {
    return;
  }

  const current = new Set(readSkippedSeats(zone));
  for (const seat of seats) {
    current.add(seat.toUpperCase());
  }
  const next = Array.from(current);
  writeSkippedSeats(zone, next);
  logs.push(`S5: skipped seats updated -> ${next.join(", ")}`);
}

function clearSkippedSeats(zone: string) {
  try {
    safeSessionRemove(`${SEAT_SKIP_KEY}:${zone}`);
  } catch {
    // ignore storage failures
  }
}

function normalizeZoneCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").trim().toUpperCase();
}

function parseZoneCandidates(zoneValue: string) {
  return zoneValue
    .split(/[,;/|\n]+/)
    .map((item) => normalizeZoneCode(item))
    .filter(Boolean);
}

function getActiveZoneIndex(zoneValue: string) {
  const zoneCandidates = parseZoneCandidates(zoneValue);

  if (!zoneCandidates.length) {
    return 0;
  }

  try {
    const raw = safeSessionGet(ZONE_INDEX_KEY);
    const index = Number(raw ?? "0");
    return Number.isFinite(index) && index >= 0 && index < zoneCandidates.length ? index : Math.max(0, zoneCandidates.length - 1);
  } catch {
    return 0;
  }
}

function setActiveZoneIndex(index: number) {
  try {
    safeSessionSet(ZONE_INDEX_KEY, String(Math.max(0, index)));
  } catch {
    // ignore storage failures
  }
}

function getActiveZone(zoneValue: string) {
  const zoneCandidates = parseZoneCandidates(zoneValue);
  return zoneCandidates[getActiveZoneIndex(zoneValue)] ?? zoneCandidates[0] ?? "";
}

function advanceToNextZone(zoneValue: string, logs: string[], reason: string) {
  const zoneCandidates = parseZoneCandidates(zoneValue);
  const currentIndex = getActiveZoneIndex(zoneValue);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= zoneCandidates.length) {
    logs.push(`Z0: no backup zone left after ${zoneCandidates[currentIndex] ?? "unknown"} (${reason})`);
    return null;
  }

  writeMarker(ZONE_FALLBACK_KEY, window.location.href);
  setActiveZoneIndex(nextIndex);
  clearSkippedSeats(zoneCandidates[currentIndex] ?? "");
  clearMarker(SEAT_MARKER_KEY);
  clearMarker(ZONE_MARKER_KEY);
  logs.push(
    `Z0: switching zone fallback -> ${zoneCandidates[currentIndex] ?? "unknown"} => ${zoneCandidates[nextIndex]} (${reason})`
  );
  return zoneCandidates[nextIndex];
}

type ZoneMarker = {
  label: string;
  textNode: Element;
  target: Element;
  distanceScore: number;
};

type PositionedZoneMarker = {
  label: string;
  x: number;
  y: number;
  source: string;
};

function findNearestShapeTarget(source: Element, candidates: Element[]) {
  const sourceRect = source.getBoundingClientRect();
  const sourceX = sourceRect.left + sourceRect.width / 2;
  const sourceY = sourceRect.top + sourceRect.height / 2;

  return (
    candidates
      .map((shape) => {
        const rect = shape.getBoundingClientRect();
        const shapeX = rect.left + rect.width / 2;
        const shapeY = rect.top + rect.height / 2;
        const distanceScore = Math.abs(shapeX - sourceX) + Math.abs(shapeY - sourceY);

        return {
          target: shape.closest("[onclick], a, area, g") ?? shape,
          distanceScore
        };
      })
      .sort((left, right) => left.distanceScore - right.distanceScore)[0] ?? null
  );
}

function readZonePopupText() {
  const popupTexts = [
    document.querySelector("#popup-event-zone")?.textContent ?? "",
    document.querySelector("#popup-suggestion")?.textContent ?? "",
    document.querySelector(".zone-remark")?.textContent ?? "",
    document.querySelector(".text-suggestion")?.textContent ?? ""
  ].join(" ");

  return normalizeZoneCode(popupTexts);
}

function tryRevealAreaZoneLabel(area: Element) {
  area.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
  area.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true, view: window }));
  const point = getAreaClientPoint(area);

  if (point) {
    point.image.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: point.x,
        clientY: point.y
      })
    );
  }

  return readZonePopupText();
}

function summarizeAreaHints(limit = 12) {
  return Array.from(document.querySelectorAll<Element>("map area"))
    .slice(0, limit)
    .map((area, index) => {
      const popupLabel = tryRevealAreaZoneLabel(area);
      const attrs = [
        area.getAttribute("title") ?? "",
        area.getAttribute("alt") ?? "",
        area.getAttribute("aria-label") ?? "",
        area.getAttribute("onclick") ?? "",
        area.getAttribute("href") ?? "",
        popupLabel
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return attrs ? `${index + 1}:${attrs}` : `${index + 1}:<empty>`;
    })
    .filter(Boolean);
}

function getAreaZoneHint(area: Element) {
  const popupLabel = tryRevealAreaZoneLabel(area);
  if (popupLabel) {
    return popupLabel;
  }

  const attrs = [
    area.getAttribute("title") ?? "",
    area.getAttribute("alt") ?? "",
    area.getAttribute("aria-label") ?? "",
    area.getAttribute("onclick") ?? "",
    area.getAttribute("href") ?? "",
    area.getAttribute("id") ?? ""
  ]
    .join(" ")
    .toUpperCase();

  const match = attrs.match(/[A-Z]{1,3}\d{1,2}/);
  return match?.[0] ?? "";
}

function collectOverlayZoneMarkers() {
  const markers: PositionedZoneMarker[] = [];
  const seen = new Set<string>();

  for (const marker of collectZoneMarkers()) {
    const center = getElementCenter(marker.textNode);
    const key = `${marker.label}:${Math.round(center.x)}:${Math.round(center.y)}`;

    if (!seen.has(key)) {
      seen.add(key);
      markers.push({
        label: marker.label,
        x: center.x,
        y: center.y,
        source: "svg"
      });
    }
  }

  for (const area of Array.from(document.querySelectorAll<Element>("map area"))) {
    const label = getAreaZoneHint(area);
    const point = getAreaClientPoint(area);

    if (!label || !point) {
      continue;
    }

    const key = `${label}:${Math.round(point.x)}:${Math.round(point.y)}`;
    if (!seen.has(key)) {
      seen.add(key);
      markers.push({
        label,
        x: point.x,
        y: point.y,
        source: "area"
      });
    }
  }

  return markers;
}

function clearZoneDebugOverlay() {
  document.getElementById(ZONE_OVERLAY_ID)?.remove();
}

function renderZoneDebugOverlay(activeZone?: string) {
  clearZoneDebugOverlay();

  const markers = collectOverlayZoneMarkers();
  if (!markers.length) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = ZONE_OVERLAY_ID;
  overlay.dataset.ttmDebug = "zone-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "2147483647";

  for (const marker of markers) {
    const badge = document.createElement("div");
    const isActive = activeZone && marker.label === activeZone;
    badge.textContent = marker.label;
    badge.title = `source=${marker.source}`;
    badge.dataset.ttmDebug = "zone-badge";
    badge.style.position = "fixed";
    badge.style.left = `${Math.round(marker.x - 18)}px`;
    badge.style.top = `${Math.round(marker.y - 10)}px`;
    badge.style.padding = "2px 6px";
    badge.style.borderRadius = "6px";
    badge.style.fontSize = "10px";
    badge.style.fontWeight = "700";
    badge.style.fontFamily = "ui-monospace, monospace";
    badge.style.color = isActive ? "#111827" : "#ffffff";
    badge.style.background = isActive ? "#facc15" : "#f97316";
    badge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.35)";
    badge.style.border = isActive ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.6)";
    overlay.appendChild(badge);
  }

  document.body.appendChild(overlay);
}

function collectZoneMarkers() {
  const textNodes = Array.from(document.querySelectorAll<Element>("svg text, svg tspan, text, tspan"));
  const shapeNodes = Array.from(
    document.querySelectorAll<Element>("svg path, svg polygon, svg rect, svg ellipse, svg circle")
  ).filter((node) => visible(node));

  return textNodes
    .filter((node) => visible(node))
    .map((node) => {
      const label = normalizeZoneCode(node.textContent ?? "");

      if (!label || !/[A-Z]{1,3}\d{1,2}/.test(label)) {
        return null;
      }

      const nearestShape = findNearestShapeTarget(node, shapeNodes);

      return nearestShape
        ? ({
          label,
          textNode: node,
          target: nearestShape.target,
          distanceScore: nearestShape.distanceScore
        } satisfies ZoneMarker)
        : null;
    })
    .filter((marker): marker is ZoneMarker => Boolean(marker))
    .sort((left, right) => left.distanceScore - right.distanceScore);
}

function collectExactTextZoneMarkers(zone: string) {
  const shapeNodes = Array.from(
    document.querySelectorAll<Element>(
      "svg path, svg polygon, svg rect, svg ellipse, svg circle, area, [onclick]"
    )
  ).filter((node) => visible(node));
  const allNodes = Array.from(document.querySelectorAll<Element>("div, span, a, strong, b, p, text, tspan"));
  const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textParents: Element[] = [];

  while (textWalker.nextNode()) {
    const node = textWalker.currentNode;
    const textValue = normalizeZoneCode(node.textContent ?? "");
    const parent = node.parentElement;

    if (parent && textValue === zone) {
      textParents.push(parent);
    }
  }

  const candidateNodes = [...allNodes, ...textParents];

  return candidateNodes
    .filter((node) => visible(node))
    .map((node) => {
      const label = normalizeZoneCode(node.textContent ?? "");

      if (label !== zone) {
        return null;
      }

      const nearestShape = findNearestShapeTarget(node, shapeNodes);
      const target =
        nearestShape?.target ??
        node.closest("[onclick], a, button, [role='button'], area") ??
        node;
      const distanceScore = nearestShape?.distanceScore ?? 0;

      return {
        label,
        textNode: node,
        target,
        distanceScore
      } satisfies ZoneMarker;
    })
    .filter((marker): marker is ZoneMarker => Boolean(marker))
    .sort((left, right) => left.distanceScore - right.distanceScore);
}

function findZoneTarget(zone: string, logs: string[]) {
  const normalizedZone = normalizeZoneCode(zone);
  const zoneMarkers = [...collectZoneMarkers(), ...collectExactTextZoneMarkers(normalizedZone)];
  const exactMarker = zoneMarkers.find((marker) => marker.label === normalizedZone);

  if (exactMarker) {
    logs.push(`C0: zone marker matched -> ${exactMarker.label}`);
    return exactMarker.target;
  }

  const exactClickable = scanClickableByTexts([normalizedZone], true)[0]?.target ?? null;
  if (exactClickable) {
    logs.push(`C0: clickable exact match -> ${normalizedZone}`);
    return exactClickable;
  }

  const attributeMatch = Array.from(
    document.querySelectorAll<Element>("area, a, [onclick], [title], [alt], [aria-label], [data-zone]")
  ).find((node) => {
    const haystack = [
      node.getAttribute("onclick") ?? "",
      node.getAttribute("href") ?? "",
      node.getAttribute("title") ?? "",
      node.getAttribute("alt") ?? "",
      node.getAttribute("aria-label") ?? "",
      node.getAttribute("data-zone") ?? "",
      node.getAttribute("id") ?? "",
      node.outerHTML.slice(0, 500)
    ]
      .join(" ")
      .toUpperCase();

    return haystack.includes(normalizedZone);
  });

  if (attributeMatch) {
    logs.push(`C0: attribute match -> ${normalizedZone}`);
    return attributeMatch.closest("[onclick], a, area, [role='button']") ?? attributeMatch;
  }

  const areaByPopup = Array.from(document.querySelectorAll<Element>("map area")).find((area) => {
    const hintedZone = tryRevealAreaZoneLabel(area);
    return hintedZone.includes(normalizedZone);
  });

  if (areaByPopup) {
    logs.push(`C0: popup/area match -> ${normalizedZone} (${describeArea(areaByPopup)})`);
    return areaByPopup;
  }

  logs.push(
    `C0: available zone markers -> ${zoneMarkers
      .slice(0, 20)
      .map((marker) => marker.label)
      .join(", ")}`
  );
  logs.push(`C0: map area hints -> ${summarizeAreaHints().join(" | ")}`);
  return null;
}

function getRequestedTicketCount(preset: TtmPresetMessage) {
  const raw = preset.ticketCount ?? preset.ticket;
  const count = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  return Number.isFinite(count) && count > 0 ? Math.max(1, Math.floor(count)) : 0;
}

function normalizeSeatStrategy(value?: string) {
  switch (value) {
    case "sequence-left":
      return "front-left";
    case "sequence":
      return "back-right";
    case "near":
      return "adjacent";
    case "front-left":
    case "front-right":
    case "back-left":
    case "back-right":
    case "random":
    case "adjacent":
    case "middle":
      return value;
    default:
      return "adjacent";
  }
}

function rowLabelToIndex(label: string) {
  const normalized = label.trim().toUpperCase();
  if (!normalized) {
    return Number.MAX_SAFE_INTEGER;
  }

  return normalized.split("").reduce((total, char) => {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) {
      return total;
    }

    return total * 26 + (code - 64);
  }, 0);
}

function numericMedian(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function extractSeatNumber(text: string) {
  const matches = text.match(/\b\d{1,3}\b/g);
  if (!matches?.length) {
    return null;
  }

  return Number(matches[matches.length - 1]);
}

function extractSeatRow(text: string) {
  const match = text.match(/\b([a-z]{1,2})\s*[- ]?\s*\d{1,3}\b/i);
  return match?.[1]?.toUpperCase() ?? "";
}

function collectRowMarkers() {
  return Array.from(document.querySelectorAll<Element>("svg text, text"))
    .filter((node) => visible(node))
    .map((node) => {
      const label = (node.textContent ?? "").trim().toUpperCase();
      const rect = node.getBoundingClientRect();
      return {
        label,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    })
    .filter((marker) => /^[A-Z]{1,2}$/.test(marker.label));
}

function findClosestRowMarker(
  rowMarkers: ReturnType<typeof collectRowMarkers>,
  x: number,
  y: number
) {
  return (
    rowMarkers
      .filter((marker) => marker.x <= x && Math.abs(marker.y - y) <= 28)
      .sort((left, right) => {
        const leftDistance = Math.abs(left.y - y) + Math.abs(left.x - x) / 10;
        const rightDistance = Math.abs(right.y - y) + Math.abs(right.x - x) / 10;
        return leftDistance - rightDistance;
      })[0] ?? null
  );
}

function getSeatElementPriority(node: Element) {
  const tag = node.tagName.toLowerCase();

  if (tag === "circle" || tag === "ellipse") {
    return 1;
  }

  if (tag === "path" || tag === "polygon" || tag === "rect") {
    return 2;
  }

  if (tag === "area" || tag === "button" || tag === "a") {
    return 3;
  }

  if (node.hasAttribute("onclick") || node instanceof HTMLElement && Boolean(node.dataset.seat)) {
    return 4;
  }

  if (tag === "g") {
    return 5;
  }

  return 10;
}

function getSeatClickTargetsAtPoint(x: number, y: number, fallback: Element) {
  const stack = Array.from(document.elementsFromPoint(x, y));
  const prioritized = stack
    .filter((node) => visible(node))
    .map((node) => node.closest("[onclick], button, a, area, [role='button'], [data-seat], g") ?? node)
    .filter((node, index, array): node is Element => Boolean(node) && array.indexOf(node) === index)
    .sort((left, right) => getSeatElementPriority(left) - getSeatElementPriority(right));

  if (!prioritized.length) {
    return [fallback];
  }

  return prioritized;
}

function readSeatFooterSummary() {
  const footerCandidates = Array.from(document.querySelectorAll<HTMLElement>("div, section, footer"))
    .filter((node) => visible(node))
    .filter((node) => {
      const style = window.getComputedStyle(node);
      return style.position === "fixed" || style.position === "sticky";
    })
    .map((node) => normalizeText(node.textContent ?? ""))
    .filter(Boolean);

  return footerCandidates.find((text) => text.includes("zone") || text.includes("ที่นั่ง")) ?? "";
}

function readBookingSummarySeats() {
  const containers = Array.from(document.querySelectorAll<HTMLElement>("div, section, aside"))
    .filter((node) => visible(node))
    .filter((node) => {
      const text = normalizeText(node.textContent ?? "");
      return text.includes("รายละเอียดการจอง") || text.includes("เลขที่นั่ง");
    });

  for (const container of containers) {
    const text = normalizeText(container.textContent ?? "");
    if (!text) {
      continue;
    }

    const seatLine = text.match(/เลขที่นั่ง\s*([a-z]?\d+(?:\s*,\s*[a-z]?\d+)*)/i);
    if (seatLine?.[1]) {
      return seatLine[1].toUpperCase();
    }

    const countLine = text.match(/จำนวนที่นั่ง\s*([0-9]+)/i);
    if (countLine?.[1] && !text.includes("เลขที่นั่ง -")) {
      return `count:${countLine[1]}`;
    }

    if (text.includes("เลขที่นั่ง -")) {
      return "-";
    }
  }

  return "";
}

function clickSeatCandidate(seat: SeatCandidate, logs: string[]) {
  const x = Math.round(seat.x);
  const y = Math.round(seat.y);
  const clickableAncestor =
    seat.element.closest("[onclick], button, a, area, [role='button'], [data-seat], g") ?? null;
  const pointTargets = getSeatClickTargetsAtPoint(x, y, seat.element);
  const targets = [...pointTargets, seat.element, clickableAncestor].filter(
    (node, index, array): node is Element => Boolean(node) && array.indexOf(node) === index
  );

  if (!targets.length) {
    logs.push(`S2: no click target at point -> ${seat.rowLabel}${seat.seatNumber}@${x},${y}`);
    return false;
  }

  logs.push(
    `S2: seat click path -> ${seat.rowLabel}${seat.seatNumber} via ${targets
      .map((target) => `${target.tagName.toLowerCase()}#${getSeatElementPriority(target)}`)
      .join(" -> ")} @ ${x},${y}`
  );

  // เลือกส่งคำสั่งคลิกไปที่ Element แรก (target ที่เจาะจงที่สุด) เท่านั้น 
  // เพื่อป้องกันไม่ให้ 1 ที่นั่ง ยิง click event ไปที่ svg circle > svg g ฯลฯ รวม 3 ครั้ง ซึ่งทำให้เกิดการรัว POST
  const target = targets[0];
  if (target) {
    dispatchSeatSequence(target, x, y);
    invokeInlineAction(target);

    if ((target as any).click) {
      try {
        (target as any).click();
      } catch {
        // ignore click errors on nodes
      }
    } else {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    }
  }

  const footerSummary = readSeatFooterSummary();
  if (footerSummary) {
    logs.push(`S2: seat footer summary -> ${footerSummary}`);
  }

  const bookingSummarySeats = readBookingSummarySeats();
  if (bookingSummarySeats) {
    logs.push(`S2: booking summary seats -> ${bookingSummarySeats}`);
  }

  return true;
}

function collectSeatCandidates(logs: string[]) {
  const rowMarkers = collectRowMarkers();
  const nodes = Array.from(
    document.querySelectorAll<Element>(
      "[data-seat], [data-row], area, button, a, [onclick], svg circle, svg ellipse, svg path, svg rect, svg polygon, svg g"
    )
  );
  const blockedWords = [
    "stage",
    "legend",
    "selected",
    "unavailable",
    "disabled",
    "sold",
    "booked",
    "ไม่ว่าง",
    "จองแล้ว",
    "หมดแล้ว",
    "ไม่สามารถเลือก"
  ];
  const deduped = new Map<string, SeatCandidate>();

  for (const node of nodes) {
    if (!visible(node)) {
      continue;
    }

    const rect = node.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) {
      continue;
    }

    const text = elementSearchText(node);
    if (!text || includesAny(text, blockedWords)) {
      continue;
    }

    const seatNumber = extractSeatNumber(text);
    if (!seatNumber) {
      continue;
    }

    const explicitRow =
      (node instanceof HTMLElement ? node.dataset.row?.toUpperCase() : "") || extractSeatRow(text);
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const rowLabel = explicitRow || findClosestRowMarker(rowMarkers, x, y)?.label || "";
    const rowIndex = rowLabelToIndex(rowLabel);
    const key = `${rowLabel}:${seatNumber}:${Math.round(x)}:${Math.round(y)}`;
    const nextCandidate = {
      element: node,
      rowLabel,
      rowIndex,
      seatNumber,
      x,
      y,
      sourceTag: node.tagName.toLowerCase()
    } satisfies SeatCandidate;
    const existingCandidate = deduped.get(key);

    if (!existingCandidate || getSeatElementPriority(node) < getSeatElementPriority(existingCandidate.element)) {
      deduped.set(key, nextCandidate);
    }
  }

  const candidates = Array.from(deduped.values());
  logs.push(`S0: seat candidates found -> ${candidates.length}`);
  return candidates;
}

function sortSeatsByStrategy(candidates: SeatCandidate[], strategy: string) {
  if (strategy === "random") {
    return [...candidates].sort(() => Math.random() - 0.5);
  }

  const rowCenter = numericMedian(candidates.map((candidate) => candidate.rowIndex));
  const seatCenter = numericMedian(candidates.map((candidate) => candidate.seatNumber));
  const xCenter = numericMedian(candidates.map((candidate) => candidate.x));
  const yCenter = numericMedian(candidates.map((candidate) => candidate.y));

  return [...candidates].sort((left, right) => {
    switch (strategy) {
      case "front-left":
        return left.y - right.y || left.x - right.x || left.seatNumber - right.seatNumber;
      case "front-right":
        return left.y - right.y || right.x - left.x || right.seatNumber - left.seatNumber;
      case "back-left":
        return right.y - left.y || left.x - right.x || left.seatNumber - right.seatNumber;
      case "back-right":
        return right.y - left.y || right.x - left.x || right.seatNumber - left.seatNumber;
      case "middle": {
        const leftScore =
          Math.abs(left.x - xCenter) +
          Math.abs(left.y - yCenter) * 1.5 +
          Math.abs(left.rowIndex - rowCenter) * 2 +
          Math.abs(left.seatNumber - seatCenter);
        const rightScore =
          Math.abs(right.x - xCenter) +
          Math.abs(right.y - yCenter) * 1.5 +
          Math.abs(right.rowIndex - rowCenter) * 2 +
          Math.abs(right.seatNumber - seatCenter);
        return leftScore - rightScore;
      }
      default:
        return left.y - right.y || left.x - right.x || left.seatNumber - right.seatNumber;
    }
  });
}

function pickAdjacentSeats(candidates: SeatCandidate[], count: number, logs: string[]) {
  const byRow = new Map<string, SeatCandidate[]>();

  for (const candidate of candidates) {
    const key = candidate.rowLabel || `row-${candidate.rowIndex}`;
    const rowSeats = byRow.get(key) ?? [];
    rowSeats.push(candidate);
    byRow.set(key, rowSeats);
  }

  const rowCenter = numericMedian(candidates.map((candidate) => candidate.rowIndex));
  const seatCenter = numericMedian(candidates.map((candidate) => candidate.seatNumber));
  const xCenter = numericMedian(candidates.map((candidate) => candidate.x));
  const yCenter = numericMedian(candidates.map((candidate) => candidate.y));
  let bestGroup: SeatCandidate[] = [];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const rowSeats of byRow.values()) {
    const sorted = [...rowSeats].sort((left, right) => left.x - right.x || left.seatNumber - right.seatNumber);

    for (let index = 0; index <= sorted.length - count; index += 1) {
      const group = sorted.slice(index, index + count);
      const isAdjacent = group.every((candidate, candidateIndex) => {
        if (candidateIndex === 0) {
          return true;
        }

        const previous = group[candidateIndex - 1]!;
        const xGap = candidate.x - previous.x;
        const seatGap = candidate.seatNumber - previous.seatNumber;
        return seatGap === 1 || (xGap > 8 && xGap < 42);
      });

      if (!isAdjacent) {
        continue;
      }

      const averageSeat = group.reduce((total, candidate) => total + candidate.seatNumber, 0) / group.length;
      const averageX = group.reduce((total, candidate) => total + candidate.x, 0) / group.length;
      const averageY = group.reduce((total, candidate) => total + candidate.y, 0) / group.length;
      const score =
        Math.abs(group[0].rowIndex - rowCenter) * 6 +
        Math.abs(averageSeat - seatCenter) +
        Math.abs(averageX - xCenter) +
        Math.abs(averageY - yCenter) * 1.5;

      if (score < bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }
  }

  if (bestGroup.length) {
    logs.push(`S1: adjacent block found -> ${bestGroup.map((seat) => `${seat.rowLabel}${seat.seatNumber}`).join(", ")}`);
  } else {
    logs.push("S1: no adjacent block found");
  }

  return bestGroup;
}

function continuePartialSeatSelection(
  candidates: SeatCandidate[],
  requestedCount: number,
  strategy: string,
  existingPickedLabels: string[],
  logs: string[]
) {
  if (!existingPickedLabels.length) {
    return null;
  }

  const pickedSet = new Set(existingPickedLabels.map((label) => label.toUpperCase()));
  const pickedCandidates = candidates.filter((candidate) =>
    pickedSet.has(`${candidate.rowLabel}${candidate.seatNumber}`.toUpperCase())
  );

  if (!pickedCandidates.length) {
    return null;
  }

  if (strategy === "adjacent") {
    const anchorRow = pickedCandidates[0]?.rowLabel ?? "";
    const sameRow = candidates
      .filter((candidate) => candidate.rowLabel === anchorRow)
      .sort((left, right) => left.x - right.x || left.seatNumber - right.seatNumber);

    const group = sameRow.filter((candidate) =>
      pickedSet.has(`${candidate.rowLabel}${candidate.seatNumber}`.toUpperCase())
    );

    if (group.length) {
      const used = new Set(group.map((candidate) => `${candidate.rowLabel}${candidate.seatNumber}`.toUpperCase()));
      const averageX = group.reduce((total, candidate) => total + candidate.x, 0) / group.length;
      const neighbors = sameRow
        .filter((candidate) => !used.has(`${candidate.rowLabel}${candidate.seatNumber}`.toUpperCase()))
        .sort((left, right) => Math.abs(left.x - averageX) - Math.abs(right.x - averageX));

      while (group.length < requestedCount && neighbors.length) {
        group.push(neighbors.shift()!);
      }

      const sortedGroup = group
        .sort((left, right) => left.x - right.x || left.seatNumber - right.seatNumber)
        .slice(0, requestedCount);

      logs.push(
        `S1: partial continuation -> ${sortedGroup.map((seat) => `${seat.rowLabel}${seat.seatNumber}`).join(", ")}`
      );
      return sortedGroup;
    }
  }

  const remainder = sortSeatsByStrategy(
    candidates.filter((candidate) => !pickedSet.has(`${candidate.rowLabel}${candidate.seatNumber}`.toUpperCase())),
    strategy
  );
  const merged = [...pickedCandidates, ...remainder].slice(0, requestedCount);
  logs.push(`S1: partial continuation fallback -> ${merged.map((seat) => `${seat.rowLabel}${seat.seatNumber}`).join(", ")}`);
  return merged;
}

function confirmSeatSelection(logs: string[]) {
  const button = findClickableByTexts(["ยืนยันที่นั่ง", "confirm seat", "ยืนยัน"]);
  const confirmed = Boolean(button && (clickElement(button) || clickAtCenter(button)));
  logs.push(confirmed ? "S3: seat confirmation clicked" : "S3: seat confirmation button not found");
  return confirmed;
}

function hasSeatWarningModal() {
  const dialogCandidates = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], .modal, .swal2-popup, .popup-normal, .ui-dialog, div[style*='z-index']:not([id^='__ttm']), .v-dialog"));
  return dialogCandidates.some((node) => {
    if (!visible(node)) {
      return false;
    }

    const text = normalizeText(node.textContent ?? "");
    return (
      text.includes("กรุณาเลือกที่นั่ง") ||
      text.includes("please select seat") ||
      text.includes("seat is not available") ||
      text.includes("ที่นั่งถูกเลือกไปแล้ว") ||
      text.includes("incorrect data") ||
      text.includes("กรุณาเลือกจำนวนบัตรใหม่อีกครั้ง") ||
      text.includes("please select number of seat")
    );
  });
}

function dismissSeatWarningModal(logs: string[]) {
  const closeButton = findClickableByTexts(["close", "ปิด", "ตกลง", "ok", "ยอมรับ"]);
  if (closeButton && (clickElement(closeButton) || clickAtCenter(closeButton))) {
    logs.push("S4: seat warning modal dismissed");
    return true;
  }

  logs.push("S4: seat warning modal found but close button not found");
  return false;
}

function readSeatWarningText() {
  const dialogCandidates = Array.from(
    document.querySelectorAll<HTMLElement>("[role='dialog'], .modal, .swal2-popup, .popup-normal, .ui-dialog, div[style*='z-index']:not([id^='__ttm']), .v-dialog")
  );

  for (const node of dialogCandidates) {
    if (!visible(node)) {
      continue;
    }

    const text = normalizeText(node.textContent ?? "");
    if (
      text.includes("กรุณาเลือกที่นั่ง") ||
      text.includes("please select seat") ||
      text.includes("seat is not available") ||
      text.includes("ที่นั่งถูกเลือกไปแล้ว") ||
      text.includes("incorrect data") ||
      text.includes("กรุณาเลือกจำนวนบัตรใหม่อีกครั้ง") ||
      text.includes("please select number of seat")
    ) {
      return text;
    }
  }

  return "";
}

function shouldSkipRejectedSeats(warningText: string) {
  const text = normalizeText(warningText);
  return (
    text.includes("กรุณาเลือกที่นั่ง") ||
    text.includes("please select seat") ||
    text.includes("seat is not available") ||
    text.includes("ที่นั่งถูกเลือกไปแล้ว") ||
    text.includes("incorrect data") ||
    text.includes("กรุณาเลือกจำนวนบัตรใหม่อีกครั้ง") ||
    text.includes("please select number of seat")
  );
}

function goBackToZoneSelection(logs: string[]) {
  const button = findClickableByTexts(["เลือกโซนอื่น", "back to zone", "change zone"]);
  const clicked = Boolean(button && (clickElement(button) || clickAtCenter(button)));
  logs.push(clicked ? "Z1: back to zone selection clicked" : "Z1: back to zone selection button not found");
  return clicked;
}

function resolveDeliveryValue(value: string) {
  const normalized = compactText(value);

  if (normalized === "pickup") {
    return "รับบัตรด้วยตัวเอง";
  }

  if (normalized === "postal" || normalized === "mail" || normalized === "delivery") {
    return "ส่งไปรษณีย์";
  }

  if (normalized === "eticket" || normalized === "e-ticket") {
    return "อี-ทิกเก็ต";
  }

  return value;
}

function resolvePaymentValue(value: string) {
  const normalized = compactText(value);

  if (normalized === "mobilewallet" || normalized === "mobile" || normalized === "wallet") {
    return "ชำระเงินผ่านมือถือ";
  }

  if (normalized === "cashatm" || normalized === "cash" || normalized === "atm") {
    return "ชำระเงินสด และเอทีเอ็ม";
  }

  if (normalized === "directdebit" || normalized === "debitaccount") {
    return "หักเงินผ่านบัญชี";
  }

  if (normalized === "qr" || normalized === "promptpay") {
    return "คิวอาร์ พร้อมเพย์";
  }

  if (normalized === "kplus" || normalized === "k-plus") {
    return "เคพลัส";
  }

  if (normalized === "truemoney" || normalized === "wallet") {
    return "ทรูมันนี่";
  }

  if (normalized === "creditcard" || normalized === "credit-card") {
    return "บัตรเครดิต/เดบิต";
  }

  return value;
}

function chooseRound(round: string | number | undefined, logs: string[]) {
  if (round === undefined || round === null || round === "") {
    logs.push("B0: no round configured");
    return false;
  }

  const value = String(round).trim();
  if (!value || value === "0") {
    logs.push("B0: no round configured");
    return false;
  }

  const container = findContainerByLabel(["รอบการแสดง", "รอบ"]);
  const select = container?.querySelector<HTMLSelectElement>("select") ?? null;

  if (select) {
    const options = Array.from(select.options).filter((option) => {
      const text = normalizeText(option.textContent ?? "");
      return Boolean(option.value?.trim() || text) && !text.includes("เลือกรอบ");
    });

    const numericIndex = Number(value);
    if (Number.isFinite(numericIndex) && numericIndex >= 1 && Number.isInteger(numericIndex)) {
      const option = options[numericIndex - 1] ?? null;
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        logs.push(`B1: round selected by index -> ${value} (${normalizeText(option.textContent ?? "")})`);
        return true;
      }
    }

    const exactOption =
      options.find((option) => compactText(option.textContent ?? "") === compactText(value)) ??
      options.find((option) => compactText(option.value ?? "") === compactText(value));

    if (exactOption) {
      select.value = exactOption.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      logs.push(`B1: round selected by exact match -> ${normalizeText(exactOption.textContent ?? "")}`);
      return true;
    }

    logs.push(`B1: round not found -> ${value}`);
    return false;
  }

  const changed = setInputValue(container, value);
  logs.push(changed ? `B1: round input set -> ${value}` : `B1: round not found -> ${value}`);
  return changed;
}

function chooseZone(zoneValue: string, logs: string[]) {
  const zoneCandidates = parseZoneCandidates(zoneValue);
  const startIndex = getActiveZoneIndex(zoneValue);

  if (!zoneCandidates.length) {
    logs.push("C1: no zone configured");
    return { status: "missing" as const, zone: null };
  }

  for (let index = startIndex; index < zoneCandidates.length; index += 1) {
    const zone = zoneCandidates[index]!;

    if (recentlyMarked(ZONE_MARKER_KEY, zone)) {
      logs.push(`C1: waiting after zone click -> ${zone}`);
      return { status: "waiting" as const, zone };
    }

    const retryCount = getMarkerRetryCount(ZONE_MARKER_KEY, zone);
    if (retryCount >= 1) {
      logs.push(`C1: zone click already retried once -> ${zone}`);
      continue;
    }

    const target = findZoneTarget(zone, logs);
    if (!target) {
      continue;
    }

    if (target.tagName === "AREA") {
      logs.push(`C1: click area target -> ${zone} (${describeArea(target)})`);
    } else {
      logs.push(`C1: click target tag -> ${zone} (${target.tagName.toLowerCase()})`);
    }

    const clicked = clickElement(target) || clickAtCenter(target);
    if (clicked) {
      setActiveZoneIndex(index);
      clearSkippedSeats(zone);
      writeMarker(ZONE_MARKER_KEY, zone, retryCount + 1);
      clearMarker(SEAT_MARKER_KEY);
      logs.push(`C1: zone clicked -> ${zone}`);
      return { status: "clicked" as const, zone };
    }

    logs.push(`C1: zone click failed -> ${zone}`);
  }

  logs.push(`C1: zone not found -> ${zoneValue}`);
  return { status: "missing" as const, zone: null };
}

function chooseSeats(preset: TtmPresetMessage, logs: string[]) {
  if (recentlyMarked(ZONE_FALLBACK_KEY, window.location.href, 2000)) {
    logs.push("S0: waiting for zone fallback navigation...");
    return {
      status: "waiting" as const,
      selected: [] as SeatCandidate[],
      requestedCount: getRequestedTicketCount(preset),
      strategy: normalizeSeatStrategy(preset.preferredSeatRule ?? preset.seat_type),
      confirmed: false,
      nextZone: preset.zone ?? preset.zones ?? ""
    };
  }

  const requestedCount = getRequestedTicketCount(preset);
  const strategy = normalizeSeatStrategy(preset.preferredSeatRule ?? preset.seat_type);
  const zoneValue = preset.zone ?? preset.zones ?? "";
  const zone = getActiveZone(zoneValue);
  const markerKey = `${zone}:${strategy}:${requestedCount}`;
  const existingMarker = getMarker(SEAT_MARKER_KEY, markerKey);
  const skippedSeats = new Set(readSkippedSeats(zone));

  if (!requestedCount) {
    logs.push("S0: no ticket count configured");
    return {
      status: "missing-config" as const,
      selected: [] as SeatCandidate[],
      requestedCount,
      strategy,
      confirmed: false
    };
  }

  if (hasSeatWarningModal()) {
    const warningText = readSeatWarningText();
    dismissSeatWarningModal(logs);
    if (shouldSkipRejectedSeats(warningText)) {
      addSkippedSeats(zone, existingMarker?.seats ?? [], logs);
    }
    if (warningText.includes("seat is not available") || warningText.includes("ที่นั่งถูกเลือกไปแล้ว")) {
      const nextZone = advanceToNextZone(zoneValue, logs, "seat-unavailable");
      if (nextZone) {
        goBackToZoneSelection(logs);
        return {
          status: "zone-fallback" as const,
          selected: [] as SeatCandidate[],
          requestedCount,
          strategy,
          confirmed: false,
          nextZone
        };
      }
    }

    clearMarker(SEAT_MARKER_KEY);
    return {
      status: "retry" as const,
      selected: [] as SeatCandidate[],
      requestedCount,
      strategy,
      confirmed: false
    };
  }

  if (recentlyMarked(SEAT_MARKER_KEY, markerKey)) {
    logs.push(`S0: waiting after seat action -> ${markerKey}`);
    return {
      status: "waiting" as const,
      selected: [] as SeatCandidate[],
      requestedCount,
      strategy,
      confirmed: false
    };
  }

  if (existingMarker?.phase === "selected") {
    const bookingSummarySeats = readBookingSummarySeats();
    if (bookingSummarySeats) {
      logs.push(`S3: booking summary seats before confirm -> ${bookingSummarySeats}`);
    }

    if (!bookingSummarySeats || bookingSummarySeats === "-") {
      logs.push("S3: booking summary not updated yet, will retry seat selection");
      addSkippedSeats(zone, existingMarker.seats ?? [], logs);
      clearMarker(SEAT_MARKER_KEY);
      return {
        status: "retry" as const,
        selected: [] as SeatCandidate[],
        requestedCount,
        strategy,
        confirmed: false,
        nextZone: undefined
      };
    }

    let bookedCount = 0;
    if (bookingSummarySeats.startsWith("count:")) {
      bookedCount = parseInt(bookingSummarySeats.slice(6), 10);
    } else {
      bookedCount = bookingSummarySeats.split(",").map((s) => s.trim()).filter(Boolean).length;
    }

    if (bookedCount > 0 && bookedCount < requestedCount) {
      logs.push(`S3: booking summary count (${bookedCount}) is less than requested (${requestedCount}), will retry seat selection`);
      addSkippedSeats(zone, existingMarker.seats ?? [], logs);
      clearMarker(SEAT_MARKER_KEY);
      return {
        status: "retry" as const,
        selected: [] as SeatCandidate[],
        requestedCount,
        strategy,
        confirmed: false,
        nextZone: undefined
      };
    }

    const confirmed = confirmSeatSelection(logs);

    if (hasSeatWarningModal()) {
      const warningText = readSeatWarningText();
      dismissSeatWarningModal(logs);
      if (shouldSkipRejectedSeats(warningText)) {
        addSkippedSeats(zone, existingMarker.seats ?? [], logs);
      }
      clearMarker(SEAT_MARKER_KEY);
      return {
        status: "retry" as const,
        selected: [] as SeatCandidate[],
        requestedCount,
        strategy,
        confirmed: false,
        nextZone: undefined
      };
    }

    writeMarker(SEAT_MARKER_KEY, markerKey, existingMarker.retries ?? 0, "confirming");

    return {
      status: confirmed ? ("confirmed" as const) : ("selected" as const),
      selected: [] as SeatCandidate[],
      requestedCount,
      strategy,
      confirmed,
      nextZone: undefined
    };
  }

  const candidates = collectSeatCandidates(logs);
  const filteredCandidates = candidates.filter(
    (candidate) => !skippedSeats.has(`${candidate.rowLabel}${candidate.seatNumber}`.toUpperCase())
  );

  if (skippedSeats.size) {
    logs.push(`S0: skipped seats active -> ${Array.from(skippedSeats).join(", ")}`);
  }

  if (!filteredCandidates.length) {
    logs.push(`S1: no seat candidates remaining in zone ${zone}`);
    const nextZone = advanceToNextZone(zoneValue, logs, "no-seats-available");
    if (nextZone) {
      goBackToZoneSelection(logs);
      return {
        status: "zone-fallback" as const,
        selected: [] as SeatCandidate[],
        requestedCount,
        strategy,
        confirmed: false,
        nextZone
      };
    }

    return {
      status: "not-found" as const,
      selected: [] as SeatCandidate[],
      requestedCount,
      strategy,
      confirmed: false,
      nextZone: undefined
    };
  }

  const alreadyPicked = existingMarker?.seats ?? [];
  let selected =
    continuePartialSeatSelection(filteredCandidates, requestedCount, strategy, alreadyPicked, logs) ??
    (strategy === "adjacent" ? pickAdjacentSeats(filteredCandidates, requestedCount, logs) : []);

  if (!selected.length) {
    selected = sortSeatsByStrategy(filteredCandidates, strategy).slice(0, requestedCount);
    logs.push(`S1: seat strategy ${strategy} -> ${selected.map((seat) => `${seat.rowLabel}${seat.seatNumber}`).join(", ")}`);
  }

  if (selected.length < requestedCount) {
    if (selected.length) {
      addSkippedSeats(zone, selected.map((seat) => `${seat.rowLabel}${seat.seatNumber}`), logs);
    }

    const nextZone = advanceToNextZone(zoneValue, logs, "not-enough-seats");
    if (nextZone) {
      goBackToZoneSelection(logs);
      return {
        status: "zone-fallback" as const,
        selected,
        requestedCount,
        strategy,
        confirmed: false,
        nextZone
      };
    }

    clearMarker(SEAT_MARKER_KEY);
    return {
      status: "retry" as const,
      selected,
      requestedCount,
      strategy,
      confirmed: false,
      nextZone: undefined
    };
  }

  const alreadyPickedSet = new Set(
    (existingMarker?.phase === "partial" ? existingMarker.seats ?? [] : []).map((seat) => seat.toUpperCase())
  );
  const remainingSeats = selected.filter(
    (seat) => !alreadyPickedSet.has(`${seat.rowLabel}${seat.seatNumber}`.toUpperCase())
  );
  const nextSeat = remainingSeats[0] ?? null;

  if (!nextSeat) {
    writeMarker(
      SEAT_MARKER_KEY,
      markerKey,
      existingMarker?.retries ?? 0,
      "selected",
      selected.map((seat) => `${seat.rowLabel}${seat.seatNumber}`)
    );

    return {
      status: "selected" as const,
      selected,
      requestedCount,
      strategy,
      confirmed: false,
      nextZone: undefined
    };
  }

  const clicked = clickSeatCandidate(nextSeat, logs);
  logs.push(
    clicked
      ? `S2: seat clicked -> ${nextSeat.rowLabel}${nextSeat.seatNumber} (${nextSeat.sourceTag})`
      : `S2: seat click failed -> ${nextSeat.rowLabel}${nextSeat.seatNumber} (${nextSeat.sourceTag})`
  );

  if (!clicked) {
    addSkippedSeats(zone, [`${nextSeat.rowLabel}${nextSeat.seatNumber}`], logs);
    clearMarker(SEAT_MARKER_KEY);
    return {
      status: "retry" as const,
      selected: selected.filter((seat) => `${seat.rowLabel}${seat.seatNumber}` !== `${nextSeat.rowLabel}${nextSeat.seatNumber}`),
      requestedCount,
      strategy,
      confirmed: false,
      nextZone: undefined
    };
  }

  const pickedSeats = Array.from(
    new Set([
      ...(existingMarker?.phase === "partial" ? existingMarker.seats ?? [] : []),
      `${nextSeat.rowLabel}${nextSeat.seatNumber}`
    ])
  );
  const nextPhase = pickedSeats.length >= requestedCount ? "selected" : "partial";

  writeMarker(
    SEAT_MARKER_KEY,
    markerKey,
    existingMarker?.retries ?? 0,
    nextPhase,
    pickedSeats
  );

  return {
    status: "selected" as const,
    selected: selected.filter((seat) => pickedSeats.includes(`${seat.rowLabel}${seat.seatNumber}`)),
    requestedCount,
    strategy,
    confirmed: false,
    nextZone: undefined
  };
}

function choosePayment(paymentValue: string, logs: string[]) {
  const aliasMap: Record<string, string[]> = {
    qr: ["qr", "thai qr payment", "พร้อมเพย์"],
    kplus: ["k plus", "kplus", "เคพลัส"],
    truemoney: ["truemoney", "pay plus", "wallet", "ทรูมันนี่"],
    "credit-card": ["บัตรเครดิต", "debit", "credit"],
    wechat: ["wechat"],
    shopeepay: ["shopee pay"]
  };

  const keys = aliasMap[paymentValue] ?? [paymentValue];
  const target = findClickableByTexts(keys);

  if (target && clickElement(target)) {
    logs.push(`D1: payment selected -> ${paymentValue}`);
    return true;
  }

  logs.push(paymentValue ? `D1: payment not found -> ${paymentValue}` : "D1: no payment configured");
  return false;
}

function applyDetailsPreset(preset: TtmPresetMessage, logs: string[]) {
  const ticketNames = preset.ticketNames ?? preset.names ?? [];
  const citizenIds =
    preset.citizenIds ??
    [preset.code_1 ?? "", preset.code_2 ?? "", preset.code_3 ?? "", preset.code_4 ?? ""].filter(Boolean);
  const zone = preset.zone ?? preset.zones ?? "";
  const ticketCount = preset.ticketCount ?? (preset.ticket ? String(preset.ticket) : "");
  const seatRule = preset.preferredSeatRule ?? preset.seat_type ?? "";
  const bookingTime = preset.bookingTime ?? preset.start_time ?? "";
  const deliveryMethod = resolveDeliveryValue(preset.deliveryMethod ?? preset.delivery ?? "");
  const paymentMethod = resolvePaymentValue(preset.paymentMethod ?? preset.payment ?? "");

  const changed = {
    round: setInputValue(findContainerByLabel(["รอบ"]), preset.round !== undefined ? String(preset.round) : ""),
    zone: setInputValue(findContainerByLabel(["โซน"]), zone),
    price: preset.price ? setInputValue(findContainerByLabel(["ราคา"]), String(preset.price)) : false,
    ticketCount: setInputValue(findContainerByLabel(["จำนวนบัตร"]), String(ticketCount)),
    seatRule: setSelectValueByText(findContainerByLabel(["วิธีเลือกที่นั่ง"]), seatRule),
    bookingTime: bookingTime ? setInputValue(findContainerByLabel(["เวลาเริ่มทำงาน"]), bookingTime) : false,
    deliveryMethod: setSelectValueByText(findContainerByLabel(["วิธีการรับบัตร"]), deliveryMethod),
    paymentMethod: setSelectValueByText(findContainerByLabel(["วิธีการชำระเงิน"]), paymentMethod)
  };

  fillRepeatedInputs("ชื่อ", ticketNames);
  fillRepeatedInputs("รหัส", citizenIds);

  logs.push(`C2: detail fields updated -> ${Object.values(changed).filter(Boolean).length} fields`);
  return changed;
}

export function detectTtmPageState(): TtmPageState {
  const url = window.location.href.toLowerCase();
  const text = pageText();
  const hasManyPaths = document.querySelectorAll("svg g, svg circle, svg ellipse, svg path:not([fill='none'])").length > 20;

  const seatStepDetected =
    includesAny(text, ["ขั้นตอนที่ 2/4", "เลือกที่นั่ง", "ยืนยันที่นั่ง", "เลือกโซนอื่น", "back to zone"]) ||
    (hasManyPaths && includesAny(text, ["ที่นั่งเลือก", "stage", "เหลือ"])) ||
    document.querySelectorAll("[data-seat], [data-row], circle[onclick], path[onclick], ellipse[onclick], rect[onclick]").length > 1;

  if (url.includes("paymentall.php") || includesAny(text, ["วิธีชำระเงิน", "ยืนยันการสั่งซื้อ"])) {
    return "payment";
  }

  if (seatStepDetected) {
    return "seats";
  }

  if (url.includes("zones.php") || includesAny(text, ["ขั้นตอนที่ 1/4", "stage", "ที่นั่งว่าง"])) {
    return "zones";
  }

  if (includesAny(text, ["ชื่อบนบัตร", "วิธีการรับบัตร", "เลขบัตรประชาชน"]) && !url.includes("paymentall.php")) {
    return "details";
  }

  if (includesAny(text, ["queue", "กรุณารอสักครู่"])) {
    return "queue";
  }

  if (includesAny(text, ["สำเร็จ", "success", "ชำระเงินสำเร็จ"])) {
    return "success";
  }

  return "unknown";
}

export function runTtmPreset(preset: TtmPresetMessage): TtmRunReport {
  const state = detectTtmPageState();
  const logs: string[] = [`A0: state detected -> ${state}`];
  const paymentMethod = preset.paymentMethod ?? preset.payment ?? "";
  const zoneValue = preset.zone ?? preset.zones ?? "";
  const activeZone = getActiveZone(zoneValue);

  if (state === "zones") {
    renderZoneDebugOverlay(activeZone);
    logs.push(`A1: zone overlay rendered -> ${activeZone || "none"}`);
  } else {
    clearZoneDebugOverlay();
  }

  if (state !== "zones") {
    clearMarker(ZONE_MARKER_KEY);
  }

  if (state !== "seats") {
    clearMarker(SEAT_MARKER_KEY);
  }

  switch (state) {
    case "zones": {
      chooseRound(preset.round, logs);
      const zoneResult = chooseZone(zoneValue, logs);

      return {
        action:
          zoneResult.status === "clicked"
            ? "zone-clicked"
            : zoneResult.status === "waiting"
              ? "zone-waiting"
              : "zone-missing",
        detail:
          zoneResult.status === "clicked"
            ? `A: อยู่หน้าเลือกโซน และกดโซน ${zoneResult.zone} แล้ว กำลังรอหน้าเลือกที่นั่ง`
            : zoneResult.status === "waiting"
              ? `A: เพิ่งกดโซน ${zoneResult.zone} ไปแล้ว กำลังรอหน้าเลือกที่นั่ง`
              : "A: อยู่หน้าเลือกโซน แต่หาโซนที่ตั้งไว้ไม่เจอ จึงหยุดค้นหาชั่วคราว รอให้ผู้ใช้กดเข้าผังเอง",
        state,
        step: "A",
        stopped: false,
        matched: zoneResult.zone,
        logs
      };
    }

    case "seats": {
      const seatResult = chooseSeats(preset, logs);
      const selectedLabels = seatResult.selected.map((seat) => `${seat.rowLabel}${seat.seatNumber}`).join(", ");

      return {
        action:
          seatResult.status === "confirmed"
            ? "seat-confirmed"
            : seatResult.status === "zone-fallback"
              ? "seat-zone-fallback"
              : seatResult.status === "selected"
                ? "seat-selected"
                : seatResult.status === "waiting"
                  ? "seat-waiting"
                  : "seat-failed",
        detail:
          seatResult.status === "confirmed"
            ? `B: เลือกที่นั่ง ${selectedLabels} แล้ว และกดยืนยันที่นั่งแล้ว`
            : seatResult.status === "zone-fallback"
              ? `B: ที่นั่งโซน ${activeZone} ไม่ว่าง จึงสลับไปโซนสำรอง ${seatResult.nextZone ?? ""}`
              : seatResult.status === "selected"
                ? selectedLabels
                  ? `B: เลือกที่นั่ง ${selectedLabels} แล้ว กำลังรอให้เว็บรับค่า ก่อนกดยืนยัน`
                  : "B: เลือกที่นั่งไว้แล้ว กำลังลองกดยืนยันอีกครั้ง"
                : seatResult.status === "waiting"
                  ? "B: เพิ่งเลือกที่นั่งไปแล้ว กำลังรอหน้าเปลี่ยน"
                  : seatResult.status === "retry"
                    ? "B: เว็บยังไม่รับที่นั่ง จึงล้าง modal แล้วจะลองเลือกใหม่"
                    : seatResult.status === "missing-config"
                      ? "B: อยู่หน้าเลือกที่นั่ง แต่ยังไม่ได้ตั้งจำนวนบัตร"
                      : "B: อยู่หน้าเลือกที่นั่ง แต่ยังหาเก้าอี้ที่กดได้ไม่เจอ",
        state,
        step: "B",
        stopped: seatResult.status === "missing-config",
        matched: selectedLabels || null,
        logs
      };
    }

    case "details": {
      applyDetailsPreset(preset, logs);
      return {
        action: "details-filled",
        detail: "C: อยู่หน้ากรอกข้อมูลบัตร และพยายามกรอกค่าจาก preset แล้ว",
        state,
        step: "C",
        stopped: false,
        matched: null,
        logs
      };
    }

    case "payment": {
      choosePayment(paymentMethod, logs);
      return {
        action: "payment-reached",
        detail: "D: ถึงหน้าชำระเงินแล้ว รอจ่ายเงินต่อได้เลย",
        state,
        step: "D",
        stopped: true,
        matched: paymentMethod || null,
        logs
      };
    }

    case "success":
      return {
        action: "success-reached",
        detail: "S: ถึงหน้าสำเร็จแล้ว",
        state,
        step: "S",
        stopped: true,
        matched: null,
        logs
      };

    case "queue":
      return {
        action: "queue-detected",
        detail: "Q: อยู่หน้า queue หรือหน้ารอระบบ",
        state,
        step: "Q",
        stopped: false,
        matched: null,
        logs
      };

    default:
      return {
        action: "unknown-state",
        detail: "U: ยังไม่รู้จักหน้า TTM นี้ จึงยังไม่สั่งงานต่อ",
        state,
        step: "U",
        stopped: true,
        matched: null,
        logs
      };
  }
}
