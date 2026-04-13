export interface Ticket {
  id: string;
  date: string;           // format YYYY-MM-DD
  amount: number;         // total en CHF (somme des deux parts pour repas mixte)
  amount81?: number;      // Repas mixte : part TVA 8.1%
  amount26?: number;      // Repas mixte : part TVA 2.6%
  category: string;       // une des 6 catégories
  photoFilename: string;  // ex: "07-03-2026.jpg" ou "07-03-2026-2.jpg"
  createdAt: string;      // ISO timestamp
}
