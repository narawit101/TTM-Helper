export type TtmPresetPayload = {
  seatNames: string[];
  citizenIds: string[];
};

export type TicketPresetInput = {
  eventUrl: string;
  round?: string;
  zone?: string;
  price?: number | null;
  ticketCount?: number;
  preferredSeatRule?: string;
  bookingTime?: string | null;
  runMode?: "FAST" | "MEDIUM" | "SAFE";
  ticketNames: string[];
  citizenIds: string[];
  deliveryMethod?: string;
  paymentMethod?: string;
};

export type TicketPresetRecord = TicketPresetInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};
