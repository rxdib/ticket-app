'use client';
import { MONTHS_FR } from '@/lib/constants';

interface Props {
  selectedMonth: number;
  selectedYear: number;
  onChange: (month: number, year: number) => void;
}

export default function MonthFilter({ selectedMonth, selectedYear, onChange }: Props) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  return (
    <div className="flex gap-3 items-center">
      <select
        className="flex-1 text-lg p-3 rounded-xl border-2 border-gray-200 bg-white font-medium"
        value={selectedMonth}
        onChange={e => onChange(parseInt(e.target.value), selectedYear)}
      >
        {MONTHS_FR.map((m, i) => (
          <option key={i} value={i}>{m}</option>
        ))}
      </select>
      <select
        className="text-lg p-3 rounded-xl border-2 border-gray-200 bg-white font-medium"
        value={selectedYear}
        onChange={e => onChange(selectedMonth, parseInt(e.target.value))}
      >
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
