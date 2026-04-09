/**
 * compramis_sort.js
 * Сравнивает колонку "Персоналии" в двух CSV-файлах и создаёт файл-отчёт.
 *
 * Запуск: node compramis.js
 */

const fs = require('fs');
const path = require('path');

// ─── Конфигурация ────────────────────────────────────────────────────────────
const FILE1 = process.argv[2] || 'dataset_icons_NEW_2.csv';
const FILE2 = process.argv[3] || 'cleanDatasetV4.csv';
const OUTPUT = process.argv[4] || 'compramis.csv';
const SEPARATOR = ';'; // разделитель колонок
const LIST_SEP = ',';  // разделитель персоналий внутри ячейки
// ─────────────────────────────────────────────────────────────────────────────

/** Парсит CSV-строку с учётом кавычек. */
function parseCSVLine(line, sep) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === sep && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** Читает CSV-файл, возвращает { headers, rows: Map<id, row> }. */
function readCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8')
    .replace(/^\uFEFF/, '')   // убираем BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = raw.split('\n').filter(l => l.trim() !== '');
  const headers = parseCSVLine(lines[0], SEPARATOR);

  const idIdx = headers.indexOf('id');
  if (idIdx === -1) throw new Error(`Колонка 'id' не найдена в ${filePath}`);

  const rows = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], SEPARATOR);
    const id = cells[idIdx]?.trim();
    if (!id) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim(); });
    rows.set(id, row);
  }
  return { headers, rows };
}

/** Нормализует строку-список персоналий: токены в нижнем регистре, отсортированы. */
function normalizeList(str) {
  if (!str || str.trim() === '') return [];
  return str
    .split(LIST_SEP)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

/** Превращает массив обратно в строку. */
function joinList(arr) {
  return arr.join(', ');
}

/** Экранирует значение для CSV. */
function csvCell(val) {
  const s = String(val ?? '');
  if (s.includes(SEPARATOR) || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ─── Основная логика ─────────────────────────────────────────────────────────

const { headers: h1, rows: rows1 } = readCSV(FILE1);
const { headers: h2, rows: rows2 } = readCSV(FILE2);

const persCol = 'Персоналии';
if (!h1.includes(persCol)) throw new Error(`Колонка '${persCol}' не найдена в ${FILE1}`);
if (!h2.includes(persCol)) throw new Error(`Колонка '${persCol}' не найдена в ${FILE2}`);

// Сохраняем порядок id как в первом файле, затем добавляем id только из второго
const allIds = [
  ...[...rows1.keys()],
  ...[...rows2.keys()].filter(id => !rows1.has(id)),
];

const outHeaders = [
  'статус',
  'id',
  'персоналии_файл1',
  'персоналии_файл2',
  'добавлено',
  'удалено',
];

const resultRows = [];

for (const id of allIds) {
  const r1 = rows1.get(id);
  const r2 = rows2.get(id);

  const raw1 = r1 ? (r1[persCol] ?? '') : '';
  const raw2 = r2 ? (r2[persCol] ?? '') : '';

  const list1 = normalizeList(raw1);
  const list2 = normalizeList(raw2);

  const set1 = new Set(list1);
  const set2 = new Set(list2);

  const added   = list2.filter(x => !set1.has(x));
  const removed = list1.filter(x => !set2.has(x));

  const isEmpty1 = list1.length === 0;
  const isEmpty2 = list2.length === 0;

  let status;
  if (isEmpty1 && isEmpty2) {
    status = 'в обоих файлах';
  } else if (isEmpty1) {
    status = 'только в файле 2';
  } else if (isEmpty2) {
    status = 'только в файле 1';
  } else if (added.length === 0 && removed.length === 0) {
    status = 'в обоих файлах';
  } else {
    status = 'изменено';
  }

  resultRows.push({
    статус: status,
    id,
    персоналии_файл1: raw1,
    персоналии_файл2: raw2,
    добавлено: joinList(added),
    удалено: joinList(removed),
    _changed: status === 'изменено' || status.startsWith('только'),
  });
}

// ─── Запись результата ───────────────────────────────────────────────────────
const lines = [outHeaders.map(csvCell).join(SEPARATOR)];
for (const row of resultRows) {
  lines.push(outHeaders.map(h => csvCell(row[h])).join(SEPARATOR));
}
fs.writeFileSync(OUTPUT, '\uFEFF' + lines.join('\r\n'), 'utf-8');

// ─── Статистика ──────────────────────────────────────────────────────────────
const total      = resultRows.length;
const same       = resultRows.filter(r => r.статус === 'в обоих файлах').length;
const changed    = resultRows.filter(r => r.статус === 'изменено').length;
const onlyFile1  = resultRows.filter(r => r.статус === 'только в файле 1').length;
const onlyFile2  = resultRows.filter(r => r.статус === 'только в файле 2').length;

console.log(`\n✅ Готово! Файл сохранён: ${OUTPUT}`);
console.log(`\n📊 Статистика:`);
console.log(`   Всего строк:          ${total}`);
console.log(`   В обоих файлах:       ${same}`);
console.log(`   Изменено:             ${changed}`);
console.log(`   Только в файле 1:     ${onlyFile1}`);
console.log(`   Только в файле 2:     ${onlyFile2}`);
console.log('');
