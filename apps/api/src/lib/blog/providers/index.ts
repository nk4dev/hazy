import { microcmsAdapter } from "./microcms";
import { qiitaAdapter } from "./qiita";
import type { BlogProvider, BlogProviderAdapter } from "./types";
import { zennAdapter } from "./zenn";

const REGISTRY: Record<BlogProvider, BlogProviderAdapter> = {
  microcms: microcmsAdapter,
  qiita: qiitaAdapter,
  zenn: zennAdapter,
};

export function getBlogProvider(provider: BlogProvider): BlogProviderAdapter {
  return REGISTRY[provider];
}
