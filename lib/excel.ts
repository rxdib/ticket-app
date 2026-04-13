import ExcelJS from 'exceljs';
import type { Ticket } from './types';
import { MONTHS_FR } from './constants';

export async function generateExcel(tickets: Ticket[], year: number): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ticket App';
  workbook.created = new Date();

  // Grouper les tickets par mois
  const byMonth: Record<number, Ticket[]> = {};
  for (const ticket of tickets) {
    const month = new Date(ticket.date).getMonth(); // 0-11
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(ticket);
  }

  // Créer une feuille par mois (dans l'ordre)
  for (let m = 0; m < 12; m++) {
    const monthTickets = byMonth[m] ?? [];
    if (monthTickets.length === 0) continue;

    const sheet = workbook.addWorksheet(MONTHS_FR[m]);

    sheet.columns = [
      { header: 'Date',          key: 'date',          width: 14 },
      { header: 'Montant (CHF)', key: 'amount',         width: 16 },
      { header: 'TVA 8.1%',      key: 'amount81',       width: 14 },
      { header: 'TVA 2.6%',      key: 'amount26',       width: 14 },
      { header: 'Catégorie',     key: 'category',       width: 35 },
      { header: 'Fichier photo', key: 'photoFilename',  width: 30 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3E4CD' },
    };

    const sorted = [...monthTickets].sort((a, b) => a.date.localeCompare(b.date));

    for (const ticket of sorted) {
      const [y, mo, d] = ticket.date.split('-');
      sheet.addRow({
        date:          `${d}.${mo}.${y}`,
        amount:        ticket.amount,
        amount81:      ticket.amount81 ?? '',
        amount26:      ticket.amount26 ?? '',
        category:      ticket.category,
        photoFilename: ticket.photoFilename,
      });
    }

    sheet.getColumn('amount').numFmt   = '#,##0.00';
    sheet.getColumn('amount81').numFmt = '#,##0.00';
    sheet.getColumn('amount26').numFmt = '#,##0.00';
  }

  if (workbook.worksheets.length === 0) {
    workbook.addWorksheet('Vide');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
