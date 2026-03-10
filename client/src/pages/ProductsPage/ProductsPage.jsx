import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProductsPage.scss';
import ProductList from '../../components/ProductList';
import ProductModal from '../../components/ProductModal';
import { api, auth } from '../../api';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingProduct, setEditingProduct] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем авторизацию
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }
    loadUser();
    loadProducts();
  }, [navigate]);

  const loadUser = async () => {
    try {
      const userData = await auth.getCurrentUser();
      setUser(userData);
    } catch (err) {
      console.error('Ошибка загрузки пользователя');
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.logout();
    navigate('/login');
  };

  const openCreate = () => {
    setModalMode('create');
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setModalMode('edit');
    setEditingProduct(product);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Удалить товар?');
    if (!ok) return;
    try {
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      alert('Ошибка удаления товара');
    }
  };

  const handleSubmitModal = async (payload) => {
    try {
      if (modalMode === 'create') {
        const newProduct = await api.createProduct(payload);
        setProducts(prev => [...prev, newProduct]);
      } else {
        const updatedProduct = await api.updateProduct(payload.id, payload);
        setProducts(prev => prev.map(p => p.id === payload.id ? updatedProduct : p));
      }
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Ошибка сохранения товара');
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div className="header__inner">
          <div className="brand">Shop Admin</div>
          <div className="header__right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {user && (
              <span>{user.first_name} {user.last_name}</span>
            )}
            <button className="btn" onClick={handleLogout} style={{ opacity: 0.8 }}>
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="main">
        <div className="container">
          <div className="toolbar">
            <h1 className="title">Товары</h1>
            <button className="btn btn--primary" onClick={openCreate}>
              + Добавить товар
            </button>
          </div>
          {loading ? (
            <div className="empty">Загрузка...</div>
          ) : (
            <ProductList
              products={products}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </main>
      <footer className="footer">
        <div className="footer__inner">
          © {new Date().getFullYear()} Shop Admin
        </div>
      </footer>
      <ProductModal
        open={modalOpen}
        mode={modalMode}
        initialProduct={editingProduct}
        onClose={closeModal}
        onSubmit={handleSubmitModal}
      />
    </div>
  );
}