import React, { useState, useEffect } from "react";
import { createClient } from "@vercel/kv";

// Crie um cliente KV fora do componente, usando as variáveis de ambiente do Vite
const kv = createClient({
  url: import.meta.env.VITE_KV_URL,
  token: import.meta.env.VITE_KV_REST_API_TOKEN,
});

// A lista inicial servirá como um fallback caso o banco de dados esteja vazio na primeira vez
const initialPlayers = [
  { id: 1, name: "Sopacrazy", presente: false, valorPago: 0 },
  { id: 2, name: "João", presente: false, valorPago: 0 },
  { id: 3, name: "Carlos", presente: false, valorPago: 0 },
  { id: 4, name: "Pedro", presente: false, valorPago: 0 },
  { id: 5, name: "Marcos", presente: false, valorPago: 0 },
  { id: 6, name: "Lucas", presente: false, valorPago: 0 },
  { id: 7, name: "Gabriel", presente: false, valorPago: 0 },
  { id: 8, name: "Thiago", presente: false, valorPago: 0 },
  { id: 9, name: "Mateus", presente: false, valorPago: 0 },
  { id: 10, name: "Felipe", presente: false, valorPago: 0 },
];

function PlayerList() {
  const [players, setPlayers] = useState([]); // Começa com uma lista vazia
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(true); // Estado para mostrar mensagem de carregamento

  // Efeito para BUSCAR os dados do Vercel KV quando o componente carregar
  useEffect(() => {
    async function fetchPlayers() {
      try {
        // Tenta pegar a lista de jogadores da chave 'jogadores' no banco de dados
        const savedPlayers = await kv.get("jogadores");

        // Se houver dados salvos, usa eles. Senão, usa a lista inicial.
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
        console.error("Erro ao buscar jogadores:", error);
        setPlayers(initialPlayers); // Em caso de erro, carrega a lista padrão
      } finally {
        setIsLoading(false); // Para de mostrar a mensagem de carregamento
      }
    }
    fetchPlayers();
  }, []); // O array vazio [] garante que isso só rode uma vez

  // Efeito para SALVAR os dados no Vercel KV sempre que o estado 'players' mudar
  useEffect(() => {
    // Não tenta salvar no primeiro carregamento se a lista estiver vazia
    if (!isLoading && players.length > 0) {
      kv.set("jogadores", players);
    }
  }, [players, isLoading]); // Roda sempre que a lista de jogadores ou o estado de loading mudar

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

  // ----- CÁLCULOS DERIVADOS DO ESTADO -----

  const confirmados = players.filter((p) => p.presente).length;
  const totalArrecadado = players.reduce(
    (total, player) => total + player.valorPago,
    0
  );

  // ----- RENDERIZAÇÃO DO COMPONENTE -----

  if (isLoading) {
    return <div className="loading-message">Carregando dados do jogo...</div>;
  }

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

      {/* Container da lista de jogadores */}
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
    </>
  );
}

export default PlayerList;
