# Интернет-магазин (Fullstack с JWT аутентификацией и refresh-токенами)

Полноценное веб-приложение интернет-магазина с системой аутентификации на JWT токенах, refresh-механизмом и автоматическим обновлением токенов на клиенте.

- **Сервер**: Node.js + Express, REST API с JWT аутентификацией, refresh-токенами и Swagger документацией
- **Клиент**: React + React Router, взаимодействие с API через axios с перехватчиками запросов/ответов

## Технологии

### Backend
- **Node.js** + **Express** — серверная платформа
- **nanoid** — генерация уникальных ID
- **cors** — кросс-доменные запросы
- **bcryptjs** — хеширование паролей
- **jsonwebtoken** — JWT токены (access + refresh)
- **swagger-jsdoc** + **swagger-ui-express** — автоматическая документация API

### Frontend
- **React** (Create React App)
- **React Router DOM** — маршрутизация
- **Axios** — HTTP клиент с перехватчиками (interceptors)
- **Sass** — стилизация (SCSS модули)
- **React Hooks** (useState, useEffect) — управление состоянием

## Требования

- Node.js (версия 14 или выше)
- npm или yarn
- Postman / Insomnia (опционально, для тестирования API)

## Установка и запуск

### 1. Клонирование репозитория
```bash
git clone https://github.com/danydunaev/fr2
cd fr2
```

### 2. Установка зависимостей для сервера
```bash
cd server
npm install express nanoid cors bcryptjs jsonwebtoken swagger-jsdoc swagger-ui-express
```

### 3. Запуск сервера
```bash
node index.js
# или с автоматическим перезапуском: npx nodemon index.js
```
Сервер запустится на **http://localhost:3000**

### 4. Установка зависимостей для клиента
```bash
cd ../client
npm install axios react-router-dom
```

### 5. Запуск клиента (в отдельном терминале)
```bash
npm start
```
Клиент запустится на **http://localhost:3001**

## Документация API (Swagger)

После запуска сервера интерактивная документация доступна по адресу:
**http://localhost:3000/api-docs**

### Возможности Swagger UI:
- Просмотр всех доступных эндпоинтов
- Детальное описание моделей данных (User, Product)
- Интерактивное тестирование API (кнопка "Try it out")
- Отправка реальных запросов к серверу
- Просмотр ответов и кодов статуса
- Авторизация через JWT токен (кнопка "Authorize")

## Аутентификация (JWT + Refresh Tokens)

В проекте реализована двухуровневая система аутентификации:

### 🔑 Типы токенов

| Токен | Время жизни | Назначение |
|-------|-------------|------------|
| **Access Token** | 15 минут | Доступ к защищенным ресурсам API |
| **Refresh Token** | 7 дней | Получение новой пары токенов |

### 🔄 Процесс работы:
1. **Регистрация** — пользователь создает аккаунт (пароль хешируется bcrypt)
2. **Вход** — сервер возвращает пару токенов (access + refresh)
3. **Хранение** — оба токена сохраняются в localStorage
4. **Запросы** — access token автоматически подставляется в заголовок `Authorization`
5. **Обновление** — при истечении access token (401) автоматически отправляется refresh token
6. **Ротация** — каждый раз создается новая пара, старый refresh token становится недействительным

### Эндпоинты аутентификации

| Метод | Эндпоинт | Описание | Защита |
|-------|----------|----------|--------|
| POST | `/api/auth/register` | Регистрация нового пользователя | Нет |
| POST | `/api/auth/login` | Вход, получение пары токенов | Нет |
| POST | `/api/auth/refresh` | Обновление пары токенов | Refresh Token |
| GET | `/api/auth/me` | Информация о текущем пользователе | ✅ JWT |

### Модель пользователя
```json
{
  "id": "string (6 символов)",
  "email": "string (уникальный)",
  "first_name": "string",
  "last_name": "string",
  "password": "string (хешируется, не возвращается)"
}
```

## API Эндпоинты для товаров

| Метод | Эндпоинт | Описание | Защита |
|-------|----------|----------|--------|
| GET | `/api/products` | Получить список всех товаров | Нет |
| POST | `/api/products` | Создать новый товар | Нет |
| GET | `/api/products/{id}` | Получить товар по ID | ✅ JWT |
| PUT | `/api/products/{id}` | Полностью обновить товар | ✅ JWT |
| PATCH | `/api/products/{id}` | Частично обновить товар | Нет |
| DELETE | `/api/products/{id}` | Удалить товар | ✅ JWT |

### Модель товара
```json
{
  "id": "string (6 символов)",
  "name": "string",
  "category": "string",
  "description": "string",
  "price": "number",
  "stock": "integer",
  "rating": "number (опционально, 0-5)",
  "image": "string (опционально, URL)"
}
```

## Клиентская часть (Frontend)

### 🧩 Компоненты
- **ProductList** — отображение списка товаров
- **ProductItem** — карточка товара с кнопками действий
- **ProductModal** — модальное окно создания/редактирования
- **LoginPage / RegisterPage** — страницы аутентификации

