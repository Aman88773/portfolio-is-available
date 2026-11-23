"use strict";

const CACHE_NAME = "zhairem-taxi-v4";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("zhairem-taxi-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET")return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin)return;

  if(event.request.mode === "navigate"){
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          if(!response.ok)return response;
          const copy=response.clone();
          try{await caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy));}
          catch(error){console.error("Zhairem Taxi навигация кэштелмеді:",error);}
          return response;
        })
        .catch(async()=>{
          const cached=await caches.match(event.request)||await caches.match("./index.html")||await caches.match("./");
          return cached||new Response("Zhairem Taxi офлайн кэші қолжетімсіз. Интернетке қосылып, бетті қайта жүктеңіз.",{
            status:503,
            headers:{"Content-Type":"text/plain; charset=utf-8"}
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached)return cached;
      return fetch(event.request).then(async response=>{
        if(response.ok){
          const copy=response.clone();
          try{await caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
          catch(error){console.error("Zhairem Taxi ресурсы кэштелмеді:",error);}
        }
        return response;
      }).catch(()=>new Response("Бұл ресурс офлайн кэште жоқ.",{
        status:503,
        headers:{"Content-Type":"text/plain; charset=utf-8"}
      }));
    })
  );
});
