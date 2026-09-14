import React, { useEffect, useState } from "react";
import { Image, Platform, type ImageProps } from "react-native";
import { api } from "../../api/services";
import { resolveFileUrl } from "../../files/shareFile";

/** Browser images cannot send Authorization headers; fetch their protected bytes first. */
export function BlogImage({ url, ...props }: Omit<ImageProps, "source"> & { url: string }) {
  const protectedFile = /^\/api\/v1\/blogs\/files\/[a-f0-9]{24}\/preview$/.test(url);
  const [loaded, setLoaded] = useState<{ url: string; objectUrl: string } | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !protectedFile) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void api.transport.fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Unable to preview image");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ url, objectUrl });
    }).catch(() => { if (!controller.signal.aborted) setLoaded(null); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, protectedFile]);
  const source = protectedFile && Platform.OS === "web"
    ? (loaded?.url === url ? { uri: loaded.objectUrl } : undefined)
    : { uri: resolveFileUrl(url), ...(protectedFile ? { headers: { Authorization: "Bearer " + (api.getAccessToken() || "") } } : {}) };
  return <Image {...props} source={source} />;
}
