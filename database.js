const sqlite3 = require('sqlite3')
const { open } = require('sqlite')

const criarBanco = async () => {

    const db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    })

    // TABELA DE INCIDENTES
    await db.exec(`
        CREATE TABLE IF NOT EXISTS incidentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    // TABELA DE USUÁRIOS — agora com nome, telefone e endereco
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            telefone TEXT,
            email TEXT UNIQUE,
            endereco TEXT,
            senha TEXT
        )
    `)

    // SEED: inserir dados iniciais apenas se a tabela estiver vazia
    const checagem = await db.get(`SELECT COUNT(*) AS total FROM incidentes`)

    if (checagem.total === 0) {
        await db.exec(`
            INSERT INTO incidentes
            (tipo_problema, localizacao, descricao, prioridade, nome_solicitante, contato_solicitante, data_registro, hora_registro, imagem_problema)
            VALUES
            ('Iluminação pública', 'Rua das Flores', 'Poste de iluminação pública apagado há vários dias.', 'Média', 'Ana Clara', '(21) 90000-0001', '2026-03-16', '10:21', 'https://itaitinga.ce.gov.br/fotos/165/Img0_600x400.jpg'),
            ('Vazamento de água', 'Rua das Camélias, 52', 'Vazamento de água constante próximo ao bueiro.', 'Alta', 'Julia Martins', '(21) 90000-0002', '2026-03-16', '10:00', 'https://agenciabrasil.ebc.com.br/sites/default/files/thumbnails/image/2025/04/28/imagens_maria_julia_nascimento_1.jpeg'),
            ('Árvore caída', 'Rua da VNW', 'Árvore caída bloqueando parcialmente a via.', 'Alta', 'Fernanda Kaka', '(21) 90000-0003', '2026-03-15', '07:00', 'https://s3.diario.one/linus/images/c27bd001-a082-44f9-85d8-0fdfdb456a4f.webp'),
            ('Acúmulo de lixo', 'Praça da Matriz, 456', 'Grande quantidade de lixo acumulado na área da praça.', 'Média', 'Felipe Dylon', '(21) 90000-0004', '2026-03-16', '10:22', 'https://s2-g1.glbimg.com/g6l58FrG-iMjLrilj8PCQhix9Gc=/984x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2023/b/1/pL0lXlRreslSm8OQDrzg/moradores-de-bairro-em-caucaia-reclamam-de-lixo-nas-ruas..jpeg'),
            ('Assalto', 'Rua 123, Vila da Penha, Rio de Janeiro', 'Relato de assalto por dois homens em motocicleta. Levaram carteira e bolsa.', 'Alta', 'João Silva', 'joao.silva@email.com', '2026-06-01', '18:30', ''),
            ('Vazamento de água', 'Rua das Flores, 45', 'Possível vazamento na rede de infraestrutura urbana.', 'Média', 'João Batista', '(21) 90000-0005', '2026-03-17', '09:15', 'https://s2-g1.glbimg.com/vqegq0PwmIJTRfK5cd_-cNNRKpg=/984x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2020/w/g/9uI0WxQPC2YCLSeWEkMA/vazamento-de-agua-foi-registrado-em-rua-do-batel-em-curitiba-na-manha-desta-segunda-feira-27-.jpg'),
            ('Buraco na rua', 'Rua Dev', 'Grande buraco formado após fortes chuvas, oferecendo risco para veículos e pedestres.', 'Alta', 'Lúcia Alcântara', '(21) 90000-0006', '2026-02-28', '11:00', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSv9g_bnV3kLqBH_rX9tKrtDLTph_uTS0O4NA&s'),
            ('Acúmulo de lixo', 'Avenida Ministro Amaral', 'Acúmulo de lixo em frente ao bueiro, dificultando o escoamento da água.', 'Alta', 'Ana Liz', '(21) 90000-0007', '2026-03-16', '10:24', ''),
            ('Buraco na rua', 'Rua Cecília, 23', 'Buraco presente há meses na via, dificultando a passagem de veículos.', 'Alta', 'Diego Pereira', '(21) 90000-0008', '2026-03-16', '10:25', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6c9ZTHxmUHTz32PXrDMeuGI0Y8w-WP-ka4g&s'),
            ('Alagamento', 'Rua Gifone, 325', 'Rua frequentemente alagada durante períodos de chuva intensa.', 'Média', 'Carlos Henrique', '(21) 90000-0009', '2026-03-16', '10:00', 'https://www.otempo.com.br/adobe/dynamicmedia/deliver/dm-aid--51c801d9-3137-49c9-9720-83fcc583e837/cidades-franco-1709440294.jpg')
        `)
        console.log('✅ Dados iniciais inseridos.')
    }

    return db
}

module.exports = { criarBanco }