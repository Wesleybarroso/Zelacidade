import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import styles from './Login.module.scss'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const nav = useNavigate()

  async function handleLogin() {
    if (!email || !senha) {
      setErro('Preencha todos os campos.')
      return
    }

    setLoading(true)
    setErro('')

    try {
      const res = await axios.post('http://localhost:3000/login', { email, senha })

      // Salva o token
      localStorage.setItem('token', res.data.token)

      // Salva os dados do usuário para carregar no perfil
      if (res.data.usuario) {
        localStorage.setItem('perfil', JSON.stringify(res.data.usuario))
      }

      nav('/dashboard')
    } catch {
      setErro('Email ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.circle1} />
        <div className={styles.circle2} />
        <div className={styles.grid} />
      </div>

      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>ZelaCidade</span>
        </div>

        <h1 className={styles.title}>Bem-vindo de volta</h1>
        <p className={styles.subtitle}>Acesse o painel de gestão urbana</p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Senha</label>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
            />
          </div>

          {erro && <p className={styles.erro}>{erro}</p>}

          <button
            className={styles.btn}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : 'Entrar'}
          </button>

          <p className={styles.registerLink}>
            Não tem uma conta?{' '}
            <Link to="/register" className={styles.link}>Criar conta</Link>
          </p>
        </div>

        <p className={styles.footer}>Sistema de Gestão de Incidentes Urbanos</p>
      </div>
    </div>
  )
}