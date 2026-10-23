import {
  Armchair,
  ArrowDownUp,
  Banknote,
  Bitcoin,
  Car,
  Check,
  ChartPie,
  CreditCard,
  FileText,
  Flag,
  GraduationCap,
  Handshake,
  HeartPulse,
  House,
  Landmark,
  LifeBuoy,
  Package,
  Percent,
  PiggyBank,
  Scale,
  School,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sunrise,
  Target,
  TrendingUp,
  Umbrella,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';

/** 全 App 唯一的圖示集（Lucide 線條圖示，見 docs/06-visual-design.md） */
const ICONS = {
  // 分頁列
  netWorth: Wallet,
  cashflow: ArrowDownUp,
  portfolio: ChartPie,
  health: HeartPulse,
  plans: Flag,
  settings: Settings,
  // 資產與負債類別
  cash: Banknote,
  investment: TrendingUp,
  crypto: Bitcoin,
  retirement: Armchair,
  insurance: ShieldCheck,
  home: House,
  car: Car,
  receivable: Handshake,
  box: Package,
  bank: Landmark,
  creditCard: CreditCard,
  graduation: GraduationCap,
  family: Users,
  store: Store,
  document: FileText,
  // 計畫類型
  lifebuoy: LifeBuoy,
  sunrise: Sunrise,
  school: School,
  shopping: ShoppingBag,
  target: Target,
  // 健檢指標
  piggyBank: PiggyBank,
  percent: Percent,
  scale: Scale,
  umbrella: Umbrella,
  // 動作與狀態
  check: Check,
  close: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function isIconName(name: string | undefined): name is IconName {
  return !!name && name in ICONS;
}

/** 裝飾用圖示：一律 aria-hidden，意思由旁邊的文字表達 */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const C = ICONS[name];
  return <C size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" className="icon-svg" />;
}

/** 列表與選項用：淺綠圓底裡的圖示 */
export function IconBadge({ name }: { name: string | undefined }) {
  if (!isIconName(name)) return null;
  return (
    <span className="icon-badge" aria-hidden="true">
      <Icon name={name} size={20} />
    </span>
  );
}
