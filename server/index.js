const express = require('express');
const { nanoid } = require('nanoid');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // или bcrypt
const jwt = require('jsonwebtoken'); // <-- добавили jsonwebtoken
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = 3000;

// JWT секреты и настройки
const JWT_SECRET = 'your-secret-key-change-this'; // В продакшене используйте .env
const ACCESS_EXPIRES_IN = '15m'; // 15 минут

// Хранилище пользователей (в памяти)
let users = [];

// Начальные данные — 10 товаров (минимум) - сохранены
let products = [
  { id: nanoid(6), name: 'Ноутбук', category: 'Электроника', description: 'Мощный игровой ноутбук', price: 1200, stock: 5, rating: 4.5, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Смартфон', category: 'Электроника', description: 'Флагманский смартфон', price: 800, stock: 10, rating: 4.7, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Наушники', category: 'Аксессуары', description: 'Беспроводные наушники с шумоподавлением', price: 150, stock: 20, rating: 4.3, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Клавиатура', category: 'Периферия', description: 'Механическая клавиатура', price: 100, stock: 15, rating: 4.6, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Мышь', category: 'Периферия', description: 'Игровая мышь', price: 50, stock: 25, rating: 4.4, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Монитор', category: 'Электроника', description: '4K монитор 27 дюймов', price: 350, stock: 7, rating: 4.8, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Внешний диск', category: 'Хранение', description: '1TB внешний SSD', price: 120, stock: 12, rating: 4.5, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Роутер', category: 'Сетевое оборудование', description: 'Wi-Fi 6 роутер', price: 200, stock: 8, rating: 4.2, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Принтер', category: 'Периферия', description: 'Лазерный принтер', price: 250, stock: 4, rating: 4.1, image: 'https://via.placeholder.com/150' },
  { id: nanoid(6), name: 'Флешка', category: 'Хранение', description: '64GB USB 3.0', price: 15, stock: 50, rating: 4.0, image: 'https://via.placeholder.com/150' }
];

// Middleware для парсинга JSON
app.use(express.json());

// Настройка CORS — разрешаем запросы с клиента (порт 3001)
app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'] // Authorization header для JWT
}));

// Middleware для логирования запросов
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      console.log('Body:', req.body);
    }
  });
  next();
});

// ==================== Swagger настройки ====================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API интернет-магазина с JWT аутентификацией',
      version: '1.0.0',
      description: 'API для управления товарами с JWT токенами',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Локальный сервер',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==================== Схемы для Swagger ====================
/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - first_name
 *         - last_name
 *         - password
 *       properties:
 *         id:
 *           type: string
 *           description: Уникальный идентификатор пользователя
 *         email:
 *           type: string
 *           format: email
 *           description: Email пользователя (логин)
 *         first_name:
 *           type: string
 *           description: Имя
 *         last_name:
 *           type: string
 *           description: Фамилия
 *         password:
 *           type: string
 *           description: Пароль (не возвращается в ответах)
 *       example:
 *         id: "abc123"
 *         email: "ivan@example.com"
 *         first_name: "Иван"
 *         last_name: "Петров"
 *         password: "secret"
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - category
 *         - description
 *         - price
 *         - stock
 *       properties:
 *         id:
 *           type: string
 *           description: Автоматически сгенерированный уникальный ID товара
 *         name:
 *           type: string
 *           description: Название товара
 *         category:
 *           type: string
 *           description: Категория товара
 *         description:
 *           type: string
 *           description: Описание товара
 *         price:
 *           type: number
 *           description: Цена товара
 *         stock:
 *           type: integer
 *           description: Количество на складе
 *         rating:
 *           type: number
 *           description: Рейтинг товара (0-5)
 *         image:
 *           type: string
 *           description: URL изображения товара
 *       example:
 *         id: "abc123"
 *         name: "Ноутбук"
 *         category: "Электроника"
 *         description: "Мощный игровой ноутбук"
 *         price: 1200
 *         stock: 5
 *         rating: 4.5
 *         image: "https://via.placeholder.com/150"
 */

// ==================== Вспомогательные функции ====================

// Поиск товара по id
function findProductOr404(id, res) {
  const product = products.find(p => p.id === id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return null;
  }
  return product;
}

// Поиск пользователя по email
function findUserByEmail(email, res) {
  const user = users.find(u => u.email === email);
  if (!user) {
    if (res) res.status(404).json({ error: "User not found" });
    return null;
  }
  return user;
}

// Хеширование пароля
async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Проверка пароля
async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

// ==================== JWT MIDDLEWARE ====================
/**
 * Middleware для проверки JWT токена
 * Ожидает заголовок: Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  // Ожидаем формат: Bearer <token>
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // сохраняем данные токена в req
    req.user = payload; // { sub: userId, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ==================== МАРШРУТЫ АУТЕНТИФИКАЦИИ ====================

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - first_name
 *               - last_name
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Пользователь успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Некорректные данные или email уже занят
 */
