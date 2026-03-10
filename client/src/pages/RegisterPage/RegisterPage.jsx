import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../../api';
import './RegisterPage.scss';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    
    setLoading(true);
    
    try {
      await auth.register({
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        password: formData.password
      });
      navigate('/login', { state: { message: 'Регистрация успешна! Войдите в систему.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div className="header__inner">
          <div className="brand">Shop Admin</div>
          <div className="header__right">Регистрация</div>
        </div>
      </header>
      <main className="main">
        <div className="container auth-container">
          <div className="auth-card">
            <h1 className="auth-title">Регистрация</h1>
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
              <label className="label">
                Email
                <input
                  type="email"
                  name="email"
                  className="input"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your@email.com"
                />
              </label>
              <label className="label">
                Имя
                <input
                  type="text"
                  name="first_name"
                  className="input"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  placeholder="Иван"
                />
              </label>
              <label className="label">
                Фамилия
                <input
                  type="text"
                  name="last_name"
                  className="input"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  placeholder="Петров"
                />
              </label>
              <label className="label">
                Пароль
                <input
                  type="password"
                  name="password"
                  className="input"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                />
              </label>
              <label className="label">
                Подтвердите пароль
                <input
                  type="password"
                  name="confirmPassword"
                  className="input"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                />
              </label>
              <button 
                type="submit" 
                className="btn btn--primary auth-btn"
                disabled={loading}
              >
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </form>
            <div className="auth-footer">
              Уже есть аккаунт? <Link to="/login">Войти</Link>
            </div>
          </div>
        </div>
      </main>
      <footer className="footer">
        <div className="footer__inner">
          © {new Date().getFullYear()} Shop Admin
        </div>
      </footer>
    </div>
  );
}