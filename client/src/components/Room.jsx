import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layer, Line, Rect, Stage } from "react-konva";
import { SnackbarProvider, enqueueSnackbar } from "notistack";
import { useSocket } from "../SocketProvider.js";
import { useAuth } from "../lib/AuthProvider.js";
import { useTheme } from "../ThemeContext";

const PALETTE = ["#312a40", "#f45b69", "#ff9f43", "#f6c445", "#42b983", "#35a7a0", "#4786f7", "#845ef7", "#ed7eb3"];

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [myWord, setMyWord] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [rankings, setRankings] = useState(null);
  const [tool, setTool] = useState("pen");
  const [brushColor, setBrushColor] = useState(PALETTE[0]);
  const [brushSize, setBrushSize] = useState(5);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 580 });
  const isDrawing = useRef(false);
  const activeStrokeId = useRef(null);
  const stageRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const chatEndRef = useRef(null);
  const players = room?.players || [];
  const connectedPlayerCount = room?.connectedPlayerCount ?? players.filter((player) => player.connected).length;
  const maxPlayers = room?.maxPlayers || 6;
  const isDrawer = Boolean(room?.youAreDrawer);
  const isHost = Boolean(room?.youAreHost);
  const isPlaying = room?.status === "playing";
  const lines = room?.lines || [];

  const sendJoin = useCallback(() => {
    if (!socket || !socket.connected) return;
    socket.emit("joinRoom", {
      userIdToken: localStorage.getItem("authToken"),
      roomId,
      password: sessionStorage.getItem(`room-password:${roomId}`) || "",
    });
  }, [roomId, socket]);

  useEffect(() => {
    if (!socket) return undefined;
    const addMessage = (entry) => setMessages((previous) => [...previous.slice(-99), entry]);
    const onRoomState = (nextRoom) => {
      if (nextRoom.id !== roomId) return;
      setRoom(nextRoom);
      setSeconds(nextRoom.secondsRemaining || 0);
      if (nextRoom.messages?.length) setMessages((previous) => previous.length ? previous : nextRoom.messages);
      if (nextRoom.yourWord) setMyWord(nextRoom.yourWord);
    };
    const onChat = (entry) => addMessage(entry);
    const onSystem = ({ message: text }) => addMessage({ nickname: "Party bot", message: text, timeStamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), type: "system" });
    const onTurnStarted = (turn) => {
      setSeconds(turn.secondsRemaining);
      setMyWord("");
      setMessages((previous) => [...previous.slice(-99), { nickname: "Party bot", message: `${turn.drawerName} is drawing · turn ${turn.turnIndex} of ${turn.totalTurns}`, timeStamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), type: "system" }]);
    };
    const onTurnEnded = ({ word, reason }) => {
      setMyWord("");
      addMessage({ nickname: "Party bot", message: reason === "solved" ? `${word} was guessed!` : `Time's up! The word was ${word}.`, timeStamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), type: "system" });
    };
    const onGameEnded = ({ rankings: finalRankings }) => setRankings(finalRankings);
    const onError = ({ message: text }) => enqueueSnackbar(text, { variant: "warning", autoHideDuration: 2600 });
    const onYourWord = ({ word }) => setMyWord(word);
    const onSessionReplaced = () => {
      enqueueSnackbar("This account joined the room from another tab or device.", { variant: "info", autoHideDuration: 2600 });
      navigate("/main");
    };
    const onDraw = ({ line }) => setRoom((previous) => {
      if (!previous) return previous;
      const index = previous.lines.findIndex((item) => item.strokeId === line.strokeId);
      const updated = [...previous.lines];
      if (index < 0) updated.push(line); else updated[index] = line;
      return { ...previous, lines: updated };
    });
    const onDrawingChanged = ({ lines: updatedLines }) => setRoom((previous) => previous ? { ...previous, lines: updatedLines } : previous);
    const onConnect = () => sendJoin();

    socket.on("roomState", onRoomState);
    socket.on("chatMessage", onChat);
    socket.on("systemMessage", onSystem);
    socket.on("turnStarted", onTurnStarted);
    socket.on("turnEnded", onTurnEnded);
    socket.on("gameEnded", onGameEnded);
    socket.on("gameError", onError);
    socket.on("roomJoinError", onError);
    socket.on("draw", onDraw);
    socket.on("drawingChanged", onDrawingChanged);
    socket.on("timer", setSeconds);
    socket.on("yourWord", onYourWord);
    socket.on("sessionReplaced", onSessionReplaced);
    socket.on("connect", onConnect);

    if (socket.connected) sendJoin(); else socket.connect();

    return () => {
      socket.emit("leaveRoom");
      socket.off("roomState", onRoomState);
      socket.off("chatMessage", onChat);
      socket.off("systemMessage", onSystem);
      socket.off("turnStarted", onTurnStarted);
      socket.off("turnEnded", onTurnEnded);
      socket.off("gameEnded", onGameEnded);
      socket.off("gameError", onError);
      socket.off("roomJoinError", onError);
      socket.off("yourWord", onYourWord);
      socket.off("sessionReplaced", onSessionReplaced);
      socket.off("draw", onDraw);
      socket.off("drawingChanged", onDrawingChanged);
      socket.off("timer", setSeconds);
      socket.off("connect", onConnect);
    };
  }, [navigate, roomId, sendJoin, socket]);

  useEffect(() => {
    if (!canvasWrapRef.current || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setCanvasSize({ width: Math.max(320, Math.floor(entry.contentRect.width)), height: Math.max(260, Math.floor(entry.contentRect.height)) }));
    observer.observe(canvasWrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!isDrawer || !isPlaying) isDrawing.current = false;
  }, [isDrawer, isPlaying]);

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      enqueueSnackbar("Room code copied!", { variant: "success" });
    } catch (_) {
      enqueueSnackbar(`Room code: ${roomId}`, { variant: "info" });
    }
  };

  const leaveRoom = () => {
    socket?.emit("leaveRoom");
    sessionStorage.removeItem(`room-password:${roomId}`);
    navigate("/main");
  };

  const beginStroke = (event) => {
    if (!isDrawer || !isPlaying || !stageRef.current) return;
    event.evt?.preventDefault?.();
    const point = stageRef.current.getPointerPosition();
    if (!point) return;
    isDrawing.current = true;
    const strokeId = `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    activeStrokeId.current = strokeId;
    const line = { strokeId, tool, points: [point.x, point.y], color: tool === "eraser" ? "#ffffff" : brushColor, size: tool === "eraser" ? Math.max(14, brushSize * 2) : brushSize };
    setRoom((previous) => previous ? { ...previous, lines: [...previous.lines, line] } : previous);
    socket.emit("draw", { line });
  };

  const moveStroke = (event) => {
    if (!isDrawing.current || !isDrawer || !stageRef.current || !activeStrokeId.current) return;
    event.evt?.preventDefault?.();
    const point = stageRef.current.getPointerPosition();
    if (!point) return;
    setRoom((previous) => {
      if (!previous) return previous;
      const updated = [...previous.lines];
      const index = updated.findIndex((line) => line.strokeId === activeStrokeId.current);
      if (index < 0) return previous;
      const line = { ...updated[index], points: [...updated[index].points, point.x, point.y] };
      updated[index] = line;
      socket.emit("draw", { line });
      return { ...previous, lines: updated };
    });
  };

  const endStroke = () => { isDrawing.current = false; activeStrokeId.current = null; };

  const sendMessage = (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || !isPlaying || isDrawer) return;
    socket.emit("message", { message: text });
    setMessage("");
  };

  const showWordHint = useMemo(() => (room?.wordHint || []).map((letter) => letter === " " ? "　" : letter).join(" "), [room?.wordHint]);

  if (!room) return <main className="game-room room-light"><SnackbarProvider/><div className="room-loading"><span className="loading-doodle">✎</span><h2>Finding your party...</h2><p>Getting the room ready</p><button className="text-action" onClick={() => navigate("/main")}>Back to lobby</button></div></main>;

  return (
    <main className={`game-room ${theme === "light" ? "room-light" : "room-dark"}`}>
      <SnackbarProvider />
      <section className="game-play-area">
        <header className="game-topbar"><button className="leave-button" onClick={leaveRoom} aria-label="Leave room">← <span>Lobby</span></button><div className="game-room-title"><span className="brand-icon">✎</span><div><b>{room.name}</b><small>{players.length} / {maxPlayers} seats · <button onClick={copyRoomCode}>room code <strong>{room.id.slice(0, 8).toUpperCase()} ⧉</strong></button></small></div></div><div className="game-turn-status">{isPlaying ? <><span className="turn-indicator"/><b>{isDrawer ? "Your turn to draw!" : `${room.drawerName} is drawing`}</b></> : <><span>🎨</span><b>{room.status === "ended" ? "Round complete!" : "Waiting room"}</b></>}</div></header>

        {isPlaying && <div className={`turn-banner ${isDrawer ? "your-turn" : "guess-turn"}`}><div className="turn-copy"><span>{isDrawer ? "YOUR SECRET WORD" : `${room.drawerName.toUpperCase()} IS DRAWING`}</span><b>{isDrawer ? (myWord || "Choosing a word...") : showWordHint}</b></div><div className={`turn-clock ${seconds <= 10 ? "clock-low" : ""}`}><span>⏱</span><b>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</b></div></div>}

        <div className={`game-toolbar ${!isDrawer ? "toolbar-disabled" : ""}`}>
          <div className="tool-switch"><button className={tool === "pen" ? "selected" : ""} onClick={() => setTool("pen")} disabled={!isDrawer || !isPlaying} aria-label="Pencil">✎ <span>Pen</span></button><button className={tool === "eraser" ? "selected" : ""} onClick={() => setTool("eraser")} disabled={!isDrawer || !isPlaying} aria-label="Eraser">⌫ <span>Eraser</span></button></div>
          <div className="color-palette">{PALETTE.map((color) => <button key={color} className={brushColor === color ? "chosen" : ""} style={{ "--swatch": color }} onClick={() => { setBrushColor(color); setTool("pen"); }} disabled={!isDrawer || !isPlaying} aria-label={`Use ${color}`}/>)}</div>
          <label className="brush-control"><span>SIZE</span><input aria-label="Brush size" type="range" min="2" max="22" value={brushSize} disabled={!isDrawer || !isPlaying} onChange={(event) => setBrushSize(Number(event.target.value))}/></label>
          <div className="drawing-actions"><button onClick={() => socket.emit("undo")} disabled={!isDrawer || !lines.length} title="Undo">↶</button><button onClick={() => socket.emit("redo")} disabled={!isDrawer} title="Redo">↷</button><span/><button onClick={() => socket.emit("clearDrawing")} disabled={!isDrawer || !lines.length} title="Clear canvas">⌫</button></div>
          <span className="canvas-hint">{isDrawer ? "Make it memorable!" : "Drop your guess in chat →"}</span>
        </div>

        <div className="drawing-board-wrap" ref={canvasWrapRef}>
          {room.status === "waiting" && <div className="room-overlay"><div className="overlay-emoji">🖍️</div><span className="eyebrow">YOUR ROOM IS READY</span><h2>{connectedPlayerCount < 2 ? "Waiting for your people" : "Let the doodling begin!"}</h2><p>{connectedPlayerCount < 2 ? "Share your room code. You need one other connected player to start." : `${connectedPlayerCount} artists are in. Everyone gets a turn to draw.`}</p><div className="room-code-card"><small>ROOM CODE</small><b>{room.id.slice(0, 8).toUpperCase()}</b><button onClick={copyRoomCode}>Copy code</button></div>{isHost && <button className="primary-action overlay-start" disabled={!room.canStart} onClick={() => socket.emit("startGame")}>{connectedPlayerCount < 2 ? "Waiting for one more player..." : "Start the game ✨"}</button>}{!isHost && <div className="host-note">The host will start the game in a moment</div>}</div>}
          {room.status === "ended" && <div className="room-overlay"><div className="overlay-emoji">🏆</div><span className="eyebrow">THAT WAS A MASTERPIECE</span><h2>Game over!</h2><p>Pass the pencil around for another round.</p>{isHost && <button className="primary-action overlay-start" disabled={!room.canStart} onClick={() => { setRankings(null); socket.emit("startGame"); }}>Play again ✨</button>}</div>}
          <Stage ref={stageRef} width={canvasSize.width} height={canvasSize.height} onMouseDown={beginStroke} onMouseMove={moveStroke} onMouseUp={endStroke} onMouseLeave={endStroke} onTouchStart={beginStroke} onTouchMove={moveStroke} onTouchEnd={endStroke} className="game-canvas">
            <Layer><Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill="#fffefa" listening={false}/>{lines.map((line) => <Line key={line.strokeId} points={line.points} stroke={line.color} strokeWidth={line.size} globalCompositeOperation="source-over" tension={0.35} lineCap="round" lineJoin="round" listening={false}/>)}</Layer>
          </Stage>
        </div>

        <footer className="players-strip"><div className="players-label">THE ARTISTS <span>· {players.length}</span></div>{players.map((player, index) => <div key={player.id} className={`player-pill ${player.isDrawer ? "drawing-player" : ""} ${!player.connected ? "offline-player" : ""}`}><span className={`player-avatar avatar-tone-${index % 6}`}>{player.nickname.slice(0, 1).toUpperCase()}</span><span className="player-name">{player.nickname}{player.id === currentUser?.uid ? " (you)" : ""}</span><b className="player-score">{player.score}</b>{player.isHost && <span className="host-crown">♛</span>}{player.hasGuessed && isPlaying && <span className="guessed-check">✓</span>}</div>)}</footer>
      </section>

      <aside className="game-chat"><header className="chat-heading"><div><span className="eyebrow">THE GOOD GUESSES</span><h2>Party chat <span>💬</span></h2></div><span className="chat-live"><i/> LIVE</span></header><div className="chat-notice">{isPlaying ? isDrawer ? "Psst... artists can't guess their own word." : "Type your guess. First to get it scores extra!" : "The chat opens when the game starts."}</div><div className="chat-messages">{messages.length === 0 && <div className="chat-empty"><span>💭</span><b>It’s quiet... for now</b><p>{isPlaying ? "Be the first to take a guess!" : "Get the game started and let the guesses fly."}</p></div>}{messages.map((entry, index) => <article key={`${entry.timeStamp}-${index}`} className={`chat-message ${entry.type === "system" ? "system-message" : ""} ${entry.type === "correct" ? "correct-message" : ""}`}><div><b>{entry.nickname}</b><time>{entry.timeStamp}</time></div><p>{entry.message}</p></article>)}<div ref={chatEndRef}/></div><form className="chat-compose" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={isDrawer ? "You're the doodler!" : "Type your guess..."} disabled={!isPlaying || isDrawer} maxLength={160} autoComplete="off"/><button type="submit" disabled={!isPlaying || isDrawer || !message.trim()} aria-label="Send guess">➤</button></form><div className="chat-footer-note">GOOD VIBES & SILLY LINES ONLY ✦</div></aside>

      {rankings && <div className="game-modal-backdrop"><section className="game-modal results-modal"><div className="overlay-emoji">🏆</div><span className="eyebrow">THE DOODLE CHAMPION</span><h2>Final scores</h2><ol>{rankings.map((player, index) => <li key={`${player.nickname}-${index}`}><span>{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "✦"} {player.nickname}</span><b>{player.score} pts</b></li>)}</ol><div className="results-actions">{isHost && <button className="primary-action" onClick={() => { setRankings(null); socket.emit("startGame"); }}>Play again ✨</button>}<button className="secondary-action" onClick={leaveRoom}>Back to lobby →</button></div></section></div>}
    </main>
  );
}

export default Room;
