import { TestBed } from '@angular/core/testing';
import { JanoGoalBar } from './goal-bar';

function render(inputs: Record<string, unknown>): HTMLElement {
  const f = TestBed.createComponent(JanoGoalBar);
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
  f.detectChanges();
  return f.nativeElement;
}
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');

describe('JanoGoalBar', () => {
  it('Mercado 92%: âmbar com atenção', () => {
    const el = render({
      name: 'Mercado',
      spentCents: 82800,
      limitCents: 90000,
      pace: 0.87,
      daysLeft: 4,
    });
    expect(el.querySelector('.j-goal--warn')).toBeTruthy();
    expect(el.querySelector('.j-goal__pct')?.textContent).toBe('92%');
    expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
      'Atenção: restam 4 dias e R$ 72,00.',
    );
    expect(
      el.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'),
    ).toBe('92');
  });

  it('Lazer 124%: vermelho, barra limitada a 100% e percentual real', () => {
    const el = render({ name: 'Lazer', spentCents: 43400, limitCents: 35000 });
    expect(el.querySelector('.j-goal--over')).toBeTruthy();
    expect(el.querySelector('.j-goal__pct')?.textContent).toBe('124%');
    expect((el.querySelector('.j-goal__fill') as HTMLElement).style.width).toBe(
      '100%',
    );
    expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
      'Passou R$ 84,00 da meta.',
    );
    expect(el.querySelector('.j-goal__pace')).toBeNull();
  });

  it('Transporte 70%: verde e sobra', () => {
    const el = render({
      name: 'Transporte',
      spentCents: 28000,
      limitCents: 40000,
      pace: 0.87,
    });
    expect(el.querySelector('.j-goal--ok')).toBeTruthy();
    expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
      'No ritmo. Sobram R$ 120,00.',
    );
  });

  it('exatamente na meta: atenção, sem "passou -R$ 0,00"', () => {
    const el = render({
      name: 'Educação',
      spentCents: 145000,
      limitCents: 145000,
    });
    expect(el.querySelector('.j-goal--warn')).toBeTruthy();
    expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
      'No limite da meta: não sobra nada.',
    );
  });

  it('último dia do mês e marcador de ritmo dentro da barra', () => {
    const el = render({
      name: 'Moradia',
      spentCents: 270042,
      limitCents: 280000,
      pace: 1,
      daysLeft: 0,
    });
    expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
      'Atenção: último dia do mês e restam R$ 99,58.',
    );
    const marcador = el.querySelector('.j-goal__pace') as HTMLElement;
    expect(marcador.style.left).toBe('100%');
    expect(marcador.style.transform).toBe('translateX(-100%)');
  });
});

describe('JanoGoalBar: ritmo e contas do mês', () => {
  it('49% no dia 1: acima do ritmo, com quanto dá por dia', () => {
    const el = render({
      name: 'Mercado',
      spentCents: 69000,
      limitCents: 140000,
      pace: 1 / 30,
      daysLeft: 29,
    });
    expect(el.querySelector('.j-goal--warn')).toBeTruthy();
    expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
      'Acima do ritmo: para fechar na meta, até R$ 23,66 por dia.',
    );
  });

  it('perto do ritmo continua "No ritmo"', () => {
    const el = render({
      name: 'Farmácia',
      spentCents: 12075,
      limitCents: 20000,
      pace: 0.61,
      daysLeft: 12,
    });
    expect(el.querySelector('.j-goal--ok')).toBeTruthy();
  });

  it('contas do mês pagas: sem ritmo nem alerta de 100%', () => {
    const el = render({
      name: 'Educação',
      spentCents: 145000,
      limitCents: 145000,
      pace: 0.61,
      daysLeft: 12,
      conta: { esperadoCents: 145000, pagoCents: 145000, faltaCents: 0 },
    });
    expect(el.querySelector('.j-goal--ok')).toBeTruthy();
    expect(el.querySelector('.j-goal__pace')).toBeNull();
    expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
      'Contas do mês pagas. Sobram R$ 0,00.',
    );
  });

  it('conta ainda a pagar que vai passar da meta', () => {
    const el = render({
      name: 'Moradia',
      spentCents: 30000,
      limitCents: 250000,
      pace: 0.3,
      daysLeft: 20,
      conta: { esperadoCents: 270000, pagoCents: 30000, faltaCents: 240000 },
    });
    expect(el.querySelector('.j-goal--over')).toBeTruthy();
    expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
      'Falta pagar cerca de R$ 2.400,00; com isso passa R$ 200,00 da meta.',
    );
  });
});

it('a partir de 80% vale o aviso de atenção com dias e valor', () => {
  const el = render({
    name: 'Mercado',
    spentCents: 134860,
    limitCents: 140000,
    pace: 0.61,
    daysLeft: 12,
  });
  expect(norm(el.querySelector('.j-goal__state')?.textContent)).toBe(
    'Atenção: restam 12 dias e R$ 51,40.',
  );
});
