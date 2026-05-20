import blueberryUrl from "../assets/icons/flote-blueberry.png";
import cherryUrl from "../assets/icons/flote-cherry.png";
import kiwiUrl from "../assets/icons/flote-kiwi.png";
import orangeUrl from "../assets/icons/flote-orange.png";
import { useUIStore } from "../store/uiStore";
import type { AccentColor } from "../store/uiStore";

const ICON_MAP: Record<AccentColor, string> = {
  blueberry: blueberryUrl,
  cherry: cherryUrl,
  kiwi: kiwiUrl,
  orange: orangeUrl,
};

type Props = {
  size?: number;
  className?: string;
};

export default function FloteLogo({ size = 20, className }: Props) {
  const accentColor = useUIStore((s) => s.accentColor);
  const src = ICON_MAP[accentColor];

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Flote"
      className={className}
      style={{ display: "block", flexShrink: 0, borderRadius: size * 0.18 }}
    />
  );
}
