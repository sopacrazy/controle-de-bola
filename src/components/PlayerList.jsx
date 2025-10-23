import React, { useState, useEffect } from "react";
import { createClient } from "@vercel/kv";

// Crie um cliente KV fora do componente
// CÓDIGO NOVO E CORRETO
const kv = createClient({
  url: import.meta.env.VITE_KV_URL,
  token: import.meta.env.VITE_KV_REST_API_TOKEN,
});

// A lista inicial agora servirá como um fallback, caso não haja nada salvo
const initialPlayers = [
  { id: 1, name: "Sopacrazy", presente: false, valorPago: 0 },
  // ... (adicione os outros jogadores aqui se quiser, como um estado inicial na primeira vez)
];

function PlayerList() {
  const [players, setPlayers] = useState([]); // Começa com uma lista vazia
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(true); // Estado de carregamento

  // Efeito para buscar os dados do Vercel KV quando o componente carregar
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const savedPlayers = await kv.get("jogadores");
        if (savedPlayers && savedPlayers.length > 0) {
          setPlayers(savedPlayers);
        } else {
          // Se não houver nada salvo, usa a lista inicial
          setPlayers(initialPlayers);
        }
      } catch (error) {
        console.error("Erro ao buscar jogadores:", error);
        setPlayers(initialPlayers); // Em caso de erro, usa a lista inicial
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  // Efeito para salvar os dados no Vercel KV sempre que 'players' mudar
  useEffect(() => {
    // Não salva a lista inicial vazia no começo
    if (players.length > 0) {
      kv.set("jogadores", players);
    }
  }, [players]);

  // Todas as funções (togglePresenca, handleAddPlayer, handleValorChange)
  // continuam exatamente iguais a antes, pois elas apenas modificam o estado 'players'.

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
      id: Date.now(),
      name: newPlayerName,
      presente: true,
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

  const confirmados = players.filter((p) => p.presente).length;
  const totalArrecadado = players.reduce(
    (total, player) => total + player.valorPago,
    0
  );

  if (isLoading) {
    return <div className="loading-message">Carregando dados do jogo...</div>;
  }

  // O JSX do retorno (a parte visual) é exatamente o mesmo de antes
  return (
    <>{/* Formulário, lista e rodapé aqui... (igual ao código anterior) */}</>
  );
}

export default PlayerList;
