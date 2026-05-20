const { withInfoPlist, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const ACCENT_COLORS = ["cherry", "kiwi", "orange"];

// ── iOS ───────────────────────────────────────────────────────────────────────

function withIosAlternateIconPlist(config) {
  return withInfoPlist(config, (config) => {
    const alternateIcons = {};
    for (const color of ACCENT_COLORS) {
      const key = `AppIcon${capitalize(color)}`;
      alternateIcons[key] = {
        CFBundleIconFiles: [key],
        UIPrerenderedIcon: false,
      };
    }

    config.modResults.CFBundleIcons = {
      CFBundlePrimaryIcon: {
        CFBundleIconFiles: ["AppIcon"],
        UIPrerenderedIcon: false,
      },
      CFBundleAlternateIcons: alternateIcons,
    };

    return config;
  });
}

function withIosAlternateIconAssets(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const xcassetsDir = path.join(
        config.modRequest.platformProjectRoot,
        config.modResults.name,
        "Images.xcassets"
      );

      for (const color of ACCENT_COLORS) {
        const iconName = `AppIcon${capitalize(color)}`;
        const appiconsetDir = path.join(xcassetsDir, `${iconName}.appiconset`);
        fs.mkdirSync(appiconsetDir, { recursive: true });

        // Copy icon from docs/ to the appiconset
        const srcIcon = path.join(projectRoot, "..", "..", "docs", `flote-${color}.png`);
        const destIcon = path.join(appiconsetDir, `${color}.png`);
        if (fs.existsSync(srcIcon)) {
          fs.copyFileSync(srcIcon, destIcon);
        }

        // Write Contents.json
        const contents = {
          images: [
            {
              filename: `${color}.png`,
              idiom: "universal",
              platform: "ios",
              size: "1024x1024",
            },
          ],
          info: { version: 1, author: "expo" },
        };
        fs.writeFileSync(
          path.join(appiconsetDir, "Contents.json"),
          JSON.stringify(contents, null, 2)
        );
      }

      return config;
    },
  ]);
}

// ── Android ───────────────────────────────────────────────────────────────────

function withAndroidAlternateIconManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    // Move LAUNCHER intent off main activity onto Default alias (if not already done)
    const mainActivity = app.activity?.find(
      (a) => a.$["android:name"] === ".MainActivity"
    );
    if (mainActivity) {
      const intentFilters = mainActivity["intent-filter"] || [];
      const launcherFilter = intentFilters.find((f) =>
        f.action?.some((a) => a.$["android:name"] === "android.intent.action.MAIN")
      );
      if (launcherFilter) {
        mainActivity["intent-filter"] = intentFilters.filter((f) => f !== launcherFilter);
      }
    }

    // Add activity-alias entries (skip if already present)
    app["activity-alias"] = app["activity-alias"] || [];
    const existingAliases = new Set(
      app["activity-alias"].map((a) => a.$["android:name"])
    );

    const aliasEntries = [
      {
        name: ".MainActivityDefault",
        enabled: "true",
        icon: "@mipmap/ic_launcher",
        roundIcon: "@mipmap/ic_launcher_round",
      },
      ...ACCENT_COLORS.map((color) => ({
        name: `.MainActivity${capitalize(color)}`,
        enabled: "false",
        icon: `@mipmap/ic_launcher_${color}`,
        roundIcon: `@mipmap/ic_launcher_${color}`,
      })),
    ];

    for (const entry of aliasEntries) {
      if (!existingAliases.has(entry.name)) {
        app["activity-alias"].push({
          $: {
            "android:name": entry.name,
            "android:enabled": entry.enabled,
            "android:exported": "true",
            "android:icon": entry.icon,
            "android:roundIcon": entry.roundIcon,
            "android:targetActivity": ".MainActivity",
          },
          "intent-filter": [
            {
              action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
              category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
            },
          ],
        });
      }
    }

    return config;
  });
}

function withAndroidAlternateIconAssets(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res"
      );

      const sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
      };

      const { execFileSync } = require("child_process");

      for (const color of ACCENT_COLORS) {
        const srcIcon = path.join(projectRoot, "..", "..", "docs", `flote-${color}.png`);
        if (!fs.existsSync(srcIcon)) continue;

        for (const [mipmapDir, size] of Object.entries(sizes)) {
          const destDir = path.join(resDir, mipmapDir);
          fs.mkdirSync(destDir, { recursive: true });
          const destIcon = path.join(destDir, `ic_launcher_${color}.png`);
          try {
            execFileSync("sips", ["-z", String(size), String(size), srcIcon, "--out", destIcon]);
          } catch {
            fs.copyFileSync(srcIcon, destIcon);
          }
        }
      }

      return config;
    },
  ]);
}

// ── Plugin entry ──────────────────────────────────────────────────────────────

function withAlternateIcons(config) {
  config = withIosAlternateIconPlist(config);
  config = withIosAlternateIconAssets(config);
  config = withAndroidAlternateIconManifest(config);
  config = withAndroidAlternateIconAssets(config);
  return config;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = withAlternateIcons;
