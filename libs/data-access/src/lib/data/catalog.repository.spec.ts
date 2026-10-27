import { missingDefaults, uniqueCategoryId } from './catalog.repository';
import { DEFAULT_CATEGORIES, slugify, type CategoryDoc } from './models';

const cat = (id: string, position: number): CategoryDoc => ({
  id,
  name: id,
  color: 'cat-1',
  icon: 'etiqueta',
  type: 'despesa',
  position,
});

describe('uniqueCategoryId', () => {
  it('usa o slug do nome', () =>
    expect(uniqueCategoryId('Saúde', new Set())).toBe('saude'));
  it('numera quando já existe', () => {
    expect(uniqueCategoryId('Saúde', new Set(['saude', 'saude-2']))).toBe(
      'saude-3',
    );
  });
});

describe('missingDefaults', () => {
  it('sem nada existente devolve todas', () => {
    expect(missingDefaults([])).toHaveLength(DEFAULT_CATEGORIES.length);
  });
  it('não ressuscita as que já existem e continua a posição', () => {
    const r = missingDefaults([cat('mercado', 4), cat('moradia', 7)]);
    expect(r.find((c) => slugify(c.name) === 'mercado')).toBeUndefined();
    expect(r).toHaveLength(DEFAULT_CATEGORIES.length - 2);
    expect(r[0].position).toBe(8);
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('ids únicos e todos com ícone', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => slugify(c.name));
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_CATEGORIES.every((c) => c.icon)).toBe(true);
  });
});
