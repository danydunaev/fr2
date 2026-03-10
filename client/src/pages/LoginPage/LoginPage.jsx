import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../../api';
import './LoginPage.scss';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await auth.login({ email, password });
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div className="header__inner">
          <div className="brand">Shop Admin</div>
          <div className="header__right">Вход</div>
        </div>
      </header>
      <main className="main">
        <div className="container auth-container">
          <div className="auth-card">
            <h1 className="auth-title">Вход в систему</h1>
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
              <label className="label">
                Email
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                />
              </label>
              <label className="label">
                Пароль
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </label>
              <button 
                type="submit" 
                className="btn btn--primary auth-btn"
                disabled={loading}
              >
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </form>
            <div className="auth-footer">
              Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
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