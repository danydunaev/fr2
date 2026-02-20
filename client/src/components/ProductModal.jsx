import React, { useEffect, useState } from 'react';

export default function ProductModal({ open, mode, initialProduct, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [rating, setRating] = useState('');
  const [image, setImage] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initialProduct) {
      setName(initialProduct.name || '');
      setCategory(initialProduct.category || '');
      setDescription(initialProduct.description || '');
      setPrice(initialProduct.price?.toString() || '');
      setStock(initialProduct.stock?.toString() || '');
      setRating(initialProduct.rating?.toString() || '');
      setImage(initialProduct.image || '');
    } else {
      // Сброс для создания нового
      setName('');
      setCategory('');
      setDescription('');
      setPrice('');
      setStock('');
      setRating('');
      setImage('');
    }
  }, [open, initialProduct]);

  if (!open) return null;

  const title = mode === 'edit' ? 'Редактирование товара' : 'Создание товара';

  const handleSubmit = (e) => {
    e.preventDefault();
    // Простейшая валидация
    if (!name.trim()) {
      alert('Введите название');
      return;
    }
    if (!category.trim()) {
      alert('Введите категорию');
      return;
    }
    if (!description.trim()) {
      alert('Введите описание');
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      alert('Введите корректную цену (>0)');
      return;
    }
    const stockNum = Number(stock);
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      alert('Введите корректное количество (целое неотрицательное)');
      return;
    }
    const ratingNum = rating ? Number(rating) : null;
    if (rating && (!Number.isFinite(ratingNum) || ratingNum < 0 || ratingNum > 5)) {
      alert('Рейтинг должен быть от 0 до 5');
      return;
    }

    onSubmit({
      id: initialProduct?.id,
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: priceNum,
      stock: stockNum,
      rating: ratingNum,
      image: image.trim() || null
    });
  };

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="iconBtn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <label className="label">
            Название *
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например, Ноутбук"
              autoFocus
            />
          </label>
          <label className="label">
            Категория *
            <input
              className="input"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Электроника"
            />
          </label>
          <label className="label">
            Описание *
            <textarea
              className="input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткое описание"
            />
          </label>
          <label className="label">
            Цена (₽) *
            <input
              className="input"
              type="number"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="1000"
            />
          </label>
          <label className="label">
            Количество на складе *
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={e => setStock(e.target.value)}
              placeholder="10"
            />
          </label>
          <label className="label">
            Рейтинг (0–5)
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={rating}
              onChange={e => setRating(e.target.value)}
              placeholder="4.5"
            />
          </label>
          <label className="label">
            Ссылка на фото
            <input
              className="input"
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </label>
          <div className="modal__footer">
            <button type="button" className="btn" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">
              {mode === 'edit' ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}