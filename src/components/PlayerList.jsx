import React, { useState, useEffect } from "react";
// O Vercel KV não é mais necessário, então removemos a importação.
// import { createClient } from "@vercel/kv";

// A lista inicial será vazia para começar sem jogadores
const initialPlayers = [];

function PlayerList() {
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Efeito para BUSCAR os dados do localStorage quando o componente carregar
  useEffect(() => {
    // A lógica agora usa localStorage
    try {
      const savedData = localStorage.getItem("jogadores");
      const savedPlayers = savedData ? JSON.parse(savedData) : null;

      // Se houver dados salvos, usa eles. Senão, usa a lista inicial vazia.
      if (
        savedPlayers &&
        Array.isArray(savedPlayers) &&
        savedPlayers.length > 0
      ) {
        setPlayers(savedPlayers);
      } else {
        setPlayers(initialPlayers);
      }
    } catch (error) {
      console.error("Erro ao buscar jogadores no localStorage:", error);
      setPlayers(initialPlayers);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Efeito para SALVAR os dados no localStorage sempre que o estado 'players' mudar
  useEffect(() => {
    // A lógica agora usa localStorage
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
  };

  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (newPlayerName.trim() === "") return;

    const newPlayer = {
      id: Date.now(), // ID único baseado no timestamp
      name: newPlayerName,
      presente: true, // Já entra como presente
      valorPago: 0,
    };
    setPlayers([...players, newPlayer]);
    setNewPlayerName("");
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
  };

  // ----- CÁLCULOS DERIVADOS E FUNÇÕES DE COMPARTILHAMENTO -----

  const confirmados = players.filter((p) => p.presente).length;
  const totalArrecadado = players.reduce(
    (total, player) => total + player.valorPago,
    0
  );

  // 1. Gera a mensagem formatada para o WhatsApp (Sem ícones estranhos)
  const generateWhatsAppMessage = () => {
    // Título da Mensagem - Usando negrito simples
    let message = `*Controle da Bola de Quinta-feira (20:00)*\n\n`;
    message += `*Confirmados:* ${confirmados} / ${players.length}\n`;
    message += `*Total Arrecadado:* R$ ${totalArrecadado
      .toFixed(2)
      .replace(".", ",")}\n\n`;
    message += `*STATUS DOS JOGADORES:*\n`;

    // Constrói a lista de jogadores
    players.forEach((player) => {
      let status = "";

      if (!player.presente) {
        status = "NAO CONFIRMOU";
      } else if (player.valorPago > 0) {
        status = `PAGO (R$ ${player.valorPago.toFixed(2).replace(".", ",")})`;
      } else {
        status = "PENDENTE DE PAGAMENTO";
      }

      // Formatando a linha: • *Nome do Jogador* - Status
      message += `• *${player.name}*: ${status}\n`;
    });

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
      {/* Rodapé com o total arrecadado */}
      <div className="summary-footer">
        <h3>Total Arrecadado</h3>
        <p className="total-amount">R$ 0,00</p>
      </div>
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

      {/* BOTÃO DE COMPARTILHAR */}
      {players.length > 0 && (
        <button
          onClick={handleShareOnWhatsApp}
          className="share-button"
          style={{
            marginBottom: "15px",
            width: "100%",
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
          Compartilhar no WhatsApp
        </button>
      )}

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
                  <img
                    src={`https://api.dicebear.com/8.x/personas/svg?seed=${player.name}`}
                    alt={`Avatar de ${player.name}`}
                    className="player-avatar"
                  />
                  <span className="player-name">{player.name}</span>
                </div>
                <div className="player-actions">
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
