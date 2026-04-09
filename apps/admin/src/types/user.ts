export interface User {
    id: string;
    email: string;
    createdAt: Date;
    expiresAt: Date | null;
    deviceLimit: number;
}