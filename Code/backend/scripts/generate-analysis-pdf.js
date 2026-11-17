const { chromium } = require('../../frontend/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineFormat(text) {
  // Inline code
  text = text.replace(/`([^`]+)`/g, (m, code) => `<code class="inline-code">${escapeHtml(code)}</code>`);
  // Bold + italic
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Arrows
  text = text.replace(/&rarr;/g, '→').replace(/->/g, '→').replace(/=>/g, '⇒');
  return text;
}

function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];

  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer = [];

  let inTable = false;
  let tableHeaderParsed = false;
  let tableRows = [];

  let listType = null; // 'ul' or 'ol'
  let listItems = [];

  let inBlockquote = false;
  let blockquoteBuffer = [];

  function flushList() {
    if (listType && listItems.length > 0) {
      out.push(`<${listType}>`);
      for (const item of listItems) {
        out.push(`<li>${item}</li>`);
      }
      out.push(`</${listType}>`);
      listType = null;
      listItems = [];
    }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      out.push('<div class="table-container"><table>');
      if (tableRows[0]) {
        out.push('<thead><tr>');
        for (const th of tableRows[0]) {
          out.push(`<th>${inlineFormat(th)}</th>`);
        }
        out.push('</tr></thead>');
      }
      if (tableRows.length > 1) {
        out.push('<tbody>');
        for (let i = 1; i < tableRows.length; i++) {
          out.push('<tr>');
          for (const td of tableRows[i]) {
            out.push(`<td>${inlineFormat(td)}</td>`);
          }
          out.push('</tr>');
        }
        out.push('</tbody>');
      }
      out.push('</table></div>');
      inTable = false;
      tableHeaderParsed = false;
      tableRows = [];
    }
  }

  function flushBlockquote() {
    if (inBlockquote && blockquoteBuffer.length > 0) {
      out.push(`<blockquote><p>${inlineFormat(blockquoteBuffer.join(' '))}</p></blockquote>`);
      inBlockquote = false;
      blockquoteBuffer = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Code blocks
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushList();
        flushTable();
        flushBlockquote();
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        out.push(`<div class="code-block-wrap"><div class="code-header"><span class="code-lang">${escapeHtml(codeLang || 'text')}</span></div><pre><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(codeBuffer.join('\n'))}</code></pre></div>`);
        codeBuffer = [];
        codeLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // 2. Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      flushBlockquote();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Check if delimiter row like |---|---|
      const isDelimiter = cells.every((c) => /^:?-+:?$/.test(c));
      if (isDelimiter) {
        tableHeaderParsed = true;
        continue;
      }

      inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // 3. Blockquotes
    if (trimmed.startsWith('>')) {
      flushList();
      flushTable();
      inBlockquote = true;
      blockquoteBuffer.push(trimmed.replace(/^>\s*/, ''));
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // Blank line
    if (!trimmed) {
      flushList();
      flushTable();
      flushBlockquote();
      continue;
    }

    // 4. Horizontal rules
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      flushTable();
      flushBlockquote();
      out.push('<hr />');
      continue;
    }

    // 5. Headings
    if (trimmed.startsWith('#')) {
      flushList();
      flushTable();
      flushBlockquote();
      const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = inlineFormat(match[2]);
        const cls = level === 1 ? 'doc-title' : (level === 2 ? 'section-title' : 'sub-title');
        out.push(`<h${level} class="${cls}">${text}</h${level}>`);
        continue;
      }
    }

    // 6. Ordered lists
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(inlineFormat(olMatch[2]));
      continue;
    }

    // 7. Unordered lists
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(inlineFormat(ulMatch[1]));
      continue;
    }

    // Normal paragraph
    flushList();
    flushTable();
    flushBlockquote();
    out.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  flushList();
  flushTable();
  flushBlockquote();

  return out.join('\n');
}

async function run() {
  const mdPath = path.resolve(__dirname, '../../../PROJECT_ANALYSIS.md');
  const pdfPath = path.resolve(__dirname, '../../../PROJECT_ANALYSIS.pdf');

  console.log('Reading markdown from:', mdPath);
  const md = fs.readFileSync(mdPath, 'utf8');

  console.log('Parsing markdown to HTML...');
  const htmlBody = markdownToHtml(md);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WearForward - Full Project Technical Analysis</title>
  <style>
    @page {
      size: A4;
      margin: 1.8cm 1.4cm 1.8cm 1.4cm;
      @bottom-right {
        content: counter(page);
        font-size: 8.5pt;
        color: #718096;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      @bottom-left {
        content: "WearForward — Full Project Technical Analysis";
        font-size: 8.5pt;
        color: #a0aec0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1a202c;
      line-height: 1.58;
      font-size: 10pt;
      margin: 0;
      padding: 0;
    }
    .doc-title {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 14px;
    }
    .section-title {
      font-size: 13.5pt;
      font-weight: 700;
      color: #1e3a8a;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 5px;
      margin-top: 26px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    .sub-title {
      font-size: 11pt;
      font-weight: 600;
      color: #1e293b;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    h4 {
      font-size: 10pt;
      font-weight: 600;
      color: #334155;
      margin-top: 12px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 8px 0;
    }
    ul, ol {
      margin: 4px 0 10px 20px;
      padding: 0;
    }
    li {
      margin-bottom: 4px;
    }
    blockquote {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      margin: 10px 0;
      padding: 8px 14px;
      border-radius: 0 4px 4px 0;
      color: #1e40af;
      font-size: 9.5pt;
    }
    blockquote p {
      margin: 0;
    }
    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }
    .inline-code {
      font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      background: #f1f5f9;
      color: #6d28d9;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 8.5pt;
    }
    .code-block-wrap {
      margin: 10px 0;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #cbd5e1;
      page-break-inside: avoid;
    }
    .code-header {
      background: #e2e8f0;
      padding: 3px 10px;
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.5px;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      margin: 0;
      font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 8pt;
      line-height: 1.45;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .table-container {
      margin: 12px 0;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      background: #ffffff;
    }
    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    strong {
      color: #0f172a;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  console.log('Launching Chromium with Playwright...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Setting HTML content...');
  await page.setContent(fullHtml, { waitUntil: 'load' });

  console.log('Generating PDF...');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '1.4cm',
      right: '1.2cm',
      bottom: '1.4cm',
      left: '1.2cm',
    },
  });

  await browser.close();
  console.log('PDF successfully generated at:', pdfPath);
}

run().catch((err) => {
  console.error('Failed to generate PDF:', err);
  process.exit(1);
});

