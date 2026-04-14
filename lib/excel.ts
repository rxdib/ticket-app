import ExcelJS from 'exceljs';
import type { Ticket } from './types';
import { MONTHS_FR, MIXED_CATEGORY } from './constants';

const CATEGORY_26 = 'Repas 2.6%';

function getTvaAmounts(ticket: Ticket): { tva81: number | ''; tva26: number | '' } {
  if (ticket.category === MIXED_CATEGORY) {
    return {
      tva81: ticket.amount81 ?? '',
      tva26: ticket.amount26 ?? '',
    };
  }
  if (ticket.category === CATEGORY_26) {
    return { tva81: '', tva26: ticket.amount };
  }
  // Toutes les autres catégories → TVA 8.1%
  return { tva81: ticket.amount, tva26: '' };
}

export async function generateExcel(tickets: Ticket[], year: number): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ticket App';
  workbook.created = new Date();

  // Grouper les tickets par mois
  const byMonth: Record<number, Ticket[]> = {};
  for (const ticket of tickets) {
    const month = new Date(ticket.date).getMonth();
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(ticket);
  }

  for (let m = 0; m < 12; m++) {
    const monthTickets = byMonth[m] ?? [];
    if (monthTickets.length === 0) continue;

    const sheet = workbook.addWorksheet(MONTHS_FR[m]);

    sheet.columns = [
      { header: 'Date',          key: 'date',          width: 14 },
      { header: 'Montant (CHF)', key: 'amount',         width: 16 },
      { header: 'TVA 8.1%',      key: 'tva81',          width: 14 },
      { header: 'TVA 2.6%',      key: 'tva26',          width: 14 },
      { header: 'Catégorie',     key: 'category',       width: 35 },
      { header: 'Paiement',      key: 'paymentMethod',  width: 12 },
      { header: 'Payeur',        key: 'payer',          width: 12 },
      { header: 'Remboursé',     key: 'reimbursed',     width: 12 },
      { header: 'Note',          key: 'note',           width: 30 },
      { header: 'Fichier photo', key: 'photoFilename',  width: 35 },
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
      const { tva81, tva26 } = getTvaAmounts(ticket);
      const isCash = ticket.paymentMethod === 'cash';
      sheet.addRow({
        date:          `${d}.${mo}.${y}`,
        amount:        ticket.amount,
        tva81,
        tva26,
        category:      ticket.category,
        paymentMethod: ticket.paymentMethod === 'cash' ? 'Cash' : 'Carte',
        payer:         isCash ? (ticket.payer ?? '') : '',
        reimbursed:    isCash ? (ticket.reimbursed ? 'Oui' : 'Non') : '',
        note:          ticket.note ?? '',
        photoFilename: ticket.photoFilename,
      });
    }

    sheet.getColumn('amount').numFmt = '#,##0.00';
    sheet.getColumn('tva81').numFmt  = '#,##0.00';
    sheet.getColumn('tva26').numFmt  = '#,##0.00';
  }

  if (workbook.worksheets.length === 0) {
    workbook.addWorksheet('Vide');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
