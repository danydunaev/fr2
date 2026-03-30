// ==================== CONSTANTS ====================

const CACHE_SHELL = 'app-shell-v1'; // Кэш для статических ресурсов (App Shell)
const CACHE_DYNAMIC = 'dynamic-content-v1'; // Кэш для динамический контента

// App Shell – статические ресурсы которые не меняются часто
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/icons/icon-16x16.png',
    '/icons/icon-32x32.png',
    '/icons/icon-48x48.png',
    '/icons/icon-64x64.png',
    '/icons/icon-128x128.png',
    '/icons/icon-152x152.png',
    '/icons/icon-180x180.png',
    '/icons/icon-192x192.png',
    '/icons/icon-256x256.png',
    '/icons/icon-512x512.png',
    '/icons/favicon.ico'
];

// ==================== INSTALL EVENT ====================

self.addEventListener('install', (event) => {
    console.log('[SW] 📦 Install event - кэширование App Shell');
    event.waitUntil(
        caches.open(CACHE_SHELL)
            .then((cache) => {
                console.log('[SW] 📦 Кэширую:', SHELL_ASSETS.length, 'файлов');
                return cache.addAll(SHELL_ASSETS);
            })
            .then(() => {
                console.log('[SW] ✅ App Shell кэширован успешно');
                return self.skipWaiting(); // Активируем сразу
            })
            .catch((err) => {
                console.error('[SW] ❌ Ошибка кэширования App Shell:', err);
            })
    );
});

// ==================== ACTIVATE EVENT ====================

self.addEventListener('activate', (event) => {
    console.log('[SW] 🔄 Activate event - очистка старых кэшей');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Удаляем старые версии кэшей
                        if (cacheName !== CACHE_SHELL && cacheName !== CACHE_DYNAMIC) {
                            console.log('[SW] 🗑️  Удаляю старый кэш:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] ✅ Старые кэши удалены');
                return self.clients.claim();
            })
    );
});

// ==================== FETCH EVENT ====================

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Пропускаем запросы к другим источникам (например cookies, analytics)
    if (url.origin !== location.origin) {
        console.log('[SW] ↗️  Пропускаю запрос к другому источнику:', url.origin);
        return;
    }

    // ========== СТРАТЕГИЯ 1: CACHE FIRST для App Shell (статические файлы) ==========
    if (SHELL_ASSETS.includes(url.pathname)) {
        console.log('[SW] 💾 CACHE FIRST (App Shell):', url.pathname);
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    return cachedResponse || fetch(event.request);
                })
                .catch(() => {
                    // Если и сеть и кэш недоступны, возвращаем главную страницу
                    return caches.match('/index.html');
                })
        );
        return;
    }

    // ========== СТРАТЕГИЯ 2: NETWORK FIRST для динамического контента ==========
    // Это нужно для страниц в папке /content/
    if (url.pathname.startsWith('/content/')) {
        console.log('[SW] 🌐 NETWORK FIRST (Dynamic):', url.pathname);
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Успешный ответ - кэшируем его
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_DYNAMIC)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    return networkResponse;
                })
                .catch((networkError) => {
                    console.log('[SW] ❌ Сеть недоступна, ищу в кэше:', url.pathname);
                    // Если сеть недоступна, берём из кэша
                    return caches.match(event.request)
                        .then((cachedResponse) => {
                            return cachedResponse || caches.match('/content/home.html');
                        });
                })
        );
        return;
    }

    // По умолчанию используем Network First для остального
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_DYNAMIC)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then((cached) => cached || caches.match('/index.html'));
            })
    );
});

// ==================== MESSAGE EVENT ====================

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ==================== PUSH EVENT ====================
// Обработка push-уведомлений

self.addEventListener('push', (event) => {
    console.log('[SW] 📬 Push событие получено');
    
    let data = {
        title: '📝 Shop Notes',
        body: 'Новое уведомление',
        reminderId: null
    };
    
    // Парсим payload если он есть
    if (event.data) {
        try {
            data = event.data.json();
        } catch (err) {
            console.error('[SW] ⚠️  Ошибка парсинга push payload:', err);
            data.body = event.data.text();
        }
    }
    
    // Настройки системного уведомления
    const options = {
        body: data.body || 'Новое сообщение',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-48x48.png',
        tag: data.reminderId ? 'reminder-' + data.reminderId : 'notification-' + Date.now(),
        requireInteraction: data.reminderId ? true : false,
        vibrate: [200, 100, 200],
        data: {
            reminderId: data.reminderId,
            timestamp: Date.now()
        }
    };
    
    // Добавляем кнопку "Отложить на 5 минут" только если это напоминание
    if (data.reminderId) {
        options.actions = [
            { action: 'snooze', title: 'Отложить на 5 минут', icon: '/icons/icon-192x192.png' },
            { action: 'dismiss', title: 'Закрыть' }
        ];
        options.silent = false;
    }
    
    // Показываем системное уведомление
    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => {
                console.log('[SW] ✅ Push уведомление показано:', data.title);
            })
            .catch(err => {
                console.error('[SW] ❌ Ошибка показа уведомления:', err);
            })
    );
});

// ==================== NOTIFICATION CLICK ====================
// Обработка клика по уведомлению (для браузеров, поддерживающих actions)

self.addEventListener('notificationclick', (event) => {
    const action = event.action;
    const reminderId = event.notification.data?.reminderId;
    
    console.log('[SW] 👆 Click по уведомлению:', { action, reminderId, tag: event.notification.tag });
    
    // Обработка действия "Отложить"
    if (action === 'snooze' && reminderId) {
        console.log('[SW] 💤 Пользователь нажал "Отложить" для напоминания:', reminderId);
        performSnooze(event, reminderId);
        return;
    }
    
    // Обработка действия "Закрыть"
    if (action === 'dismiss') {
        console.log('[SW] ❌ Пользователь закрыл уведомление');
        event.notification.close();
        return;
    }
    
    // Обработка клика на основное уведомление (для Safari, где нет действий)
    if (reminderId && !action) {
        console.log('[SW] 💤 Клик на напоминание (Safari) - откладываем');
        performSnooze(event, reminderId);
        return;
    }
    
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].url.includes('localhost:3002')) {
                        return clientList[i].focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Функция для откладывания напоминания с fallback на WebSocket
function performSnooze(event, reminderId) {
    event.notification.close();
    
    event.waitUntil(
        fetch(`https://localhost:3003/snooze?reminderId=${reminderId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        })
            .then(response => {
                console.log('[SW] 📊 HTTP ответ статус:', response.status);
                if (response.ok) {
                    console.log('[SW] ✅ Напоминание отложено на 5 минут (HTTP)');
                    return response.json();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            })
            .catch(err => {
                console.warn('[SW] ⚠️  HTTP не сработал, пытаемся WebSocket:', err.message);
                // Fallback: отправляем сообщение открытому клиенту
                return clients.matchAll({ type: 'window', includeUncontrolled: true })
                    .then(clientList => {
                        for (let client of clientList) {
                            if (client.url.includes('localhost:3002')) {
                                client.postMessage({
                                    type: 'SNOOZE_REMINDER',
                                    reminderId: reminderId
                                });
                                console.log('[SW] ✅ WebSocket fallback - сообщение отправлено клиенту');
                                return;
                            }
                        }
                        console.warn('[SW] ⚠️  Клиент не найден');
                    });
            })
    );
}