/** Pedaço de texto de uma página de PDF, com posição (origem embaixo à esquerda). */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Reconstrói as linhas de uma página: itens na mesma altura (tolerância de 2,5 pt) viram uma
 * linha, da esquerda para a direita; as linhas vêm de cima para baixo. Colunas separadas
 * por espaço largo ficam com dois espaços entre elas.
 */
export function linesFromItems(items: PdfTextItem[]): string[] {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - item.y) <= 2.5);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      let line = '';
      let prevEnd: number | null = null;
      for (const it of sorted) {
        if (prevEnd !== null) {
          const gap = it.x - prevEnd;
          line +=
            gap > 4
              ? '  '
              : gap > 0.5 && !line.endsWith(' ') && !it.str.startsWith(' ')
                ? ' '
                : '';
        }
        line += it.str.trim() === it.str ? it.str : it.str.trim();
        prevEnd = it.x + it.width;
      }
      return line.trim();
    });
}
