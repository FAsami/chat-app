const socket = io("/");
const videoContainerEl = document.getElementById("video-container");
const actionButtonsEl = document.getElementById("action-buttons");
const shareScreenEl = document.getElementById("share-screen");
const stopScreenEl = document.getElementById("stop-share");

const peer = new Peer(undefined, {
  config: {
    iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "0f956e42603ee768b783e0e2",
        credential: "c6rFQYnCpXqbdLK3",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "0f956e42603ee768b783e0e2",
        credential: "c6rFQYnCpXqbdLK3",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: "0f956e42603ee768b783e0e2",
        credential: "c6rFQYnCpXqbdLK3",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: "0f956e42603ee768b783e0e2",
        credential: "c6rFQYnCpXqbdLK3",
      },
    ],
  },
});

let currentStream;
socket.on("connected-users", async (connectedUserIds) => {
  if (connectedUserIds.length === 1) {
    // Get the current video stream
    const stream = await getStream();
    currentStream = stream;

    // Render local video for first or admin user
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.addEventListener("loadedmetadata", () => {
      video.play().catch((error) => {
        console.error("Unable to play video:", error);
      });
      videoContainerEl.append(video);

      //action buttons
      actionButtonsEl.style.display = "block";
    });
  }
});

shareScreenEl.addEventListener("click", async () => {
  const stream = await getScreen();
  currentStream = stream;

  const video = document.querySelector("video");
  video.srcObject = stream;
  video.muted = true;
  video.addEventListener("loadedmetadata", () => {
    video.play().catch((error) => {
      console.error("Unable to play video:", error);
    });
    videoContainerEl.append(video);
  });
});

stopScreenEl.addEventListener("click", async () => {
  const video = document.querySelector("video");
  const tracks = video.srcObject.getTracks();
  tracks.forEach((track) => track.stop());
  const stream = await getStream();
  currentStream = stream;
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play().catch((error) => {
      console.error("Unable to play video:", error);
    });
  });
});

const getStream = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  return stream;
};

const getScreen = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  });
  return stream;
};

peer.on("error", (err) => {
  console.error("PeerJS error:", err);
});

peer.on("open", (id) => {
  const roomId = window.location.pathname.replace("/", "");
  socket.emit("join-room", roomId, id);
});

peer.on("call", (call) => {
  call.answer();
  videoContainerEl.setAttribute("data-remote", "true");
  const video = document.createElement("video");
  call.on("stream", (stream) => {
    video.srcObject = stream;
    videoContainerEl.addEventListener("click", () => {
      video.play();
    });
    video.addEventListener("loadedmetadata", () => {
      videoContainerEl.append(video);
    });
  });
});

socket.on("user-connected", async (userId) => {
  if (currentStream) {
    peer.call(userId, currentStream);
  }
});
