import { TestBed } from '@angular/core/testing';
import type { CategoryDoc, TransactionDoc } from '@jano/data-access';
import { DetalheTransacao, TRANSFERENCIA, avisoDoSalvar } from './detalhe';
import { nomeSemPrefixo } from '@jano/import-file';

const tx: TransactionDoc = {
  id: 't1',
  accountId: 'conta',
  date: '2026-10-21',
  amountCents: -4200,
  description: 'Pix · Mercadinho Souza',
  descriptionNorm: 'PIX MERCADINHO SOUZA',
  dedupeKey: 'k',
  categoryId: null,
  categoryIsManual: false,
  isTransfer: false,
  importId: null,
};
const cats: CategoryDoc[] = [
  {
    id: 'mercado',
    name: 'Mercado',
    color: 'cat-3',
    icon: 'carrinho',
    type: 'despesa',
    position: 1,
  },
  {
    id: 'lazer',
    name: 'Lazer',
    color: 'cat-6',
    icon: 'jogos',
    type: 'despesa',
    position: 2,
  },
];

function montar(t = tx) {
  const f = TestBed.createComponent(DetalheTransacao);
  f.componentRef.setInput('tx', t);
  f.componentRef.setInput('categorias', cats);
  f.componentRef.setInput('conta', 'Conta corrente');
  f.detectChanges();
  const saidas: unknown[] = [];
  f.componentInstance.salvar.subscribe((v) => saidas.push(v));
  return { f, el: f.nativeElement as HTMLElement, saidas };
}

const botao = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find((b) =>
    b.textContent?.trim().startsWith(texto),
  ) as HTMLButtonElement;

const alterar = (
  f: { detectChanges(): void },
  el: HTMLElement,
  rotulo: string,
) => {
  (el.querySelector(`[aria-label="${rotulo}"]`) as HTMLButtonElement).click();
  f.detectChanges();
};

