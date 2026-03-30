// ==================== ИНИЦИАЛИЗАЦИЯ ==================== 
const appContent = document.getElementById('app-content');
const homeTab = document.getElementById('home-tab');
const aboutTab = document.getElementById('about-tab');
const statusIndicator = document.getElementById('status-indicator');

// Обработка сообщений от Service Worker (для Safari fallback и offline откладывания)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SNOOZE_REMINDER') {
            const reminderId = event.data.reminderId;
            console.log('[App] 💤 Получено от SW: откладываем напоминание', reminderId);
            socket.emit('snoozeReminder', { reminderId });
            showNotification('⏰ Напоминание отложено на 5 минут');
        }
    });
}

// ==================== WEBSOCKET (SOCKET.IO) ====================
// Подключаемся к сервету через Socket.IO (работает на порту 3003 с HTTPS)
console.log('[Socket.IO] 🚀 Инициализация подключения к https://localhost:3003');

const socket = io('https://localhost:3003', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    secure: true,
    rejectUnauthorized: false
});

socket.on('connect', () => {
    console.log('[Socket.IO] ✅ Подключено к серверу:', socket.id);

    // После переподключения сервер может быть перезапущен и потерять подписки в памяти
    resyncExistingSubscriptionToServer();
});

socket.on('disconnect', () => {
    console.log('[Socket.IO] 🔴 Отключено от сервера');
});

socket.on('connect_error', (error) => {
    console.error('[Socket.IO] ❌ Ошибка подключения:', error.message || error);
    console.error('[Socket.IO] 🔍 Тип ошибки:', error);
});

socket.on('error', (error) => {
    console.error('[Socket.IO] ❌ Ошибка Socket.IO:', error);
});

socket.on('reconnect_attempt', () => {
    console.log('[Socket.IO] 🔄 Попытка переподключения...');
});

