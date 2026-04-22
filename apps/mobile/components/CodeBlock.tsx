import { ScrollView, Text, View } from "react-native";
import { Highlight, themes } from "prism-react-renderer";
import { useSettingsStore, type CodeTheme } from "../src/store/settingsStore";

function resolveTheme(name: CodeTheme) {
  switch (name) {
    case "dracula":   return themes.dracula;
    case "nightOwl":  return themes.nightOwl;
    case "palenight": return themes.palenight;
    case "vsDark":    return themes.vsDark;
    case "github":    return themes.github;
    case "oneLight":  return themes.oneLight;
    case "vsLight":   return themes.vsLight;
    default:          return themes.oneDark;
  }
}

type Props = {
  code: string;
  language?: string;
};

export default function CodeBlock({ code, language }: Props) {
  const codeTheme = useSettingsStore((s) => s.codeTheme);
  const theme = resolveTheme(codeTheme);
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
