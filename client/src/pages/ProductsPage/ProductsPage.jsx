import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProductsPage.scss';
import ProductList from '../../components/ProductList';
import ProductModal from '../../components/ProductModal';
import { products, auth, hasRole } from '../../api';

export default function ProductsPage() {
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingProduct, setEditingProduct] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
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
      localStorage.setItem('userRole', userData.role);
    } catch (err) {
      console.error('Ошибка загрузки пользователя');
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await products.getAll();
      setProductsList(data);
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
    // Только seller и admin могут создавать товары
    if (!hasRole(['seller', 'admin'])) {
      alert('У вас нет прав для создания товаров');
      return;
    }
    setModalMode('create');
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    // Только seller и admin могут редактировать товары
    if (!hasRole(['seller', 'admin'])) {
      alert('У вас нет прав для редактирования товаров');
      return;
    }
    setModalMode('edit');
    setEditingProduct(product);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleDelete = async (id) => {
    // Только admin может удалять товары
    if (!hasRole('admin')) {
      alert('У вас нет прав для удаления товаров');
      return;
    }
    
    const ok = window.confirm('Удалить товар?');
    if (!ok) return;
    try {
      await products.delete(id);
      setProductsList(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      alert('Ошибка удаления товара');
    }
  };

  const handleSubmitModal = async (payload) => {
    try {
      if (modalMode === 'create') {
        const newProduct = await products.create(payload);
        setProductsList(prev => [...prev, newProduct]);
      } else {
        const updatedProduct = await products.update(payload.id, payload);
        setProductsList(prev => prev.map(p => p.id === payload.id ? updatedProduct : p));
      }
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Ошибка сохранения товара');
    }
  };

  const goToUsersPage = () => {
    navigate('/users');
  };

  return (
    <div className="page">
      <header className="header">
        <div className="header__inner">
          <div className="brand">Shop Admin</div>
          <div className="header__right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {user && (
              <>
                <span style={{ opacity: 0.8 }}>
                  {user.first_name} {user.last_name}
                </span>
                <span className="role-badge" style={{
                  background: user.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 
                             user.role === 'seller' ? 'rgba(99, 102, 241, 0.2)' : 
                             'rgba(255, 255, 255, 0.1)',
                  padding: '4px 8px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  border: user.role === 'admin' ? '1px solid rgba(239, 68, 68, 0.5)' :
                          user.role === 'seller' ? '1px solid rgba(99, 102, 241, 0.5)' :
                          '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  {user.role === 'admin' ? 'Админ' : 
                   user.role === 'seller' ? 'Продавец' : 'Пользователь'}
                </span>
                {user.role === 'admin' && (
                  <button className="btn" onClick={goToUsersPage}>
                    Пользователи
                  </button>
                )}
              </>
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
            {hasRole(['seller', 'admin']) && (
              <button className="btn btn--primary" onClick={openCreate}>
                + Добавить товар
              </button>
            )}
          </div>
          {loading ? (
            <div className="empty">Загрузка...</div>
          ) : (
            <ProductList
              products={productsList}
              onEdit={openEdit}
              onDelete={handleDelete}
              userRole={user?.role}
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