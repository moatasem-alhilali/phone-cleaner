export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const pushField = () => {
    currentRow.push(currentField);
    currentField = "";
  };

  const pushRow = () => {
    rows.push(currentRow);
    currentRow = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentField += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushField();
      continue;
    }

    if (char === "\n") {
      pushField();
      pushRow();
      continue;
    }

    if (char === "\r") {
      if (next === "\n") {
        continue;
      }
      pushField();
      pushRow();
      continue;
    }

    currentField += char;
  }

  pushField();
  pushRow();

  return rows.filter((row) => row.length > 1 || row[0]?.trim() !== "");
}

export function stringifyCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const needsQuotes = /[",\n\r]/.test(field);
          const escaped = field.replace(/"/g, '""');
          return needsQuotes ? `"${escaped}"` : escaped;
        })
        .join(",")
    )
    .join("\n");
}
