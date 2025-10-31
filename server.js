import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // テスト中なので全許可
  },
});

const PORT = process.env.PORT || 3010;

// publicフォルダを静的配信
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`joined room ${room}`);
  });

  // ✏️ 線の開始
  socket.on("begin", ({ room, point }) => {
    socket.to(room).emit("begin", { point });
  });

  // ✏️ 線の描画
  socket.on("draw", ({ room, point }) => {
    socket.to(room).emit("draw", { point });
  });

  // ✏️ 描画終了（いまは何もしない）
  socket.on("end", ({ room }) => {
    socket.to(room).emit("end");
  });

  // 🧽 全消去
  socket.on("clear", ({ room }) => {
    io.to(room).emit("clear");
  });

  socket.on("disconnect", () => {
    console.log("a user disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
