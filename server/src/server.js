require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectToDatabase = require("../lib/dbConnection");
const verifyIdToken = require("./services/firebase");
const User = require("./models/UserModel");
const authRoutes = require("./routes/isAccountExists");
const accountRoutes = require("./routes/createUser");
const guestRoutes = require("./routes/guest");
const { verifyGuestToken, assertGuestTokenSecret } = require("./services/guestAuth");

const PORT = Number(process.env.PORT) || 5000;
const TURN_SECONDS = 60;
const MAX_PLAYERS = 6;
const ROOM_RECONNECT_GRACE_MS = 20000;
const words = [
  "Apple", "Banana", "Carrot", "Dog", "Elephant", "Frog", "Giraffe", "Hat", "Igloo", "Jackal",
  "Kite", "Lion", "Monkey", "Nest", "Orange", "Parrot", "Queen", "Rose", "Sun", "Tree",
  "Umbrella", "Violin", "Whale", "Xylophone", "Yacht", "Zebra", "Ant", "Bear", "Cloud", "Dolphin",
  "Egg", "Flower", "Ghost", "House", "Ice", "Jelly", "King", "Leaf", "Mountain", "Night",
  "Owl", "Penguin", "Quilt", "Rainbow", "Star", "Tiger", "Unicorn", "Vase", "Window", "Yarn",
  "Zipper", "Airport", "Balloon", "Camera", "Dragon", "Engine", "Fire", "Garden", "Helicopter",
  "Island", "Juice", "Lamp", "Moon", "Notebook", "Pizza", "Quokka", "Rocket", "Ship", "Treehouse",
  "Volcano", "Waterfall", "Bakery", "Circus", "Diner", "Eggplant", "Forest", "Guitar", "Hotel",
  "Iceberg", "Jungle", "Keyhole", "Lighthouse", "Meadow", "Necklace", "Ocean", "Raccoon", "Snowflake",
  "Telescope", "Velvet", "Wagon", "Acorn", "Candle", "Fountain", "Glove", "Horizon", "Jar", "Kangaroo",
  "Lemon", "Map", "Octopus", "Pencil", "River", "Starfish", "Teapot", "Waffle", "Airplane", "Bicycle",
  "Castle", "Feather", "Jellyfish", "Pineapple", "Sunflower", "Turtle", "Windmill", "Astronaut", "Cupcake",
  "Fireworks", "Jaguar", "Marble", "Ostrich", "Anchor", "Butterfly", "Chocolate", "Hammock", "Orchid",
  "Squirrel", "Train", "Balloon", "Daisy", "Hummingbird", "Jigsaw", "Koala", "Lollipop", "Mango", "Noodle",
  "Panda", "Quartz", "Snowball", "Tulip", "Violet", "Whistle", "Cactus", "Diamond", "Echo", "Glacier",
  "Magnet", "Nugget", "Opal", "Sapphire", "Tangerine", "Watermelon", "Utopia", "Vortex"
];

const rooms = new Map();
const disconnectTimers = new Map();
const guessBuckets = new Map();

function connectedPlayers(room) {
  return [...room.players.values()].filter((player) => player.connected && player.socketId);
}

function canStartRoom(room) {
  return (room.status === "waiting" || room.status === "ended") &&
    room.hostId && room.players.get(room.hostId)?.connected && connectedPlayers(room).length >= 2;
}

function normalizeAnswer(value) {
  return String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanNickname(value) {
  return String(value || "Guest").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 24) || "Guest";
}

function getIdentity(token) {
  if (typeof token === "string" && token.startsWith("guest:")) {
    try { return Promise.resolve(verifyGuestToken(token)); }
    catch (error) { return Promise.reject(error); }
  }
  if (!token) return Promise.reject(new Error("Authentication required"));
  return verifyIdToken(token).then(async (decoded) => {
    if (decoded.email && decoded.firebase?.sign_in_provider === "google.com") {
      const user = await User.findOne({ email: decoded.email }).lean();
      if (!user) throw new Error("User account not found");
      return { uid: decoded.uid, nickname: cleanNickname(user.nickname), isDummy: false };
    }
    if (decoded.firebase?.sign_in_provider === "anonymous") {
      return { uid: decoded.uid, nickname: `Guest_${decoded.uid.slice(0, 8)}`, isDummy: false };
    }
    throw new Error("User account not found");
  });
}

