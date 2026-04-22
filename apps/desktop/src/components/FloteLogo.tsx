import logoUrl from "../assets/logo.png";

type Props = {
  size?: number;
  className?: string;
};

export default function FloteLogo({ size = 20, className }: Props) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt="Flote"
      className={className}
      style={{ display: "block", flexShrink: 0, borderRadius: size * 0.18 }}
    />
  );
}
