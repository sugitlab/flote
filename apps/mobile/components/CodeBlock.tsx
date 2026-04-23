import { ScrollView, Text, View, useColorScheme } from "react-native";
import { Highlight, themes } from "prism-react-renderer";
import { useSettingsStore, type DarkCodeTheme, type LightCodeTheme } from "../src/store/settingsStore";

function resolveDarkTheme(name: DarkCodeTheme) {
  switch (name) {
    case "dracula":  return themes.dracula;
    case "nightOwl": return themes.nightOwl;
    case "vsDark":   return themes.vsDark;
    default:         return themes.oneDark;
  }
}

function resolveLightTheme(name: LightCodeTheme) {
  switch (name) {
    case "oneLight":      return themes.oneLight;
    case "vsLight":       return themes.vsLight;
    case "solarizedLight": return themes.vsLight; // closest available
    default:              return themes.github;
  }
}

type Props = {
  code: string;
  language?: string;
};

export default function CodeBlock({ code, language }: Props) {
  const colorScheme = useColorScheme();
  const codeThemeDark = useSettingsStore((s) => s.codeThemeDark);
  const codeThemeLight = useSettingsStore((s) => s.codeThemeLight);
  const isDark = colorScheme === "dark";
  const theme = isDark ? resolveDarkTheme(codeThemeDark) : resolveLightTheme(codeThemeLight);
  const lang = (language ?? "text") as Parameters<typeof Highlight>[0]["language"];

  return (
    <View style={{ borderRadius: 8, overflow: "hidden", marginVertical: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: theme.plain.backgroundColor as string }}
        contentContainerStyle={{ padding: 14 }}
      >
        <Highlight theme={theme} code={code.trimEnd()} language={lang}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <View>
              {tokens.map((line, i) => {
                getLineProps({ line });
                return (
                  <View key={i} style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {line.map((token, key) => {
                      const tokenProps = getTokenProps({ token });
                      return (
                        <Text
                          key={key}
                          style={[
                            {
                              fontFamily: "monospace",
                              fontSize: 13,
                              lineHeight: 20,
                              color: theme.plain.color as string,
                            },
                            tokenProps.style as object,
                          ]}
                        >
                          {token.content}
                        </Text>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
        </Highlight>
      </ScrollView>
    </View>
  );
}
