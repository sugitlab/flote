import { Image } from "react-native";

type Props = {
  size?: number;
};

export default function FloteLogo({ size = 28 }: Props) {
  return (
    <Image
      source={require("../assets/logo.png")}
      style={{ width: size, height: size, borderRadius: size * 0.18 }}
      resizeMode="cover"
    />
  );
}
