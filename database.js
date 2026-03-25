const sqlite3 = require('sqlite3')
const { open } = require('sqlite')

const criarBanco = async () => {
    const db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    })

    // TABELA DE INCIDENTES — com usuario_id para saber quem cadastrou
    await db.exec(`
        CREATE TABLE IF NOT EXISTS incidentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            tipo_problema TEXT,
            localizacao TEXT,
            descricao TEXT,
            prioridade TEXT,
            nome_solicitante TEXT,
            contato_solicitante TEXT,
            data_registro TEXT,
            hora_registro TEXT,
            status_resolucao TEXT DEFAULT 'Pendente',
            imagem_problema TEXT
        )
    `)

    // TABELA DE USUÁRIOS — com campo 'papel' (admin ou cidadao)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            telefone TEXT,
            email TEXT UNIQUE,
            endereco TEXT,
            senha TEXT,
            papel TEXT DEFAULT 'cidadao'
        )
    `)

    // Adicionar colunas novas se já existir banco antigo (migration segura)
    try { await db.exec(`ALTER TABLE usuarios ADD COLUMN papel TEXT DEFAULT 'cidadao'`) } catch {}
    try { await db.exec(`ALTER TABLE incidentes ADD COLUMN usuario_id INTEGER`) } catch {}

    // SEED: dados iniciais apenas se tabela vazia
    const checagem = await db.get(`SELECT COUNT(*) AS total FROM incidentes`)
    if (checagem.total === 0) {
        await db.exec(`
            INSERT INTO incidentes
            (tipo_problema, localizacao, descricao, prioridade, nome_solicitante, contato_solicitante, data_registro, hora_registro, imagem_problema)
            VALUES
            ('Iluminação pública', 'Rua das Flores', 'Poste de iluminação pública apagado há vários dias.', 'Média', 'Ana Clara', '(21) 90000-0001', '2026-03-16', '10:21', 'https://itaitinga.ce.gov.br/fotos/165/Img0_600x400.jpg'),
            ('Vazamento de água', 'Rua das Camélias, 52', 'Vazamento de água constante próximo ao bueiro.', 'Alta', 'Julia Martins', '(21) 90000-0002', '2026-03-16', '10:00', ''),
            ('Árvore caída', 'Rua da VNW', 'Árvore caída bloqueando parcialmente a via.', 'Alta', 'Fernanda Kaka', '(21) 90000-0003', '2026-03-15', '07:00', ''),
            ('Acúmulo de lixo', 'Praça da Matriz, 456', 'Grande quantidade de lixo acumulado na área da praça.', 'Média', 'Felipe Dylon', '(21) 90000-0004', '2026-03-16', '10:22', ''),
            ('Assalto', 'Rua 123, Vila da Penha, Rio de Janeiro', 'Relato de assalto por dois homens em motocicleta.', 'Alta', 'João Silva', 'joao.silva@email.com', '2026-06-01', '18:30', ''),
            ('Vazamento de água', 'Rua das Flores, 45', 'Possível vazamento na rede de infraestrutura urbana.', 'Média', 'João Batista', '(21) 90000-0005', '2026-03-17', '09:15', ''),
            ('Buraco na rua', 'Rua Dev', 'Grande buraco formado após fortes chuvas.', 'Alta', 'Lúcia Alcântara', '(21) 90000-0006', '2026-02-28', '11:00', ''),
            ('Acúmulo de lixo', 'Avenida Ministro Amaral', 'Acúmulo de lixo em frente ao bueiro.', 'Alta', 'Ana Liz', '(21) 90000-0007', '2026-03-16', '10:24', ''),
            ('Buraco na rua', 'Rua Cecília, 23', 'Buraco presente há meses na via.', 'Alta', 'Diego Pereira', '(21) 90000-0008', '2026-03-16', '10:25', ''),
            ('Alagamento', 'Rua Gifone, 325', 'Rua frequentemente alagada durante períodos de chuva intensa.', 'Média', 'Carlos Henrique', '(21) 90000-0009', '2026-03-16', '10:00', '')
        `)
        console.log('✅ Dados iniciais inseridos.')
    }

    return db
}

module.exports = { criarBanco }