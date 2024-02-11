const express = require("express");
const app = express();
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");
app.set("view engine", "ejs");
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});
const { ExpressPeerServer } = require("peer");
const opinions = {
  debug: true,
};

app.use("/peerjs", ExpressPeerServer(server, opinions));
app.use(express.static("public"));

// Object to store connected users
const connectedUsers = {};

app.get("/", (req, res) => {
  res.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId, userName) => {
    socket.join(roomId);

    if (!connectedUsers[roomId]) {
      connectedUsers[roomId] = [];
    }
    connectedUsers[roomId].push(userId);

    io.to(roomId).emit("user-connected", userId, userName);

    socket.on("message", (message) => {
      io.to(roomId).emit("createMessage", message, userName);
    });

    // Emit the list of connected user IDs to the client
    socket.emit("connected-users", connectedUsers[roomId]);

    socket.on("disconnect", () => {
      console.log(connectedUsers);
      if (connectedUsers[roomId]) {
        const index = connectedUsers[roomId].indexOf(userId);
        if (index !== -1) {
          connectedUsers[roomId].splice(index, 1);
          io.to(roomId).emit("user-disconnected", userId);
        }
      }
    });
  });
});
const PORT = 8909;
server.listen(PORT, () => console.log("Sever is running PORT " + PORT));
