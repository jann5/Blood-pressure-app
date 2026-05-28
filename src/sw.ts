/// <reference lib="WebWorker" />

import { clientsClaim } from "workbox-core";
import { NavigationRoute, registerRoute } from "workbox-routing";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
};

type ReminderPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

const manifestEntries = self.__WB_MANIFEST;
precacheAndRoute(manifestEntries);

const hasIndexHtml = manifestEntries.some(
  (entry) =>
    typeof entry === "string"
      ? entry === "index.html" || entry.endsWith("/index.html")
      : entry.url === "index.html" || entry.url.endsWith("/index.html"),
);
if (hasIndexHtml) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));
}

self.addEventListener("push", (event) => {
  const defaultPayload: Required<ReminderPayload> = {
    title: "Przypomnienie",
    body: "Czas zmierzyć puls.",
    url: "/",
    tag: "daily-pulse-reminder",
  };

  let payload: Required<ReminderPayload> = defaultPayload;

  if (event.data) {
    try {
      const parsed = event.data.json() as ReminderPayload;
      payload = {
        title: parsed.title || defaultPayload.title,
        body: parsed.body || defaultPayload.body,
        url: parsed.url || defaultPayload.url,
        tag: parsed.tag || defaultPayload.tag,
      };
    } catch {
      const text = event.data.text();
      payload = {
        ...defaultPayload,
        body: text || defaultPayload.body,
      };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: {
        url: payload.url,
      },
      badge: "/icons/icon-192.png",
      icon: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = String(event.notification.data?.url || "/");

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsList) => {
        for (const client of clientsList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

export {};
