import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.scss'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LineChart, Line,
} from 'recharts'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function criarIconePin(cor) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      background:${cor};border:3px solid #fff;
      transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  })
}

function RecentralizarMapa({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.setView(coords, 14, { animate: true })
  }, [coords])
  return null
}

const PRIORIDADE_COR = { Alta: '#ff5252', Média: '#ffab40', Baixa: '#69f0ae' }
const STATUS_COR = { Pendente: '#ffab40', 'Em Análise': '#40c4ff', Resolvido: '#69f0ae' }
const TIPO_ICONE = {
  'Buraco na rua': '🕳️', 'Iluminação pública': '💡', 'Vazamento de água': '💧',
  'Acúmulo de lixo': '🗑️', 'Árvore caída': '🌳', Alagamento: '🌊', Assalto: '🚨',
}
const getIcone = (tipo) => TIPO_ICONE[tipo] || '📍'

function formVazio() {
  const hoje = new Date()
  return {
    tipo_problema: '', localizacao: '', descricao: '', prioridade: 'Média',
    nome_solicitante: '', contato_solicitante: '',
    data_registro: hoje.toISOString().split('T')[0],
    hora_registro: hoje.toTimeString().slice(0, 5),
    imagem_problema: '', status_resolucao: 'Pendente',
  }
}

