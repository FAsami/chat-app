const socket = io("/");
const videoContainerEl = document.getElementById("video-container");
const actionButtonsEl = document.getElementById("action-buttons");
const shareScreenEl = document.getElementById("share-screen");
const stopScreenEl = document.getElementById("stop-share");
const startRecordingEl = document.getElementById("start-recording");
const stopRecordingEl = document.getElementById("stop-recording");

const messageFormEl = document.getElementById("message-form");
const inputEl = document.getElementById("input-form");

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
let caller;
let connectedPeers = [];

socket.on("user-connected", async (userId, users) => {
  const isAdmin = users.find((user) => user.userId === userId).isAdmin;

  if (isAdmin) {
    const stream = await getStream();
    currentStream = stream;
    startRecordingEl.addEventListener("click", () => startRecording(stream));
    const video = document.querySelector("video");
    video.srcObject = stream;
    video.muted = true;
    video.addEventListener("loadedmetadata", () => {
      video.play();
      videoContainerEl.append(video);
      actionButtonsEl.style.display = "block";
    });
  }
  let call;
  if (!isAdmin) {
    call = peer.call(userId, currentStream);
  }
  users.forEach(async () => {
    if (call) {
      connectedPeers.push(call.peerConnection);
    }
  });
});

socket.on("user-disconnected", (userId, users) => {
  const isAdmin = users.find((user) => user.userId === userId)?.isAdmin;
  if (isAdmin) {
    console.log("Admin  disconnected!");
  }
});

peer.on("open", (id) => {
  const roomId = window.location.pathname.replace("/", "");
  const userId = id;
  socket.emit("join-room", roomId, userId);
});

peer.on("call", (call) => {
  call.answer();
  videoContainerEl.setAttribute("data-remote", "true");
  const video = document.querySelector("video");
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

peer.on("error", (error) => {
  console.error(error);
});

shareScreenEl.addEventListener("click", async () => {
  const stream = await getScreen();
  screenStream = stream;

  if (connectedPeers.length) {
    connectedPeers.forEach((connection) => {
      const [videoTrack] = stream.getVideoTracks();
      const sender = connection
        .getSenders()
        .find((s) => s.track.kind === videoTrack.kind);
      sender.replaceTrack(videoTrack);
    });
  }
  const video = document.querySelector("video");
  video.srcObject = stream;
  video.muted = true;
  video.addEventListener("loadedmetadata", () => {
    video.play();
    videoContainerEl.append(video);
  });
});

stopScreenEl.addEventListener("click", async () => {
  const video = document.querySelector("video");
  const tracks = video.srcObject.getTracks();
  tracks.forEach((track) => track.stop());
  const stream = await getStream();

  if (connectedPeers.length) {
    connectedPeers.forEach((connection) => {
      const [videoTrack] = stream.getVideoTracks();
      const sender = connection
        .getSenders()
        .find((s) => s.track.kind === videoTrack.kind);
      sender.replaceTrack(videoTrack);
    });
  }

  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
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

const startRecording = (stream) => {
  const chunks = [];
  const mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  mediaRecorder.start();
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    await uploadVideo(blob);
    chunks.length = 0;
  };

  stopRecordingEl.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  });
};

const uploadVideo = async (blob) => {
  try {
    const formData = new FormData();
    formData.append("video", blob, "recording.webm");

    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      console.log("Video uploaded successfully.");
    } else {
      console.error("Failed to upload video.");
    }
  } catch (error) {
    console.error("Error uploading video:", error);
  }
};

messageFormEl.addEventListener("submit", (e) => {
  e.preventDefault();
  if (inputEl.value) {
    socket.emit("send-message", inputEl.value);
    inputEl.value = "";
  }
});
const messageContainer = document.getElementById("messages");

socket.on("create-message", (message, userId) => {
  const id = generateRandomString(6);
  messageContainer.innerHTML += getMessageString(
    id,
    message,
    userId.split("-")[0]
  );
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
});

const generateRandomString = (length) => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const getMessageString = (id, message, sender) => {
  return `
    <div id=${id} class="message">
      <small class="sender">${sender}</small>
      <div class="content">${message}</div>
    </div>
  `;
};
