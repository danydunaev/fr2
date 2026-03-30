const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ==================== VAPID КЛЮЧИ ====================
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.error('[Server] ❌ VAPID keys are missing. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment variables.');
    process.exit(1);
}

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:dev@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const pushOptions = {
    TTL: 60,
    urgency: 'high'
};

const app = express();
app.use(cors());
app.use(bodyParser.json());
// На 3003 оставляем только API/WebSocket (UI обслуживается отдельным сервером на 3002)
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Backend server is running. Open UI at https://localhost:3002'
    });
});

// Хранилище подписок на push
let subscriptions = [];

// Хранилище активных напоминаний: ключ - id заметки, значение - объект с таймером и данными
const reminders = new Map();

// ==================== HTTPS КОНФИГ ====================
const options = {
    key: fs.readFileSync(path.join(__dirname, '../localhost+2-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '../localhost+2.pem'))
};

const server = https.createServer(options, app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log('[Server] 🔐 Сертификаты загружены:', {
    key: path.join(__dirname, '../localhost+2-key.pem'),
    cert: path.join(__dirname, '../localhost+2.pem')
});

// ==================== WEBSOCKET СОБЫТИЯ ====================
io.on('connection', (socket) => {
    console.log('[WS] ✅ Клиент подключён:', socket.id);

    // Досинхронизация: при подключении отправляем только будущие напоминания
    const remindersSnapshot = Array.from(reminders.entries())
        .filter(([, value]) => typeof value.reminderTime === 'number' && value.reminderTime > Date.now())
        .map(([id, value]) => ({
            id,
            text: value.text,
            reminder: value.reminderTime || null
        }));
    socket.emit('remindersSnapshot', remindersSnapshot);
    console.log(`[WS] 🔄 Отправлен снимок напоминаний: ${remindersSnapshot.length}`);

    // Обработка события 'newTask' от клиента
    socket.on('newTask', (task) => {
        console.log('[WS] 📝 Новая задача:', task.text);
        
        // Рассылаем событие всем подключённым клиентам
        io.emit('taskAdded', task);

        // Формируем payload для push-уведомления
        const payload = JSON.stringify({
            title: '📝 Новая задача',
            body: task.text,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-48x48.png'
        });

        // Отправляем уведомления всем подписанным клиентам
        subscriptions.forEach((sub, index) => {
            webpush.sendNotification(sub, payload, pushOptions).catch(err => {
                console.error(`[Push] ❌ Ошибка отправки уведомления (${index}):`, err.message);
                // Удаляем невалидную подписку
                if (err.statusCode === 410) {
                    subscriptions.splice(index, 1);
                }
            });
        });
    });

    // Обработка события 'taskDeleted' от клиента
    socket.on('taskDeleted', (task) => {
        console.log('[WS] 🗑️  Задача удалена:', task.text);

        // Если удалили заметку с напоминанием, очищаем серверные таймеры и запись
        const parsedId = Number(task.id);
        const reminderKey = reminders.has(parsedId)
            ? parsedId
            : Array.from(reminders.keys()).find((key) => String(key) === String(task.id));

        if (reminderKey !== undefined) {
            const reminder = reminders.get(reminderKey);
            if (reminder?.timeoutId) clearTimeout(reminder.timeoutId);
            if (reminder?.cleanupTimer) clearTimeout(reminder.cleanupTimer);
            reminders.delete(reminderKey);
            console.log('[WS] 🧹 Удалено связанное напоминание:', reminderKey);
        }
        
        // Рассылаем событие всем подключённым клиентам
        io.emit('taskDeleted', task);

        // Формируем payload для push-уведомления об удалении
        const payload = JSON.stringify({
            title: '🗑️  Задача удалена',
            body: task.text,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-48x48.png'
        });

        // Отправляем уведомления всем подписанным клиентам
        subscriptions.forEach((sub, index) => {
            webpush.sendNotification(sub, payload, pushOptions).catch(err => {
                console.error(`[Push] ❌ Ошибка отправки уведомления (${index}):`, err.message);
                if (err.statusCode === 410) {
                    subscriptions.splice(index, 1);
                }
            });
        });
    });

    // Обработка события 'newReminder' от клиента
    socket.on('newReminder', (reminder) => {
        const { id, text, reminderTime } = reminder;
        const delay = reminderTime - Date.now();

        // Синхронизация между всеми вкладками/браузерами: добавляем напоминание в списки заметок
        io.emit('reminderAdded', {
            id,
            text,
            reminder: reminderTime,
            timestamp: Date.now()
        });
        
        console.log(`[WS] ⏰ Новое напоминание: "${text}" через ${Math.round(delay / 60000)} минут`);
        console.log(`[WS] ⏰ Активных подписок: ${subscriptions.length}`);
        
        if (delay <= 0) {
            console.log('[WS] ⏰ Напоминание уже в прошлом, пропускаем');
            return;
        }

        // Если уже было напоминание с этим id, отменяем его
        if (reminders.has(id)) {
            clearTimeout(reminders.get(id).timeoutId);
            console.log('[WS] ⏰ Отмена предыдущего напоминания для id:', id);
        }

        // Устанавливаем новый таймер
        const timeoutId = setTimeout(() => {
            console.log('[WS] ⏰ Отправка напоминания:', text);
            console.log(`[WS] ⏰ Будет отправлено ${subscriptions.length} подписчикам`);

            // Fallback: дублируем напоминание в активные вкладки через WebSocket
            io.emit('reminderDue', { id, text, source: 'timer' });
            
            if (subscriptions.length === 0) {
                console.warn('[WS] ⚠️  Нет активных подписок! Уведомление не будет отправлено');
                // НЕ удаляем! Оставляем для откладывания
                return;
            }

            // Отправляем push-уведомление всем подписанным клиентам
            const payload = JSON.stringify({
                title: '!!! Напоминание',
                body: text,
                reminderId: id,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-48x48.png'
            });

            let successCount = 0;
            subscriptions.forEach((sub, index) => {
                // Определяем браузер по endpoint URL
                let browserType = 'Unknown';
                if (sub.endpoint.includes('web.push.apple.com')) browserType = '🍎 Safari/Apple';
                else if (sub.endpoint.includes('fcm.googleapis.com')) browserType = '🟢 Chrome/Android';
                else if (sub.endpoint.includes('updates.push.services.mozilla.com')) browserType = '🔥 Firefox';
                else if (sub.endpoint.includes('push.yandex')) browserType = '🟡 Яндекс';
                else if (sub.endpoint.includes('notify.windows.com')) browserType = '🪟 Edge/Windows';
                
                console.log(`[Push] 📨 Отправка ${index + 1}/${subscriptions.length} (${browserType})`);
                console.log(`[Push] 🔗 Endpoint: ${sub.endpoint.substring(0, 60)}...`);
                
                webpush.sendNotification(sub, payload, pushOptions)
                    .then(() => {
                        successCount++;
                        console.log(`[Push] ✅ Успех! (${browserType}) - подписчик ${index + 1}/${subscriptions.length}`);
                    })
                    .catch(err => {
                        console.error(`[Push] ❌ Ошибка (${browserType}) ${index + 1}:`, err.message);
                        console.error(`[Push] 🔍 Статус: ${err.statusCode}`);
                        console.error(`[Push] 📝 Полная ошибка:`, err);
                        if (err.statusCode === 410) {
                            subscriptions.splice(index, 1);
                            console.log('[Push] 🗑️  Удалена невалидная подписка, осталось:', subscriptions.length);
                        }
                    });
            });

            console.log(`[Push] 📊 Попыток отправить: ${subscriptions.length}`);

            // НЕ удаляем напоминание сразу! Оставляем его для откладывания
            // Оно будет удалено либо через 30 минут, либо когда его отложат
            console.log('[WS] 💾 Напоминание остается в памяти для откладывания');
        }, delay);

        // Сохраняем таймер в хранилище
        reminders.set(id, { timeoutId, text, reminderTime });
        console.log(`[WS] 💾 Напоминание сохранено. Активных: ${reminders.size}`);
        
        // Добавляем cleanup таймер (удалить напоминание через 30 минут если его не отложили)
        const cleanupTimer = setTimeout(() => {
            if (reminders.has(id)) {
                console.log('[WS] 🗑️  Удаление старого напоминания (прошло 30 минут):', id);
                reminders.delete(id);
            }
        }, 30 * 60 * 1000); // 30 минут
        
        // Сохраняем cleanup таймер для возможности отмены
        reminders.get(id).cleanupTimer = cleanupTimer;
    });

    // Обработка события 'snoozeReminder' от клиента (WebSocket fallback для Safari)
    socket.on('snoozeReminder', (data) => {
        const reminderId = data.reminderId;
        console.log('[WS] 💤 Запрос на откладывание от клиента:', reminderId);
        
        if (!reminders.has(reminderId)) {
            console.log('[WS] ⚠️  Напоминание не найдено:', reminderId);
            socket.emit('snoozeError', { reminderId, error: 'Reminder not found' });
            return;
        }

        const reminder = reminders.get(reminderId);
        clearTimeout(reminder.timeoutId);
        if (reminder.cleanupTimer) {
            clearTimeout(reminder.cleanupTimer);
        }
        console.log('[WS] ⏹️  Отменен текущий таймер для id:', reminderId);

        // Устанавливаем новый через 5 минут
        const newDelay = 5 * 60 * 1000;
        const newReminderTime = Date.now() + newDelay;
        const newTimeoutId = setTimeout(() => {
            console.log('[WS] ⏰ Отправка отложенного напоминания:', reminder.text);

            // Fallback: дублируем отложенное напоминание в активные вкладки
            io.emit('reminderDue', { id: reminderId, text: reminder.text, source: 'snooze-ws' });
            
            const payload = JSON.stringify({
                title: 'Отложенное напоминание',
                body: reminder.text,
                reminderId: reminderId,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-48x48.png'
            });

            subscriptions.forEach((sub, index) => {
                webpush.sendNotification(sub, payload, pushOptions).catch(err => {
                    console.error(`[Push] ❌ Ошибка отправки (${index}):`, err.message);
                    if (err.statusCode === 410) {
                        subscriptions.splice(index, 1);
                    }
                });
            });

            reminders.delete(reminderId);
        }, newDelay);

        reminders.set(reminderId, {
            timeoutId: newTimeoutId,
            text: reminder.text,
            reminderTime: newReminderTime
        });

        console.log('[WS] ✅ Напоминание отложено на 5 минут (WebSocket)');

        // Синхронизируем новое время напоминания между всеми клиентами
        io.emit('reminderRescheduled', {
            id: reminderId,
            reminder: newReminderTime,
            text: reminder.text,
            source: 'snooze-ws'
        });
        
        // Добавляем cleanup таймер для отложенного напоминания
        const newCleanupTimer = setTimeout(() => {
            if (reminders.has(reminderId)) {
                console.log('[WS] 🗑️  Удаление отложенного напоминания (прошло 30 минут):', reminderId);
                reminders.delete(reminderId);
            }
        }, 30 * 60 * 1000);
        reminders.get(reminderId).cleanupTimer = newCleanupTimer;
        
        // Отправляем push-уведомление об успешном откладывании
        const confirmPayload = JSON.stringify({
            title: '✅ Успешно',
            body: `Напоминание отложено на 5 минут`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-48x48.png'
        });

        subscriptions.forEach((sub, index) => {
            webpush.sendNotification(sub, confirmPayload, pushOptions).catch(err => {
                console.error(`[Push] ❌ Ошибка отправки подтверждения (${index}):`, err.message);
                if (err.statusCode === 410) {
                    subscriptions.splice(index, 1);
                }
            });
        });
        
        // Уведомляем клиента через Socket.IO
        socket.emit('snoozeSuccess', {
            reminderId,
            reminder: newReminderTime,
            message: 'Напоминание отложено на 5 минут'
        });
    });

    socket.on('disconnect', () => {
        console.log('[WS] 🔴 Клиент отключён:', socket.id);
    });
});

// ==================== PUSH ENDPOINTS ====================

// Сохранение подписки на push
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    
    // Определяем браузер по endpoint
    let browserType = 'Unknown';
    if (subscription.endpoint.includes('web.push.apple.com')) browserType = '🍎 Safari/Apple';
    else if (subscription.endpoint.includes('fcm.googleapis.com')) browserType = '🟢 Chrome/Android';
    else if (subscription.endpoint.includes('updates.push.services.mozilla.com')) browserType = '🔥 Firefox';
    else if (subscription.endpoint.includes('push.yandex')) browserType = '🟡 Яндекс';
    else if (subscription.endpoint.includes('notify.windows.com')) browserType = '🪟 Edge/Windows';
    
    console.log('[Push] 📤 Получен запрос подписки от:', browserType);
    console.log('[Push] 📝 Endpoint:', subscription.endpoint?.substring(0, 50) + '...');
    
    // Проверяем дубликаты
    const isDuplicate = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
    if (!isDuplicate) {
        subscriptions.push(subscription);
        console.log(`[Push] ✅ Подписка сохранена! Всего активных подписок: ${subscriptions.length}`);
    } else {
        console.log('[Push] ℹ️  Подписка уже существует');
    }
    
    res.status(201).json({ 
        message: 'Подписка сохранена',
        totalSubscriptions: subscriptions.length
    });
});

// Удаление подписки
app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    const initialCount = subscriptions.length;
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    
    if (subscriptions.length < initialCount) {
        console.log(`[Push] 🗑️  Подписка удалена. Осталось подписок: ${subscriptions.length}`);
    }
    
    res.status(200).json({ message: 'Подписка удалена' });
});

