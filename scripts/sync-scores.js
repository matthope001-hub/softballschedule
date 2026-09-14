// scripts/sync-scores.js — DEBUG VERSION
// Temporary: dumps raw row structure to diagnose parser mismatch.
// Replace with full version once structure is confirmed.

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const HTO_URL   = 'https://www.htosports.com/teams/default.asp?u=HCCS&s=softball&p=schedule&format=List&d=ALL';

async function fetchHTO() {
  console.log('Fetching:', HTO_URL);
  const res = await fetch(HTO_URL, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-CA,en;q=0.9',
      'Referer':         'https://www.htosports.com/',
      'Cache-Control':   'no-cache',
    }
  });
  if (!res.ok) throw new Error(`HTO fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  console.log(`Got ${html.length} chars`);
  return html;
}

async function main() {
  const html = await fetchHTO();
  const $ = cheerio.load(html);

  let rowCount = 0;
  $('tr').each((_, row) => {
    const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
    // Print all rows with 1–12 cells — covers date rows and game rows
    if (cells.length >= 1 && cells.length <= 12 && rowCount < 40) {
      console.log(`ROW [${cells.length}]:`, JSON.stringify(cells));
      rowCount++;
    }
  });
  console.log(`Total rows printed: ${rowCount}`);
}

main().catch(e => { console.error(e); process.exit(1); });