socket.on('remindersSnapshot', (snapshot) => {
    if (!Array.isArray(snapshot)) return;

    let addedCount = 0;
    snapshot.forEach((reminder) => {
        if (!notes.find(n => n.id === reminder.id)) {
            notes.push({
                id: reminder.id,
                text: reminder.text,
                reminder: reminder.reminder || null
            });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        saveNotes();
        const container = document.getElementById('notes-list-container');
        if (container) {
            renderNotes();
        }
        console.log(`[Socket.IO] 🔄 Досинхронизация напоминаний: добавлено ${addedCount}`);
    }
});

socket.on('taskAdded', (task) => {
    console.log('[Socket.IO] 📨 Получена задача от другого клиента:', task);
    
    // Проверяем, есть ли уже такая заметка
    if (!notes.find(n => n.id === task.id)) {
        const newNote = {
            id: task.id,
            text: task.text,
            reminder: null
        };
        notes.push(newNote);
        saveNotes();
        
        // Обновляем отображение если мы на странице заметок
        const container = document.getElementById('notes-list-container');
        if (container) {
            renderNotes();
            console.log('[Socket.IO] ✅ Заметка добавлена в список');
        }
    }
    
    showNotification(`📝 Новая задача: ${task.text}`);
});

socket.on('taskDeleted', (task) => {
    console.log('[Socket.IO] 📨 Получено событие удаления:', task);
    
    // Удаляем заметку из списка
    const noteIndex = notes.findIndex(n => n.id === task.id);
    if (noteIndex !== -1) {
        notes.splice(noteIndex, 1);
        saveNotes();
        
        // Обновляем отображение если мы на странице заметок
        const container = document.getElementById('notes-list-container');
        if (container) {
            renderNotes();
            console.log('[Socket.IO] ✅ Заметка удалена из списка');
        }
    }
    
    showNotification(`🗑️ Задача удалена: ${task.text}`);
});

socket.on('reminderAdded', (reminder) => {
    console.log('[Socket.IO] 📨 Получено напоминание от другого клиента:', reminder);

    // Не дублируем заметку, если она уже есть локально
    if (!notes.find(n => n.id === reminder.id)) {
        const newNote = {
            id: reminder.id,
            text: reminder.text,
            reminder: reminder.reminder || null
        };
        notes.push(newNote);
        saveNotes();

        const container = document.getElementById('notes-list-container');
        if (container) {
            renderNotes();
            console.log('[Socket.IO] ✅ Напоминание добавлено в список');
        }
    }
});

socket.on('reminderRescheduled', (data) => {
    console.log('[Socket.IO] 🔄 Напоминание отложено, обновляю время:', data);

    if (!data || !data.id || !data.reminder) return;

    const noteIndex = notes.findIndex((n) => String(n.id) === String(data.id));
    if (noteIndex !== -1) {
        notes[noteIndex].reminder = data.reminder;
        saveNotes();

        const container = document.getElementById('notes-list-container');
        if (container) {
            renderNotes();
        }
    }
});

socket.on('snoozeSuccess', (data) => {
    console.log('[Socket.IO] ✅ Сарвер подтвердил откладывание:', data);
    showNotification(data.message);
});

socket.on('snoozeError', (data) => {
    console.error('[Socket.IO] ❌ Ошибка откладывания:', data);
    showNotification('⚠️ Ошибка при откладывании');
});

socket.on('reminderDue', (data) => {
    const reminderId = data?.id;
    const text = data?.text || 'Напоминание';
    console.log('[Socket.IO] ⏰ Получено напоминание (fallback):', data);
    showNotification(`⏰ Напоминание: ${text}`);

    // Визуальный fallback с возможностью отложить на 5 минут
    setTimeout(() => {
        const shouldSnooze = confirm(`⏰ Напоминание\n\n${text}\n\nНажмите OK, чтобы отложить на 5 минут.`);
        if (shouldSnooze && reminderId) {
            socket.emit('snoozeReminder', { reminderId });
            showNotification('⏳ Запрос на откладывание отправлен');
        }
    }, 50);
});

// ==================== PUSH УВЕДОМЛЕНИЯ ====================

let cachedVapidPublicKey = null;

async function getVapidPublicKey() {
    if (cachedVapidPublicKey) return cachedVapidPublicKey;

    const response = await fetch('https://localhost:3003/server-info');
    if (!response.ok) {
        throw new Error(`Не удалось получить server-info: ${response.status}`);
    }

    const data = await response.json();
    if (!data?.vapidPublicKey) {
        throw new Error('Сервер не вернул vapidPublicKey');
    }

    cachedVapidPublicKey = data.vapidPublicKey;
    return cachedVapidPublicKey;
}

// Преобразование base64 ключа в формат Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Подписка на push-уведомления
async function sendSubscriptionToServer(subscription) {
    console.log('[Push] 📤 Отправка подписки на сервер https://localhost:3003/subscribe');
    const response = await fetch('https://localhost:3003/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
    });

    console.log('[Push] 📥 Ответ сервера:', response.status);
    const data = await response.json();
    console.log('[Push] 📊 Ответ сервера:', data);
    return { response, data };
}

async function resyncExistingSubscriptionToServer() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        const { response } = await sendSubscriptionToServer(subscription);
        if (response.ok) {
            console.log('[Push] 🔄 Существующая подписка синхронизирована с сервером');
        }
    } catch (err) {
        console.warn('[Push] ⚠️  Не удалось досинхронизировать подписку:', err.message);
    }
}

async function subscribeToPush() {
    console.log('[Push] 📡 Начало подписки на push...');
    
    if (!('serviceWorker' in navigator)) {
        console.warn('[Push] ⚠️  Service Worker не поддерживается');
        return;
    }
    
    if (!('PushManager' in window)) {
        console.warn('[Push] ⚠️  PushManager не поддерживается браузером');
        return;
    }
    
    try {
        console.log('[Push] ⏳ Ожидание готовности Service Worker...');
        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] ✅ Service Worker готов:', registration.scope);

        const vapidPublicKey = await getVapidPublicKey();
        
        console.log('[Push] ⏳ Подписка на push...');
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
        console.log('[Push] ✅ Подписка успешна:', subscription.endpoint.substring(0, 50) + '...');
        
        // Определяем браузер по endpoint
        let browserType = 'Unknown';
        if (subscription.endpoint.includes('web.push.apple.com')) browserType = '🍎 Safari/Apple';
        else if (subscription.endpoint.includes('fcm.googleapis.com')) browserType = '🟢 Chrome/Android';
        else if (subscription.endpoint.includes('updates.push.services.mozilla.com')) browserType = '🔥 Firefox';
        else if (subscription.endpoint.includes('push.yandex')) browserType = '🟡 Яндекс';
        else if (subscription.endpoint.includes('notify.windows.com')) browserType = '🪟 Edge/Windows';
        
        console.log('[Push] 🌐 Браузер:', browserType);
        console.log('[Push] 📍 Полный endpoint:', subscription.endpoint);
        
        // Отправляем подписку на сервер
        const { response, data } = await sendSubscriptionToServer(subscription);
        
        if (response.ok) {
            console.log('[Push] ✅ Подписка на push уведомления активирована! Всего:', data.totalSubscriptions);
            alert('✅ Уведомления включены! (' + data.totalSubscriptions + ' подписок на сервере)');
        } else {
            console.error('[Push] ❌ Ошибка ответа сервера:', response.status, data);
            alert('❌ Ошибка подписки: ' + data.message);
        }
    } catch (err) {
        console.error('[Push] ❌ Ошибка подписки:', err);
        console.error('[Push] 🔍 Тип ошибки:', err.name);
        console.error('[Push] 📝 Сообщение:', err.message);
        console.error('[Push] 🗂️  Stack:', err.stack);
    }
}

