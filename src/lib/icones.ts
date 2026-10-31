// Ícone de cada tela do menu (lucide-react funciona no servidor e no navegador).
import {
  ArrowLeftRight,
  ClipboardList,
  History,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
  ScanLine,
  Truck,
  Users,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";

const ICONES: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/itens": Package,
  "/pedidos": ClipboardList,
  "/emprestimos": ArrowLeftRight,
  "/contagens": ScanLine,
  "/romaneios": Truck,
  "/movimentacoes": History,
  "/enderecos": MapPin,
  "/usuarios": Users,
  "/relatorios": FileSpreadsheet,
  "/menu": LayoutGrid,
};

export function iconeDe(href: string): LucideIcon {
  return ICONES[href] ?? LayoutGrid;
}

