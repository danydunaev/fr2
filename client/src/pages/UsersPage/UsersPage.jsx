import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { users, auth, hasRole } from '../../api';
import './UsersPage.scss';

export default function UsersPage() {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем, админ ли пользователь
    if (!hasRole('admin')) {
      navigate('/products');
      return;
    }
    loadUsers();
  }, [navigate]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await users.getAll();
      setUsersList(data);
    } catch (err) {
      console.error('Ошибка загрузки пользователей');
      if (err.response?.status === 403) {
        navigate('/products');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Заблокировать пользователя?')) return;
    
    try {
      await users.delete(userId);
      setUsersList(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert('Ошибка блокировки пользователя');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      const updated = await users.update(editingUser.id, {
        first_name: editingUser.first_name,
        last_name: editingUser.last_name,
        role: editingUser.role
      });
      setUsersList(prev => prev.map(u => u.id === updated.id ? updated : u));
      setShowEditModal(false);
      setEditingUser(null);
    } catch (err) {
      alert('Ошибка обновления пользователя');
    }
  };

  const handleLogout = () => {
    auth.logout();
    navigate('/login');
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="page">
      <header className="header">
        <div className="header__inner">
          <div className="brand">Shop Admin</div>
          <div className="header__right" style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" onClick={() => navigate('/products')}>
              Товары
            </button>
            <button className="btn" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="main">
        <div className="container">
          <div className="toolbar">
            <h1 className="title">Управление пользователями</h1>
          </div>
          
          {usersList.length === 0 ? (
            <div className="empty">Нет пользователей</div>
          ) : (
            <div className="users-table">
              <div className="users-table-header">
                <div>ID</div>
                <div>Email</div>
                <div>Имя</div>
                <div>Фамилия</div>
                <div>Роль</div>
                <div>Действия</div>
              </div>
              {usersList.map(user => (
                <div key={user.id} className="users-table-row">
                  <div className="user-id">{user.id}</div>
                  <div>{user.email}</div>
                  <div>{user.first_name}</div>
                  <div>{user.last_name}</div>
                  <div>
                    <span className={`role-badge role-${user.role}`}>
                      {user.role === 'admin' ? 'Админ' : 
                       user.role === 'seller' ? 'Продавец' : 'Пользователь'}
                    </span>
                  </div>
                  <div className="user-actions">
                    <button 
                      className="btn" 
                      onClick={() => handleEdit(user)}
                    >
                      Редактировать
                    </button>
                    <button 
                      className="btn btn--danger" 
                      onClick={() => handleDelete(user.id)}
                      disabled={user.id === JSON.parse(atob(localStorage.getItem('accessToken')?.split('.')[1] || '{}')).sub}
                    >
                      Заблокировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showEditModal && editingUser && (
        <div className="backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Редактирование пользователя</div>
              <button className="iconBtn" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="form">
              <label className="label">
                Имя
                <input
                  className="input"
                  value={editingUser.first_name}
                  onChange={e => setEditingUser({...editingUser, first_name: e.target.value})}
                />
              </label>
              <label className="label">
                Фамилия
                <input
                  className="input"
                  value={editingUser.last_name}
                  onChange={e => setEditingUser({...editingUser, last_name: e.target.value})}
                />
              </label>
              <label className="label">
                Роль
                <select 
                  className="input"
                  value={editingUser.role}
                  onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                >
                  <option value="user">Пользователь</option>
                  <option value="seller">Продавец</option>
                  <option value="admin">Администратор</option>
                </select>
              </label>
              <div className="modal__footer">
                <button className="btn" onClick={() => setShowEditModal(false)}>Отмена</button>
                <button className="btn btn--primary" onClick={handleUpdateUser}>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}