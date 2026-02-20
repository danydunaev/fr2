const express = require('express');
const { nanoid } = require('nanoid');
const cors = require('cors');

const app = express();
const port = 3000;

// Начальные данные — 10 товаров (минимум)
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
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware для логирования запросов (как в методичке)
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      console.log('Body:', req.body);
    }
  });
  next();
});

// Вспомогательная функция для поиска товара по id
function findProductOr404(id, res) {
  const product = products.find(p => p.id === id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return null;
  }
  return product;
}

// ----- CRUD для товаров -----

// POST /api/products — создание нового товара
app.post('/api/products', (req, res) => {
  const { name, category, description, price, stock, rating, image } = req.body;
  // Проверяем обязательные поля
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

// GET /api/products — получить все товары
app.get('/api/products', (req, res) => {
  res.json(products);
});

// GET /api/products/:id — получить один товар по id
app.get('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const product = findProductOr404(id, res);
  if (!product) return;
  res.json(product);
});

// PATCH /api/products/:id — частичное обновление товара
app.patch('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const product = findProductOr404(id, res);
  if (!product) return;

  // Проверяем, есть ли что обновлять
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

// DELETE /api/products/:id — удаление товара
app.delete('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const exists = products.some(p => p.id === id);
  if (!exists) return res.status(404).json({ error: "Product not found" });
  products = products.filter(p => p.id !== id);
  res.status(204).send(); // 204 No Content
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
});