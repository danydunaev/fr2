# Интернет-магазин (Fullstack с JWT аутентификацией)

- **Сервер**: Node.js + Express, REST API с JWT аутентификацией и Swagger документацией
- **Клиент**: React, взаимодействие с API через axios

## Технологии

### Backend
- **Node.js** + **Express** — серверная платформа
- **nanoid** — генерация уникальных ID
- **cors** — кросс-доменные запросы
- **bcrypt** / **bcryptjs** — хеширование паролей
- **jsonwebtoken** — JWT токены для аутентификации
- **swagger-jsdoc** + **swagger-ui-express** — автоматическая документация API

### Frontend
- **React** (Create React App)
- **Axios** — HTTP клиент
- **Sass** — стилизация
- **React Hooks** (useState, useEffect)

## Требования

- Node.js (версия 14 или выше)
- npm или yarn
- Postman (опционально, для тестирования API)

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
npm install
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

## Аутентификация (JWT)

В проекте реализована полноценная система аутентификации:

### Процесс работы:
1. **Регистрация** — пользователь создает аккаунт (пароль хешируется bcrypt)
2. **Вход** — при успешном входе сервер возвращает JWT токен
3. **Защищенные маршруты** — требуют передачи токена в заголовке `Authorization: Bearer <token>`
4. **Информация о пользователе** — эндпоинт `/api/auth/me` возвращает данные текущего пользователя

### Эндпоинты аутентификации

| Метод | Эндпоинт | Описание | Защита |
|-------|----------|----------|--------|
| POST | `/api/auth/register` | Регистрация нового пользователя | Нет |
| POST | `/api/auth/login` | Вход в систему, получение JWT токена | Нет |
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
| GET | `/api/products/paged` | Получить товары с пагинацией | Нет |
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

## Тестирование API

### Через Swagger UI:
1. Откройте http://localhost:3000/api-docs
2. Зарегистрируйтесь через `POST /api/auth/register`
3. Войдите через `POST /api/auth/login`, скопируйте полученный токен
4. Нажмите кнопку **"Authorize"** (замок) и вставьте токен
5. Теперь можно тестировать защищенные маршруты

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

**Защищенный запрос:**
```json
GET http://localhost:3000/api/products/abc123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Через curl:

```bash
# Регистрация
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","first_name":"Иван","last_name":"Петров","password":"qwerty123"}'

# Вход
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"qwerty123"}'

# Защищенный запрос с токеном
curl -X GET http://localhost:3000/api/products/abc123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Безопасность

- ✅ **Пароли хешируются** с помощью bcrypt (соль встроена в алгоритм)
- ✅ **JWT токены** с ограниченным временем жизни (15 минут)
- ✅ **Защищенные маршруты** требуют валидный токен
- ✅ **Пароль никогда не возвращается** в ответах сервера
- ✅ **CORS настроен** только для доверенного источника (http://localhost:3001)

## Структура проекта

```
fr2/
├── client/                          # React-клиент
│   ├── public/
│   └── src/
│       ├── api/                     # Настройка axios запросов
│       ├── components/               # React компоненты
│       └── pages/                    # Страницы приложения
│
└── server/                          # Express сервер
    └── index.js                      # Главный файл с JSDoc-аннотациями
                                      # и всей логикой приложения
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

## Возможные проблемы и решения

### Ошибка 500 при регистрации
- Проверьте, установлен ли bcrypt: `npm list bcryptjs`
- Убедитесь, что импорт работает: `const bcrypt = require('bcryptjs')`

### Ошибка 401 при запросе к защищенному маршруту
- Проверьте, что токен передан в заголовке: `Authorization: Bearer <token>`
- Токен мог истечь (живет 15 минут) — войдите снова

### CORS ошибки
- Проверьте, что клиент запущен на порту 3001
- В сервере должен быть разрешен `origin: 'http://localhost:3001'`

## Разработка

### Добавление новых маршрутов
1. Добавьте JSDoc аннотацию для Swagger
2. Реализуйте логику маршрута
3. При необходимости добавьте `authMiddleware` для защиты

### Переменные окружения (для продакшена)
Создайте файл `.env` в папке `server`:
```env
JWT_SECRET=ваш-секретный-ключ
PORT=3000
```

---
