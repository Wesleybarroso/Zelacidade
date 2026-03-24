const express = require('express')
const { criarBanco } = require('./database')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')

const app = express()

app.use(express.json({ limit: '10mb' })) // limite aumentado para suportar imagens base64
app.use(cors({ origin: 'http://localhost:5173' }))

const SECRET = 'segredo_super_forte'

// ==========================
// 🛡️ MIDDLEWARE AUTH
// ==========================
function auth(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).send('Sem token')

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader

    try {
        const decoded = jwt.verify(token, SECRET)
        req.userId = decoded.id
        next()
    } catch {
        res.status(401).send('Token inválido')
    }
}

// ==========================
// 🔐 CRIAR USUÁRIO
// ==========================
app.post('/register', async (req, res) => {
    const { nome, telefone, email, endereco, senha } = req.body

    if (!email || !senha) return res.status(400).send('Email e senha são obrigatórios')

    const db = await criarBanco()
    const hash = await bcrypt.hash(senha, 10)

    try {
        await db.run(
            `INSERT INTO usuarios (nome, telefone, email, endereco, senha) VALUES (?, ?, ?, ?, ?)`,
            [nome, telefone, email, endereco, hash]
        )
        res.send('Usuário criado')
    } catch {
        res.status(400).send('Email já existe')
    }
})

// ==========================
// 🔑 LOGIN — retorna token + dados do usuário
// ==========================
app.post('/login', async (req, res) => {
    const { email, senha } = req.body
    const db = await criarBanco()

    const user = await db.get(`SELECT * FROM usuarios WHERE email = ?`, [email])
    if (!user) return res.status(401).send('Usuário não encontrado')

    const valido = await bcrypt.compare(senha, user.senha)
    if (!valido) return res.status(401).send('Senha inválida')

    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '1d' })

    // Retorna token + dados do usuário (sem a senha)
    res.json({
        token,
        usuario: {
            id: user.id,
            nome: user.nome || '',
            email: user.email || '',
            telefone: user.telefone || '',
            endereco: user.endereco || '',
        }
    })
})

// ==========================
// 👤 BUSCAR PERFIL
// ==========================
app.get('/perfil', auth, async (req, res) => {
    const db = await criarBanco()
    const user = await db.get(
        `SELECT id, nome, email, telefone, endereco FROM usuarios WHERE id = ?`,
        [req.userId]
    )
    if (!user) return res.status(404).send('Usuário não encontrado')
    res.json(user)
})

// ==========================
// ✏️ ATUALIZAR PERFIL
// ==========================
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
// 📊 INCIDENTES
// ==========================

// LISTAR
app.get('/incidentes', auth, async (req, res) => {
    const db = await criarBanco()
    const lista = await db.all(`SELECT * FROM incidentes`)
    res.json(lista)
})

// BUSCAR 1
app.get('/incidentes/:id', auth, async (req, res) => {
    const { id } = req.params
    const db = await criarBanco()
    const incidente = await db.get(`SELECT * FROM incidentes WHERE id = ?`, [id])
    if (!incidente) return res.status(404).send('Não encontrado')
    res.json(incidente)
})

// CRIAR
app.post('/incidentes', auth, async (req, res) => {
    const {
        tipo_problema, localizacao, descricao, prioridade,
        nome_solicitante, contato_solicitante,
        data_registro, hora_registro, imagem_problema
    } = req.body

    const db = await criarBanco()
    await db.run(`
        INSERT INTO incidentes (
            tipo_problema, localizacao, descricao, prioridade,
            nome_solicitante, contato_solicitante,
            data_registro, hora_registro, imagem_problema
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [tipo_problema, localizacao, descricao, prioridade,
        nome_solicitante, contato_solicitante,
        data_registro, hora_registro, imagem_problema])

    res.send('Incidente criado')
})

// DELETAR
app.delete('/incidentes/:id', auth, async (req, res) => {
    const { id } = req.params
    const db = await criarBanco()
    const incidente = await db.get(`SELECT * FROM incidentes WHERE id = ?`, [id])
    if (!incidente) return res.status(404).send('Não encontrado')
    await db.run(`DELETE FROM incidentes WHERE id = ?`, [id])
    res.send('Deletado')
})

// ATUALIZAR
app.put('/incidentes/:id', auth, async (req, res) => {
    const { id } = req.params
    const {
        tipo_problema, localizacao, descricao, prioridade,
        nome_solicitante, contato_solicitante,
        data_registro, hora_registro, imagem_problema, status_resolucao
    } = req.body

    const db = await criarBanco()
    const incidente = await db.get(`SELECT * FROM incidentes WHERE id = ?`, [id])
    if (!incidente) return res.status(404).send('Não encontrado')

    await db.run(`
        UPDATE incidentes
        SET tipo_problema = ?, localizacao = ?, descricao = ?, prioridade = ?,
            nome_solicitante = ?, contato_solicitante = ?, data_registro = ?,
            hora_registro = ?, imagem_problema = ?, status_resolucao = ?
        WHERE id = ?
    `, [tipo_problema, localizacao, descricao, prioridade,
        nome_solicitante, contato_solicitante,
        data_registro, hora_registro, imagem_problema, status_resolucao, id])

    res.send('Atualizado')
})

// HOME
app.get('/', (req, res) => res.send('API ZelaCidade rodando 🚀'))

// SERVER
const PORT = 3000
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`))