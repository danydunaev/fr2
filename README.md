# Интернет-магазин (Frontend + Backend)

- **Сервер** на Node.js + Express, предоставляющий REST API для управления товарами (CRUD) с автоматической документацией Swagger.
- **Клиент** на React, взаимодействующий с API через axios.

## Технологии

### Backend
- Node.js
- Express
- nanoid (генерация уникальных ID)
- cors (для разрешения кросс-доменных запросов)
- **swagger-jsdoc** (генерация OpenAPI спецификации из JSDoc-комментариев)
- **swagger-ui-express** (интерактивная документация API)

### Frontend
- React (Create React App)
- Axios (HTTP-клиент)
- Sass (стилизация)
- React Hooks (useState, useEffect)

## Требования

- Node.js (версия 14 или выше)
- npm (или yarn)

## Установка и запуск


```bash
git clone <https://github.com/danydunaev/fr2>
cd fr2
<<<<<<< HEAD
npm install express nanoid cors swagger-jsdoc swagger-ui-express
cd ../server
server node index.js
Сервер запустится на http://localhost:3000
cd ../client
client npm start
Клиент запустится на http://localhost:3001
```



### Возможности Swagger UI:
- Просмотр всех доступных эндпоинтов
- Детальное описание модели данных (Product)
- Интерактивное тестирование API (кнопка "Try it out")
- Отправка реальных запросов к серверу
- Просмотр ответов и кодов статуса

## API Эндпоинты

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/products` | Получить список всех товаров |
| GET | `/api/products/{id}` | Получить товар по ID |
| POST | `/api/products` | Создать новый товар |
| PATCH | `/api/products/{id}` | Частичное обновление товара |
| DELETE | `/api/products/{id}` | Удалить товар |