// Отписка от push-уведомлений
async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            // Отправляем запрос на удаление на сервер
            await fetch('https://localhost:3003/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
            
            // Локально отписываемся
            await subscription.unsubscribe();
            console.log('[Push] ✅ Отписка выполнена');
        }
    } catch (err) {
        console.error('[Push] ❌ Ошибка отписки:', err);
    }
}

// Проверить есть ли активная подписка на push
async function hasPushSubscription() {
    try {
        // Проверяем есть ли локальная подписка
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('[Push] ⚠️  PushManager не поддерживается');
            return false;
        }
        
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            console.log('[Push] ⚠️  Локально нет подписки');
            return false;
        }
        
        console.log('[Push] ✅ Локально подписка найдена, проверяем сервер...');
        
        // Проверяем статус именно этой подписки на СЕРВЕРЕ
        try {
            const response = await fetch('https://localhost:3003/subscription-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
            const data = await response.json();
            console.log('[Push] 📊 Проверка подписки на сервере:', data);
            
            if (!response.ok || !data.subscribed) {
                console.log('[Push] ⚠️  Текущая подписка не найдена на сервере');
                return false;
            }
            return true;
        } catch (err) {
            console.log('[Push] ⚠️  Ошибка проверки сервера, используем локальную проверку:', err.message);
            return true; // Доверяем локальной подписке
        }
    } catch (err) {
        console.error('[Push] ❌ Ошибка проверки подписки:', err);
        return false;
    }
}

// Показ всплывающего сообщения
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== СТАТУС ПОДКЛЮЧЕНИЯ ====================

function updateConnectionStatus() {
    if (navigator.onLine) {
        statusIndicator.classList.remove('offline');
        statusIndicator.classList.add('online');
        statusIndicator.innerHTML = '<div class="status-dot"></div><span>✅ Онлайн</span>';
        console.log('🟢 Подключено к интернету');
    } else {
        statusIndicator.classList.remove('online');
        statusIndicator.classList.add('offline');
        statusIndicator.innerHTML = '<div class="status-dot"></div><span>⚠️ Офлайн</span>';
        console.warn('🔴 Интернет отключен! Приложение работает из кэша');
    }
}

// Отслеживаем изменения статуса подключения
window.addEventListener('online', () => {
    updateConnectionStatus();
    console.log('📡 Интернет восстановлен!');
});

window.addEventListener('offline', () => {
    updateConnectionStatus();
    console.log('📡 Интернет потерян. Переходим на офлайн режим');
});

// Инициализируем статус при загрузке
document.addEventListener('DOMContentLoaded', updateConnectionStatus);

