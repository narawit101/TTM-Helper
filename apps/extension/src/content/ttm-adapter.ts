import { TtmPresetMessage } from "@/types";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function findContainerByLabel(labelIncludes: string[]) {
  const labels = Array.from(document.querySelectorAll("label, span, div"));
  const match = labels.find((node) => {
    const text = normalizeText(node.textContent ?? "");
    return labelIncludes.some((label) => text.includes(normalizeText(label)));
  });

  return match?.closest("div, section, form") ?? null;
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

  const select = container.querySelector<HTMLSelectElement>("select");

  if (select) {
    const option = Array.from(select.options).find((item) =>
      normalizeText(item.textContent ?? "").includes(normalizeText(value))
    );

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
    normalizeText(node.textContent ?? "").includes(normalizeText(value))
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

function clickPrimaryAction() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a, div"));
  const match = candidates.find((node) => {
    const text = normalizeText(node.textContent ?? "");
    return ["start", "เริ่ม", "เริ่ม/หยุด"].some((keyword) => text.includes(keyword));
  });

  match?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return Boolean(match);
}

export function applyTtmPreset(preset: TtmPresetMessage) {
  const ticketNames = preset.ticketNames ?? preset.names ?? [];
  const citizenIds = preset.citizenIds ?? [
    preset.code_1 ?? "",
    preset.code_2 ?? "",
    preset.code_3 ?? "",
    preset.code_4 ?? ""
  ].filter(Boolean);
  const eventUrl = preset.eventUrl ?? preset.url ?? "";
  const zone = preset.zone ?? preset.zones ?? "";
  const ticketCount = preset.ticketCount !== undefined ? String(preset.ticketCount) : (preset.ticket ? String(preset.ticket) : "");
  const seatRule = preset.preferredSeatRule ?? preset.seat_type ?? "";
  const bookingTime = preset.bookingTime ?? preset.start_time ?? "";
  const deliveryMethod = preset.deliveryMethod ?? preset.delivery ?? "";
  const paymentMethod = preset.paymentMethod ?? preset.payment ?? "";

  const results = {
    eventUrl: eventUrl
      ? setInputValue(
        findContainerByLabel(["ลิงก์คอนเสิร์ต", "concert link"]),
        eventUrl
      )
      : false,
    round: setInputValue(
      findContainerByLabel(["รอบ", "round"]),
      preset.round !== undefined ? String(preset.round) : ""
    ),
    zone: setInputValue(findContainerByLabel(["โซน", "zone"]), zone),
    price: preset.price
      ? setInputValue(findContainerByLabel(["ราคา", "price"]), String(preset.price))
      : false,
    ticketCount: setInputValue(
      findContainerByLabel(["จำนวนบัตร", "จำนวนบัตรที่ต้องการ", "ticket count"]),
      ticketCount
    ),
    seatRule: setSelectValueByText(
      findContainerByLabel(["วิธีเลือกที่นั่ง", "seat rule"]),
      seatRule
    ),
    bookingTime: bookingTime
      ? setInputValue(
        findContainerByLabel(["เวลาเริ่มทำงาน", "start time"]),
        bookingTime
      )
      : false,
    runMode: preset.runMode
      ? setSelectValueByText(
        findContainerByLabel(["โหมด", "mode"]),
        preset.runMode === "FAST" ? "เร็ว" : "safe"
      )
      : false,
    deliveryMethod: setSelectValueByText(
      findContainerByLabel(["วิธีการรับบัตร", "delivery"]),
      deliveryMethod
    ),
    paymentMethod: setSelectValueByText(
      findContainerByLabel(["วิธีการชำระเงิน", "payment"]),
      paymentMethod
    )
  };

  fillRepeatedInputs("ชื่อนามบัตร", ticketNames);
  fillRepeatedInputs("รหัส", citizenIds);

  return results;
}

export function runTtmPreset(preset: TtmPresetMessage) {
  const results = applyTtmPreset(preset);
  const started = clickPrimaryAction();
  return { ...results, started };
}
