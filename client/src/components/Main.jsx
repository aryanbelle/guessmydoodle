import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SnackbarProvider, enqueueSnackbar } from "notistack";
import { useAuth } from "../lib/AuthProvider.js";
import { useSocket } from "../SocketProvider.js";
import { useTheme } from "../ThemeContext";

function Main() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [rooms, setRooms] = useState([]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { theme, changeTheme } = useTheme();
  const [myNickname, setMyNickname] = useState("");
  const { currentUser, signOut } = useAuth();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !currentUser) return undefined;
    const onRooms = (roomData) => setRooms(Object.values(roomData).filter((room) => room.creator && room.users.length > 0));
    const onDelete = (roomId) => setRooms((previous) => previous.filter((room) => room.id !== roomId));
    const savePendingPassword = (roomId) => {
      const pendingPassword = sessionStorage.getItem("pending-created-room-password");
      if (pendingPassword !== null) {
        sessionStorage.setItem(`room-password:${roomId}`, pendingPassword);
        sessionStorage.removeItem("pending-created-room-password");
      }
    };
    const onRoom = (room) => {
      savePendingPassword(room.id);
      navigate(`/room/${room.id}`);
    };
    const onJoined = ({ id }) => {
      savePendingPassword(id);
      navigate(`/room/${id}`);
    };
    const onCreateError = (data) => enqueueSnackbar(data.message, { variant: "error" });
    const onJoinError = (data) => enqueueSnackbar(data.message, { variant: "error" });
    socket.on("your-nickname", setMyNickname);
    socket.on("fetchRooms", onRooms);
    socket.on("deleteRoom", onDelete);
    socket.on("roomCreated", onRoom);
    socket.on("roomJoined", onJoined);
    socket.on("roomCreateError", onCreateError);
    socket.on("roomJoinError", onJoinError);
    socket.emit("requestRooms");
    socket.emit("request-nickname", { userIdToken: localStorage.getItem("authToken") });
    return () => {
      socket.off("your-nickname", setMyNickname);
      socket.off("fetchRooms", onRooms);
      socket.off("deleteRoom", onDelete);
      socket.off("roomCreated", onRoom);
      socket.off("roomJoined", onJoined);
      socket.off("roomCreateError", onCreateError);
      socket.off("roomJoinError", onJoinError);
    };
  }, [navigate, socket, currentUser]);

  const handleCreateRoom = (event) => {
    event.preventDefault();
    sessionStorage.setItem("pending-created-room-password", isPrivate ? password : "");
    socket.emit("createRoom", { userIdToken: localStorage.getItem("authToken"), roomName: roomName.trim() || `${myNickname || "Player"}'s room`, isPrivate, password: isPrivate ? password : null });
    setIsModalOpen(false);
  };
  const handleJoinRoom = (roomId = joinRoomId) => {
    if (!roomId.trim()) {
      enqueueSnackbar("Enter a room code first.", { variant: "warning" });
      return;
    }
    sessionStorage.setItem(`room-password:${roomId.trim()}`, joinPassword);
    socket.emit("joinRoom", { roomId: roomId.trim(), password: joinPassword, userIdToken: localStorage.getItem("authToken") });
    setIsJoinModalOpen(false);
  };
  const handleLogout = async () => { try { await signOut(); navigate("/signin"); } catch (error) { console.error("Error signing out:", error); } };

  const dialog = (title, onClose, content) => (
    <div className="game-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="game-modal" role="dialog" aria-modal="true" aria-label={title}>
        <button className="game-modal-close" onClick={onClose} aria-label="Close">×</button>
        <span className="eyebrow">DOODLE PARTY</span><h2>{title}</h2>{content}
      </section>
    </div>
  );

  return (
    <main className={`lobby-page ${theme === "light" ? "lobby-light" : "lobby-dark"}`}>
      <SnackbarProvider />
      <header className="lobby-topbar"><a className="brand-mark" href="/main"><span className="brand-icon">✎</span><span>guess<span className="brand-color">my</span>doodle</span></a>
        <div className="topbar-right"><span className="online-pill"><i /> {rooms.reduce((total, room) => total + (room.playerCount || room.users.length), 0)} PLAYING</span><button className="profile-chip" onClick={() => setIsProfileModalOpen(true)}><span className="avatar">{(myNickname || "G").slice(0, 1).toUpperCase()}</span><span>{myNickname || "Guest artist"}</span><span className="chevron">⌄</span></button></div>
      </header>
      <div className="lobby-content">
        <section className="welcome-copy"><div className="eyebrow"><span>✦</span> THE PARTY IS ON</div><h1>Draw it.<br/><span>Guess it.</span><br/>Giggle about it.</h1><p>Grab your friends and turn questionable doodles into unforgettable game nights.</p>
          <div className="welcome-actions"><button className="primary-action" onClick={() => setIsModalOpen(true)}><span>＋</span> Create a room <span className="action-arrow">↗</span></button><button className="secondary-action" onClick={() => setIsJoinModalOpen(true)}>Join with a code <span>→</span></button></div>
          <div className="quick-facts"><span>🎨 <b>1</b> doodler</span><span>👀 <b>Up to 6</b> players</span><span>⏱️ <b>60 sec</b> per turn</span></div>
        </section>
        <section className="art-card" aria-label="A playful doodle illustration"><div className="art-spark spark-one">✦</div><div className="art-spark spark-two">✧</div><div className="art-label">TODAY'S MASTERPIECE <span>✦</span></div><div className="doodle-scene"><div className="sun-face">☀</div><div className="cloud cloud-one">☁</div><div className="cloud cloud-two">☁</div><div className="rainbow"><i/><i/><i/><i/></div><div className="hill hill-back"/><div className="hill hill-front"/><div className="flower flower-one">✿</div><div className="flower flower-two">✿</div></div><div className="art-sticker sticker-top">not bad!<span>♡</span></div><div className="art-sticker sticker-bottom">10/10 would guess again</div><div className="art-footer"><span><b>✨</b> made with questionable talent</span><span className="art-dots">● ● ●</span></div></section>
        <section className="rooms-section"><div className="section-heading"><div><span className="eyebrow">JUMP RIGHT IN</span><h2>Rooms in the making <span>🎉</span></h2></div><button className="text-action" onClick={() => setIsJoinModalOpen(true)}>Have a room code? <b>Join here →</b></button></div>
          {rooms.length ? <div className="room-grid">{rooms.filter((room) => !room.isPrivate).map((room) => <article className="room-card" key={room.id}><div className="room-card-icon">🎨</div><div className="room-info"><h3>{room.name || "A doodle room"}</h3><p>Hosted by {room.creator}</p><span className="player-count">👥 {room.playerCount ?? room.users.length}/{room.maxPlayers || 6} seats</span></div><button className="room-join" onClick={() => handleJoinRoom(room.id)}>Join <span>→</span></button></article>)}</div> : <div className="empty-rooms"><span className="empty-icon">🖍️</span><div><b>It’s a little quiet in here...</b><p>Be the first to start a room. Your friends and their masterpieces are one invite away.</p></div><button onClick={() => setIsModalOpen(true)}>Start a room <span>→</span></button></div>}
        </section>
      </div>
      <footer className="lobby-footer"><span>GOOD ART IS OPTIONAL. GOOD TIMES AREN'T.</span><div><button onClick={() => setIsSettingsModalOpen(true)}>⚙ Settings</button><button onClick={handleLogout}>Log out ↗</button></div></footer>

      {isModalOpen && dialog("Create your room", () => setIsModalOpen(false), <form onSubmit={handleCreateRoom}><label className="field-label" htmlFor="room-name">Give your room a name</label><input id="room-name" className="game-input" placeholder="The doodle den" value={roomName} onChange={(event) => setRoomName(event.target.value)} autoFocus/><label className="toggle-row"><span><b>Private party</b><small>Only friends with the code can join</small></span><input type="checkbox" checked={isPrivate} onChange={() => setIsPrivate((value) => !value)}/></label>{isPrivate && <><label className="field-label" htmlFor="room-password">Room password</label><input id="room-password" className="game-input" type="password" placeholder="Make it a secret" value={password} onChange={(event) => setPassword(event.target.value)}/></>}<button className="primary-action modal-action" type="submit">Let's play <span>→</span></button></form>)}
      {isJoinModalOpen && dialog("Got a room code?", () => setIsJoinModalOpen(false), <form onSubmit={(event) => { event.preventDefault(); handleJoinRoom(); }}><label className="field-label" htmlFor="room-code">Room code</label><input id="room-code" className="game-input" placeholder="e.g. A8F23B9C" value={joinRoomId} onChange={(event) => setJoinRoomId(event.target.value.toUpperCase())} autoFocus/><label className="field-label" htmlFor="join-password">Password <span className="optional-label">(if needed)</span></label><input id="join-password" className="game-input" type="password" placeholder="Room password" value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)}/><button className="primary-action modal-action" type="submit">Hop in <span>→</span></button></form>)}
      {isProfileModalOpen && dialog("Your artist card", () => setIsProfileModalOpen(false), <div className="profile-dialog"><span className="avatar avatar-large">{(myNickname || "G").slice(0, 1).toUpperCase()}</span><b>{myNickname || "Guest artist"}</b><span>Here to draw, guess & have fun.</span></div>)}
      {isSettingsModalOpen && dialog("Make it yours", () => setIsSettingsModalOpen(false), <div><label className="field-label" htmlFor="theme-select">Choose your vibe</label><select id="theme-select" className="game-input" value={theme} onChange={(event) => changeTheme(event.target.value)}><option value="light">Sunny side up</option><option value="dark">Late night doodle</option></select><button className="primary-action modal-action" onClick={() => setIsSettingsModalOpen(false)}>All set <span>✓</span></button></div>)}
    </main>
  );
}

export default Main;