function publicRoom(room) {
  return {
    id: room.id,
    name: room.name,
    creator: room.players.get(room.hostId)?.nickname || room.creatorName,
    isPrivate: room.isPrivate,
    users: [...room.players.values()].filter((player) => player.connected).map((player) => player.nickname),
    playerCount: room.players.size,
    connectedPlayerCount: connectedPlayers(room).length,
    maxPlayers: MAX_PLAYERS,
  };
}

function getRoomList() {
  return Object.fromEntries([...rooms.values()].filter((room) => !room.isPrivate && room.status === "waiting").map((room) => [room.id, publicRoom(room)]));
}

function emitRoomList(io) {
  io.emit("fetchRooms", getRoomList());
}

function roomSnapshot(room, playerId) {
  const players = [...room.players.values()].map((player) => ({
    id: player.id,
    nickname: player.nickname,
    score: player.score,
    connected: player.connected,
    isHost: player.id === room.hostId,
    isDrawer: room.status === "playing" && player.id === room.drawerId,
    hasGuessed: room.guessed.has(player.id),
  }));
  const secondsRemaining = room.status === "playing" ? Math.max(0, Math.ceil((room.turnEndsAt - Date.now()) / 1000)) : 0;
  return {
    id: room.id,
    name: room.name,
    isPrivate: room.isPrivate,
    hostId: room.hostId,
    players,
    maxPlayers: MAX_PLAYERS,
    occupiedSeatCount: room.players.size,
    connectedPlayerCount: connectedPlayers(room).length,
    status: room.status,
    drawerId: room.drawerId,
    drawerName: room.players.get(room.drawerId)?.nickname || "",
    turnIndex: room.turnIndex,
    totalTurns: room.turnOrder.length,
    secondsRemaining,
    wordHint: room.status === "playing" ? room.word.split("").map((letter) => (letter === " " ? " " : "_")) : [],
    lines: room.lines,
    messages: room.messages,
    youAreHost: playerId === room.hostId,
    youAreDrawer: room.status === "playing" && playerId === room.drawerId,
    yourWord: playerId === room.drawerId && room.status === "playing" ? room.word : null,
    canStart: playerId === room.hostId && canStartRoom(room),
    canDraw: room.status === "playing" && playerId === room.drawerId,
  };
}

function emitState(io, room) {
  for (const player of room.players.values()) {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit("roomState", roomSnapshot(room, player.id));
    }
  }
}

function clearRoomTimers(room) {
  if (room.turnTimer) clearTimeout(room.turnTimer);
  if (room.tickTimer) clearInterval(room.tickTimer);
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  if (room.advanceTimer) clearTimeout(room.advanceTimer);
  room.turnTimer = null;
  room.tickTimer = null;
  room.cleanupTimer = null;
  room.advanceTimer = null;
}

function stopTurnClock(room) {
  if (room.turnTimer) clearTimeout(room.turnTimer);
  if (room.tickTimer) clearInterval(room.tickTimer);
  room.turnTimer = null;
  room.tickTimer = null;
}

function scheduleNextTurn(io, room, delay) {
  if (room.advanceTimer) clearTimeout(room.advanceTimer);
  room.advanceTimer = setTimeout(() => {
    room.advanceTimer = null;
    if (rooms.has(room.id) && room.status === "playing") startTurn(io, room);
  }, delay);
}

function chooseWord() {
  return words[crypto.randomInt(words.length)];
}

function endGame(io, room) {
  clearRoomTimers(room);
  room.status = "ended";
  room.word = "";
  room.drawerId = null;
  room.guessed.clear();
  room.lines = [];
  const rankings = [...room.players.values()].map(({ nickname, score }) => ({ nickname, score })).sort((a, b) => b.score - a.score);
  io.to(room.id).emit("gameEnded", { rankings });
  emitState(io, room);
}

function startTurn(io, room) {
  if (room.advanceTimer) clearTimeout(room.advanceTimer);
  room.advanceTimer = null;
  if (room.turnIndex >= room.turnOrder.length) return endGame(io, room);
  if (connectedPlayers(room).length < 2) return endGame(io, room);

  const nextId = room.turnOrder[room.turnIndex];
  if (!room.players.has(nextId) || !room.players.get(nextId).connected) {
    room.turnIndex += 1;
    return startTurn(io, room);
  }

  stopTurnClock(room);
  room.drawerId = nextId;
  room.word = chooseWord();
  room.guessed = new Set();
  room.lines = [];
  room.history = [];
  room.redoHistory = [];
  room.strokeIds = new Set();
  room.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
  io.to(room.id).emit("turnStarted", { drawerId: nextId, drawerName: room.players.get(nextId).nickname, turnIndex: room.turnIndex + 1, totalTurns: room.turnOrder.length, wordHint: room.word.split("").map((letter) => letter === " " ? " " : "_"), secondsRemaining: TURN_SECONDS });
  io.to(room.players.get(nextId).socketId).emit("yourWord", { word: room.word });
  emitState(io, room);
  room.tickTimer = setInterval(() => {
    const secondsRemaining = Math.max(0, Math.ceil((room.turnEndsAt - Date.now()) / 1000));
    io.to(room.id).emit("timer", secondsRemaining);
    if (secondsRemaining <= 0 && room.tickTimer) {
      clearInterval(room.tickTimer);
      room.tickTimer = null;
    }
  }, 1000);
  room.turnTimer = setTimeout(() => {
    room.turnTimer = null;
    io.to(room.id).emit("turnEnded", { word: room.word, reason: "time" });
    room.turnIndex += 1;
    scheduleNextTurn(io, room, 1800);
  }, TURN_SECONDS * 1000);
}