app.post('/api/auth/register', async (req, res) => {
  const { email, first_name, last_name, password } = req.body;

  if (!email || !first_name || !last_name || !password) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  // Проверка уникальности email
  if (users.some(u => u.email === email)) {
    return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
  }

  const hashedPassword = await hashPassword(password);
  const newUser = {
    id: nanoid(6),
    email,
    first_name,
    last_name,
    password: hashedPassword
  };
  users.push(newUser);

  // Не возвращаем пароль в ответе
  const { password: _, ...userWithoutPassword } = newUser;
  res.status(201).json(userWithoutPassword);
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Успешный вход, возвращает JWT токен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: JWT токен для доступа к защищенным маршрутам
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Отсутствуют обязательные поля
 *       401:
 *         description: Неверный email или пароль
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  // Создание JWT токена
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_EXPIRES_IN,
    }
  );

  // Не возвращаем пароль
  const { password: _, ...userWithoutPassword } = user;
  res.status(200).json({
    accessToken,
    user: userWithoutPassword
  });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить информацию о текущем пользователе
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Данные текущего пользователя
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Не авторизован (токен отсутствует или недействителен)
 */
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const userId = req.user.sub;
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Не возвращаем пароль
  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// ==================== ПУБЛИЧНЫЕ МАРШРУТЫ ДЛЯ ТОВАРОВ ====================

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создает новый товар
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - description
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               rating:
 *                 type: number
 *               image:
 *                 type: string
 *     responses:
 *       201:
 *         description: Товар успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Ошибка в теле запроса
 */
app.post('/api/products', (req, res) => {
  const { name, category, description, price, stock, rating, image } = req.body;
  if (!name || !category || !description || price === undefined || stock === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const newProduct = {
    id: nanoid(6),
    name: name.trim(),
    category: category.trim(),
    description: description.trim(),
    price: Number(price),
    stock: Number(stock),
    rating: rating ? Number(rating) : null,
    image: image || null
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Возвращает список всех товаров
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Список товаров
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
app.get('/api/products', (req, res) => {
  res.json(products);
});

/**
 * @swagger
 * /api/products/paged:
 *   get:
 *     summary: Возвращает список товаров с пагинацией
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Количество товаров на странице
 *     responses:
 *       200:
 *         description: Список товаров с пагинацией
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
app.get('/api/products/paged', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedProducts = products.slice(startIndex, endIndex);
  
  res.json({
    data: paginatedProducts,
    pagination: {
      page,
      limit,
      total: products.length,
      pages: Math.ceil(products.length / limit)
    }
  });
});

// ==================== ЗАЩИЩЕННЫЕ МАРШРУТЫ (требуют JWT) ====================

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получает товар по ID (защищенный маршрут)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID товара
 *     responses:
 *       200:
 *         description: Данные товара
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.get('/api/products/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const product = findProductOr404(id, res);
  if (!product) return;
  res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Полностью обновляет товар (защищенный маршрут)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID товара
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - description
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               rating:
 *                 type: number
 *               image:
 *                 type: string
 *     responses:
 *       200:
 *         description: Обновленный товар
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Ошибка в теле запроса
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.put('/api/products/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const product = findProductOr404(id, res);
  if (!product) return;

  const { name, category, description, price, stock, rating, image } = req.body;
  // При PUT все поля обязательны (кроме rating и image, они опциональны)
  if (!name || !category || !description || price === undefined || stock === undefined) {
    return res.status(400).json({ error: "Missing required fields for PUT" });
  }

  // Полное обновление
  product.name = name.trim();
  product.category = category.trim();
  product.description = description.trim();
  product.price = Number(price);
  product.stock = Number(stock);
  product.rating = rating ? Number(rating) : null;
  product.image = image || null;

  res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удаляет товар (защищенный маршрут)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID товара
 *     responses:
 *       204:
 *         description: Товар успешно удален (нет тела ответа)
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.delete('/api/products/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const exists = products.some(p => p.id === id);
  if (!exists) return res.status(404).json({ error: "Product not found" });
  products = products.filter(p => p.id !== id);
  res.status(204).send();
});

// ==================== ПУБЛИЧНЫЙ PATCH (оставлен для обратной совместимости) ====================

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Частично обновляет данные товара (публичный маршрут)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID товара
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               rating:
 *                 type: number
 *               image:
 *                 type: string
 *     responses:
 *       200:
 *         description: Обновленный товар
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Нет данных для обновления
 *       404:
 *         description: Товар не найден
 */
app.patch('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const product = findProductOr404(id, res);
  if (!product) return;

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const { name, category, description, price, stock, rating, image } = req.body;
  if (name !== undefined) product.name = name.trim();
  if (category !== undefined) product.category = category.trim();
  if (description !== undefined) product.description = description.trim();
  if (price !== undefined) product.price = Number(price);
  if (stock !== undefined) product.stock = Number(stock);
  if (rating !== undefined) product.rating = rating ? Number(rating) : null;
  if (image !== undefined) product.image = image;

  res.json(product);
});

// Обработка 404 для несуществующих маршрутов
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
  console.log(`JWT секрет: ${JWT_SECRET}`);
  console.log(`Swagger UI доступен по адресу http://localhost:${port}/api-docs`);
});