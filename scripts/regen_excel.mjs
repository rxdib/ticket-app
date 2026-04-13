import { readFileSync, writeFileSync } from 'fs';
import ExcelJS from 'exceljs';

const TICKETS_JSON = 'C:/Users/Robin/Dropbox/Applications/Robalex_ticket/Tickets/2026/tickets.json';
const EXCEL_OUT    = 'C:/Users/Robin/Dropbox/Applications/Robalex_ticket/Tickets/2026/2026.xlsx';

const MONTHS_FR = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

const MIXED_CATEGORY = 'Repas mixte (8.1%+2.6%)';
const CATEGORY_26    = 'Repas 2.6%';

function getTvaAmounts(ticket) {
  if (ticket.category === MIXED_CATEGORY) {
    return { tva81: ticket.amount81 ?? '', tva26: ticket.amount26 ?? '' };
  }
  if (ticket.category === CATEGORY_26) {
    return { tva81: '', tva26: ticket.amount };
  }
  return { tva81: ticket.amount, tva26: '' };
}

const tickets = JSON.parse(readFileSync(TICKETS_JSON, 'utf-8'));

const workbook = new ExcelJS.Workbook();
workbook.creator = 'Ticket App';
workbook.created = new Date();

const byMonth = {};
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
    { header: 'Categorie',     key: 'category',       width: 35 },
    { header: 'Fichier photo', key: 'photoFilename',  width: 35 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3E4CD' } };

  const sorted = [...monthTickets].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const [y, mo, d] = t.date.split('-');
    const { tva81, tva26 } = getTvaAmounts(t);
    sheet.addRow({
      date:          `${d}.${mo}.${y}`,
      amount:        t.amount,
      tva81,
      tva26,
      category:      t.category,
      photoFilename: t.photoFilename,
    });
  }

  sheet.getColumn('amount').numFmt = '#,##0.00';
  sheet.getColumn('tva81').numFmt  = '#,##0.00';
  sheet.getColumn('tva26').numFmt  = '#,##0.00';
}

if (workbook.worksheets.length === 0) workbook.addWorksheet('Vide');

const buffer = await workbook.xlsx.writeBuffer();
writeFileSync(EXCEL_OUT, Buffer.from(buffer));
console.log(`Excel regenere : ${tickets.length} tickets -> ${EXCEL_OUT}`);
