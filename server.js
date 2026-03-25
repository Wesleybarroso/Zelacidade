const express = require('express')
const { criarBanco } = require('./database')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(cors({ origin: 'http://localhost:5173' }))

const SECRET = 'segredo_super_forte'

// ==========================
// 🛡️ MIDDLEWARE AUTH
// ==========================
function auth(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).send('Sem token')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    try {
        const decoded = jwt.verify(token, SECRET)
        req.userId = decoded.id
        req.userPapel = decoded.papel
        next()
    } catch {
        res.status(401).send('Token inválido')
    }
}

// Middleware: somente admin
function soAdmin(req, res, next) {
    if (req.userPapel !== 'admin') return res.status(403).send('Acesso restrito a administradores')
    next()
}

// ==========================
// 🔐 REGISTRAR
// ==========================
app.post('/register', async (req, res) => {
    const { nome, telefone, email, endereco, senha } = req.body
    if (!email || !senha) return res.status(400).send('Email e senha são obrigatórios')

    const db = await criarBanco()
    const hash = await bcrypt.hash(senha, 10)

    try {
        await db.run(
            `INSERT INTO usuarios (nome, telefone, email, endereco, senha, papel) VALUES (?, ?, ?, ?, ?, 'cidadao')`,
            [nome, telefone, email, endereco, hash]
        )
        res.send('Usuário criado')
    } catch {
        res.status(400).send('Email já existe')
    }
})

// ==========================
// 🔑 LOGIN
// ==========================
app.post('/login', async (req, res) => {
    const { email, senha } = req.body
    const db = await criarBanco()

    const user = await db.get(`SELECT * FROM usuarios WHERE email = ?`, [email])
    if (!user) return res.status(401).send('Usuário não encontrado')

    const valido = await bcrypt.compare(senha, user.senha)
    if (!valido) return res.status(401).send('Senha inválida')

    // Inclui o papel no token
    const token = jwt.sign({ id: user.id, papel: user.papel }, SECRET, { expiresIn: '1d' })

    res.json({
        token,
        usuario: {
            id: user.id,
            nome: user.nome || '',
            email: user.email || '',
            telefone: user.telefone || '',
            endereco: user.endereco || '',
            papel: user.papel || 'cidadao',
        }
    })
})

// ==========================
// 👤 PERFIL
// ==========================
app.get('/perfil', auth, async (req, res) => {
    const db = await criarBanco()
    const user = await db.get(
        `SELECT id, nome, email, telefone, endereco, papel FROM usuarios WHERE id = ?`,
        [req.userId]
    )
    if (!user) return res.status(404).send('Usuário não encontrado')
    res.json(user)
})

app.put('/perfil', auth, async (req, res) => {
    const { nome, telefone, endereco } = req.body
    const db = await criarBanco()
    await db.run(
        `UPDATE usuarios SET nome = ?, telefone = ?, endereco = ? WHERE id = ?`,
        [nome, telefone, endereco, req.userId]
    )
    res.send('Perfil atualizado')
})

// ==========================
// 👥 ADMIN: LISTAR USUÁRIOS
// ==========================
app.get('/usuarios', auth, soAdmin, async (req, res) => {
    const db = await criarBanco()
    const lista = await db.all(`SELECT id, nome, email, telefone, endereco, papel FROM usuarios`)
    res.json(lista)
})

// Admin muda papel de um usuário
app.put('/usuarios/:id/papel', auth, soAdmin, async (req, res) => {
    const { papel } = req.body
    if (!['admin', 'cidadao'].includes(papel)) return res.status(400).send('Papel inválido')
    const db = await criarBanco()
    await db.run(`UPDATE usuarios SET papel = ? WHERE id = ?`, [papel, req.params.id])
    res.send('Papel atualizado')
})

// ==========================
// 📊 INCIDENTES
// ==========================

// LISTAR
// Admin vê todos | Cidadão vê só os seus
app.get('/incidentes', auth, async (req, res) => {
    const db = await criarBanco()
    let lista
    if (req.userPapel === 'admin') {
        lista = await db.all(`SELECT * FROM incidentes ORDER BY id DESC`)
    } else {
        lista = await db.all(`SELECT * FROM incidentes WHERE usuario_id = ? ORDER BY id DESC`, [req.userId])
    }
    res.json(lista)
})

// BUSCAR 1
app.get('/incidentes/:id', auth, async (req, res) => {
    const db = await criarBanco()
    const inc = await db.get(`SELECT * FROM incidentes WHERE id = ?`, [req.params.id])
    if (!inc) return res.status(404).send('Não encontrado')
    // Cidadão só pode ver o próprio
    if (req.userPapel !== 'admin' && inc.usuario_id !== req.userId) return res.status(403).send('Acesso negado')
    res.json(inc)
})

// CRIAR — qualquer usuário logado pode criar
app.post('/incidentes', auth, async (req, res) => {
    const { tipo_problema, localizacao, descricao, prioridade,
            nome_solicitante, contato_solicitante,
            data_registro, hora_registro, imagem_problema } = req.body
    const db = await criarBanco()
    await db.run(`
        INSERT INTO incidentes (
            usuario_id, tipo_problema, localizacao, descricao, prioridade,
            nome_solicitante, contato_solicitante, data_registro, hora_registro, imagem_problema
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.userId, tipo_problema, localizacao, descricao, prioridade,
        nome_solicitante, contato_solicitante, data_registro, hora_registro, imagem_problema])
    res.send('Incidente criado')
})

// DELETAR — admin deleta qualquer | cidadão só o próprio
app.delete('/incidentes/:id', auth, async (req, res) => {
    const db = await criarBanco()
    const inc = await db.get(`SELECT * FROM incidentes WHERE id = ?`, [req.params.id])
    if (!inc) return res.status(404).send('Não encontrado')
    if (req.userPapel !== 'admin' && inc.usuario_id !== req.userId) return res.status(403).send('Acesso negado')
    await db.run(`DELETE FROM incidentes WHERE id = ?`, [req.params.id])
    res.send('Deletado')
})

// ATUALIZAR — admin atualiza qualquer | cidadão só o próprio (e não pode mudar status)
app.put('/incidentes/:id', auth, async (req, res) => {
    const db = await criarBanco()
    const inc = await db.get(`SELECT * FROM incidentes WHERE id = ?`, [req.params.id])
    if (!inc) return res.status(404).send('Não encontrado')
    if (req.userPapel !== 'admin' && inc.usuario_id !== req.userId) return res.status(403).send('Acesso negado')

    const { tipo_problema, localizacao, descricao, prioridade,
            nome_solicitante, contato_solicitante,
            data_registro, hora_registro, imagem_problema, status_resolucao } = req.body

    // Cidadão não pode alterar o status_resolucao
    const novoStatus = req.userPapel === 'admin' ? status_resolucao : inc.status_resolucao

    await db.run(`
        UPDATE incidentes
        SET tipo_problema=?, localizacao=?, descricao=?, prioridade=?,
            nome_solicitante=?, contato_solicitante=?, data_registro=?,
            hora_registro=?, imagem_problema=?, status_resolucao=?
        WHERE id=?
    `, [tipo_problema, localizacao, descricao, prioridade,
        nome_solicitante, contato_solicitante, data_registro,
        hora_registro, imagem_problema, novoStatus, req.params.id])
    res.send('Atualizado')
})

// ==========================
// 🏠 HOME
// ==========================
app.get('/', (req, res) => res.send('API ZelaCidade rodando 🚀'))

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'))