export type Producto = {
  id: string;
  nombre: string;
  categoria: string;
  precio_cent: number;
  activo: boolean;
  orden: number;
};

export type PedidoItem = {
  nombre: string;
  precio_cent: number;
  qty: number;
};

export type Pedido = {
  id: string;
  codigo: string;
  mesa: string | null;
  items: PedidoItem[];
  total_cent: number;
  estado: "pendiente" | "pagado" | "canjeado" | "cancelado";
  metodo: string | null;
  payment_intent_id: string | null;
  creado_en: string;
  pagado_en: string | null;
  canjeado_en: string | null;
};

export type Config = {
  evento_nombre: string;
  subtitulo: string;
  logo_url: string | null;
  banner_url: string | null;
  color1: string;
  color2: string;
  fondo: string;
};

export const CONFIG_DEFECTO: Config = {
  evento_nombre: "Mi Fiesta",
  subtitulo: "Pide y recoge en barra",
  logo_url: null,
  banner_url: null,
  color1: "#FF2D78",
  color2: "#7C5CFF",
  fondo: "#0B0A0F",
};

export const euros = (cent: number) =>
  (cent / 100).toFixed(2).replace(".", ",") + " €";