describe('DetalheTransacao', () => {
  it('só habilita Salvar depois de escolher algo', () => {
    const { f, el } = montar();
    expect(botao(el, 'Salvar').disabled).toBe(true);
    botao(el, 'Mercado').click();
    f.detectChanges();
    expect(botao(el, 'Salvar').disabled).toBe(false);
  });

  it('emite a categoria escolhida', () => {
    const { f, el, saidas } = montar();
    botao(el, 'Lazer').click();
    f.detectChanges();
    botao(el, 'Salvar').click();
    expect(saidas).toEqual([
      { escolha: 'lazer', regra: null, mudouCategoria: true },
    ]);
  });

  const marcar = (f: { detectChanges(): void }, el: HTMLElement, n: number) => {
    botao(el, n === 0 ? 'Passadas' : 'Futuras').click();
    f.detectChanges();
  };
  const trecho = (el: HTMLElement) =>
    el.querySelector('[aria-label="Trecho do nome"]') as HTMLInputElement;

  it('passadas e futuras com o trecho do nome', () => {
    const { f, el, saidas } = montar();
    botao(el, 'Mercado').click();
    f.detectChanges();
    expect(trecho(el)).toBeNull();
    marcar(f, el, 0);
    marcar(f, el, 1);
    // O trecho aparece como texto; o campo só abre em "Alterar".
    expect(trecho(el)).toBeNull();
    expect(el.querySelector('.regra .trecho')?.textContent).toContain(
      'PIX MERCADINHO SOUZA',
    );
    botao(el, 'Salvar').click();
    expect(saidas).toEqual([
      {
        escolha: 'mercado',
        mudouCategoria: true,
        regra: {
          pattern: 'PIX MERCADINHO SOUZA',
          categoryId: 'mercado',
          passadas: true,
          futuras: true,
        },
      },
    ]);
  });

  it('só as passadas, com trecho digitado à mão e normalizado', () => {
    const { f, el, saidas } = montar();
    botao(el, 'Mercado').click();
    f.detectChanges();
    marcar(f, el, 0);
    alterar(f, el, 'Alterar trecho da regra');
    (
      el.querySelector('[aria-label="Limpar trecho"]') as HTMLButtonElement
    ).click();
    f.detectChanges();
    expect(trecho(el).value).toBe('');
    expect(botao(el, 'Salvar').disabled).toBe(true);
    trecho(el).value = 'Mercadinho Souzá';
    trecho(el).dispatchEvent(new Event('input'));
    f.detectChanges();
    botao(el, 'Salvar').click();
    expect(saidas).toEqual([
      {
        escolha: 'mercado',
        mudouCategoria: true,
        regra: {
          pattern: 'MERCADINHO SOUZA',
          categoryId: 'mercado',
          passadas: true,
          futuras: false,
        },
      },
    ]);
  });

  it('na compra no débito, o trecho é a loja; só o prefixo não deixa salvar', () => {
    const { f, el } = montar({
      ...tx,
      description: 'COMPRA C/CARTAO 27/10 17:15 MATEUS SUPERM SAO LUIS',
      descriptionNorm: 'COMPRA C CARTAO 17 15 MATEUS SUPERM SAO LUIS',
    });
    botao(el, 'Mercado').click();
    f.detectChanges();
    marcar(f, el, 1);
    alterar(f, el, 'Alterar trecho da regra');
    expect(trecho(el).value).toBe('MATEUS SUPERM SAO LUIS');
    trecho(el).value = 'COMPRA C/CARTAO';
    trecho(el).dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(el.textContent).toContain('Inclua o nome da loja');
    expect(botao(el, 'Salvar').disabled).toBe(true);
  });

  it('copia o nome da transação', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { f, el } = montar();
    (
      el.querySelector('[aria-label="Copiar nome"]') as HTMLButtonElement
    ).click();
    await vi.waitFor(() => {
      f.detectChanges();
      expect(el.querySelector('[aria-label="Nome copiado"]')).not.toBeNull();
    });
    expect(writeText).toHaveBeenCalledWith('Pix · Mercadinho Souza');
  });

  it('aviso conta as passadas alteradas', () => {
    const r = { pattern: 'X', categoryId: 'c', passadas: true, futuras: true };
    expect(avisoDoSalvar(r, 3)).toBe(
      'Salvo: 3 transações passadas alteradas; as próximas com esse nome já chegam assim.',
    );
    expect(avisoDoSalvar({ ...r, futuras: false }, 1)).toBe(
      'Salvo: 1 transação passada alterada.',
    );
    expect(avisoDoSalvar(null, 0)).toBe('Salvo.');
  });

  it('transferência não oferece regra', () => {
    const { f, el, saidas } = montar();
    botao(el, 'Transferência').click();
    f.detectChanges();
    expect(el.querySelector('.regra')).toBeNull();
    botao(el, 'Salvar').click();
    expect(saidas).toEqual([
      { escolha: TRANSFERENCIA, regra: null, mudouCategoria: true },
    ]);
  });

  describe('dividir em categorias', () => {
    const campo = (el: HTMLElement, rotulo: string) =>
      el.querySelector(`[aria-label="${rotulo}"]`) as
        HTMLInputElement | HTMLSelectElement;
    const digitar = (
      f: ReturnType<typeof montar>['f'],
      c: HTMLInputElement | HTMLSelectElement,
      v: string,
    ) => {
      c.value = v;
      c.dispatchEvent(
        new Event(c instanceof HTMLSelectElement ? 'change' : 'input'),
      );
      f.detectChanges();
    };

    it('só salva quando as partes fecham o total, e mostra quanto falta', () => {
      const { f, el, saidas } = montar({ ...tx, categoryId: 'mercado' });
      botao(el, 'Dividir em categorias').click();
      f.detectChanges();
      digitar(f, campo(el, 'Valor 1'), '30,00');
      digitar(f, campo(el, 'Categoria 2'), 'lazer');
      expect(el.textContent).toMatch(/Faltam R\$\s12,00/);
      expect(botao(el, 'Salvar').disabled).toBe(true);
      digitar(f, campo(el, 'Valor 2'), '12,00');
      expect(el.textContent).toContain('As partes fecham o total.');
      botao(el, 'Salvar').click();
      expect(saidas).toEqual([
        {
          escolha: null,
          mudouCategoria: true,
          regra: null,
          divisao: [
            { categoryId: 'mercado', amountCents: -3000 },
            { categoryId: 'lazer', amountCents: -1200 },
          ],
        },
      ]);
    });

    it('entrada não pode ser dividida', () => {
      const { el } = montar({ ...tx, amountCents: 5000 });
      expect(botao(el, 'Dividir em categorias')).toBeUndefined();
    });

    it('lançamento dividido abre com as partes e pode desfazer', () => {
      const { f, el, saidas } = montar({
        ...tx,
        categoryId: 'mercado',
        categoryIsManual: true,
        splits: [
          { categoryId: 'mercado', amountCents: -3000 },
          { categoryId: 'lazer', amountCents: -1200 },
        ],
      });
      expect((campo(el, 'Valor 2') as HTMLInputElement).value).toBe('12,00');
      botao(el, 'Desfazer divisão').click();
      f.detectChanges();
      botao(el, 'Salvar').click();
      expect(saidas).toEqual([
        { escolha: 'mercado', regra: null, mudouCategoria: true },
      ]);
    });
  });
});

