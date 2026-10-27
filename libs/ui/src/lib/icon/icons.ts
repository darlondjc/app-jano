import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  CircleEllipsis,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  Music,
  PawPrint,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide';

/** [tag, atributos] — formato de dados dos ícones do Lucide (licença ISC). */
export type IconNode = readonly (readonly [
  string,
  Record<string, string | number>,
])[];

/** Ícones disponíveis para categorias. A chave (em português) é o que fica salvo. */
export const ICONS: Record<string, { label: string; node: IconNode }> = {
  casa: { label: 'Casa', node: House as IconNode },
  carrinho: { label: 'Carrinho', node: ShoppingCart as IconNode },
  compras: { label: 'Sacola', node: ShoppingBag as IconNode },
  talheres: { label: 'Talheres', node: Utensils as IconNode },
  cafe: { label: 'Café', node: Coffee as IconNode },
  carro: { label: 'Carro', node: Car as IconNode },
  combustivel: { label: 'Combustível', node: Fuel as IconNode },
  onibus: { label: 'Ônibus', node: Bus as IconNode },
  viagem: { label: 'Viagem', node: Plane as IconNode },
  saude: { label: 'Saúde', node: HeartPulse as IconNode },
  medico: { label: 'Médico', node: Stethoscope as IconNode },
  farmacia: { label: 'Farmácia', node: Pill as IconNode },
  academia: { label: 'Academia', node: Dumbbell as IconNode },
  cinema: { label: 'Cinema', node: Clapperboard as IconNode },
  jogos: { label: 'Jogos', node: Gamepad2 as IconNode },
  musica: { label: 'Música', node: Music as IconNode },
  assinatura: { label: 'Assinatura', node: Repeat as IconNode },
  internet: { label: 'Internet', node: Wifi as IconNode },
  celular: { label: 'Celular', node: Smartphone as IconNode },
  energia: { label: 'Energia', node: Zap as IconNode },
  educacao: { label: 'Educação', node: GraduationCap as IconNode },
  livros: { label: 'Livros', node: BookOpen as IconNode },
  roupa: { label: 'Roupa', node: Shirt as IconNode },
  beleza: { label: 'Beleza', node: Scissors as IconNode },
  pet: { label: 'Pet', node: PawPrint as IconNode },
  crianca: { label: 'Criança', node: Baby as IconNode },
  presente: { label: 'Presente', node: Gift as IconNode },
  doacao: { label: 'Doação', node: HandHeart as IconNode },
  manutencao: { label: 'Manutenção', node: Wrench as IconNode },
  seguro: { label: 'Seguro', node: Shield as IconNode },
  banco: { label: 'Impostos e taxas', node: Landmark as IconNode },
  recibo: { label: 'Recibo', node: Receipt as IconNode },
  trabalho: { label: 'Trabalho', node: Briefcase as IconNode },
  salario: { label: 'Salário', node: Banknote as IconNode },
  investimento: { label: 'Investimento', node: TrendingUp as IconNode },
  carteira: { label: 'Carteira', node: Wallet as IconNode },
  etiqueta: { label: 'Etiqueta', node: Tag as IconNode },
  outros: { label: 'Outros', node: CircleEllipsis as IconNode },
};

export const ICON_NAMES = Object.keys(ICONS);
export const DEFAULT_ICON = 'etiqueta';

const esc = (v: string | number) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

/** Conteúdo interno do <svg> do ícone (dados estáticos, nunca vindos do usuário). */
export function iconInnerSvg(name: string): string {
  const node = (ICONS[name] ?? ICONS[DEFAULT_ICON]).node;
  return node
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([k, v]) => `${k}="${esc(v)}"`)
          .join(' ')}/>`,
    )
    .join('');
}
