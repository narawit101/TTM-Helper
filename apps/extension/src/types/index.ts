export type SectionKey = "concert" | "names" | "citizens" | "payment";

export type HelperDraft = {
    url: string;
    round: string;
    zones: string;
    price: string;
    ticket: string;
    seat_type: string;
    runMode: "FAST" | "MEDIUM" | "SAFE";
    start_time: string;
    delivery: string;
    payment: string;
    names: string[];
    code_1: string;
    code_2: string;
    code_3: string;
    code_4: string;
    phone_number: string;
    enable_proxy: boolean;
};

export type TtmPresetMessage = {
    url?: string;
    eventUrl?: string;
    round?: string | number;
    zone?: string;
    zones?: string;
    price?: number | null;
    ticketCount?: string | number;
    ticket?: string | number;
    preferredSeatRule?: string;
    seat_type?: string;
    bookingTime?: string | null;
    start_time?: string | null;
    runMode?: "FAST" | "MEDIUM" | "SAFE";
    ticketNames?: string[];
    names?: string[];
    citizenIds?: string[];
    code_1?: string;
    code_2?: string;
    code_3?: string;
    code_4?: string;
    paymentMethod?: string;
    payment?: string;
    deliveryMethod?: string;
    delivery?: string;
};

export type TtmPageState =
    | "unknown"
    | "zones"
    | "seats"
    | "details"
    | "payment"
    | "success"
    | "queue";

export type TtmRunReport = {
    action: string;
    detail: string;
    state: TtmPageState;
    step: string;
    stopped: boolean;
    matched?: string | null;
    logs: string[];
};

export type SeatCandidate = {
    element: Element;
    rowLabel: string;
    rowIndex: number;
    seatNumber: number;
    x: number;
    y: number;
    sourceTag: string;
}

export type StepMarker = {
    key: string;
    at: number;
    href: string;
    retries?: number;
    phase?: string;
    seats?: string[];
};

export type StoredRun = {
    tabId: number;
    preset: Record<string, unknown>;
    startedAt: number;
};