describe('nomeSemPrefixo', () => {
  it('tira operação, data e hora do banco', () => {
    expect(nomeSemPrefixo('COMPRA C/CARTAO 30/10 14:26 MO A MO')).toBe(
      'MO A MO',
    );
    expect(
      nomeSemPrefixo('PIX - ENVIADO 30/10 11:59 Diogo Duailibe da Silva'),
    ).toBe('Diogo Duailibe da Silva');
    expect(nomeSemPrefixo('MERCADOLIVRE*LOJA')).toBe('MERCADOLIVRE*LOJA');
    expect(nomeSemPrefixo('COMPRA C/CARTAO')).toBe('COMPRA C/CARTAO');
  });
});

describe('categorias no detalhe', () => {
  it('as do tipo do lançamento vêm primeiro e as de receita ficam verdes', () => {
    const f = TestBed.createComponent(DetalheTransacao);
    f.componentRef.setInput('tx', { ...tx, amountCents: 50000 });
    f.componentRef.setInput('categorias', [
      ...cats,
      {
        id: 'receita',
        name: 'Receita',
        color: 'cat-1',
        icon: 'salario',
        type: 'receita',
        position: 3,
      },
    ]);
    f.detectChanges();
    const chips = [
      ...(f.nativeElement as HTMLElement).querySelectorAll(
        '[aria-label="Categoria"] .j-chip',
      ),
    ];
    expect(chips[0].textContent?.trim()).toBe('Receita');
    expect(chips[0].classList).toContain('receita');
    expect(chips[1].classList).not.toContain('receita');
  });
});

describe('DetalheTransacao: apelido', () => {
  it('dá um apelido para as transações com o trecho, sem mexer na categoria', () => {
    const { f, el, saidas } = montar({
      ...tx,
      description: 'PIX - ENVIADO 10/10 08:30 JIM DAVI SILVA',
      descriptionNorm: 'PIX ENVIADO 08 30 JIM DAVI SILVA',
    });
    botao(el, 'Dar um apelido').click();
    f.detectChanges();
    const campo = el.querySelector('#apelido') as HTMLInputElement;
    campo.value = 'Academia';
    campo.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(el.querySelector('#apelido-trecho')).toBeNull();
    alterar(f, el, 'Alterar trecho do apelido');
    const trecho = el.querySelector('#apelido-trecho') as HTMLInputElement;
    trecho.value = 'jim davi';
    trecho.dispatchEvent(new Event('input'));
    f.detectChanges();
    botao(el, 'Salvar').click();
    expect(saidas).toEqual([
      expect.objectContaining({
        mudouCategoria: false,
        apelido: { pattern: 'JIM DAVI', apelido: 'Academia' },
      }),
    ]);
  });

  it('trecho genérico não deixa salvar', () => {
    const { f, el } = montar({
      ...tx,
      description: 'PIX - ENVIADO 10/10 08:30 JIM DAVI',
      descriptionNorm: 'PIX ENVIADO 08 30 JIM DAVI',
    });
    botao(el, 'Dar um apelido').click();
    f.detectChanges();
    const campo = el.querySelector('#apelido') as HTMLInputElement;
    campo.value = 'Academia';
    campo.dispatchEvent(new Event('input'));
    f.detectChanges();
    alterar(f, el, 'Alterar trecho do apelido');
    const trecho = el.querySelector('#apelido-trecho') as HTMLInputElement;
    trecho.value = 'PIX';
    trecho.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(botao(el, 'Salvar').disabled).toBe(true);
  });
});
