// 1. Importação dos pacotes necessários
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// --- CONFIGURAÇÃO DO UPLOAD PARA O CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "transportadora_app",
    format: async (req, file) => "jpg",
    public_id: (req, file) => "comprovativo-" + Date.now(),
  },
});

const upload = multer({ storage: storage });

// 4. Configuração do servidor Express
const app = express();
app.use(cors());
app.use(express.json());

// 5. Configuração da conexão com o Banco de Dados
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection()
  .then((connection) => {
    console.log(
      "✅ Conectado ao banco de dados MySQL com o ID " + connection.threadId
    );
    connection.release();
  })
  .catch((err) => {
    console.error("❌ Erro fatal ao conectar ao banco de dados:", err.stack);
    process.exit(1);
  });

// --- ROTAS DA API ---

app.get("/", (req, res) => {
  res
    .status(200)
    .json({ status: "ok", message: "API da Transportadora no ar!" });
});

// ROTA DE LOGIN

// ROTA DE LOGIN (SIMPLIFICADA SEM A PLACA)
app.post("/login", async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) {
    return res
      .status(400)
      .json({ success: false, message: "Usuário e senha são obrigatórios." });
  }

  // Query SQL simplificada para não buscar a placa, evitando o erro.
  const query = `
    SELECT 
        u.ID_USUARIO, 
        u.LOGIN, 
        u.SENHA_HASH, 
        u.ID_MOTORISTA, 
        m.NOME AS NOME_MOTORISTA
    FROM APP_USUARIOS u 
    JOIN FF_MOTORISTA m ON u.ID_MOTORISTA = m.ID
    WHERE u.LOGIN = ?`;

  try {
    const [results] = await db.query(query, [login]);
    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuário não encontrado." });
    }
    const usuario = results[0];

    if (senha === usuario.SENHA_HASH) {
      res.status(200).json({
        success: true,
        message: "Login bem-sucedido!",
        userData: {
          id_usuario: usuario.ID_USUARIO,
          login: usuario.LOGIN,
          id_motorista: usuario.ID_MOTORISTA, // Chave correta para o Flutter
          nome: usuario.NOME_MOTORISTA,
          placa: " ", // Enviando um valor padrão para não quebrar o app
        },
      });
    } else {
      res.status(401).json({ success: false, message: "Senha incorreta." });
    }
  } catch (err) {
    console.error("Erro na query de login:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

// ROTA PARA BUSCAR ROTA E ENTREGAS
app.get("/rota/:idMotorista", async (req, res) => {
  const { idMotorista } = req.params;
  const { status } = req.query;
  const statusDaBusca = status || "PENDENTE";

  const query = `
    SELECT
        r.id AS rota_id, r.codigo_viagem, r.total_frete,
        re.id AS rota_entrega_id, 
        re.destino,
        re.origem,
        re.valor_frete_editado AS valor_frete,
        re.status_entrega,
        re.img_entrega_url,
        re.img_devolucao_url,
        re.obs_entrega,
        c.NOME AS cliente_nome
    FROM FF_ROTA r
    JOIN FF_ROTA_ENTREGAS re ON r.id = re.id_rota
    JOIN FF_ENTREGA e ON re.id_entrega_original = e.id
    LEFT JOIN FF_CADASTRO c ON e.id_destinatario = c.CODIGO
    WHERE r.id_motorista = ? AND TRIM(r.status) = ?
    ORDER BY r.codigo_viagem, re.id;
    `;

  try {
    const [results] = await db.query(query, [idMotorista, statusDaBusca]);

    if (results.length === 0) {
      return res.status(200).json({
        success: false,
        message: `Nenhuma rota com status '${statusDaBusca}' encontrada.`,
      });
    }

    const rotas = results.reduce((acc, item) => {
      if (!acc[item.rota_id]) {
        acc[item.rota_id] = {
          rotaInfo: {
            id: item.rota_id,
            codigo: item.codigo_viagem,
            valorCarga: parseFloat(item.total_frete),
          },
          entregas: [],
        };
      }
      acc[item.rota_id].entregas.push({
        id: item.rota_entrega_id,
        clientName: item.cliente_nome || "FORT FRUIT LTDA",
        origin: item.origem || "Não informado",
        destination: item.destino || "Não informado",
        freightValue: parseFloat(item.valor_frete) || 0.0,
        status: item.status_entrega,
        imgEntregaUrl: item.img_entrega_url,
        imgDevolucaoUrl: item.img_devolucao_url,
        obs: item.obs_entrega,
      });
      return acc;
    }, {});

    const primeiraRota = Object.values(rotas)[0];
    res.status(200).json({ success: true, ...primeiraRota });
  } catch (err) {
    console.error("Erro na query de busca de rota:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

// ROTA PARA ATUALIZAR ENTREGA
app.put("/rota-entrega/:idRotaEntrega", async (req, res) => {
  const { idRotaEntrega } = req.params;
  const { status, obs, img_entrega, img_devolucao } = req.body;

  if (!status) {
    return res
      .status(400)
      .json({ success: false, message: "O status é obrigatório." });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const updateQuery = `
      UPDATE FF_ROTA_ENTREGAS 
      SET 
        status_entrega = ?, 
        obs_entrega = ?, 
        img_entrega_url = ?, 
        img_devolucao_url = ?,
        data_hora_atualizacao = NOW()
      WHERE id = ?;
    `;

    const values = [
      status,
      obs || null,
      img_entrega || null,
      img_devolucao || null,
      idRotaEntrega,
    ];
    await connection.query(updateQuery, values);
    await connection.commit();
    res
      .status(200)
      .json({ success: true, message: "Entrega atualizada com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao atualizar a entrega:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  } finally {
    connection.release();
  }
});

// ROTA DE UPLOAD DE IMAGEM
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .send({ success: false, message: "Nenhum ficheiro enviado." });
  }
  res.send({ success: true, imageUrl: req.file.path });
});

// --- ROTAS DE DESPESAS ---
app.get("/despesas/:idMotorista", async (req, res) => {
  const { idMotorista } = req.params;

  const query = `
    SELECT 
        d.id, 
        d.categoria, 
        d.valor, 
        d.data_despesa, 
        d.img_comprovativo_url, 
        d.obs 
    FROM 
        FF_DESPESAS d
    JOIN 
        FF_ROTA r ON d.id_rota = r.id
    WHERE 
        d.id_motorista = ? AND TRIM(r.status) = 'PENDENTE'
    ORDER BY 
        d.data_despesa DESC;
  `;

  try {
    const [results] = await db.query(query, [idMotorista]);
    res.status(200).json({ success: true, expenses: results });
  } catch (err) {
    console.error("Erro ao buscar despesas:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

app.post("/despesa", async (req, res) => {
  const {
    id_motorista,
    id_rota,
    categoria,
    valor,
    data_despesa,
    img_comprovativo_url,
    obs,
  } = req.body;

  if (!id_motorista || !id_rota || !categoria || !valor || !data_despesa) {
    return res
      .status(400)
      .json({ success: false, message: "Campos obrigatórios em falta." });
  }

  const query = `
    INSERT INTO FF_DESPESAS (id_motorista, id_rota, categoria, valor, data_despesa, img_comprovativo_url, obs)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `;
  const values = [
    id_motorista,
    id_rota,
    categoria,
    valor,
    data_despesa,
    img_comprovativo_url,
    obs,
  ];

  try {
    await db.query(query, values);
    res
      .status(201)
      .json({ success: true, message: "Despesa adicionada com sucesso!" });
  } catch (err) {
    console.error("Erro ao adicionar despesa:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

app.delete("/despesa/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "O ID da despesa é obrigatório." });
  }

  const query = `DELETE FROM FF_DESPESAS WHERE id = ?;`;

  try {
    const [result] = await db.query(query, [id]);

    if (result.affectedRows > 0) {
      res
        .status(200)
        .json({ success: true, message: "Despesa apagada com sucesso." });
    } else {
      res.status(404).json({
        success: false,
        message: "Nenhuma despesa encontrada com este ID.",
      });
    }
  } catch (err) {
    console.error("Erro ao apagar despesa:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

// ROTA GET PARA BUSCAR AS DESPESAS DE UMA ROTA ESPECÍFICA
app.get("/despesas/rota/:idRota", async (req, res) => {
  const { idRota } = req.params;

  if (!idRota) {
    return res
      .status(400)
      .json({ success: false, message: "O ID da Rota é obrigatório." });
  }

  const query = `
    SELECT id, categoria, valor, data_despesa, img_comprovativo_url, obs 
    FROM FF_DESPESAS 
    WHERE id_rota = ? 
    ORDER BY data_despesa DESC;
  `;

  try {
    const [results] = await db.query(query, [idRota]);
    res.status(200).json({ success: true, expenses: results });
  } catch (err) {
    console.error("Erro ao buscar despesas da rota:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

// GESTOR DE ERROS GLOBAL
app.use((err, req, res, next) => {
  console.error("--- ERRO GLOBAL CAPTURADO ---", err);
  res.status(err.http_code || 500).json({
    success: false,
    message: err.message || "Ocorreu um erro inesperado no servidor.",
  });
});

// =======================================================
// --- ROTAS PARA O CONTROLE DE BOLA ---
// =======================================================

// ROTA PARA LISTAR TODOS OS JOGADORES
app.get("/jogadores", async (req, res) => {
  try {
    const query = "SELECT * FROM BOLA_JOGADORES ORDER BY nome ASC;";
    const [results] = await db.query(query);
    res.status(200).json({ success: true, players: results });
  } catch (err) {
    console.error("Erro ao buscar jogadores:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

// ROTA PARA ADICIONAR UM NOVO JOGADOR
app.post("/jogadores", async (req, res) => {
  const { nome } = req.body;
  if (!nome || nome.trim() === "") {
    return res
      .status(400)
      .json({ success: false, message: "O nome é obrigatório." });
  }
  try {
    const query = "INSERT INTO BOLA_JOGADORES (nome) VALUES (?);";
    const [result] = await db.query(query, [nome.trim()]);
    res.status(201).json({
      success: true,
      message: "Jogador adicionado!",
      newPlayer: {
        id: result.insertId,
        nome: nome.trim(),
        presente: false,
        valor_pago: 0,
      },
    });
  } catch (err) {
    console.error("Erro ao adicionar jogador:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

// ROTA PARA ATUALIZAR UM JOGADOR (PRESENÇA, VALOR PAGO, NOME, ETC)
app.put("/jogadores/:id", async (req, res) => {
  const { id } = req.params;
  // Adiciona 'goleiro' à desestruturação
  const { nome, presente, valor_pago, goleiro } = req.body;

  let fieldsToUpdate = [];
  let values = [];

  if (nome !== undefined) {
    fieldsToUpdate.push("nome = ?");
    values.push(nome);
  }
  if (presente !== undefined) {
    fieldsToUpdate.push("presente = ?");
    values.push(presente);
  }
  if (valor_pago !== undefined) {
    fieldsToUpdate.push("valor_pago = ?");
    values.push(valor_pago);
  }
  // Adiciona a lógica para o campo 'goleiro'
  if (goleiro !== undefined) {
    fieldsToUpdate.push("goleiro = ?");
    values.push(goleiro);
  }

  if (fieldsToUpdate.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Nenhum campo para atualizar." });
  }

  values.push(id);

  try {
    const query = `UPDATE BOLA_JOGADORES SET ${fieldsToUpdate.join(
      ", "
    )} WHERE id = ?;`;
    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Jogador não encontrado." });
    }
    res
      .status(200)
      .json({ success: true, message: "Jogador atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar jogador:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

// ROTA BÔNUS: RESETAR A LISTA PARA A PRÓXIMA SEMANA
app.post("/jogadores/reset", async (req, res) => {
  try {
    const query = "UPDATE BOLA_JOGADORES SET presente = false, valor_pago = 0;";
    await db.query(query);
    res.status(200).json({
      success: true,
      message: "Lista de presença e pagamentos reiniciada!",
    });
  } catch (err) {
    console.error("Erro ao resetar a lista:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
});

// Inicialização do Servidor
const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor a rodar na porta ${PORT}`);
});
