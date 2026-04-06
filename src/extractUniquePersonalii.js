const fs = require("fs");
const path = require("path");

// --- настройки ---
const INPUT_FILE = process.argv[2] || "cleanDataset.csv";
const OUTPUT_FILE = process.argv[3] || "uniquePersonalii.csv";
const COLUMN_NAME = "Персоналии";
const CSV_SEPARATOR = ";";
// -----------------

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === CSV_SEPARATOR && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Файл не найден: ${INPUT_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(INPUT_FILE, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim() !== "");

  if (lines.length === 0) {
    console.error("CSV-файл пустой.");
    process.exit(1);
  }

  // Парсим заголовок
  const headers = parseCSVLine(lines[0]);
  const colIndex = headers.indexOf(COLUMN_NAME);

  if (colIndex === -1) {
    console.error(`Колонка "${COLUMN_NAME}" не найдена.`);
    console.error("Доступные колонки:", headers.join(", "));
    process.exit(1);
  }

  console.log(`Найдена колонка "${COLUMN_NAME}" (индекс ${colIndex})`);
  console.log(`Обрабатываем ${lines.length - 1} строк...`);

  // Собираем уникальные значения
  const uniqueSet = new Set();
  let emptyCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const cellValue = cols[colIndex] || "";

    // Пропускаем пустые и nan
    if (!cellValue || cellValue.toLowerCase() === "nan") {
      emptyCount++;
      continue;
    }

    // Разбиваем по запятой и нормализуем каждый элемент
    const items = cellValue
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && s !== "nan");

    for (const item of items) {
      uniqueSet.add(item);
    }
  }

  // Сортируем по алфавиту
  const sorted = [...uniqueSet].sort((a, b) => a.localeCompare(b, "ru"));

  // Записываем в CSV
    const outputLines = ["Персоналии", ...sorted];
    const contentWithBOM = "\uFEFF" + outputLines.join("\n");
    fs.writeFileSync(OUTPUT_FILE, contentWithBOM, "utf-8");

  console.log(`\n Готово!`);
  console.log(`   Уникальных значений: ${sorted.length}`);
  console.log(`   Пропущено пустых/nan: ${emptyCount}`);
  console.log(`   Результат сохранён в: ${OUTPUT_FILE}`);
}

main();