// Функция для установки активной вкладки
function setActiveTab(activeId) {
    [homeTab, aboutTab].forEach(tab => tab.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

// ==================== ЛОГИКА ЗАМЕТОК ====================

let notes = JSON.parse(localStorage.getItem('notes') || '[]');

// Миграция старого формата (простые строки) в новый (объекты с id и reminder)
if (notes.length > 0 && typeof notes[0] === 'string') {
    notes = notes.map(text => ({
        id: Date.now() + Math.random(),
        text: text,
        reminder: null
    }));
    localStorage.setItem('notes', JSON.stringify(notes));
    console.log('[Notes] ✅ Миграция старого формата завершена');
}

function saveNotes() {
    localStorage.setItem('notes', JSON.stringify(notes));
}

function formatReminderTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function roundToNextMinute(date) {
    const rounded = new Date(date);
    rounded.setSeconds(0, 0);
    rounded.setMinutes(rounded.getMinutes() + 1);
    return rounded;
}

function formatRelativeReminder(targetTimestamp) {
    const diff = targetTimestamp - Date.now();
    if (diff <= 0) return 'в прошлом';

    const totalMinutes = Math.ceil(diff / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `через ${minutes} мин`;
    if (minutes === 0) return `через ${hours} ч`;
    return `через ${hours} ч ${minutes} мин`;
}

let reminderUxTimerId = null;

function setupReminderTimeUX(reminderTimeField) {
    if (!reminderTimeField) return { refreshPreview: () => {} };

    const preview = document.getElementById('reminder-preview');

    const updateMinBound = () => {
        const minValue = formatDateTimeLocal(roundToNextMinute(new Date()));
        reminderTimeField.min = minValue;
    };

    const setDefaultValue = () => {
        const defaultDate = roundToNextMinute(new Date());
        reminderTimeField.value = formatDateTimeLocal(defaultDate);
    };

    const refreshPreview = () => {
        if (!preview) return;

        if (!reminderTimeField.value) {
            preview.textContent = 'Выберите время напоминания';
            preview.style.color = 'rgba(255, 255, 255, 0.65)';
            return;
        }

        const ts = new Date(reminderTimeField.value).getTime();
        if (Number.isNaN(ts)) {
            preview.textContent = 'Неверный формат даты';
            preview.style.color = '#fca5a5';
            return;
        }

        const humanTime = new Date(ts).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        if (ts <= Date.now()) {
            preview.textContent = 'Выберите время в будущем';
            preview.style.color = '#fca5a5';
            return;
        }

        preview.textContent = `Сработает: ${humanTime} (${formatRelativeReminder(ts)})`;
        preview.style.color = '#86efac';
    };

    reminderTimeField.step = '60';
    updateMinBound();
    if (!reminderTimeField.value) setDefaultValue();
    refreshPreview();

    reminderTimeField.addEventListener('input', refreshPreview);
    reminderTimeField.addEventListener('focus', updateMinBound);

    // Автообновление текущего времени и min-границы, чтобы поле всегда было актуальным
    if (reminderUxTimerId) {
        clearInterval(reminderUxTimerId);
    }
    reminderUxTimerId = setInterval(() => {
        updateMinBound();
        if (!reminderTimeField.value) {
            setDefaultValue();
        }
        refreshPreview();
    }, 30000);

    return { refreshPreview, setDefaultValue, updateMinBound };
}

function renderNotes() {
    const container = document.getElementById('notes-list-container');
    if (!container) return;

    if (notes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: 12px; color: rgba(255, 255, 255, 0.5);">
                <p>📭 Нет заметок</p>
                <p style="font-size: 12px; opacity: 0.7; margin-top: 8px;">Добавьте первую заметку выше</p>
            </div>
        `;
        return;
    }

    container.innerHTML = notes.map((note, index) => {
        let reminderInfo = '';
        if (note.reminder) {
            const reminderDate = new Date(note.reminder);
            const isExpired = reminderDate < new Date();
            reminderInfo = `<div style="margin-top: 8px; font-size: 12px; color: ${isExpired ? '#fca5a5' : '#86efac'}; display: flex; align-items: center; gap: 4px;">
                <span>${isExpired ? '⏰' : '⏳'} Напоминание: ${formatReminderTime(note.reminder)}</span>
            </div>`;
        }
        return `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; display: flex; align-items: flex-start; gap: 12px; justify-content: space-between;">
                <div style="flex: 1; word-break: break-word;">
                    <div style="font-size: 14px; line-height: 1.5;">${escapeHtml(note.text)}</div>
                    ${reminderInfo}
                </div>
                <button class="delete-btn" data-id="${note.id}" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.45); color: #fca5a5; padding: 6px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0;">
                    🗑 Удалить
                </button>
            </div>
        `;
    }).join('');

    // Обработчики для кнопок удаления
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const noteIndex = notes.findIndex(n => n.id.toString() === id);
            if (noteIndex !== -1) {
                const deletedNote = notes[noteIndex];
                notes.splice(noteIndex, 1);
                saveNotes();
                renderNotes();
                
                // Отправляем событие удаления на сервер
                socket.emit('taskDeleted', { 
                    text: deletedNote.text, 
                    id: deletedNote.id,
                    timestamp: Date.now()
                });
                console.log('[Socket.IO] 📤 Отправлено событие удаления:', deletedNote.text);
            }
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initNotesForm() {
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    const reminderForm = document.getElementById('reminder-form');
    const reminderText = document.getElementById('reminder-text');
    const reminderTime = document.getElementById('reminder-time');
    const reminderTimeUX = setupReminderTimeUX(reminderTime);
    
    if (!form) return;

    // Обработка обычной заметки
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
            const newNote = {
                id: Date.now() + Math.random(),
                text: text,
                reminder: null
            };
            notes.push(newNote);
            saveNotes();
            input.value = '';
            input.focus();
            renderNotes();
            
            // Отправляем событие на сервер через WebSocket
            socket.emit('newTask', {
                text: text,
                id: newNote.id,
                timestamp: Date.now()
            });
            console.log('[Socket.IO] 📤 Отправлена новая задача');
        }
    });

    // Обработка заметки с напоминанием
    if (reminderForm) {
        reminderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = reminderText.value.trim();
            const datetime = reminderTime.value;
            
            if (!text) {
                showNotification('⚠️ Введите текст напоминания');
                reminderText.focus();
                return;
            }
            
            if (!datetime) {
                showNotification('⚠️ Выберите дату и время напоминания');
                reminderTime.focus();
                return;
            }

            // Проверяем есть ли активная подписка на push
            const hasPush = await hasPushSubscription();
            if (!hasPush) {
                showNotification('⚠️ Включите уведомления перед созданием напоминания!');
                return;
            }
            
            const reminderTimestamp = new Date(datetime).getTime();
            
            if (reminderTimestamp > Date.now()) {
                const newNote = {
                    id: Date.now() + Math.random(),
                    text: text,
                    reminder: reminderTimestamp
                };
                notes.push(newNote);
                saveNotes();
                reminderText.value = '';
                reminderTimeUX.setDefaultValue();
                reminderTimeUX.refreshPreview();
                renderNotes();
                
                // Отправляем событие напоминания на сервер
                console.log('[Socket.IO] 🔗 Статус подключения:', socket.connected ? '✅ подключено' : '❌ не подключено');
                socket.emit('newReminder', {
                    id: newNote.id,
                    text: text,
                    reminderTime: reminderTimestamp
                });
                console.log('[Socket.IO] 📤 Отправлено напоминание для:', text);
                showNotification('⏰ Напоминание запланировано');
            } else {
                showNotification('⚠️ Дата должна быть в будущем');
            }
        });
    }

    renderNotes();
}

function initQuickReminders() {
    const quickBtns = document.querySelectorAll('.quick-reminder-btn');
    const reminderTextField = document.getElementById('reminder-text');
    const reminderTimeField = document.getElementById('reminder-time');
    const reminderPreview = document.getElementById('reminder-preview');
    
    if (!reminderTextField || !reminderTimeField || quickBtns.length === 0) {
        console.warn('[Quick Reminders] Элементы не найдены');
        return;
    }
    
    console.log('[Quick Reminders] ✅ Инициализирую', quickBtns.length, 'кнопок');
    
    quickBtns.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const text = reminderTextField.value.trim();
            
            if (!text) {
                alert('Введите текст напоминания');
                reminderTextField.focus();
                return;
            }
            
            console.log(`[Quick Reminders] 🔘 Нажата кнопка ${index + 1}:`, btn.textContent);
            
            const now = new Date();
            let reminderDate = new Date(now);
            
            if (btn.dataset.minutes) {
                // Прибавляем минуты
                const minutes = parseInt(btn.dataset.minutes);
                reminderDate.setMinutes(reminderDate.getMinutes() + minutes);
                console.log(`[Quick Reminders] ⏳ Через ${minutes} минут`);
            } else if (btn.dataset.type === 'tomorrow-morning') {
                // Завтра в 9:00
                reminderDate.setDate(reminderDate.getDate() + 1);
                reminderDate.setHours(9, 0, 0, 0);
                console.log('[Quick Reminders] ⏳ Завтра в 9:00');
            } else if (btn.dataset.type === 'tomorrow-evening') {
                // Завтра в 18:00
                reminderDate.setDate(reminderDate.getDate() + 1);
                reminderDate.setHours(18, 0, 0, 0);
                console.log('[Quick Reminders] ⏳ Завтра в 18:00');
            }
            
            const formattedDateTime = formatDateTimeLocal(roundToNextMinute(reminderDate));
            
            try {
                reminderTimeField.value = formattedDateTime;
                reminderTimeField.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('[Quick Reminders] ✅ Дата установлена:', formattedDateTime);
            } catch (err) {
                console.error('[Quick Reminders] ❌ Ошибка установки даты:', err);
                alert('Ошибка установки даты');
                return;
            }

            if (reminderPreview && !reminderPreview.textContent) {
                reminderPreview.textContent = 'Напоминание выбрано';
            }
            
            // Подсвечиваем выбранную кнопку
            quickBtns.forEach(b => {
                b.style.background = 'rgba(168, 85, 247, 0.12)';
                b.style.opacity = '0.7';
            });
            btn.style.background = 'rgba(168, 85, 247, 0.35)';
            btn.style.opacity = '1';
            
            // Убираем подсветку через 500мс
            setTimeout(() => {
                quickBtns.forEach(b => {
                    b.style.background = 'rgba(168, 85, 247, 0.12)';
                    b.style.opacity = '1';
                });
            }, 500);
        });
    });
}

// ==================== ЗАГРУЗКА КОНТЕНТА ====================

async function loadContent(page) {
    try {
        appContent.style.opacity = '0.6';
        const response = await fetch(`content/${page}.html`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        appContent.innerHTML = html;
        appContent.classList.remove('app-content');
        
        // Небольшая задержка для срабатывания анимации
        setTimeout(() => {
            appContent.classList.add('app-content');
            appContent.style.opacity = '1';
            
            // После загрузки инициализируем компоненты
            if (page === 'home') {
                initNotesForm();
                initQuickReminders();
            }
        }, 10);
    } catch (err) {
        console.error('Ошибка загрузки контента:', err);
        appContent.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.45); border-radius: 12px; color: #fca5a5;">
                <p>❌ Ошибка загрузки страницы</p>
                <p style="font-size: 12px; opacity: 0.8; margin-top: 8px;">Пожалуйста, попробуйте позже</p>
            </div>
        `;
        appContent.style.opacity = '1';
    }
}

// Event listeners для вкладок
homeTab.addEventListener('click', () => {
    setActiveTab('home-tab');
    loadContent('home');
});

aboutTab.addEventListener('click', () => {
    setActiveTab('about-tab');
    loadContent('about');
});

// Загружаем главную страницу при старте
window.addEventListener('load', () => {
    loadContent('home');
});

// ==================== РЕГИСТРАЦИЯ SERVICE WORKER ====================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            console.log('✅ Service Worker зарегистрирован:', reg.scope);

            // Инициализируем управление push кнопками
            const enableBtn = document.getElementById('enable-push');
            const disableBtn = document.getElementById('disable-push');

            if (enableBtn && disableBtn) {
                // Проверяем текущий статус подписки
                const subscription = await reg.pushManager.getSubscription();
                if (subscription) {
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                    console.log('[Push] ℹ️  Пользователь уже подписан на уведомления');
                    // Критично для сценария перезапуска сервера: подписка есть в браузере, но может отсутствовать на сервере
                    await sendSubscriptionToServer(subscription);
                }

                // Кнопка "Включить уведомления"
                enableBtn.addEventListener('click', async () => {
                    // Проверяем разрешение
                    if (Notification.permission === 'denied') {
                        alert('Уведомления запрещены. Разрешите их в настройках браузера.');
                        return;
                    }
                    
                    // Запрашиваем разрешение если нужно
                    if (Notification.permission === 'default') {
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            console.log('[Push] ⚠️  Пользователь запретил уведомления');
                            return;
                        }
                    }
                    
                    // Подписываемся на push
                    await subscribeToPush();
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                });

                // Кнопка "Отключить уведомления"
                disableBtn.addEventListener('click', async () => {
                    await unsubscribeFromPush();
                    disableBtn.style.display = 'none';
                    enableBtn.style.display = 'inline-block';
                });
            }
        } catch (err) {
            console.error('❌ Service Worker registration failed:', err);
        }
    });
}
