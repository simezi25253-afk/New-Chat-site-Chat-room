const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Room = require("./models/Room");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// MongoDB 接続
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected (chat room)"))
  .catch(err => console.log(err));


// チャットルーム表示
app.get("/room/:roomId", async (req, res) => {
  const token = req.query.token;

  if (!token) return res.send("トークンがありません。ログインしてください。");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.send("トークンが無効です。ログインし直してください。");
  }

  const username = decoded.username;
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) return res.send("このルームは存在しません");

  res.render("room", {
    roomName: room.roomName,
    username,
    roomId: room.roomId,
    token
  });
});


// WebSocket（リアルタイム通信）
io.on("connection", (socket) => {
  console.log("ユーザーが接続しました");

  // 部屋に参加
  socket.on("joinRoom", ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`${username} が ${roomId} に参加`);
  });

  // メッセージ受信
  socket.on("chatMessage", ({ roomId, username, message }) => {
    io.to(roomId).emit("chatMessage", {
      username,
      message
    });
  });

  socket.on("disconnect", () => {
    console.log("ユーザーが切断しました");
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Chat room server running"));