// Проверка существования конкретной подписки (по endpoint)
app.post('/subscription-status', (req, res) => {
    const { endpoint } = req.body || {};

    if (!endpoint) {
        return res.status(400).json({ message: 'Endpoint is required', subscribed: false });
    }

    const subscribed = subscriptions.some(sub => sub.endpoint === endpoint);
    return res.status(200).json({ subscribed, totalSubscriptions: subscriptions.length });
});

// Откладывание напоминания на 5 минут
app.post('/snooze', (req, res) => {
    const reminderId = parseFloat(req.query.reminderId);
    
    console.log('[Server] 💤 Запрос на откладывание напоминания:', reminderId);
    
    if (!reminderId || !reminders.has(reminderId)) {
        return res.status(404).json({ error: 'Reminder not found' });
    }

    const reminder = reminders.get(reminderId);
    
    // Отменяем предыдущий таймер
    clearTimeout(reminder.timeoutId);
    console.log('[Server] ⏹️  Отменен текущий таймер для id:', reminderId);

    // Устанавливаем новый через 5 минут (300 000 мс)
    const newDelay = 5 * 60 * 1000;
    const newReminderTime = Date.now() + newDelay;
    const newTimeoutId = setTimeout(() => {
        console.log('[Server] ⏰ Отправка отложенного напоминания:', reminder.text);

        // Fallback: дублируем отложенное напоминание в активные вкладки
        io.emit('reminderDue', { id: reminderId, text: reminder.text, source: 'snooze-http' });
        
        const payload = JSON.stringify({
            title: 'Отложенное напоминание',
            body: reminder.text,
            reminderId: reminderId,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-48x48.png'
        });

        subscriptions.forEach((sub, index) => {
            webpush.sendNotification(sub, payload, pushOptions).catch(err => {
                console.error(`[Push] ❌ Ошибка отправки (${index}):`, err.message);
                if (err.statusCode === 410) {
                    subscriptions.splice(index, 1);
                }
            });
        });

        // ✅ НЕ удаляем напоминание - оставляем для возможного повторного откладывания
    }, newDelay);

    // Отменяем старый cleanup таймер если он был
    if (reminder.cleanupTimer) {
        clearTimeout(reminder.cleanupTimer);
    }

    // Обновляем хранилище с новым таймером
    reminders.set(reminderId, {
        timeoutId: newTimeoutId,
        text: reminder.text,
        reminderTime: newReminderTime
    });

    // Синхронизируем новое время напоминания между всеми клиентами
    io.emit('reminderRescheduled', {
        id: reminderId,
        reminder: newReminderTime,
        text: reminder.text,
        source: 'snooze-http'
    });

    // Добавляем новый cleanup таймер для отложенного напоминания
    const cleanupTimer = setTimeout(() => {
        if (reminders.has(reminderId)) {
            console.log('[Server] 🗑️  Удаление отложенного напоминания (прошло 30 минут):', reminderId);
            reminders.delete(reminderId);
        }
    }, 30 * 60 * 1000);
    reminders.get(reminderId).cleanupTimer = cleanupTimer;

    console.log('[Server] ⏰ Напоминание отложено на 5 минут');
    res.status(200).json({
        message: 'Reminder snoozed for 5 minutes',
        reminderId,
        reminder: newReminderTime
    });
});

// Информация о сервере
app.get('/server-info', (req, res) => {
    res.json({
        status: 'online',
        vapidPublicKey: vapidKeys.publicKey,
        subscriptions: subscriptions.length,
        timestamp: new Date().toISOString()
    });
});

// ==================== ЗАПУСК СЕРВЕРА ====================
const PORT = 3003;
server.listen(PORT, () => {
    console.log('\n═══════════════════════════════════════');
    console.log(`✅ WebSocket + Push сервер запущен`);
    console.log(`🌐 https://localhost:${PORT}`);
    console.log(`📡 WebSocket подключения активны`);
    console.log(`📬 Push уведомления готовы`);
    console.log('═══════════════════════════════════════\n');
});
