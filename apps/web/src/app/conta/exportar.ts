import type { DadosDoUsuario } from '@jano/data-access';

/** Reais com vírgula decimal e sinal, sem símbolo: "-1234,50". */
export function reais(cents: number): string {
  const sinal = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sinal}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

function celula(v: string, texto = true): string {
  // Evita que o Excel interprete texto como fórmula (o valor numérico fica como está).
  const seguro = texto && /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV das transações, no formato que o Excel brasileiro abre (separador ";"). */
export function transacoesCsv(dados: DadosDoUsuario): string {
  const nomeCategoria = new Map(
    dados.categories.map((c) => [c.id, String(c['name'] ?? c.id)]),
  );
  const nomeConta = new Map(
    dados.accounts.map((a) => [a.id, String(a['nickname'] ?? a.id)]),
  );
  const linhas = [
    ['Data', 'Descrição', 'Valor (R$)', 'Categoria', 'Conta', 'Transferência'],
  ];
  const ordenadas = [...dados.transactions].sort((a, b) =>
    String(b['date']).localeCompare(String(a['date'])),
  );
  for (const t of ordenadas) {
    const catId = t['categoryId'] as string | null;
    linhas.push([
      String(t['date']),
      String(t['description'] ?? ''),
      reais(Number(t['amountCents'])),
      catId ? (nomeCategoria.get(catId) ?? catId) : '',
      nomeConta.get(String(t['accountId'])) ?? '',
      t['isTransfer'] ? 'sim' : 'não',
    ]);
  }
  return (
    '﻿' +
    linhas
      .map((l) => l.map((v, i) => celula(v, i !== 2)).join(';'))
      .join('\r\n')
  );
}

/** Baixa um arquivo gerado no navegador. */
export function baixar(nome: string, conteudo: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
