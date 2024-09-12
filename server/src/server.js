const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectToDatabase = require("../lib/dbConnection.js");
const auth = require("./routes/isAccountExists.js");
const newuser = require("./routes/createUser.js");
const cors = require("cors");
const verifyIdToken = require("./services/firebase.js");
const User = require("./models/UserModel.js");
const app = express();
const server = http.createServer(app);
const lodash = require('lodash');
const Rooms = require("./models/Rooms.js");

require('dotenv').config();


app.use(cors())

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server);

connectToDatabase();

const rooms = {};
const userRooms = {};

const scores_global = new Array(6).fill(0);


const words = [
  "Apple", "Banana", "Carrot", "Dog", "Elephant", "Frog", "Giraffe", "Hat", "Igloo", "Jackal",
  "Kite", "Lion", "Monkey", "Nest", "Orange", "Parrot", "Queen", "Rose", "Sun", "Tree",
  "Umbrella", "Violin", "Whale", "Xylophone", "Yacht", "Zebra", "Ant", "Bear", "Cloud", "Dolphin",
  "Egg", "Flower", "Ghost", "House", "Ice", "Jelly", "King", "Leaf", "Mountain", "Night",
  "Owl", "Penguin", "Quilt", "Rainbow", "Star", "Tiger", "Unicorn", "Vase", "Window", "Xylophone",
  "Yarn", "Zipper", "Airport", "Balloon", "Camera", "Dragon", "Engine", "Fire", "Garden", "Helicopter",
  "Island", "Juice", "Kite", "Lamp", "Moon", "Notebook", "Orange", "Pizza", "Quokka", "Rocket",
  "Ship", "Treehouse", "Unicorn", "Volcano", "Waterfall", "X-ray", "Yacht", "Zebra", "Avenue", "Bakery",
  "Circus", "Diner", "Eggplant", "Forest", "Guitar", "Hotel", "Iceberg", "Jungle", "Keyhole", "Lighthouse",
  "Meadow", "Necklace", "Ocean", "Penguin", "Quilt", "Raccoon", "Snowflake", "Telescope", "Underground", "Velvet",
  "Wagon", "Xerox", "Yardstick", "Zephyr", "Acorn", "Banana", "Candle", "Desk", "Elephant", "Fountain",
  "Glove", "Horizon", "Ink", "Jar", "Kangaroo", "Lemon", "Map", "Notebook", "Octopus", "Pencil",
  "Quill", "River", "Starfish", "Teapot", "Uranus", "Vase", "Waffle", "Xylophone", "Yogurt", "Zephyr",
  "Airplane", "Bicycle", "Castle", "Dragonfly", "Envelope", "Feather", "Giraffe", "Harmonica", "Iguana", "Jellyfish",
  "Key", "Lamp", "Mountain", "Nectar", "Orange", "Pineapple", "Quasar", "Rainbow", "Sunflower", "Turtle",
  "Unicycle", "Volcano", "Windmill", "Xylophone", "Yacht", "Zebra", "Astronaut", "Blossom", "Cupcake", "Dove",
  "Eagle", "Fireworks", "Gondola", "Helium", "Igloo", "Jaguar", "Kite", "Lighthouse", "Marble", "Nutmeg",
  "Ostrich", "Penguin", "Quilt", "Rose", "Squirrel", "Train", "Umbrella", "Velvet", "Wagon", "Xylophone",
  "Yak", "Zebra", "Anchor", "Butterfly", "Chocolate", "Dragon", "Envelope", "Feather", "Guitar", "Hammock",
  "Ink", "Jellyfish", "Kangaroo", "Lemon", "Moon", "Nectarine", "Orchid", "Penguin", "Quill", "Rainbow",
  "Star", "Telescope", "Unicorn", "Vase", "Whale", "Xylophone", "Yarn", "Zephyr", "Acorn", "Balloon",
  "Chocolate", "Daisy", "Elephant", "Feather", "Giraffe", "Hummingbird", "Iceberg", "Jigsaw", "Koala", "Lollipop",
  "Mango", "Noodle", "Oasis", "Panda", "Quartz", "Rainbow", "Snowball", "Tulip", "Ukelele", "Violet",
  "Whistle", "Xylophone", "Yogurt", "Zephyr", "Ant", "Bat", "Cactus", "Diamond", "Echo", "Flame",
  "Glacier", "Horizon", "Ink", "Jaguar", "Kite", "Lemon", "Magnet", "Nugget", "Opal", "Penguin",
  "Quilt", "Rocket", "Sapphire", "Tangerine", "Utopia", "Vortex", "Watermelon", "Xylophone", "Yacht", "Zephyr"
];

let isGameEnded = false;

