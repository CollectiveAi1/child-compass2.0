// Client-side report output: every report can be downloaded as CSV or sent to
// the browser print dialog (which doubles as "Save as PDF") without any
// third-party document libraries.

export interface ReportTable {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  footer?: string;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename: string, table: ReportTable) {
  const lines = [table.columns.map(csvCell).join(','), ...table.rows.map(row => row.map(csvCell).join(','))];
  // BOM prefix so Excel opens the CSV as UTF-8.
  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  triggerDownload(URL.createObjectURL(blob), filename.endsWith('.csv') ? filename : `${filename}.csv`, true);
}

export function triggerDownload(href: string, filename: string, revoke = false) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 4_000);
}

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function reportHtml(table: ReportTable, centerName: string): string {
  return `
    <header class="print-head">
      <div><h1>${escapeHtml(table.title)}</h1>${table.subtitle ? `<p>${escapeHtml(table.subtitle)}</p>` : ''}</div>
      <div class="print-brand"><b>${escapeHtml(centerName)}</b><span>Child Compass · Generated ${new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
    </header>
    <table class="print-table">
      <thead><tr>${table.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>${table.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    ${table.footer ? `<p class="print-footer">${escapeHtml(table.footer)}</p>` : ''}`;
}

// Prints via a same-origin iframe so popup blockers never eat the report.
export function printReport(table: ReportTable, centerName: string) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '100%';
  frame.style.bottom = '100%';
  frame.setAttribute('title', `${table.title} print preview`);
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(table.title)}</title><style>
    body{font:13px/1.5 'Segoe UI',system-ui,sans-serif;color:#1c2b3a;margin:32px}
    .print-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #163b73;padding-bottom:14px;margin-bottom:18px}
    .print-head h1{font-size:22px;margin:0 0 4px}
    .print-head p{margin:0;color:#5a6b7d}
    .print-brand{text-align:right;display:grid;gap:2px}
    .print-brand b{color:#163b73}
    .print-brand span{font-size:11px;color:#7a8896}
    .print-table{width:100%;border-collapse:collapse}
    .print-table th{background:#eef3fa;color:#163b73;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
    .print-table th,.print-table td{border:1px solid #d5dee8;padding:8px 10px}
    .print-table tr:nth-child(even) td{background:#f8fafc}
    .print-footer{margin-top:16px;color:#5a6b7d;font-size:12px}
    @page{margin:14mm}
  </style></head><body>${reportHtml(table, centerName)}</body></html>`);
  doc.close();
  // document.write content is available synchronously after close(), and the
  // report embeds no external assets, so print immediately.
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10_240 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