function beginGame(io, room) {
  room.status = "playing";
  room.turnOrder = connectedPlayers(room).map((player) => player.id);
  room.turnIndex = 0;
  room.players.forEach((player) => { player.score = 0; });
  startTurn(io, room);
  emitRoomList(io);
}

function enterRoom(io, socket, room, identity) {
  const existingPlayer = room.players.get(identity.uid);
  if (room.status === "playing" && !existingPlayer) {
    socket.emit("roomJoinError", { message: "This game is already in progress." });
    return false;
  }
  if (!existingPlayer && room.players.size >= MAX_PLAYERS) {
    socket.emit("roomJoinError", { message: "This room is full." });
    return false;
  }
  const reconnectTimer = disconnectTimers.get(identity.uid);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  disconnectTimers.delete(identity.uid);
  const previous = [...rooms.values()].find((candidate) => candidate.players.has(identity.uid));
  if (previous && previous.id !== room.id) removePlayer(io, previous, identity.uid, "left");

  let player = room.players.get(identity.uid);
  const isNew = !player;
  if (!player) player = { id: identity.uid, nickname: identity.nickname, score: 0, connected: true, socketId: socket.id };
  if (player.socketId && player.socketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(player.socketId);
    previousSocket?.leave(room.id);
    if (previousSocket) {
      previousSocket.data.roomId = null;
      previousSocket.data.userId = null;
      previousSocket.emit("sessionReplaced");
    }
  }
  player.nickname = identity.nickname;
  player.connected = true;
  player.socketId = socket.id;
  room.players.set(identity.uid, player);
  socket.data.userId = identity.uid;
  socket.data.roomId = room.id;
  socket.join(room.id);
  socket.emit("roomJoined", { id: room.id, nickname: player.nickname });
  emitState(io, room);
  if (isNew) socket.to(room.id).emit("systemMessage", { message: `${player.nickname} joined the room.` });
  emitRoomList(io);
  return true;
}

function removePlayer(io, room, playerId, reason) {
  const player = room.players.get(playerId);
  if (!player) return;
  room.players.delete(playerId);
  if (player.socketId) io.sockets.sockets.get(player.socketId)?.leave(room.id);
  if (room.status === "playing" && room.drawerId === playerId) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    if (room.tickTimer) clearInterval(room.tickTimer);
    room.turnTimer = null;
    room.tickTimer = null;
    room.turnIndex += 1;
    scheduleNextTurn(io, room, 500);
  } else if (room.status === "playing" && room.guessed.size >= connectedPlayers(room).length - 1 && connectedPlayers(room).length > 1) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    if (room.tickTimer) clearInterval(room.tickTimer);
    room.turnTimer = null;
    room.tickTimer = null;
    room.turnIndex += 1;
    scheduleNextTurn(io, room, 500);
  }
  if (room.hostId === playerId) room.hostId = room.players.keys().next().value || null;
  io.to(room.id).emit("systemMessage", { message: `${player.nickname} ${reason} the room.` });
  if (room.players.size === 0) {
    clearRoomTimers(room);
    rooms.delete(room.id);
  } else {
    emitState(io, room);
  }
  emitRoomList(io);
}

function validLine(line) {
  return line && typeof line === "object" && typeof line.strokeId === "string" && line.strokeId.length < 120 &&
    Array.isArray(line.points) && line.points.length >= 2 && line.points.length <= 4000 && line.points.length % 2 === 0 &&
    line.points.every((point) => Number.isFinite(point) && point >= 0 && point <= 2500) &&
    /^#[0-9a-f]{6}$/i.test(line.color) && Number.isFinite(line.size) && line.size >= 1 && line.size <= 40;
}

