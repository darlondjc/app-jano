import { linesFromItems, type PdfTextItem } from '@jano/import-file';

/** Lê o PDF no navegador e devolve as linhas de texto de todas as páginas. */
export async function linhasDoPdf(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'assets/pdf/pdf.worker.min.mjs',
    document.baseURI,
  ).href;
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;
  const linhas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const i of content.items) {
      if ('str' in i)
        items.push({
          str: i.str,
          x: i.transform[4],
          y: i.transform[5],
          width: i.width,
        });
    }
    linhas.push(...linesFromItems(items));
  }
  await task.destroy();
  return linhas;
}
