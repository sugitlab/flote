import { useState, useEffect } from "react";

type Status = "loading" | "latest" | "update-available" | "error";

function compareVersions(current: string, latest: string): "latest" | "update-available" {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [cMaj, cMin, cPatch] = parse(current);
  const [lMaj, lMin, lPatch] = parse(latest);
  if (lMaj > cMaj) return "update-available";
  if (lMaj === cMaj && lMin > cMin) return "update-available";
  if (lMaj === cMaj && lMin === cMin && lPatch > cPatch) return "update-available";
  return "latest";
}

export function useLatestVersion(currentVersion: string) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!currentVersion) return;
    const controller = new AbortController();
    fetch("https://api.github.com/repos/sugitlab/flote/releases/latest", {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => r.json())
      .then((data) => {
        const tag: string = data.tag_name ?? "";
        const cleaned = tag.replace(/^v/, "");
        setStatus(compareVersions(currentVersion, cleaned));
      })
      .catch(() => setStatus("error"));
    return () => controller.abort();
  }, [currentVersion]);

  const releasesUrl = "https://github.com/sugitlab/flote/releases/latest";

  return { status, releasesUrl };
}
