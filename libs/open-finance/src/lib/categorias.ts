/**
 * Tradução das categorias da Pluggy e dos códigos de ramo (MCC) para as categorias padrão
 * do Jano (pelo nome; `categorizar` acha a categoria pelo nome ou pelo id).
 * Árvore da Pluggy: https://docs.pluggy.ai/en/docs/products/transaction-categorization
 */

/** Categorias da Pluggy que são dinheiro mudando de lugar: ficam fora dos totais. */
const TRANSFERENCIAS = new Set([
  'Same person transfer',
  'Same person transfer - Cash',
  'Same person transfer - PIX',
  'Same person transfer - TED',
  'Credit card payment',
  'Investments',
  'Automatic investment',
  'Fixed income',
  'Mutual funds',
  'Variable income',
  'Margin',
  'Pension',
]);

/** Folhas e ramos da árvore da Pluggy → categoria do Jano. O que não está aqui fica sem. */
const PLUGGY: Record<string, string> = {
  Income: 'Receita',
  Salary: 'Receita',
  Retirement: 'Receita',
  'Entrepreneurial activities': 'Receita',
  'Government aid': 'Receita',
  'Non-recurring income': 'Receita',
  'Proceeds interests and dividends': 'Rendimentos',
  'Late payment and overdraft costs': 'Impostos e taxas',
  'Interests charged': 'Impostos e taxas',
  'Real estate financing': 'Moradia',
  'Vehicle Financing': 'Transporte',
  'Student loan': 'Educação',
  Telecommunications: 'Celular e internet',
  Internet: 'Celular e internet',
  Mobile: 'Celular e internet',
  TV: 'Celular e internet',
  Education: 'Educação',
  'Online Courses': 'Educação',
  University: 'Educação',
  School: 'Educação',
  Kindergarten: 'Educação',
  'Wellness and fitness': 'Academia',
  'Gyms and fitness centers': 'Academia',
  'Sports practice': 'Academia',
  Wellness: 'Beleza e cuidados',
  Tickets: 'Lazer',
  'Stadiums and arenas': 'Lazer',
  'Landmarks and museums': 'Lazer',
  'Cinema, theater and concerts': 'Lazer',
  Shopping: 'Compras',
  'Online shopping': 'Compras',
  Electronics: 'Compras',
  'Pet supplies and vet': 'Pets',
  Clothing: 'Vestuário',
  'Kids and toys': 'Filhos',
  Bookstore: 'Compras',
  'Sports goods': 'Compras',
  'Office Supplies': 'Compras',
  'Digital services': 'Assinaturas',
  Gaming: 'Lazer',
  'Video streaming': 'Assinaturas',
  'Music streaming': 'Assinaturas',
  Groceries: 'Mercado',
  'Food and drinks': 'Restaurantes',
  'Eating out': 'Restaurantes',
  'Food delivery': 'Restaurantes',
  Travel: 'Viagens',
  'Airport and airlines': 'Viagens',
  Accommodation: 'Viagens',
  'Mileage programs': 'Viagens',
  'Bus tickets': 'Viagens',
  Donations: 'Presentes e doações',
  Gambling: 'Lazer',
  Lottery: 'Lazer',
  'Online bet': 'Lazer',
  Taxes: 'Impostos e taxas',
  'Income taxes': 'Impostos e taxas',
  'Taxes on investments': 'Impostos e taxas',
  'Tax on financial operations': 'Impostos e taxas',
  'Bank fees': 'Impostos e taxas',
  'Account fees': 'Impostos e taxas',
  'Wire transfer fees and ATM fees': 'Impostos e taxas',
  'Credit card fees': 'Impostos e taxas',
  Housing: 'Moradia',
  Rent: 'Moradia',
  Houseware: 'Casa e manutenção',
  'Urban land and building tax': 'Moradia',
  Utilities: 'Moradia',
  Water: 'Moradia',
  Electricity: 'Moradia',
  Gas: 'Moradia',
  Healthcare: 'Saúde',
  Dentist: 'Saúde',
  Pharmacy: 'Farmácia',
  Optometry: 'Saúde',
  'Hospital clinics and labs': 'Saúde',
  Transportation: 'Transporte',
  'Taxi and ride-hailing': 'Transporte',
  'Public transportation': 'Transporte',
  'Car rental': 'Transporte',
  Bicycle: 'Transporte',
  Automotive: 'Transporte',
  'Gas stations': 'Combustível',
  Parking: 'Transporte',
  'Tolls and in-vehicle payment': 'Transporte',
  'Vehicle ownership taxes and fees': 'Transporte',
  'Vehicle maintenance': 'Transporte',
  'Traffic tickets': 'Transporte',
  Insurance: 'Seguros',
  'Life insurance': 'Seguros',
  'Home Insurance': 'Seguros',
  'Health insurance': 'Seguros',
  'Vehicle insurance': 'Seguros',
  Leisure: 'Lazer',
};

