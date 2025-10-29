import React, { useState, useEffect } from "react";

// Função utilitária para embaralhar um array (Algoritmo Fisher-Yates)
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// A lista inicial será vazia para começar sem jogadores
const initialPlayers = [];

const MAX_GOALKEEPERS = 3; // Limite de goleiros

function PlayerList() {
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // ESTADO: Para armazenar os times e as reservas
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [reserves, setReserves] = useState([]);

  // Efeito para BUSCAR os dados do localStorage quando o componente carregar
  useEffect(() => {
    try {
      const savedData = localStorage.getItem("jogadores");
      let savedPlayers = savedData ? JSON.parse(savedData) : initialPlayers;

      // Garante que jogadores antigos que não tinham isGoalKeeper recebam o valor padrão
      savedPlayers = savedPlayers.map((player) => ({
        isGoalKeeper: false, // Adiciona o novo campo
        ...player,
      }));

      setPlayers(savedPlayers);
    } catch (error) {
      console.error("Erro ao buscar jogadores no localStorage:", error);
      setPlayers(initialPlayers);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Efeito para SALVAR os dados no localStorage sempre que o estado 'players' mudar
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem("jogadores", JSON.stringify(players));
      } catch (error) {
        console.error("Erro ao salvar jogadores no localStorage:", error);
      }
    }
  }, [players, isLoading]);

  // ----- FUNÇÕES PARA MANIPULAR O ESTADO -----

  const togglePresenca = (playerId) => {
    setPlayers(
      players.map((player) =>
        player.id === playerId
          ? { ...player, presente: !player.presente }
          : player
      )
    );
    // Limpa os times se o status de presença for alterado
    setTeamA([]);
    setTeamB([]);
    setReserves([]);
  };

  // FUNÇÃO: Alterna o status de goleiro
  const toggleGoalKeeper = (playerId) => {
    const currentKeepers = players.filter((p) => p.isGoalKeeper).length;

    setPlayers(
      players.map((player) => {
        if (player.id === playerId) {
          // Se já é goleiro, pode remover
          if (player.isGoalKeeper) {
            return { ...player, isGoalKeeper: false };
          }
          // Se não é goleiro, checa o limite
          if (currentKeepers < MAX_GOALKEEPERS) {
            return { ...player, isGoalKeeper: true };
          }
          // Se atingiu o limite, não faz nada
          alert(`Limite de ${MAX_GOALKEEPERS} goleiros atingido.`);
          return player;
        }
        return player;
      })
    );
    // Limpa os times se a função do jogador mudar
    setTeamA([]);
    setTeamB([]);
    setReserves([]);
  };

  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (newPlayerName.trim() === "") return;

    const newPlayer = {
      id: Date.now(), // ID único baseado no timestamp
      name: newPlayerName,
      presente: true, // Já entra como presente
      valorPago: 0,
      isGoalKeeper: false, // NOVO CAMPO
    };
    setPlayers([...players, newPlayer]);
    setNewPlayerName("");
    // Limpa os times se um novo jogador for adicionado
    setTeamA([]);
    setTeamB([]);
    setReserves([]);
  };

  const handleValorChange = (playerId, valor) => {
    const valorNumerico = parseFloat(valor) || 0;
    setPlayers(
      players.map((player) =>
        player.id === playerId
          ? { ...player, valorPago: valorNumerico }
          : player
      )
    );
  };

  // FUNÇÃO: Remove o jogador da lista
  const handleRemovePlayer = (playerId) => {
    setPlayers(players.filter((player) => player.id !== playerId));
    // Limpa os times se um jogador for removido
    setTeamA([]);
    setTeamB([]);
    setReserves([]);
  };

  // FUNÇÃO CORRIGIDA: Garante no máximo um goleiro por time.
  const handleGenerateTeams = () => {
    // 1. Separa confirmados em Goleiros e Jogadores de Linha (Shuffled)
    const confirmedKeepers = shuffleArray(
      players.filter((p) => p.presente && p.isGoalKeeper)
    );
    const confirmedLinePlayers = shuffleArray(
      players.filter((p) => p.presente && !p.isGoalKeeper)
    );

    let teamA = [];
    let teamB = [];
    let reserves = [];

    // 2. Distribui os Goleiros primeiro (máx. 1 por time)
    if (confirmedKeepers.length > 0) {
      teamA.push(confirmedKeepers.shift());
    }

    if (confirmedKeepers.length > 0) {
      teamB.push(confirmedKeepers.shift());
    }

    // O que sobrou dos goleiros (máximo 1) vai para a reserva
    reserves.push(...confirmedKeepers);

    // 3. Distribui os Jogadores de Linha para preencher as vagas restantes (5 no total)
    const requiredForA = 5 - teamA.length;
    const requiredForB = 5 - teamB.length;

    // Preenche Time A
    for (let i = 0; i < requiredForA && confirmedLinePlayers.length > 0; i++) {
      teamA.push(confirmedLinePlayers.shift());
    }

    // Preenche Time B
    for (let i = 0; i < requiredForB && confirmedLinePlayers.length > 0; i++) {
      teamB.push(confirmedLinePlayers.shift());
    }

    // 4. O que sobrou (jogadores de linha) vai para a reserva
    reserves.push(...confirmedLinePlayers);

    // 5. Atualiza o estado
    setTeamA(teamA);
    setTeamB(teamB);
    setReserves(reserves);
  };

  // ----- CÁLCULOS DERIVADOS E FUNÇÕES DE COMPARTILHAMENTO -----

  const confirmados = players.filter((p) => p.presente).length;
  const totalArrecadado = players.reduce(
    (total, player) => total + player.valorPago,
    0
  );

  // 1. Gera a mensagem formatada para o WhatsApp (Sem ícones estranhos)
  const generateWhatsAppMessage = () => {
    let message = `*Controle da Bola de Quinta-feira (20:00)*\n\n`;
    message += `*Confirmados:* ${confirmados} / ${players.length}\n`;
    message += `*Total Arrecadado:* R$ ${totalArrecadado
      .toFixed(2)
      .replace(".", ",")}\n\n`;
    message += `*STATUS DOS JOGADORES:*\n`;

    // Constrói a lista de jogadores
    players.forEach((player) => {
      let status = "";

      // Adiciona o status de Goleiro se for o caso
      const keeperStatus = player.isGoalKeeper ? "(Goleiro) " : "";

      if (!player.presente) {
        status = "NAO CONFIRMOU";
      } else if (player.valorPago > 0) {
        status = `PAGO (R$ ${player.valorPago.toFixed(2).replace(".", ",")})`;
      } else {
        status = "PENDENTE DE PAGAMENTO";
      }

      // Formatando a linha: • *Nome do Jogador* - Status
      message += `• *${player.name}* ${keeperStatus}- ${status}\n`;
    });

    // Se os times foram gerados, adiciona à mensagem
    if (teamA.length > 0) {
      message += `\n*------------------------------*\n`;
      message += `*TIMES ALEATÓRIOS:*\n`;

      // Função auxiliar para formatar a lista de times na mensagem
      const formatTeam = (team) =>
        team
          .map((p) => `  • ${p.name} ${p.isGoalKeeper ? "(G)" : ""}`)
          .join("\n");

      message += `\n*TIME A (Azul 5x5):*\n`;
      message += formatTeam(teamA) + "\n";

      message += `\n*TIME B (Amarelo 5x5):*\n`;
      message += formatTeam(teamB) + "\n";

      if (reserves.length > 0) {
        message += `\n*RESERVAS (${reserves.length}):*\n`;
        message += formatTeam(reserves);
      }
    }

    return message;
  };

  // 2. Abre o link do WhatsApp
  const handleShareOnWhatsApp = () => {
    const text = generateWhatsAppMessage();
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  // ----- RENDERIZAÇÃO DO COMPONENTE -----

  if (isLoading) {
    return <div className="loading-message">Carregando dados do jogo...</div>;
  }

  const emptyListMessage = (
    <div className="player-list-container">
      <div className="header">
        <h2>Bola de Quinta-feira (20:00)</h2>
        <p className="confirmados-count">Ainda não há jogadores cadastrados.</p>
      </div>
      <div className="summary-footer">
        <h3>Total Arrecadado</h3>
        <p className="total-amount">R$ 0,00</p>
      </div>
    </div>
  );

  // Bloco de JSX dos times
  const teamsBlock = teamA.length > 0 && (
    <div
      className="teams-container"
      style={{
        marginTop: "20px",
        padding: "15px",
        backgroundColor: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        color: "#333",
        marginBottom: "20px",
      }}
    >
      <h3
        style={{ marginBottom: "10px", color: "#1c1e21", textAlign: "center" }}
      >
        🏆 Times Gerados 🏆
      </h3>

      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        {/* Time A */}
        <div
          style={{
            flex: 1,
            minWidth: "150px",
            padding: "10px",
            border: "2px solid #007bff",
            borderRadius: "8px",
            marginBottom: "10px",
          }}
        >
          <h4
            style={{
              color: "#007bff",
              marginBottom: "5px",
              textAlign: "center",
            }}
          >
            Time A (Azul)
          </h4>
          <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
            {teamA.map((p) => (
              <li key={p.id} style={{ padding: "2px 0" }}>
                {p.isGoalKeeper ? "🧤" : "⚽"} {p.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Time B - Cor Amarela */}
        <div
          style={{
            flex: 1,
            minWidth: "150px",
            padding: "10px",
            border: "2px solid #ffc107",
            borderRadius: "8px",
            marginBottom: "10px",
          }}
        >
          <h4
            style={{
              color: "#ffc107",
              marginBottom: "5px",
              textAlign: "center",
            }}
          >
            Time B (Amarelo)
          </h4>
          <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
            {teamB.map((p) => (
              <li key={p.id} style={{ padding: "2px 0" }}>
                {p.isGoalKeeper ? "🧤" : "⚽"} {p.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Reserva */}
      {reserves.length > 0 && (
        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: "#fff3cd",
            color: "#856404",
            borderRadius: "8px",
            border: "1px solid #ffeeba",
            textAlign: "center",
          }}
        >
          <h4 style={{ margin: "0 0 5px 0" }}>Reservas ({reserves.length})</h4>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            {reserves.map((p) => p.name).join(", ")}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Formulário para adicionar novo jogador */}
      <form onSubmit={handleAddPlayer} className="add-player-form">
        <input
          type="text"
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
          placeholder="Adicionar jogador..."
          className="add-player-input"
        />
        <button type="submit" className="add-player-button">
          +
        </button>
      </form>

      {/* NOVO CONTAINER FLEXÍVEL PARA ALINHAR BOTÕES LADO A LADO */}
      {(players.length > 0 || confirmados >= 10) && (
        <div className="action-buttons-container">
          {/* BOTÃO DE COMPARTILHAR */}
          {players.length > 0 && (
            <button
              onClick={handleShareOnWhatsApp}
              className="share-button"
              style={{
                padding: "10px",
                backgroundColor: "#25D366",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "bold",
              }}
            >
              WhatsApp
            </button>
          )}

          {/* BOTÃO: Montar Times - visível apenas com 10+ confirmados */}
          {confirmados >= 10 && (
            <button
              onClick={handleGenerateTeams}
              style={{
                padding: "10px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "bold",
              }}
            >
              Montar Times ({confirmados})
            </button>
          )}
        </div>
      )}

      {/* POSICIONAMENTO: Bloco dos times aparece antes da lista de jogadores */}
      {teamsBlock}

      {players.length === 0 ? (
        emptyListMessage
      ) : (
        /* Container da lista de jogadores */
        <div className="player-list-container">
          <div className="header">
            <h2>Bola de Quinta-feira (20:00)</h2>
            <p className="confirmados-count">
              Confirmados:{" "}
              <strong>
                {confirmados} / {players.length}
              </strong>
            </p>
          </div>

          <ul className="player-list">
            {players.map((player) => (
              <li
                key={player.id}
                className={`player-item ${player.presente ? "presente" : ""}`}
              >
                <div className="player-info">
                  {/* Ícone de goleiro ao lado do nome */}
                  {player.isGoalKeeper && (
                    <span className="goalkeeper-icon">🧤</span>
                  )}
                  <img
                    src={`https://api.dicebear.com/8.x/personas/svg?seed=${player.name}`}
                    alt={`Avatar de ${player.name}`}
                    className="player-avatar"
                  />
                  <span className="player-name">{player.name}</span>
                </div>
                <div className="player-actions">
                  {/* NOVO BOTÃO: Alternar Goleiro */}
                  <button
                    onClick={() => toggleGoalKeeper(player.id)}
                    className={
                      player.isGoalKeeper
                        ? "button-goleiro-ativo"
                        : "button-goleiro-inativo"
                    }
                    title={
                      player.isGoalKeeper ? "Remover Goleiro" : "Tornar Goleiro"
                    }
                  >
                    🧤
                  </button>
                  <div className="payment-input-wrapper">
                    <span>R$</span>
                    <input
                      type="number"
                      step="0.01"
                      className="payment-input"
                      placeholder="Valor"
                      value={player.valorPago === 0 ? "" : player.valorPago}
                      onChange={(e) =>
                        handleValorChange(player.id, e.target.value)
                      }
                    />
                  </div>
                  <button
                    onClick={() => togglePresenca(player.id)}
                    className={
                      !player.presente
                        ? "button-pendente"
                        : player.valorPago > 0
                        ? "button-pago"
                        : "button-pendente-pagamento"
                    }
                  >
                    {!player.presente
                      ? "Confirmar"
                      : player.valorPago > 0
                      ? "Pago ✔️"
                      : "Pendente"}
                  </button>
                  {/* BOTÃO DE REMOVER */}
                  <button
                    onClick={() => handleRemovePlayer(player.id)}
                    className="button-remover"
                  >
                    X
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Rodapé com o total arrecadado */}
          <div className="summary-footer">
            <h3>Total Arrecadado</h3>
            <p className="total-amount">
              R$ {totalArrecadado.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default PlayerList;