function createApplication() {
  const app = express();
  const server = http.createServer(app);
  const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:3000,https://guessmydoodle.vercel.app").split(",").map((origin) => origin.trim()).filter(Boolean);
  app.use(cors({ origin: allowedOrigins, credentials: true, methods: ["GET", "POST"] }));
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: true, limit: "32kb" }));
  app.get("/health", (_req, res) => res.status(200).json({ status: "ok", database: require("mongoose").connection.readyState === 1 ? "connected" : "disconnected" }));
  app.use("/auth", authRoutes);
  app.use("/auth", guestRoutes);
  app.use("/account", accountRoutes);
  app.use((error, _req, res, _next) => {
    console.error("HTTP request error:", error.message);
    res.status(400).json({ success: false, message: "Invalid request" });
  });

  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true, methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket) => {
    emitRoomList(io);
    socket.on("requestRooms", () => socket.emit("fetchRooms", getRoomList()));

    socket.on("request-nickname", async ({ userIdToken } = {}) => {
      try {
        const identity = await getIdentity(userIdToken);
        socket.emit("your-nickname", identity.nickname);
      } catch (error) {
        socket.emit("userNotFound", { message: error.message || "Authentication failed" });
      }
    });

    socket.on("createRoom", async (data = {}) => {
      try {
        const identity = await getIdentity(data.userIdToken);
        if (data.isPrivate && (typeof data.password !== "string" || data.password.length < 4 || data.password.length > 64)) {
          socket.emit("roomCreateError", { message: "Private room passwords must be 4–64 characters." });
          return;
        }
        let id;
        do { id = crypto.randomBytes(4).toString("hex").toUpperCase(); } while (rooms.has(id));
        const room = {
          id, name: String(data.roomName || `${identity.nickname}'s room`).trim().slice(0, 40) || `${identity.nickname}'s room`,
          creatorName: identity.nickname, hostId: identity.uid, isPrivate: Boolean(data.isPrivate), password: data.isPrivate ? data.password : null,
          players: new Map(), status: "waiting", drawerId: null, word: "", turnIndex: 0, turnOrder: [], turnEndsAt: 0,
          guessed: new Set(), lines: [], messages: [], history: [], redoHistory: [], strokeIds: new Set(), turnTimer: null, tickTimer: null, cleanupTimer: null, advanceTimer: null,
        };
        rooms.set(id, room);
        if (enterRoom(io, socket, room, identity)) socket.emit("roomCreated", { id });
      } catch (error) {
        socket.emit("roomCreateError", { message: error.message || "Could not create the room." });
      }
    });

    socket.on("joinRoom", async (data = {}) => {
      try {
        const identity = await getIdentity(data.userIdToken);
        const room = rooms.get(String(data.roomId || ""));
        if (!room) { socket.emit("roomJoinError", { message: "Room not found. It may have ended." }); return; }
        if (room.isPrivate && room.password !== data.password && !room.players.has(identity.uid)) { socket.emit("roomJoinError", { message: "That password does not match." }); return; }
        enterRoom(io, socket, room, identity);
      } catch (error) {
        socket.emit("roomJoinError", { message: error.message || "Authentication failed." });
      }
    });

    socket.on("startGame", () => {
      const room = rooms.get(socket.data.roomId);
      if (!room || room.hostId !== socket.data.userId) { socket.emit("gameError", { message: "Only the room host can start the game." }); return; }
      if (!canStartRoom(room)) {
        if (room.status !== "waiting" && room.status !== "ended") return;
        socket.emit("gameError", { message: "The host and at least one other connected player are needed to start." });
        return;
      }
      beginGame(io, room);
    });

    socket.on("message", ({ message } = {}) => {
      const room = rooms.get(socket.data.roomId);
      const player = room?.players.get(socket.data.userId);
      if (!room || !player || !player.connected || room.status !== "playing" || Date.now() >= room.turnEndsAt || player.id === room.drawerId) return;
      const now = Date.now();
      const bucket = guessBuckets.get(socket.data.userId) || [];
      const recent = bucket.filter((timestamp) => now - timestamp < 5000);
      if (recent.length >= 8) { socket.emit("systemMessage", { message: "Slow down a little before sending another guess." }); return; }
      recent.push(now);
      guessBuckets.set(socket.data.userId, recent);
      const text = String(message || "").trim().slice(0, 160);
      if (!text) return;
      if (normalizeAnswer(text) === normalizeAnswer(room.word) && !room.guessed.has(player.id)) {
        room.guessed.add(player.id);
        const correctCount = room.guessed.size;
        const points = Math.max(5, 12 - (correctCount - 1) * 2);
        player.score += points;
        const drawer = room.players.get(room.drawerId);
        if (drawer) drawer.score += 4;
        const chatEntry = { nickname: player.nickname, message: `${player.nickname} guessed it! +${points} points`, timeStamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), type: "correct" };
        room.messages.push(chatEntry);
        room.messages = room.messages.slice(-100);
        io.to(room.id).emit("chatMessage", chatEntry);
        emitState(io, room);
        const eligible = connectedPlayers(room).filter((candidate) => candidate.id !== room.drawerId).length;
        if (room.guessed.size >= eligible && eligible > 0) {
          stopTurnClock(room);
          io.to(room.id).emit("turnEnded", { word: room.word, reason: "solved" });
          room.turnIndex += 1;
          scheduleNextTurn(io, room, 2200);
        }
        return;
      }
      const chatEntry = { nickname: player.nickname, message: text, timeStamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), type: "guess" };
      room.messages.push(chatEntry);
      room.messages = room.messages.slice(-100);
      io.to(room.id).emit("chatMessage", chatEntry);
    });

    socket.on("draw", ({ line } = {}) => {
      const room = rooms.get(socket.data.roomId);
      if (!room || room.status !== "playing" || Date.now() >= room.turnEndsAt || room.drawerId !== socket.data.userId || !validLine(line)) return;
      const index = room.lines.findIndex((existing) => existing.strokeId === line.strokeId);
      if (index < 0) {
        if (room.lines.length >= 500) return;
        room.history.push(room.lines.map((existing) => ({ ...existing, points: [...existing.points] })));
        if (room.history.length > 60) room.history.shift();
        room.redoHistory = [];
        room.strokeIds.add(line.strokeId);
        room.lines.push(line);
      } else {
        room.lines[index] = line;
      }
      socket.to(room.id).emit("draw", { line });
    });

    socket.on("undo", () => {
      const room = rooms.get(socket.data.roomId);
      if (!room || room.status !== "playing" || Date.now() >= room.turnEndsAt || room.drawerId !== socket.data.userId || !room.history.length) return;
      room.redoHistory.push(room.lines.map((line) => ({ ...line, points: [...line.points] })));
      room.lines = room.history.pop();
      io.to(room.id).emit("drawingChanged", { lines: room.lines });
    });

    socket.on("redo", () => {
      const room = rooms.get(socket.data.roomId);
      if (!room || room.status !== "playing" || Date.now() >= room.turnEndsAt || room.drawerId !== socket.data.userId || !room.redoHistory.length) return;
      room.history.push(room.lines.map((line) => ({ ...line, points: [...line.points] })));
      room.lines = room.redoHistory.pop();
      io.to(room.id).emit("drawingChanged", { lines: room.lines });
    });

    socket.on("clearDrawing", () => {
      const room = rooms.get(socket.data.roomId);
      if (!room || room.status !== "playing" || Date.now() >= room.turnEndsAt || room.drawerId !== socket.data.userId || !room.lines.length) return;
      room.history.push(room.lines.map((line) => ({ ...line, points: [...line.points] })));
      room.redoHistory = [];
      room.lines = [];
      io.to(room.id).emit("drawingChanged", { lines: [] });
    });

    socket.on("leaveRoom", () => {
      const room = rooms.get(socket.data.roomId);
      if (room) removePlayer(io, room, socket.data.userId, "left");
      socket.data.roomId = null;
      socket.data.userId = null;
    });

    socket.on("disconnect", () => {
      const room = rooms.get(socket.data.roomId);
      const player = room?.players.get(socket.data.userId);
      if (!room || !player || player.socketId !== socket.id) return;
      player.connected = false;
      if (room.hostId === player.id) room.hostId = connectedPlayers(room)[0]?.id || player.id;
      emitState(io, room);
      const uid = player.id;
      const timer = setTimeout(() => {
        disconnectTimers.delete(uid);
        if (!rooms.has(room.id) || room.players.get(uid)?.connected) return;
        removePlayer(io, room, uid, "left");
      }, ROOM_RECONNECT_GRACE_MS);
      disconnectTimers.set(uid, timer);
    });
  });

  return { app, server, io };
}

async function start() {
  assertGuestTokenSecret();
  await connectToDatabase();
  const { server } = createApplication();
  server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  const shutdown = async (signal) => {
    console.log(`${signal} received; closing server`);
    server.close(async () => {
      await require("mongoose").disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  });
}

module.exports = { createApplication, normalizeAnswer, validLine };
