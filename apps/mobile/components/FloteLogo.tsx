import { Image } from "react-native";
import { useSettingsStore } from "../src/store/settingsStore";
import type { AccentColor } from "../src/store/settingsStore";

const ICON_MAP: Record<AccentColor, ReturnType<typeof require>> = {
  blueberry: require("../assets/flote-blueberry.png"),
  cherry:    require("../assets/flote-cherry.png"),
  kiwi:      require("../assets/flote-kiwi.png"),
  orange:    require("../assets/flote-orange.png"),
};

type Props = {
  size?: number;
};

export default function FloteLogo({ size = 28 }: Props) {
  const accentColor = useSettingsStore((s) => s.accentColor);
  return (
    <Image
      source={ICON_MAP[accentColor]}
      style={{ width: size, height: size, borderRadius: size * 0.18 }}
      resizeMode="cover"
    />
  );
}