### 🔄 Автоматизация с Axios Interceptors

**Request Interceptor** — автоматически добавляет токен в каждый запрос:
```javascript
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

**Response Interceptor** — автоматически обновляет токены при 401 ошибке:
```javascript
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 1. Отправляем refresh token
      // 2. Получаем новую пару
      // 3. Сохраняем новые токены
      // 4. Повторяем исходный запрос
    }
  }
);
```

### 🛡️ Защита маршрутов
- Без токена — перенаправление на `/login`
- При истечении токена — автоматическое обновление
- При ошибке refresh — выход из системы

## Тестирование API

### Через Swagger UI:
1. Откройте http://localhost:3000/api-docs
2. Зарегистрируйтесь через `POST /api/auth/register`
3. Войдите через `POST /api/auth/login` — получите `accessToken` и `refreshToken`
4. Нажмите **"Authorize"** и вставьте `accessToken`
5. Тестируйте защищенные маршруты

### Через клиентское приложение:
1. Откройте http://localhost:3001
2. Зарегистрируйтесь / войдите
3. Управляйте товарами через интерфейс
4. Токены автоматически сохраняются и обновляются

### Через Postman:

**Регистрация:**
```json
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "first_name": "Иван",
  "last_name": "Петров",
  "password": "qwerty123"
}
```

**Вход:**
```json
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "qwerty123"
}
```

**Обновление токенов:**
```json
POST http://localhost:3000/api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Защищенный запрос:**
```json
GET http://localhost:3000/api/products/abc123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Безопасность

- ✅ **Пароли хешируются** bcrypt (соль + 10 раундов)
- ✅ **Access токены** живут 15 минут (минимизация риска)
- ✅ **Refresh токены** с ротацией (каждое использование создает новый)
- ✅ **Хранилище** — localStorage (простота для учебного проекта)
- ✅ **CORS** ограничен только доверенным источником
- ✅ **JWT секреты** разделены для access и refresh токенов

## Структура проекта

```
fr2/
├── client/                          # React-клиент
│   ├── public/
│   └── src/
│       ├── api/
│       │   └── index.js             # Axios + interceptors
│       ├── components/
│       │   ├── ProductItem.jsx
│       │   ├── ProductList.jsx
│       │   └── ProductModal.jsx
│       ├── pages/
│       │   ├── LoginPage/           # Страница входа
│       │   ├── ProductsPage/        # Управление товарами
│       │   └── RegisterPage/        # Страница регистрации
│       ├── App.js
│       └── index.js
│
└── server/                          # Express сервер
    └── index.js                      # Основной файл с JSDoc-аннотациями
                                      # и всей бизнес-логикой
```

## Выполненные практические работы

### ✅ Практическая работа №4
- Разработка сервера на Express с CRUD операциями
- Создание React-клиента с использованием хуков
- Логирование запросов и обработка ошибок

### ✅ Практическая работа №5
- Подключение Swagger (swagger-jsdoc + swagger-ui-express)
- Документирование API через JSDoc аннотации
- Интерактивная документация по адресу `/api-docs`

### ✅ Практическая работа №7
- Хеширование паролей с bcrypt
- Регистрация и вход пользователей
- Безопасное хранение учетных данных

### ✅ Практическая работа №8
- JWT токены для аутентификации
- Middleware для проверки токенов
- Защита маршрутов (GET/:id, PUT, DELETE)
- Эндпоинт `/api/auth/me` для получения данных пользователя

### ✅ Практическая работа №9
- Разделение access и refresh токенов
- Хранилище активных refresh токенов
- Эндпоинт `/api/auth/refresh` с ротацией токенов

### ✅ Практическая работа №10
- Хранение токенов в localStorage
- Axios interceptors для автоматической подстановки токена
- Автоматическое обновление токенов при 401 ошибке
- Страницы входа и регистрации на React
- Защита маршрутов и управление товарами

## Возможные проблемы и решения

### ❌ Ошибка 500 при регистрации
**Решение:** Проверьте установку bcryptjs
```bash
npm list bcryptjs
npm install bcryptjs
```

### ❌ Ошибка 401 после входа
**Решение:** Проверьте, что токен передается в заголовке
```javascript
// В DevTools → Application → LocalStorage
localStorage.getItem('accessToken'); // должен быть не null
```

### ❌ Токен не обновляется автоматически
**Решение:** Проверьте interceptor в `api/index.js`
- Должен обрабатывать 401 статус
- Должен отправлять запрос на `/auth/refresh`

### ❌ CORS ошибки
**Решение:** Проверьте настройки сервера
```javascript
// В server/index.js
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));
```

## Переменные окружения (для продакшена)

Создайте файл `.env` в папке `server`:
```env
JWT_SECRET=ваш-супер-секретный-ключ
REFRESH_SECRET=другой-секретный-ключ
PORT=3000
NODE_ENV=production
```

В папке `client` создайте `.env`:
```env
REACT_APP_API_URL=http://localhost:3000/api
```

---
