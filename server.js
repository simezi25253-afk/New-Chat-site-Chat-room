const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Room = require("./models/Room");
const Message = require("./models/Message");
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


// ホーム（ルーム一覧）
app.get("/", async (req, res) => {
  const token = req.query.token;
  if (!token) return res.send("トークンがありません");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.send("トークンが無効です");
  }

  const rooms = await Room.find().sort({ createdAt: -1 });

  res.render("home", {
    username: decoded.username,
    token,
    rooms
  });
});


// チャットルーム表示
app.get("/room/:roomId", async (req, res) => {
  const token = req.query.token;

  if (!token) return res.send("トークンがありません");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.send("トークンが無効です");
  }

  const username = decoded.username;
  const room = await Room.findOne({ roomId: req.params.roomId });

  if (!room) return res.send("このルームは存在しません");

  const messages = await Message.find({ roomId: room.roomId }).sort({ createdAt: 1 });

  res.render("room", {
    roomName: room.roomName,
    username,
    roomId: room.roomId,
    token,
    messages
  });
});


// WebSocket
io.on("connection", (socket) => {
  console.log("ユーザー接続");

  // 部屋に参加
  socket.on("joinRoom", ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    // 入室通知
    io.to(roomId).emit("systemMessage", `${username} が入室しました`);
  });

  // メッセージ送信
  socket.on("chatMessage", async ({ roomId, username, message }) => {

    // DB 保存
    const msg = await Message.create({
      roomId,
      username,
      message,
      readBy: [username] // 自分は既読
    });

    // 全員に送信
    io.to(roomId).emit("chatMessage", {
      username,
      message,
      messageId: msg._id
    });
  });

  // 既読処理
  socket.on("readMessage", async ({ messageId, username, roomId }) => {
    await Message.updateOne(
      { _id: messageId },
      { $addToSet: { readBy: username } }
    );

    io.to(roomId).emit("updateRead", { messageId, username });
  });

  // 退出
  socket.on("disconnect", () => {
    if (socket.roomId && socket.username) {
      io.to(socket.roomId).emit("systemMessage", `${socket.username} が退出しました`);
    }
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Chat room server running"));
