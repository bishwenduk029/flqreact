import mitt from "mitt";

const dev = process.env.NODE_ENV !== "production";

export default class PageLoader {
  constructor(initialPage) {
    this.pageCache = {};

    // These two pages are always loaded at first.
    this.loadingRoutes = {
      "/_app": true,
      [initialPage]: true,
    };

    this.pageRegisterEvents = mitt();
  }

  async registerPage(route) {
    const [pageName, fn] = route;
    const pagePath = pageName.replace(/^pages/, "");

    try {
      const mod = fn();
      const component = mod.default || mod;

      this.pageCache[pagePath] = component;
      this.pageRegisterEvents.emit(pagePath, component);
    } catch (e) {
      console.error(`Error loading page: ${pagePath}`, e);
    }
  }

  loadPage(route) {
    return new Promise((resolve) => {
      if (this.pageCache[route]) {
        return resolve(this.pageCache[route]);
      }

      const load = (page) => {
        this.pageRegisterEvents.off(route, load);
        delete this.loadingRoutes[route];
        resolve(page);
      };

      this.pageRegisterEvents.on(route, load);

      if (!this.loadingRoutes[route]) {
        this.loadingRoutes[route] = true;

        const prefix = dev ? "pages" : "_flareact/static/pages";

        this.loadScript(prefix + route + `.js`);
      }
    });
  }

  prefetchData(route) {
    const url = getPagePropsUrl(route);

    this.loadPrefetch(url, "script");
  }

  loadScript(path) {
    const prefix =
      process.env.NODE_ENV === "production" ? "/" : "http://localhost:8080/";
    const url = prefix + path;

    if (document.querySelector(`script[src^="${url}"]`)) return;

    const script = document.createElement("script");
    script.src = url;
    document.body.appendChild(script);
  }

  loadPrefetch(path, as) {
    return new Promise((resolve, reject) => {
      if (
        document.querySelector(`link[rel="${relPrefetch}"][href^="${path}"]`)
      ) {
        return resolve();
      }

      const link = document.createElement("link");
      link.rel = relPrefetch;
      link.href = path;
      link.as = as;
      link.onload = resolve;
      link.onerror = reject;

      document.head.appendChild(link);
    });
  }
}

export function getPagePropsUrl(pagePath) {
  return `/_flareact/props${pagePath}.json`;
}

/**
 * Borrowed from Next.js
 */
function hasRel(rel, link) {
  try {
    link = document.createElement("link");
    return link.relList.supports(rel);
  } catch {}
}

/**
 * Borrowed from Next.js
 */
const relPrefetch =
  hasRel("preload") && !hasRel("prefetch")
    ? // https://caniuse.com/#feat=link-rel-preload
      // macOS and iOS (Safari does not support prefetch)
      "preload"
    : // https://caniuse.com/#feat=link-rel-prefetch
      // IE 11, Edge 12+, nearly all evergreen
      "prefetch";