export interface CategoriaSugerida {
  /** Nome de uma categoria padrão do Jano. */
  nome?: string;
  /** Transferência entre contas próprias, aplicação ou pagamento de fatura. */
  transferencia?: boolean;
}

/** Categoria do categorizador da Pluggy (campo `category`) no vocabulário do Jano. */
export function deCategoriaPluggy(
  category: string | null | undefined,
): CategoriaSugerida {
  if (!category) return {};
  if (TRANSFERENCIAS.has(category)) return { transferencia: true };
  const nome = PLUGGY[category];
  return nome ? { nome } : {};
}

/** Faixas de MCC (código de ramo da bandeira do cartão) → categoria do Jano. */
const MCC: [number, number, string][] = [
  [742, 742, 'Pets'],
  [1520, 1799, 'Casa e manutenção'],
  [3000, 3350, 'Viagens'], // companhias aéreas
  [3351, 3500, 'Transporte'], // locadoras de carro
  [3501, 3999, 'Viagens'], // hotéis
  [4111, 4131, 'Transporte'],
  [4511, 4511, 'Viagens'],
  [4722, 4722, 'Viagens'],
  [4784, 4784, 'Transporte'], // pedágio
  [4812, 4816, 'Celular e internet'],
  [4899, 4899, 'Celular e internet'],
  [4900, 4900, 'Moradia'],
  [5200, 5200, 'Casa e manutenção'],
  [5211, 5261, 'Casa e manutenção'],
  [5310, 5399, 'Compras'],
  [5411, 5411, 'Mercado'],
  [5422, 5451, 'Mercado'],
  [5462, 5462, 'Restaurantes'], // padarias
  [5499, 5499, 'Mercado'],
  [5532, 5533, 'Transporte'],
  [5541, 5542, 'Combustível'],
  [5611, 5699, 'Vestuário'],
  [5712, 5719, 'Casa e manutenção'],
  [5722, 5722, 'Casa e manutenção'],
  [5732, 5734, 'Compras'],
  [5811, 5814, 'Restaurantes'],
  [5815, 5818, 'Assinaturas'], // bens digitais
  [5912, 5912, 'Farmácia'],
  [5940, 5949, 'Compras'],
  [5964, 5964, 'Compras'],
  [5977, 5977, 'Beleza e cuidados'],
  [5983, 5983, 'Combustível'],
  [5995, 5995, 'Pets'],
  [5999, 5999, 'Compras'],
  [6300, 6300, 'Seguros'],
  [7011, 7011, 'Viagens'],
  [7230, 7230, 'Beleza e cuidados'],
  [7297, 7298, 'Beleza e cuidados'],
  [7512, 7512, 'Transporte'],
  [7523, 7523, 'Transporte'], // estacionamento
  [7531, 7549, 'Transporte'], // oficinas e lava-rápido
  [7832, 7832, 'Lazer'],
  [7922, 7922, 'Lazer'],
  [7941, 7941, 'Academia'],
  [7991, 7996, 'Lazer'],
  [7997, 7997, 'Academia'],
  [7999, 7999, 'Lazer'],
  [8011, 8099, 'Saúde'],
  [8211, 8299, 'Educação'],
  [8351, 8351, 'Educação'],
  [8398, 8398, 'Presentes e doações'],
  [8661, 8661, 'Presentes e doações'],
  [9311, 9399, 'Impostos e taxas'],
];

/** Categoria pelo ramo do estabelecimento (MCC), que vem nas compras do cartão. */
export function deMcc(mcc: number | null | undefined): string | undefined {
  if (!mcc) return undefined;
  return MCC.find(([de, ate]) => mcc >= de && mcc <= ate)?.[2];
}
