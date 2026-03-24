import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import styles from './Register.module.scss'

export default function Register() {
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
    senha: '',
    confirmarSenha: '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const nav = useNavigate()

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
    setErro('')
  }

  function validar() {
    if (!form.nome.trim()) return 'Nome completo é obrigatório.'
    if (!form.telefone.trim()) return 'Telefone é obrigatório.'
    if (!form.email.trim()) return 'Email é obrigatório.'
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Email inválido.'
    if (!form.endereco.trim()) return 'Endereço é obrigatório.'
    if (form.senha.length < 6) return 'Senha deve ter no mínimo 6 caracteres.'
    if (form.senha !== form.confirmarSenha) return 'As senhas não coincidem.'
    return null
  }

  async function handleRegister() {
    const erroValidacao = validar()
    if (erroValidacao) { setErro(erroValidacao); return }

    setLoading(true)
    setErro('')

    try {
      await axios.post('http://localhost:3000/register', {
        email: form.email,
        senha: form.senha,
        nome: form.nome,
        telefone: form.telefone,
        endereco: form.endereco,
      })
      setSucesso(true)
      setTimeout(() => nav('/'), 2000)
    } catch (e) {
      setErro(e.response?.data || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleRegister()
  }

  function formatarTelefone(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 2) return nums
    if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`
    return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`
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

        <h1 className={styles.title}>Criar conta</h1>
        <p className={styles.subtitle}>Junte-se à gestão urbana da sua cidade</p>

        {sucesso ? (
          <div className={styles.sucesso}>
            <span className={styles.sucessoIcone}>✅</span>
            <p>Conta criada com sucesso!</p>
            <span>Redirecionando para o login...</span>
          </div>
        ) : (
          <div className={styles.form}>

            {/* NOME */}
            <div className={styles.field}>
              <label className={styles.label}>
                <span className={styles.labelIcone}>👤</span> Nome completo
              </label>
              <input
                className={styles.input}
                placeholder="Seu nome completo"
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* TELEFONE + EMAIL */}
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>
                  <span className={styles.labelIcone}>📞</span> Telefone
                </label>
                <input
                  className={styles.input}
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={e => set('telefone', formatarTelefone(e.target.value))}
                  onKeyDown={handleKeyDown}
                  maxLength={15}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  <span className={styles.labelIcone}>✉️</span> Email
                </label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>

            {/* ENDEREÇO */}
            <div className={styles.field}>
              <label className={styles.label}>
                <span className={styles.labelIcone}>📍</span> Endereço
              </label>
              <input
                className={styles.input}
                placeholder="Rua, número, bairro, cidade"
                value={form.endereco}
                onChange={e => set('endereco', e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* SENHA + CONFIRMAR */}
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>
                  <span className={styles.labelIcone}>🔒</span> Senha
                </label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Mín. 6 caracteres"
                  value={form.senha}
                  onChange={e => set('senha', e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  <span className={styles.labelIcone}>🔒</span> Confirmar senha
                </label>
                <input
                  className={`${styles.input} ${form.confirmarSenha && form.confirmarSenha !== form.senha ? styles.inputErro : ''} ${form.confirmarSenha && form.confirmarSenha === form.senha ? styles.inputOk : ''}`}
                  type="password"
                  placeholder="Repita a senha"
                  value={form.confirmarSenha}
                  onChange={e => set('confirmarSenha', e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>

            {/* FORÇA DA SENHA */}
            {form.senha && (
              <div className={styles.forca}>
                <div className={styles.forcaBarra}>
                  <div
                    className={styles.forcaPreenchimento}
                    style={{
                      width: form.senha.length >= 10 ? '100%' : form.senha.length >= 6 ? '60%' : '30%',
                      background: form.senha.length >= 10 ? '#00e676' : form.senha.length >= 6 ? '#ffab40' : '#ff5252'
                    }}
                  />
                </div>
                <span className={styles.forcaLabel}>
                  {form.senha.length >= 10 ? 'Senha forte' : form.senha.length >= 6 ? 'Senha média' : 'Senha fraca'}
                </span>
              </div>
            )}

            {erro && <p className={styles.erro}>⚠️ {erro}</p>}

            <button
              className={styles.btn}
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? <span className={styles.spinner} /> : 'Criar conta'}
            </button>

            <p className={styles.loginLink}>
              Já tem uma conta?{' '}
              <Link to="/" className={styles.link}>Entrar</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}