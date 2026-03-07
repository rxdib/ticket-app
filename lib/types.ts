export interface Ticket {
  id: string;
  date: string;           // format YYYY-MM-DD
  amount: number;         // en CHF
  category: string;       // une des 6 catégories
  photoFilename: string;  // ex: "2026-03-05_a1b2c3.jpg"
  createdAt: string;      // ISO timestamp
}
