// Los iconos de la aplicación.
//
// Antes eran emojis (🍳 💳 🍽️). Un emoji lo dibuja el sistema operativo, no
// nosotros: cambia de forma en cada aparato, se ve infantil en una pantalla de
// trabajo y no hay forma de que herede el color de lo que lo rodea. Estos son
// trazos, no pesan nada y toman el color del texto donde caen.

interface P {
  size?: number;
  className?: string;
}

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

/** Cocina: la llama del pase. */
export function IconCocina({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 2.5c.6 3-1.6 4.2-2.7 5.8A5.2 5.2 0 0 0 12 17a5.2 5.2 0 0 0 4.8-7.2C15.9 7.6 14 6.6 14 4c0 0-1 .8-2-1.5Z" />
      <path d="M7.5 20.5h9" />
    </svg>
  );
}

/** Caja: el datáfono por el que entra el dinero. */
export function IconCaja({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h3" />
    </svg>
  );
}

/** Salón: las mesas del local, vistas desde arriba. */
export function IconSalon({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

/** Administración: los mandos del local. */
export function IconAdmin({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 6h9M19 6h1M4 12h5M15 12h5M4 18h9M19 18h1" />
      <circle cx="16" cy="6" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="16" cy="18" r="2.2" />
    </svg>
  );
}

/** La carta del comensal. */
export function IconCarta({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 3h9a3 3 0 0 1 3 3v15H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

/** El reloj de la comanda: cuánto lleva esperando. */
export function IconReloj({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Hecho. */
export function IconCheck({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  );
}

/** Avanzar al siguiente paso. */
export function IconFlecha({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Volver un paso atrás. */
export function IconVolver({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

/** La nota que el comensal escribió con su pedido. */
export function IconNota({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 4h16v11l-5 5H4z" />
      <path d="M20 15h-5v5" />
      <path d="M8 8.5h8M8 12h5" />
    </svg>
  );
}

/** El aviso sonoro de comanda nueva. */
export function IconSonido({ size = 20, className, off }: P & { off?: boolean }) {
  return (
    <svg {...base(size, className)}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {off ? (
        <path d="M16 9.5 21 14.5M21 9.5l-5 5" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
      )}
    </svg>
  );
}

/** Cancelar. */
export function IconEquis({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Buscar un plato en una carta de 113. */
export function IconBuscar({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

/** Uno más. */
export function IconMas({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Uno menos. */
export function IconMenos({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 12h14" />
    </svg>
  );
}

/** El carrito del comensal. */
export function IconCarrito({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h7.4a2 2 0 0 0 2-1.6L20 8H6" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </svg>
  );
}

/** Borrar. */
export function IconPapelera({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/** Editar / lápiz. */
export function IconLapiz({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="M14.5 5.5 18.5 9.5" />
    </svg>
  );
}

/** La carta: platos y categorías. */
export function IconPlato({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

/** El dinero del local: números de Yape/Plin y PINes. */
export function IconDinero({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11M14.8 9.2A2.8 2.8 0 0 0 12 8c-1.5 0-2.8.9-2.8 2s1.3 2 2.8 2 2.8.9 2.8 2-1.3 2-2.8 2a2.8 2.8 0 0 1-2.8-1.2" />
    </svg>
  );
}

/** La marca del local: su color y su logo. */
export function IconMarca({ size = 20, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.5-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z" />
      <circle cx="7.5" cy="11.5" r="1.2" />
      <circle cx="12" cy="7.5" r="1.2" />
      <circle cx="16.5" cy="11" r="1.2" />
    </svg>
  );
}