io.on("connection", async (client) => {

  io.emit('fetchRooms', rooms);

  client.on('request-nickname', async ({ userIdToken }) => {
    let nickname;
    const decodedToken = await verifyIdToken(userIdToken);

    if (
      decodedToken.email && decodedToken.firebase.sign_in_provider === "google.com"
    ) {
      let email = decodedToken.email;
      const user = await User.find({ email });
      if (user.length) {
        nickname = user[0].nickname;
        client.emit('your-nickname', nickname);
      }
      else {
        client.emit('userNotFound', { message: 'User not found' });
      }
    }
  })

  client.on("createRoom", async (roomData) => {
    try {
      const decodedToken = await verifyIdToken(roomData.userIdToken);

      let isAnonymous = false;
      let nickname;
      let userAuthkey = decodedToken.uid;
      if (
        decodedToken.email &&
        decodedToken.firebase.sign_in_provider === "google.com"
      ) {
        let email = decodedToken.email;
        const user = await User.find({ email });
        if (user.length) {
          nickname = user[0].nickname;
        } else {
          client.emit("roomCreateError", { message: "User account not found" });
        }
      } else if (decodedToken.firebase.sign_in_provider === "anonymous") {
        isAnonymous = true;
        client.emit("roomCreateError", { message: "Guest users cannot access this feature" });
      } else {
        client.emit("roomCreateError", { message: "User account not found" });
      }


      if (!isAnonymous) {
        const roomId = generateRoomId();
        const newRoom = {
          id: roomId,
          name: roomData.roomName,
          creator: nickname,
          isPrivate: roomData.isPrivate,
          password: roomData.password,
          users: [],
          usersData: [],
          drawings: [],
        };

        newRoom[userAuthkey] = nickname;

        userRooms[client.id] = roomId;
        let creatorData = {
          socketId: client.id,
          nickname,
          score: 0,
          isCurrentPlayer: false,
        };


        if (!newRoom.users.includes(nickname)) {
          newRoom.users.push(nickname);
          newRoom.usersData.push(creatorData);
        }

        rooms[roomId] = newRoom;




        client.emit("roomCreated", { id: newRoom.id });

      }

    } catch (error) {
      console.error("Error", error);
      client.emit("roomCreateError", { message: "Something went wrong" });
    }
  });

  // Joining room

  client.on("joinRoom", async (joinData) => {

    const decodedToken = await verifyIdToken(joinData.userIdToken);
    let nickname;

    let userAuthkey = decodedToken.uid;
    if (
      decodedToken.email &&
      decodedToken.firebase.sign_in_provider === "google.com"
    ) {
      let email = decodedToken.email;
      const user = await User.find({ email });
      if (user.length) {
        nickname = user[0].nickname;
      } else {
        client.emit("roomJoinError", { message: "User account not found" });
        return;
      }
    } else if (decodedToken.firebase.sign_in_provider === "anonymous") {
      nickname = `Guest_${decodedToken.uid}`;
    } else {
      client.emit("roomJoinError", { message: "User account not found" });
      return;
    }

    const room = rooms[joinData.roomId];
    if (room) {
      if (room.isPrivate && room.password !== joinData.password) {
        client.emit("roomJoinError", { message: "Incorrect password." });
        return;
      } else if (room.users.length > 6) {
        client.emit("roomJoinError", { message: "Room is full" });
        return;
      }

      room[userAuthkey] = nickname;
      client.join(joinData.roomId);
      userRooms[client.id] = joinData.roomId;
      let joinUserData = {
        socketId: client.id,
        nickname,
        score: 0,
        isTurnOver: false,
      };
      if (!room.users.includes(nickname)) {
        room.users.push(nickname);
        room.usersData.push(joinUserData);
      }
      client.emit("roomJoined", { id: room.id, userAuthkey, nickname });

      client.broadcast.to(joinData.roomId).emit("userJoined", {
        message: `${nickname} joined the Room`,
      });
      if (room.users.length === 6) {
        const currentPlayerIndex = 0;
        io.in(joinData.roomId).emit("start-game", {
          roomId: joinData.roomId,
          message: "Game started",
          currentPlayerIndex,
          isTurnOver: rooms[joinData.roomId].usersData.isTurnOver
        });
      }
    } else {
      client.emit("roomJoinError", { message: "Room not found." });
    }
  });

  let gameTimer;

  const handleGameStart = async ({ roomId, userAuthkey, _currentPlayerIndex, isTurnOver }) => {
    if (isGameEnded) {
      return;
    }
    if (isTurnOver) return;

    if (_currentPlayerIndex)

      clearTimeout(gameTimer);

    let timer = 60;
    const intervalId = setInterval(() => {
      if (timer < 0) {
        clearInterval(intervalId);
        return;
      }
      io.in(roomId).emit('set-counter', timer);
      timer--;
    }, 1000);

    const players = rooms[roomId].usersData;


    if (_currentPlayerIndex > players.length - 1) {
      isGameEnded = true;
    }

    let currentPlayer = players[_currentPlayerIndex];
    io.in(roomId).emit('currentPlayer', { _currentPlayer: currentPlayer.nickname });



    io.to(roomId).emit("request-player-authKey");

    client.once("client-auth-key", (userAuthkey) => {

      if ((rooms[roomId][userAuthkey] === currentPlayer.nickname && (!currentPlayer.isTurnOver))) {
        client.emit("start-drawing", { word, roomId });
      } else {
        client.emit("drawing-started", { currentPlayer: currentPlayer.nickname, roomId });
      }
    });

    let _room = rooms[roomId];
    let _guessedPlayers = [];
    let scores = [];

    const randomIndex = Math.floor(Math.random() * words.length);
    word = words[randomIndex];


    client.removeAllListeners("message");  // Prevent stacking listeners
    client.on("message", ({ roomId, message, userAuthkey }) => {
      let currentDate = new Date().toLocaleTimeString();
      const nickname = _room[userAuthkey];
      let score = 0;


      if (_room[userAuthkey]) {




        if (message.toLowerCase() === word.toLowerCase() && !(_guessedPlayers.includes(_room[userAuthkey]))) {
          _guessedPlayers.push(_room[userAuthkey]);
          score = 10 - (_guessedPlayers.indexOf(nickname) * 2);

          scores_global[_currentPlayerIndex] += score;

          client.emit("recieve-message", {
            roomId,
            message: `${message.toUpperCase()} : You guessed it correct and got ${score} points`,
            nickname: _room[userAuthkey],
            timeStamp: currentDate,
          });

          client.broadcast.emit("recieve-message", {
            roomId,
            message: `${rooms[roomId][userAuthkey]} guessed it correct and got ${score} points`,
            nickname: _room[userAuthkey],
            timeStamp: currentDate,
          });

          const updateScore = rooms[roomId].usersData.find(user => user.nickname === nickname);
          updateScore.score = score;

          return;
        }
        io.in(roomId).emit("recieve-message", {
          roomId,
          message,
          nickname: _room[userAuthkey],
          timeStamp: currentDate,
        });
        return;
      }
    });


    gameTimer = setTimeout(() => {
      io.in(roomId).emit("request-nickname", roomId);
      client.once("send-nickname", ({ roomId, sendNickname }) => {  // Use `once` here
        if (sendNickname === currentPlayer.nickname) {
          currentPlayer.isTurnOver = true;
          io.in(roomId).emit("switch-turn", { roomId, _currentPlayerIndex });
        }
      });
    }, 20000);
  };

  client.once("game-started", handleGameStart);

  client.on("switch-turn-client", ({ roomId, _currentPlayerIndex }) => {

    _currentPlayerIndex++;

    if (_currentPlayerIndex > rooms[roomId].users.length - 1) {

      const players = rooms[roomId].usersData;
      const ranking = [...players].sort((a, b) => b.score - a.score);

      const players_score_data = ranking.map((player) => {
        return { nickname: player.nickname, score: player.score };
      })

      io.in(roomId).emit('game-ended', { roomId, players_score_data, message: 'Game ended' })

      return;
    }


    io.in(roomId).emit("start-game", {
      roomId: roomId,
      message: `${rooms[roomId].usersData[_currentPlayerIndex].nickname}'s turn`,
      currentPlayerIndex: _currentPlayerIndex,
      isTurnOver: rooms[roomId].usersData.isTurnOver
    });

    handleGameStart({ roomId, userAuthkey: null, _currentPlayerIndex, isTurnOver: false });
  });


  client.on("draw", ({ roomId, line }) => {
    const room = rooms[roomId];
    if (room) {
      if (line && Array.isArray(line.points)) {

        room.drawings.push(line);
        client.broadcast.to(roomId).emit("draw", { roomId, line });
      } else {
        console.error("Invalid line data:", line);
      }
    }
  });

  client.on("undo", ({ roomId, updatedLines }) => {
    const room = rooms[roomId];
    if (room) {
      room.drawings = updatedLines;
      client.broadcast.to(roomId).emit("undo", { roomId, updatedLines });
    }
  });

  client.on("redo", ({ roomId, updatedLines }) => {
    const room = rooms[roomId];
    if (room) {
      room.drawings = updatedLines;
      client.broadcast.to(roomId).emit("redo", { roomId, updatedLines });
    }
  });

  client.on("roomDisconnected", ({ roomId, myAuthKey }) => {
    if (rooms[roomId]) {
      const creator = rooms[roomId].creator;
      const userauth = rooms[roomId][myAuthKey];
      if (creator === userauth) {
        delete rooms[roomId];
        io.emit('deleteRoom', roomId);
      }
    }
  })

  client.on("disconnect", () => {
    const roomId = userRooms[client.id];
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      room.users = room.users.filter((userId) => userId !== room[client.id]);
      client.broadcast.to(roomId).emit("userLeft", {
        message: `A user with id ${client.id} has left the room.`,
      });
    }
    delete userRooms[client.id];
  });
});

function generateRoomId() {
  return crypto.randomUUID();
}

app.use("/auth", auth);
app.use("/account", newuser);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
