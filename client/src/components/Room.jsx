import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Stage, Layer, Line } from "react-konva";
import { ReactComponent as PencilIcon } from "../assets/icons/pencil.svg";
import { ReactComponent as EraserIcon } from "../assets/icons/eraser.svg";
import { ReactComponent as SendIcon } from "../assets/icons/sendmsg.svg";
import io from "socket.io-client";
import { auth } from '../lib/firebaseConfig';
import { useTheme } from "../ThemeContext";
import { SnackbarProvider, enqueueSnackbar } from "notistack";
import Modal from 'react-modal';
import axios from "axios";
import { useSocket } from "../SocketProvider.js";
import { useAuth } from '../lib/AuthProvider.js';

// const socket = io("http://localhost:5000");

function Room() {
  const { roomId } = useParams();
  const [tool, setTool] = useState("pen");
  const [lines, setLines] = useState([]);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(5);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [myNickname, setMyNickname] = useState(null);
  const [isMsgFromMe, setIsMsgFromMe] = useState(false);
  const [authKey, setAuthKey] = useState(null);
  const isDrawing = useRef(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [counter, setCounter] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playersScores, setPlayersScores] = useState([]);
  const { theme, changeTheme } = useTheme();
  const { currentUser } = useAuth();
  const [usersPhotoUrl, setUsersPhotoUrl] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState('');

  const socket = useSocket();
  const navigate = useNavigate();
  useEffect(() => {
    if (socket && currentUser) {
      socket.connect();
      const userIdToken = localStorage.getItem("authToken");

      // Emit to join the room


      socket.on("currentPlayer", (data) => {
        setCurrentPlayer(data._currentPlayer);
      })

      socket.emit("joinRoom", { userIdToken, roomId });


      socket.on("userJoined", (data) => {
        enqueueSnackbar(data.message, { variant: 'success', anchorOrigin: { vertical: 'top', horizontal: 'center' }, autoHideDuration: 2000 });
      });

      socket.on("roomJoined", ({ id, userAuthkey, nickname }) => {
        setMyNickname(nickname);
        localStorage.setItem("nickname", nickname);
        setAuthKey(userAuthkey);
        localStorage.setItem("myauthkey", userAuthkey);
      });

      socket.on("recieve-message", ({ roomId, ...msg }) => {
        setMessages(prevMessages => [...prevMessages, msg]);
      });

      socket.on("draw", ({ roomId: rId, line }) => {
        if (rId === roomId) {
          setLines(prevLines => [...prevLines, line]);
        }
      });

      socket.on("undo", ({ roomId: rId, updatedLines }) => {
        if (rId === roomId) {
          setLines(updatedLines);
        }
      });

      socket.on("redo", ({ roomId: rId, updatedLines }) => {
        if (rId === roomId) {
          setLines(updatedLines);
        }
      });

      socket.on("start-game", ({ roomId, message, currentPlayerIndex, isTurnOver }) => {
        enqueueSnackbar(message, { variant: 'default', anchorOrigin: { vertical: 'top', horizontal: 'center' }, autoHideDuration: 2000 });
        if (isTurnOver) {
          setIsMyTurn(false);
        }
        socket.emit("game-started", { roomId, userAuthkey: authKey, _currentPlayerIndex: currentPlayerIndex, isTurnOver });
      });

      socket.on("game-ended", ({ roomId, players_score_data, message }) => {
        setPlayersScores(players_score_data);
        setIsModalOpen(true);
      });

      socket.on("set-counter", (timer) => {
        setCounter(timer);
      });

      socket.on('request-player-authKey', () => {
        const myAuthKey = localStorage.getItem("myauthkey");
        socket.emit("client-auth-key", myAuthKey);
      });

      socket.on("start-drawing", ({ word, roomId }) => {
        setIsMyTurn(true);
        enqueueSnackbar("You have to draw: " + word, { variant: 'default', anchorOrigin: { vertical: 'default', horizontal: 'center' }, autoHideDuration: 2000 });
      });

      socket.on("drawing-started", ({ roomId, currentPlayer }) => {
      });

      socket.on("switch-turn", ({ roomId, scores, _currentPlayerIndex }) => {

        setIsMyTurn(false);
        socket.emit("switch-turn-client", { roomId, scores, _currentPlayerIndex });
      });

      socket.on("request-nickname", (roomId) => {
        const sendNickname = localStorage.getItem("nickname");
        socket.emit("send-nickname", { roomId, sendNickname });
      });

      socket.on("disconnect", (reason) => {
        const myAuthKey = localStorage.getItem("myauthkey");
        socket.emit("roomDisconnected", { roomId, myAuthKey });
        socket.emit("joinRoom", { userIdToken, roomId });
      });

      const myAuthKey = localStorage.getItem("myauthkey");
      return () => {
        // Emit disconnect event before the cleanup
        socket.emit("roomDisconnected", { roomId, myAuthKey });

        socket.off(); // Clean up event listeners
        socket.disconnect(); // Disconnect socket
      };
    }
  }, []);
  const handleMouseDown = (e) => {
    if (!isMyTurn) {
      return;
    }
    else {
      isDrawing.current = true;
      const pos = e.target.getStage().getPointerPosition();
      if (pos) {
        const newLine = {
          tool,
          points: [pos.x, pos.y],
          color: tool === "eraser" ? "#0a0a0a" : brushColor,
          size: brushSize,
        };
        setLines([...lines, newLine]);
        setUndoStack([...undoStack, lines]);
        setRedoStack([]);
        socket.emit("draw", { roomId, line: newLine });
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isMyTurn || !isDrawing.current) {
      return;
    }
    else {
      const stage = e.target.getStage();
      const point = stage.getPointerPosition();
      if (!point) return;

      setLines((prevLines) => {
        const lastLine = { ...prevLines[prevLines.length - 1] };
        lastLine.points = lastLine.points.concat([point.x, point.y]);

        const newLines = prevLines
          .slice(0, prevLines.length - 1)
          .concat(lastLine);
        socket.emit("draw", { roomId, line: lastLine });
        return newLines;
      });
    }
  };

  const handleMouseUp = () => {
    if (!isMyTurn) { return; }
    else { isDrawing.current = false; }
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack.pop();
    setRedoStack([lines, ...redoStack]);
    setLines(previousState);
    socket.emit("undo", { roomId, updatedLines: previousState });
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack.shift();
    setUndoStack([...undoStack, lines]);
    setLines(nextState);
    socket.emit("redo", { roomId, updatedLines: nextState });
  };

  const sendMessage = () => {
    if (message.trim() === "") return;

    const messageData = {
      roomId,
      message,
      userAuthkey: authKey
    };
    socket.emit("message", messageData);
    setMessage("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    navigate('/main');
  }


  return (
    <div className={`${theme === 'light' ? 'bg-[#e6e6e6] text-black' : 'bg-black text-white'} h-screen flex`}>
      <SnackbarProvider />
      <div className="flex flex-col w-3/4 h-full p-4 ">
        <div className={`${theme === 'light' ? 'bg-[#e6e6e6] text-black' : 'bg-[#1e1e1e]'} p-4 rounded-lg shadow-lg mb-4 flex justify-between items-center`}>
          <div className="flex space-x-2">
            <button
              onClick={() => setTool("pen")}
              className={`px-4 py-2 flex rounded-md ${theme === 'light' ? 'bg-white hover:bg-[#c4c4c4]' : 'bg-[#2b2b2b] hover:bg-[#3a3a3a]'} ${tool === "pen" ? "bg-[#3a3a3a]" : "bg-[#2b2b2b]"
                } hover:bg-[#3a3a3a] transition duration-200`}
            >
              <PencilIcon className="w-6 h-6 mr-4" />
              Pencil
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`px-4 py-2 flex rounded-md ${theme === 'light' ? 'bg-white hover:bg-[#c4c4c4]' : 'bg-[#2b2b2b] hover:bg-[#3a3a3a]'} ${tool === "eraser" ? "bg-[#3a3a3a]" : "bg-[#2b2b2b]"
                } hover:bg-[#3a3a3a] transition duration-200`}
            >
              <EraserIcon className="w-6 h-6 mr-4" />
              Eraser
            </button>
          </div>
          <div className="flex space-x-4">
            <label className="flex items-center">
              Brush Color:
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="ml-2 border-none w-20 h-10"
              />
            </label>
            <label className="flex items-center">
              Brush Size:
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                className="ml-2"
              />
            </label>

            <div className="flex items-center font-bold">{currentPlayer.length > 8 ? currentPlayer.substring(0, 8) + "..." : currentPlayer}</div>
            <div className="flex items-center font-bold">{`time: ${counter}`}</div>

          </div>
          <div className="flex space-x-2">
            <button
              onClick={undo}
              className={`px-4 py-2 rounded-md ${theme === 'light' ? 'bg-white hover:bg-[#c4c4c4]' : 'bg-[#2b2b2b] hover:bg-[#3a3a3a]'} transition duration-200`}
            >
              Undo
            </button>
            <button
              onClick={redo}
              className={`px-4 py-2 rounded-md ${theme === 'light' ? 'bg-white hover:bg-[#c4c4c4]' : 'bg-[#2b2b2b] hover:bg-[#3a3a3a]'} transition duration-200`}
            >
              Redo
            </button>
          </div>
        </div>
        <Stage
          width={window.innerWidth * 0.75} // 75% of the screen width
          height={window.innerHeight * 0.75} // Adjust height accordingly
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}

          className='bg-white rounded-lg'
        >
          <Layer>
            {lines.map((line, index) => (
              <Line
                key={index}
                points={line.points}
                stroke={line.color}
                strokeWidth={line.size}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            ))}
          </Layer>
        </Stage>

        <div className="flex items-center">
          <img src={usersPhotoUrl[0]} />
        </div>
      </div>
      <div className={`w-1/4 h-full ${theme === 'light' ? 'bg-white' : 'bg-[#1e1e1e]'} p-4 flex flex-col`}>
        <div className="flex-grow overflow-y-auto mb-4 space-y-2">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.nickname === myNickname ? "justify-end" : "justify-start"}`}
            >
              <div className="flex-col">
                <div className={`${msg.nickname === myNickname ? "text-right" : "text-left"} text-xs ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                  {msg.nickname.length > 15 ? msg.nickname.substring(0, 15) + '...' : msg.nickname}
                </div>
                <div
                  className={`${msg.nickname === myNickname
                    ? "bg-indigo-600 text-white text-right rounded-tr-none"
                    : "bg-indigo-200 text-black rounded-tl-none"
                    } min-w-36 max-w-lg shadow-lg rounded-lg p-3`}
                >
                  <div>
                    <div className="text-sm">{msg.message}</div>
                    <div className="mb-1" style={{ fontSize: '10px' }}>
                      {msg.timeStamp}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>

        <Modal
          isOpen={isModalOpen}
          onRequestClose={closeModal}
          contentLabel="Game Ended"
          ariaHideApp={false}
          className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50"
          overlayClassName="fixed inset-0 bg-black bg-opacity-50"
        >
          <div className="bg-white p-6 rounded-lg shadow-lg min-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Game Over</h2>
            <ul className="list-disc list-inside mb-4">
              {playersScores.map((player, index) => (
                <li key={index} className="text-lg">
                  <span className="font-semibold">{player.nickname}:</span> {player.score}
                </li>
              ))}
            </ul>
            <button
              onClick={closeModal}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </Modal>
        <div className="flex items-center">
          <input
            className={`flex-grow px-5 py-3 ${theme === 'light' ? 'bg-[#e6e6e6] text-black' : 'bg-[#2b2b2b] text-white'} rounded-lg rounded-r-none p-2 focus:outline-none`}
            type="text"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            disabled={isMyTurn ? true : false}
          />
          <button
            onClick={sendMessage}
            className="px-5 py-3 flex rounded-lg rounded-l-none bg-indigo-600 text-white hover:bg-indigo-800 transition duration-200"
          >
            Send
            <SendIcon className="ml-2 items-center w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Room;
