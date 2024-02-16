const socket = io("/");
const videoContainerEl = document.getElementById("video-container");
const actionButtonsEl = document.getElementById("action-buttons");
const shareScreenEl = document.getElementById("share-screen");
const stopScreenEl = document.getElementById("stop-share");
const startRecordingEl = document.getElementById("start-recording");
const stopRecordingEl = document.getElementById("stop-recording");

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

    //Add event listener to start recording on click on start button
    startRecordingEl.addEventListener("click", () => startRecording(stream));

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

const startRecording = (stream) => {
  console.log(stream);
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