export default function Dashboard() {
  const [aba, setAba] = useState('dashboard')
  const [incidentes, setIncidentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroPrio, setFiltroPrio] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [modal, setModal] = useState(null)
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(formVazio())
  const [imgPreview, setImgPreview] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [perfil, setPerfil] = useState({ nome: '', email: '', telefone: '', endereco: '' })
  const [perfilEdit, setPerfilEdit] = useState(false)
  const [perfilOk, setPerfilOk] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [notificacoes, setNotificacoes] = useState([])
  const [sinoAberto, setSinoAberto] = useState(false)
  const sinoRef = useRef(null)
  const [mapaFoco, setMapaFoco] = useState(null)
  const [mapaBusca, setMapaBusca] = useState('')
  const [mapaFiltroPrio, setMapaFiltroPrio] = useState('Todos')
  const [geocoords, setGeocoords] = useState({})
  const geocodificandoRef = useRef(false)

  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const nav = useNavigate()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  // ── CARREGAR ────────────────────────────────────
  async function carregar(silencioso = false) {
    if (!silencioso) setLoading(true)
    try {
      const res = await axios.get('http://localhost:3000/incidentes', { headers })
      const novos = res.data

      // Detectar mudanças de status para gerar notificações
      setIncidentes(prev => {
        if (prev.length > 0) {
          const novasNotifs = []
          novos.forEach(novo => {
            const antigo = prev.find(p => p.id === novo.id)
            if (antigo && antigo.status_resolucao !== novo.status_resolucao) {
              novasNotifs.push({
                id: Date.now() + Math.random(),
                incidenteId: novo.id,
                tipo: novo.tipo_problema,
                de: antigo.status_resolucao,
                para: novo.status_resolucao,
                hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                lida: false,
              })
            }
          })
          if (novasNotifs.length > 0) {
            setNotificacoes(n => [...novasNotifs, ...n].slice(0, 20))
          }
        }
        return novos
      })
    } catch { logout() }
    finally { if (!silencioso) setLoading(false) }
  }

  useEffect(() => {
    carregar()
    carregarPerfil()
    const intervalo = setInterval(() => carregar(true), 30000)
    return () => clearInterval(intervalo)
  }, [])

  // Geocodifica incidentes quando entra na aba mapa
  useEffect(() => {
    if (aba !== 'mapa' || geocodificandoRef.current) return
    geocodificarTodos()
  }, [aba, incidentes])

  async function geocodificarTodos() {
    geocodificandoRef.current = true
    const novos = {}
    for (const inc of incidentes) {
      if (geocoords[inc.id]) continue
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(inc.localizacao)}&format=json&limit=1`)
        const d = await r.json()
        if (d[0]) novos[inc.id] = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) }
        await new Promise(res => setTimeout(res, 500)) // respeitar rate limit
      } catch {}
    }
    setGeocoords(prev => ({ ...prev, ...novos }))
    geocodificandoRef.current = false
  }

  // Fechar sino ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (sinoRef.current && !sinoRef.current.contains(e.target)) {
        setSinoAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function carregarPerfil() {
    try {
      const res = await axios.get('http://localhost:3000/perfil', { headers })
      setPerfil(res.data)
      localStorage.setItem('perfil', JSON.stringify(res.data))
    } catch {
      // fallback: dados salvos no login
      const p = localStorage.getItem('perfil')
      if (p) setPerfil(JSON.parse(p))
    }
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('perfil')
    nav('/')
  }

  const naoLidas = notificacoes.filter(n => !n.lida).length

  function marcarTodasLidas() {
    setNotificacoes(n => n.map(x => ({ ...x, lida: true })))
  }

  function removerNotif(id) {
    setNotificacoes(n => n.filter(x => x.id !== id))
  }

  const STATUS_ICONE = { Pendente: '🟡', 'Em Análise': '🔵', Resolvido: '🟢' }

  function NotificacoesPanel() {
    return (
      <div className={styles.notifPanel}>
        <div className={styles.notifHeader}>
          <span className={styles.notifTitulo}>🔔 Notificações</span>
          {notificacoes.length > 0 && (
            <button className={styles.notifLimpar} onClick={() => setNotificacoes([])}>
              Limpar tudo
            </button>
          )}
        </div>
        {notificacoes.length === 0 ? (
          <div className={styles.notifVazio}>
            <span>Nenhuma notificação</span>
            <p>Mudanças de status aparecerão aqui</p>
          </div>
        ) : (
          <div className={styles.notifLista}>
            {notificacoes.map(n => (
              <div key={n.id} className={`${styles.notifItem} ${!n.lida ? styles.notifNaoLida : ''}`}>
                <div className={styles.notifIcone}>{getIcone(n.tipo)}</div>
                <div className={styles.notifInfo}>
                  <span className={styles.notifTipo}>{n.tipo}</span>
                  <span className={styles.notifStatus}>
                    {STATUS_ICONE[n.de]} {n.de} → {STATUS_ICONE[n.para]} {n.para}
                  </span>
                  <span className={styles.notifHora}>{n.hora}</span>
                </div>
                <button className={styles.notifFechar} onClick={() => removerNotif(n.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── IMAGEM ──────────────────────────────────────
  function onImagem(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImgPreview(ev.target.result)
      setForm(f => ({ ...f, imagem_problema: ev.target.result }))
    }
    reader.readAsDataURL(file)
  }

  function removerImg() {
    setImgPreview(null)
    setForm(f => ({ ...f, imagem_problema: '' }))
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  // ── GPS ─────────────────────────────────────────
  function usarGPS() {
    if (!navigator.geolocation) return alert('GPS não disponível.')
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const d = await r.json()
          setForm(f => ({ ...f, localizacao: d.display_name || `${latitude}, ${longitude}` }))
        } catch {
          setForm(f => ({ ...f, localizacao: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` }))
        }
        setGpsLoading(false)
      },
      () => { alert('Não foi possível obter localização.'); setGpsLoading(false) }
    )
  }

  // ── FORM ────────────────────────────────────────
  function abrirNovo() {
    setEditandoId(null); setForm(formVazio()); setImgPreview(null); setFormAberto(true)
  }

  function abrirEditar(inc) {
    setEditandoId(inc.id); setForm({ ...inc }); setImgPreview(inc.imagem_problema || null)
    setModal(null); setFormAberto(true)
  }

  async function salvar() {
    if (!form.tipo_problema || !form.localizacao) return alert('Tipo e localização são obrigatórios.')
    try {
      if (editandoId) {
        await axios.put(`http://localhost:3000/incidentes/${editandoId}`, form, { headers })
      } else {
        await axios.post('http://localhost:3000/incidentes', form, { headers })
      }
      setFormAberto(false); setImgPreview(null); carregar()
    } catch { alert('Erro ao salvar.') }
  }

  async function deletar(id) {
    if (!confirm('Deletar este incidente?')) return
    try {
      await axios.delete(`http://localhost:3000/incidentes/${id}`, { headers })
      setModal(null); carregar()
    } catch { alert('Erro ao deletar.') }
  }

  // ── PERFIL ──────────────────────────────────────
  async function salvarPerfil() {
    try {
      await axios.put('http://localhost:3000/perfil', perfil, { headers })
      localStorage.setItem('perfil', JSON.stringify(perfil))
      setPerfilEdit(false)
      setPerfilOk(true)
      setTimeout(() => setPerfilOk(false), 3000)
    } catch {
      alert('Erro ao salvar perfil.')
    }
  }

  // ── FILTRO ──────────────────────────────────────
  const filtrados = incidentes.filter(i => {
    const ok1 = busca === '' || [i.tipo_problema, i.localizacao, i.nome_solicitante]
      .some(v => v?.toLowerCase().includes(busca.toLowerCase()))
    const ok2 = filtroPrio === 'Todos' || i.prioridade === filtroPrio
    const ok3 = filtroStatus === 'Todos' || i.status_resolucao === filtroStatus
    return ok1 && ok2 && ok3
  })

  const stats = {
    total: incidentes.length,
    alta: incidentes.filter(i => i.prioridade === 'Alta').length,
    pendente: incidentes.filter(i => i.status_resolucao === 'Pendente').length,
    resolvido: incidentes.filter(i => i.status_resolucao === 'Resolvido').length,
  }

  // ── COMPONENTES REUTILIZÁVEIS ───────────────────
  const Filtros = () => (
    <section className={styles.filtros}>
      <input className={styles.busca} placeholder="🔍  Buscar por tipo, local ou solicitante..."
        value={busca} onChange={e => setBusca(e.target.value)} />
      <div className={styles.filtroGrupo}>
        {['Todos', 'Alta', 'Média', 'Baixa'].map(p => (
          <button key={p} className={`${styles.filtroBtn} ${filtroPrio === p ? styles.ativo : ''}`}
            onClick={() => setFiltroPrio(p)}>{p}</button>
        ))}
      </div>
      <div className={styles.filtroGrupo}>
        {['Todos', 'Pendente', 'Em Análise', 'Resolvido'].map(s => (
          <button key={s} className={`${styles.filtroBtn} ${filtroStatus === s ? styles.ativo : ''}`}
            onClick={() => setFiltroStatus(s)}>{s}</button>
        ))}
      </div>
    </section>
  )

  // ── RENDER ──────────────────────────────────────
  return (
    <div className={styles.page}>
      {menuAberto && <div className={styles.overlay2} onClick={() => setMenuAberto(false)} />}

      {/* SIDEBAR */}
      <aside className={`${styles.sidebar} ${menuAberto ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>ZelaCidade</span>
        </div>
        <nav className={styles.nav}>
          {[
            { id: 'dashboard',    icon: '📊', label: 'Dashboard' },
            { id: 'incidentes',   icon: '📋', label: 'Incidentes' },
            { id: 'estatisticas', icon: '📈', label: 'Estatísticas' },
            { id: 'mapa',         icon: '🗺️', label: 'Mapa' },
            { id: 'perfil',       icon: '👤', label: 'Perfil' },
          ].map(({ id, icon, label }) => (
            <button key={id}
              className={`${styles.navBtn} ${aba === id ? styles.navAtivo : ''}`}
              onClick={() => { setAba(id); setMenuAberto(false) }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </nav>
        <button className={styles.logoutBtn} onClick={logout}><span>🚪</span> Sair</button>
      </aside>

      {/* MAIN */}
      <main className={styles.main}>
        {/* TOPBAR MOBILE */}
        <div className={styles.topbar}>
          <button className={styles.menuBtn} onClick={() => setMenuAberto(true)}>☰</button>
          <span className={styles.topbarTitle}>⬡ ZelaCidade</span>
          <div className={styles.sinoWrap} ref={sinoRef}>
            <button className={styles.sinoBtn} onClick={() => { setSinoAberto(s => !s); marcarTodasLidas() }}>
              🔔
              {naoLidas > 0 && <span className={styles.sinoBadge}>{naoLidas}</span>}
            </button>
            {sinoAberto && <NotificacoesPanel />}
          </div>
        </div>

        {/* ══ ABA: DASHBOARD ══ */}
        {aba === 'dashboard' && <>
          <header className={styles.header}>
            <div>
              <h1 className={styles.titulo}>Painel de Incidentes</h1>
              <p className={styles.subtitulo}>Gestão urbana em tempo real</p>
            </div>
            <div className={styles.headerAcoes}>
              <div className={styles.sinoWrap}>
                <button className={styles.sinoBtn} onClick={() => { setSinoAberto(s => !s); marcarTodasLidas() }}>
                  🔔
                  {naoLidas > 0 && <span className={styles.sinoBadge}>{naoLidas}</span>}
                </button>
                {sinoAberto && <NotificacoesPanel />}
              </div>
              <button className={styles.btnVerde} onClick={abrirNovo}>+ Novo Incidente</button>
            </div>
          </header>

          <section className={styles.statsGrid}>
            <div className={styles.statCard}><span className={styles.statLabel}>Total</span><span className={styles.statNum}>{stats.total}</span></div>
            <div className={`${styles.statCard} ${styles.statVermelho}`}><span className={styles.statLabel}>Alta Prioridade</span><span className={styles.statNum}>{stats.alta}</span></div>
            <div className={`${styles.statCard} ${styles.statAmarelo}`}><span className={styles.statLabel}>Pendentes</span><span className={styles.statNum}>{stats.pendente}</span></div>
            <div className={`${styles.statCard} ${styles.statVerde}`}><span className={styles.statLabel}>Resolvidos</span><span className={styles.statNum}>{stats.resolvido}</span></div>
          </section>

          <Filtros />

          {loading
            ? <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Carregando...</p></div>
            : <section className={styles.lista}>
                {filtrados.length === 0
                  ? <div className={styles.vazio}>Nenhum incidente encontrado.</div>
                  : filtrados.map((inc, i) => (
                    <div key={inc.id} className={styles.card}
                      style={{ animationDelay: `${i * 35}ms` }}
                      onClick={() => setModal(inc)}>
                      <div className={styles.cardIcone}>{getIcone(inc.tipo_problema)}</div>
                      <div className={styles.cardInfo}>
                        <h3 className={styles.cardTitulo}>{inc.tipo_problema}</h3>
                        <p className={styles.cardDetalhe}>📍 {inc.localizacao}</p>
                        <p className={styles.cardDetalhe2}>👤 {inc.nome_solicitante}</p>
                      </div>
                      <div className={styles.cardMeta}>
                        <span className={styles.badge}
                          style={{ background: PRIORIDADE_COR[inc.prioridade] + '25', color: PRIORIDADE_COR[inc.prioridade] }}>
                          {inc.prioridade}
                        </span>
                        <span className={styles.badge}
                          style={{ background: STATUS_COR[inc.status_resolucao] + '25', color: STATUS_COR[inc.status_resolucao] }}>
                          {inc.status_resolucao}
                        </span>
                        <span className={styles.cardData}>{inc.data_registro}</span>
                      </div>
                    </div>
                  ))
                }
              </section>
          }
        </>}

        {/* ══ ABA: INCIDENTES ══ */}
        {aba === 'incidentes' && <>
          <header className={styles.header}>
            <div>
              <h1 className={styles.titulo}>Todos os Incidentes</h1>
              <p className={styles.subtitulo}>{incidentes.length} registros encontrados</p>
            </div>
            <button className={styles.btnVerde} onClick={abrirNovo}>+ Novo Incidente</button>
          </header>

          <Filtros />

          <div className={styles.tabelaWrap}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>#</th><th>Tipo</th><th>Localização</th>
                  <th>Solicitante</th><th>Prioridade</th>
                  <th>Status</th><th>Data</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0
                  ? <tr><td colSpan={8} className={styles.tabelaVazio}>Nenhum incidente encontrado.</td></tr>
                  : filtrados.map(inc => (
                    <tr key={inc.id} className={styles.tabelaRow} onClick={() => setModal(inc)}>
                      <td className={styles.tdId}>{inc.id}</td>
                      <td><span className={styles.tdTipo}>{getIcone(inc.tipo_problema)} {inc.tipo_problema}</span></td>
                      <td className={styles.tdLocal}>{inc.localizacao}</td>
                      <td>{inc.nome_solicitante}</td>
                      <td><span className={styles.badge} style={{ background: PRIORIDADE_COR[inc.prioridade] + '25', color: PRIORIDADE_COR[inc.prioridade] }}>{inc.prioridade}</span></td>
                      <td><span className={styles.badge} style={{ background: STATUS_COR[inc.status_resolucao] + '25', color: STATUS_COR[inc.status_resolucao] }}>{inc.status_resolucao}</span></td>
                      <td className={styles.tdData}>{inc.data_registro}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className={styles.tdAcoes}>
                          <button className={styles.btnAcaoVerde} onClick={() => abrirEditar(inc)}>✏️</button>
                          <button className={styles.btnAcaoVerm} onClick={() => deletar(inc.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </>}

        {/* ══ ABA: PERFIL ══ */}
        {aba === 'perfil' && <>
          <header className={styles.header}>
            <div>
              <h1 className={styles.titulo}>Meu Perfil</h1>
              <p className={styles.subtitulo}>Suas informações pessoais</p>
            </div>
          </header>

          <div className={styles.perfilCard}>
            <div className={styles.perfilTopo}>
              <div className={styles.avatar}>
                {perfil.nome ? perfil.nome[0].toUpperCase() : '?'}
              </div>
              <div>
                <h2 className={styles.perfilNome}>{perfil.nome || 'Usuário'}</h2>
                <p className={styles.perfilEmail}>{perfil.email || 'Sem email cadastrado'}</p>
              </div>
            </div>

            {perfilOk && <div className={styles.perfilSucesso}>✅ Perfil salvo com sucesso!</div>}

            <div className={styles.perfilGrid}>
              {[
                { label: '👤 Nome completo', key: 'nome', type: 'text' },
                { label: '✉️ Email',          key: 'email', type: 'email' },
                { label: '📞 Telefone',       key: 'telefone', type: 'text' },
                { label: '📍 Endereço',       key: 'endereco', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key} className={styles.perfilCampo}>
                  <span className={styles.perfilCampoLabel}>{label}</span>
                  {perfilEdit
                    ? <input className={styles.perfilInput} type={type}
                        value={perfil[key]} onChange={e => setPerfil(p => ({ ...p, [key]: e.target.value }))} />
                    : <span className={styles.perfilCampoVal}>{perfil[key] || '—'}</span>
                  }
                </div>
              ))}
            </div>

            <div className={styles.perfilAcoes}>
              {perfilEdit
                ? <>
                    <button className={styles.btnSalvar} onClick={salvarPerfil}>💾 Salvar</button>
                    <button className={styles.btnCancelar} onClick={() => setPerfilEdit(false)}>Cancelar</button>
                  </>
                : <button className={styles.btnSalvar} onClick={() => setPerfilEdit(true)}>✏️ Editar perfil</button>
              }
            </div>
          </div>

          <div className={styles.perfilStatsWrap}>
            <h3 className={styles.perfilStatsTitle}>Sua atividade</h3>
            <section className={styles.statsGrid}>
              <div className={styles.statCard}><span className={styles.statLabel}>Total</span><span className={styles.statNum}>{stats.total}</span></div>
              <div className={`${styles.statCard} ${styles.statVermelho}`}><span className={styles.statLabel}>Alta prioridade</span><span className={styles.statNum}>{stats.alta}</span></div>
              <div className={`${styles.statCard} ${styles.statVerde}`}><span className={styles.statLabel}>Resolvidos</span><span className={styles.statNum}>{stats.resolvido}</span></div>
            </section>
          </div>
        </>}

        {/* ══ ABA: ESTATÍSTICAS ══ */}
        {aba === 'estatisticas' && (() => {
          // Dados por tipo de problema
          const porTipo = Object.entries(
            incidentes.reduce((acc, i) => {
              acc[i.tipo_problema] = (acc[i.tipo_problema] || 0) + 1
              return acc
            }, {})
          ).map(([name, value]) => ({ name, value }))

          // Dados por prioridade
          const porPrioridade = [
            { name: 'Alta',  value: incidentes.filter(i => i.prioridade === 'Alta').length,  cor: '#ff5252' },
            { name: 'Média', value: incidentes.filter(i => i.prioridade === 'Média').length, cor: '#ffab40' },
            { name: 'Baixa', value: incidentes.filter(i => i.prioridade === 'Baixa').length, cor: '#69f0ae' },
          ]

          // Dados por status
          const porStatus = [
            { name: 'Pendente',    value: incidentes.filter(i => i.status_resolucao === 'Pendente').length,    cor: '#ffab40' },
            { name: 'Em Análise',  value: incidentes.filter(i => i.status_resolucao === 'Em Análise').length,  cor: '#40c4ff' },
            { name: 'Resolvido',   value: incidentes.filter(i => i.status_resolucao === 'Resolvido').length,   cor: '#69f0ae' },
          ]

          // Incidentes por mês
          const porMes = Object.entries(
            incidentes.reduce((acc, i) => {
              const mes = i.data_registro?.slice(0, 7) || 'N/A'
              acc[mes] = (acc[mes] || 0) + 1
              return acc
            }, {})
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6)
            .map(([name, total]) => ({ name: name.slice(5), total }))

          // Top localizações
          const topLocais = Object.entries(
            incidentes.reduce((acc, i) => {
              const local = i.localizacao?.split(',')[0] || 'N/A'
              acc[local] = (acc[local] || 0) + 1
              return acc
            }, {})
          )
            .sort(([,a],[,b]) => b - a)
            .slice(0, 5)
            .map(([name, total]) => ({ name, total }))

          const CORES_PIZZA = ['#00e676','#40c4ff','#ffab40','#ff5252','#ce93d8','#80cbc4','#fff176']

          const TooltipCustom = ({ active, payload }) => {
            if (!active || !payload?.length) return null
            return (
              <div className={styles.tooltip}>
                <span className={styles.tooltipLabel}>{payload[0].name || payload[0].payload?.name}</span>
                <span className={styles.tooltipVal}>{payload[0].value} incidente{payload[0].value !== 1 ? 's' : ''}</span>
              </div>
            )
          }

          return <>
            <header className={styles.header}>
              <div>
                <h1 className={styles.titulo}>Estatísticas</h1>
                <p className={styles.subtitulo}>Análise visual dos incidentes urbanos</p>
              </div>
            </header>

            {/* CARDS RESUMO */}
            <section className={styles.statsGrid}>
              <div className={styles.statCard}><span className={styles.statLabel}>Total</span><span className={styles.statNum}>{stats.total}</span></div>
              <div className={`${styles.statCard} ${styles.statVermelho}`}><span className={styles.statLabel}>Alta prioridade</span><span className={styles.statNum}>{stats.alta}</span></div>
              <div className={`${styles.statCard} ${styles.statAmarelo}`}><span className={styles.statLabel}>Pendentes</span><span className={styles.statNum}>{stats.pendente}</span></div>
              <div className={`${styles.statCard} ${styles.statVerde}`}><span className={styles.statLabel}>Resolvidos</span><span className={styles.statNum}>{stats.resolvido}</span></div>
            </section>

            {/* LINHA 1: Pizza Tipo + Pizza Status */}
            <div className={styles.graficosRow}>
              <div className={styles.graficoCard}>
                <h3 className={styles.graficoTitulo}>Tipos de Problema</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={porTipo} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={90} innerRadius={45}
                      paddingAngle={3}>
                      {porTipo.map((_, i) => (
                        <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipCustom />} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#4a6a4a' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className={styles.graficoCard}>
                <h3 className={styles.graficoTitulo}>Status dos Incidentes</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={porStatus} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={90} innerRadius={45}
                      paddingAngle={3}>
                      {porStatus.map((item, i) => (
                        <Cell key={i} fill={item.cor} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipCustom />} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#4a6a4a' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* LINHA 2: Barras por Prioridade + Area por Mês */}
            <div className={styles.graficosRow}>
              <div className={styles.graficoCard}>
                <h3 className={styles.graficoTitulo}>Incidentes por Prioridade</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porPrioridade} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2a1a" />
                    <XAxis dataKey="name" tick={{ fill: '#4a6a4a', fontSize: 13 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#4a6a4a', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<TooltipCustom />} cursor={{ fill: 'rgba(0,230,118,0.05)' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {porPrioridade.map((item, i) => (
                        <Cell key={i} fill={item.cor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={styles.graficoCard}>
                <h3 className={styles.graficoTitulo}>Evolução Mensal</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={porMes}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00e676" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2a1a" />
                    <XAxis dataKey="name" tick={{ fill: '#4a6a4a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#4a6a4a', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<TooltipCustom />} cursor={{ stroke: '#00e676', strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="total" stroke="#00e676" strokeWidth={2}
                      fill="url(#colorTotal)" dot={{ fill: '#00e676', r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* LINHA 3: Top Localizações */}
            <div className={styles.graficoCardFull}>
              <h3 className={styles.graficoTitulo}>Top 5 Localizações com Mais Incidentes</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topLocais} layout="vertical" barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2a1a" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4a6a4a', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140}
                    tick={{ fill: '#4a6a4a', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCustom />} cursor={{ fill: 'rgba(0,230,118,0.05)' }} />
                  <Bar dataKey="total" fill="#00e676" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        })()}

        {/* ══ ABA: MAPA ══ */}
        {aba === 'mapa' && (() => {
          const incFiltrados = incidentes.filter(i => {
            const okBusca = mapaBusca === '' || i.tipo_problema?.toLowerCase().includes(mapaBusca.toLowerCase()) || i.localizacao?.toLowerCase().includes(mapaBusca.toLowerCase())
            const okPrio = mapaFiltroPrio === 'Todos' || i.prioridade === mapaFiltroPrio
            return okBusca && okPrio
          })

          // Geocode: tenta extrair coordenadas da localização (fallback: centro do Brasil)
          const CENTER = [-15.7801, -47.9292]

          function focarIncidente(inc) {
            const coords = geocoords[inc.id]
            if (coords) {
              setMapaFoco({ lat: coords.lat, lng: coords.lng, id: inc.id })
            } else {
              // Tenta geocodificar na hora
              fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(inc.localizacao)}&format=json&limit=1`)
                .then(r => r.json())
                .then(d => {
                  if (d[0]) {
                    const coords = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) }
                    setGeocoords(prev => ({ ...prev, [inc.id]: coords }))
                    setMapaFoco({ ...coords, id: inc.id })
                  }
                }).catch(() => {})
            }
          }

          return <>
            <header className={styles.header}>
              <div>
                <h1 className={styles.titulo}>Mapa de Incidentes</h1>
                <p className={styles.subtitulo}>{incFiltrados.length} incidentes no mapa</p>
              </div>
            </header>

            {/* FILTROS DO MAPA */}
            <div className={styles.mapaFiltros}>
              <input className={styles.busca} placeholder="🔍  Buscar por tipo ou local..."
                value={mapaBusca} onChange={e => setMapaBusca(e.target.value)} />
              <div className={styles.filtroGrupo}>
                {['Todos','Alta','Média','Baixa'].map(p => (
                  <button key={p}
                    className={`${styles.filtroBtn} ${mapaFiltroPrio === p ? styles.ativo : ''}`}
                    onClick={() => setMapaFiltroPrio(p)}>{p}</button>
                ))}
              </div>
            </div>

            {/* LEGENDA */}
            <div className={styles.mapaLegenda}>
              {Object.entries(PRIORIDADE_COR).map(([label, cor]) => (
                <div key={label} className={styles.mapaLegendaItem}>
                  <span className={styles.mapaLegendaDot} style={{ background: cor }} />
                  <span>{label}</span>
                </div>
              ))}
              <div className={styles.mapaLegendaItem}>
                <span className={styles.mapaLegendaDot} style={{ background: '#40c4ff' }} />
                <span>Em Análise</span>
              </div>
            </div>

            {/* LAYOUT: MAPA + LISTA LATERAL */}
            <div className={styles.mapaLayout}>
              {/* MAPA */}
              <div className={styles.mapaContainer}>
                <MapContainer
                  center={CENTER}
                  zoom={5}
                  style={{ width: '100%', height: '100%', borderRadius: '12px' }}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {mapaFoco && (
                    <RecentralizarMapa coords={[mapaFoco.lat, mapaFoco.lng]} />
                  )}
                  {incFiltrados.map(inc => {
                    const coords = geocoords[inc.id]
                    if (!coords) return null
                    const cor = PRIORIDADE_COR[inc.prioridade] || '#00e676'
                    return (
                      <Marker key={inc.id} position={[coords.lat, coords.lng]} icon={criarIconePin(cor)}>
                        <Popup>
                          <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: 160 }}>
                            <strong style={{ fontSize: 14 }}>{getIcone(inc.tipo_problema)} {inc.tipo_problema}</strong><br />
                            <span style={{ fontSize: 12, color: '#666' }}>📍 {inc.localizacao}</span><br />
                            <span style={{ fontSize: 12, color: '#666' }}>👤 {inc.nome_solicitante}</span><br />
                            <span style={{
                              display: 'inline-block', marginTop: 6, padding: '2px 8px',
                              borderRadius: 10, fontSize: 11, fontWeight: 600,
                              background: (PRIORIDADE_COR[inc.prioridade] || '#ccc') + '30',
                              color: PRIORIDADE_COR[inc.prioridade] || '#333'
                            }}>{inc.prioridade}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  })}
                </MapContainer>
              </div>

              {/* LISTA LATERAL */}
              <div className={styles.mapaLista}>
                <p className={styles.mapaListaTitulo}>Clique para localizar</p>
                {incFiltrados.map(inc => (
                  <div key={inc.id} className={`${styles.mapaItem} ${mapaFoco?.id === inc.id ? styles.mapaItemAtivo : ''}`}
                    onClick={() => focarIncidente(inc)}>
                    <span className={styles.mapaItemIcone}>{getIcone(inc.tipo_problema)}</span>
                    <div className={styles.mapaItemInfo}>
                      <span className={styles.mapaItemTipo}>{inc.tipo_problema}</span>
                      <span className={styles.mapaItemLocal}>{inc.localizacao}</span>
                    </div>
                    <span className={styles.badge}
                      style={{ background: PRIORIDADE_COR[inc.prioridade] + '25', color: PRIORIDADE_COR[inc.prioridade], flexShrink: 0 }}>
                      {inc.prioridade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        })()}
      </main>

      {/* ══ MODAL DETALHE ══ */}
      {modal && (
        <div className={styles.overlayModal} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.fecharBtn} onClick={() => setModal(null)}>✕</button>
            {modal.imagem_problema && (
              <img className={styles.modalImg} src={modal.imagem_problema} alt="problema"
                onError={e => e.target.style.display = 'none'} />
            )}
            <div className={styles.modalIcone}>{getIcone(modal.tipo_problema)}</div>
            <h2 className={styles.modalTitulo}>{modal.tipo_problema}</h2>
            <div className={styles.modalBadges}>
              <span className={styles.badge} style={{ background: PRIORIDADE_COR[modal.prioridade] + '25', color: PRIORIDADE_COR[modal.prioridade] }}>{modal.prioridade}</span>
              <span className={styles.badge} style={{ background: STATUS_COR[modal.status_resolucao] + '25', color: STATUS_COR[modal.status_resolucao] }}>{modal.status_resolucao}</span>
            </div>
            <div className={styles.modalGrid}>
              {[
                ['📍 Localização', modal.localizacao],
                ['👤 Solicitante', modal.nome_solicitante],
                ['📞 Contato', modal.contato_solicitante],
                ['📅 Data/Hora', `${modal.data_registro} às ${modal.hora_registro}`],
              ].map(([label, val]) => (
                <div key={label} className={styles.modalItem}>
                  <span className={styles.modalLabel}>{label}</span>
                  <span className={styles.modalVal}>{val}</span>
                </div>
              ))}
            </div>
            {modal.descricao && (
              <div className={styles.modalDesc}>
                <span className={styles.modalLabel}>📝 Descrição</span>
                <p>{modal.descricao}</p>
              </div>
            )}
            <div className={styles.modalAcoes}>
              <button className={styles.btnSalvar} onClick={() => abrirEditar(modal)}>✏️ Editar</button>
              <button className={styles.btnCancelar} onClick={() => deletar(modal.id)}>🗑️ Deletar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL FORM ══ */}
      {formAberto && (
        <div className={styles.overlayModal} onClick={() => setFormAberto(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.fecharBtn} onClick={() => setFormAberto(false)}>✕</button>
            <h2 className={styles.modalTitulo}>{editandoId ? '✏️ Editar Incidente' : '➕ Novo Incidente'}</h2>

            <div className={styles.formGrid}>
              {/* TIPO */}
              <label className={`${styles.fLabel} ${styles.full}`}>
                Tipo de Problema *
                <select className={styles.fInput} value={form.tipo_problema}
                  onChange={e => setForm({ ...form, tipo_problema: e.target.value })}>
                  <option value="">Selecione...</option>
                  {Object.keys(TIPO_ICONE).map(t => <option key={t}>{t}</option>)}
                  <option value="Outro">Outro</option>
                </select>
              </label>

              {/* LOCALIZAÇÃO + GPS */}
              <label className={`${styles.fLabel} ${styles.full}`}>
                Localização *
                <div className={styles.gpsRow}>
                  <input className={styles.fInput} placeholder="Rua, número, bairro..."
                    value={form.localizacao}
                    onChange={e => setForm({ ...form, localizacao: e.target.value })} />
                  <button type="button" className={styles.btnGps} onClick={usarGPS} disabled={gpsLoading}>
                    {gpsLoading ? <span className={styles.spinnerPeq} /> : '📡'}
                    {gpsLoading ? 'Buscando...' : 'Usar GPS'}
                  </button>
                </div>
              </label>

              {/* PRIORIDADE / STATUS */}
              <label className={styles.fLabel}>
                Prioridade
                <select className={styles.fInput} value={form.prioridade}
                  onChange={e => setForm({ ...form, prioridade: e.target.value })}>
                  <option>Alta</option><option>Média</option><option>Baixa</option>
                </select>
              </label>
              <label className={styles.fLabel}>
                Status
                <select className={styles.fInput} value={form.status_resolucao}
                  onChange={e => setForm({ ...form, status_resolucao: e.target.value })}>
                  <option>Pendente</option><option>Em Análise</option><option>Resolvido</option>
                </select>
              </label>

              {/* SOLICITANTE / CONTATO */}
              <label className={styles.fLabel}>
                Nome do Solicitante
                <input className={styles.fInput} placeholder="Nome completo"
                  value={form.nome_solicitante}
                  onChange={e => setForm({ ...form, nome_solicitante: e.target.value })} />
              </label>
              <label className={styles.fLabel}>
                Contato
                <input className={styles.fInput} placeholder="Telefone ou email"
                  value={form.contato_solicitante}
                  onChange={e => setForm({ ...form, contato_solicitante: e.target.value })} />
              </label>

              {/* DATA / HORA */}
              <label className={styles.fLabel}>
                Data
                <input className={styles.fInput} type="date" value={form.data_registro}
                  onChange={e => setForm({ ...form, data_registro: e.target.value })} />
              </label>
              <label className={styles.fLabel}>
                Hora
                <input className={styles.fInput} type="time" value={form.hora_registro}
                  onChange={e => setForm({ ...form, hora_registro: e.target.value })} />
              </label>

              {/* FOTO */}
              <div className={`${styles.fLabel} ${styles.full}`}>
                <span className={styles.fLabelText}>📷 Foto do Problema</span>
                {imgPreview ? (
                  <div className={styles.imgPreviewWrap}>
                    <img className={styles.imgPreview} src={imgPreview} alt="preview" />
                    <button type="button" className={styles.btnRemoverImg} onClick={removerImg}>
                      ✕ Remover foto
                    </button>
                  </div>
                ) : (
                  <div className={styles.imgBotoes}>
                    <button type="button" className={styles.btnFoto}
                      onClick={() => fileRef.current?.click()}>
                      <span className={styles.btnFotoIcone}>🖼️</span>
                      <span>Galeria</span>
                    </button>
                    <button type="button" className={styles.btnFoto}
                      onClick={() => cameraRef.current?.click()}>
                      <span className={styles.btnFotoIcone}>📸</span>
                      <span>Câmera</span>
                    </button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={onImagem} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                  style={{ display: 'none' }} onChange={onImagem} />
              </div>

              {/* DESCRIÇÃO */}
              <label className={`${styles.fLabel} ${styles.full}`}>
                Descrição
                <textarea className={`${styles.fInput} ${styles.fTextarea}`}
                  placeholder="Descreva o problema em detalhes..."
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })} />
              </label>
            </div>

            <div className={styles.modalAcoes}>
              <button className={styles.btnSalvar} onClick={salvar}>💾 Salvar</button>
              <button className={styles.btnCancelar} onClick={() => setFormAberto(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}