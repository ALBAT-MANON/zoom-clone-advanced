import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import Join from "./Join.jsx";
import "./App.css"; // You’ll style this
const profilePic = "/profile.jpg"; // image placed in public folder

const SERVER_URL = "http://localhost:5000";

const App = () => {
  const [yourID, setYourID] = useState("");
  const [peers, setPeers] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState({});
  const [startTime] = useState(Date.now());
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [file, setFile] = useState(null);

  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);
  const chatBoxRef = useRef();

  useEffect(() => {
    if (!userInfo) return;

    socketRef.current = io(SERVER_URL);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      userVideo.current.srcObject = stream;

      socketRef.current.emit("join-room", userInfo.roomID, userInfo.username);
      setYourID(socketRef.current.id);

      socketRef.current.on("user-connected", ({ userID, username }) => {
        const peer = createPeer(userID, socketRef.current.id, stream);
        peersRef.current.push({ peerID: userID, username, peer });
        setPeers((prev) => [...prev, { peer, username }]);
      });

      socketRef.current.on("signal", ({ from, signal, username }) => {
        const existingPeer = peersRef.current.find(p => p.peerID === from);
        if (existingPeer) {
          existingPeer.peer.signal(signal);
        } else {
          const peer = addPeer(signal, from, stream);
          peersRef.current.push({ peerID: from, username, peer });
          setPeers((prev) => [...prev, { peer, username }]);
        }
      });

      socketRef.current.on("chat-message", (msg) => {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => {
          if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
          }
        }, 100);
      });

      socketRef.current.on("receive-file", ({ fileData, filename, sender }) => {
        const link = document.createElement("a");
        link.href = fileData;
        link.download = filename;
        link.textContent = `📥 File from ${sender}: ${filename}`;
        document.getElementById("file-area").appendChild(link);
        document.getElementById("file-area").appendChild(document.createElement("br"));
      });

      socketRef.current.on("update-users", (users) => {
        setOnlineUsers(users);
      });

      socketRef.current.on("user-disconnected", (userID) => {
        const peerObj = peersRef.current.find(p => p.peerID === userID);
        if (peerObj) peerObj.peer.destroy();
        peersRef.current = peersRef.current.filter(p => p.peerID !== userID);
        setPeers(peersRef.current.map(p => ({ peer: p.peer, username: p.username })));
      });

      socketRef.current.on("assigned-to-breakout", (newRoomID) => {
        window.location.href = `/?roomID=${newRoomID}&username=${userInfo.username}`;
      });
    });

    return () => socketRef.current?.disconnect();
  }, [userInfo]);

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on("signal", (signal) => {
      socketRef.current.emit("signal", { userToSignal, callerID, signal, username: userInfo.username });
    });
    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on("signal", (signal) => {
      socketRef.current.emit("signal", { userToSignal: callerID, callerID: socketRef.current.id, signal, username: userInfo.username });
    });
    peer.signal(incomingSignal);
    return peer;
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const messageData = {
        username: userInfo.username,
        text: newMessage,
        roomID: userInfo.roomID,
        timestamp: new Date().toLocaleTimeString(),
      };
      socketRef.current.emit("chat-message", messageData);
      setNewMessage("");
    }
  };

  const sendFile = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      socketRef.current.emit("send-file", {
        roomID: userInfo.roomID,
        fileData: reader.result,
        filename: file.name,
        sender: userInfo.username,
      });
    };
    reader.readAsDataURL(file);
  };

  const toggleMic = () => {
    const audioTrack = userVideo.current?.srcObject?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  };

  const toggleCam = () => {
    const videoTrack = userVideo.current?.srcObject?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCamOn(videoTrack.enabled);
    }
  };

  const startRecording = () => {
    alert("🔴 Recording started (placeholder)");
  };

  const getCallDuration = () => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  if (!userInfo) return <Join onJoin={setUserInfo} />;

  return (
    <div className="app">
      {/* Watermark */}
      <div className="watermark">
        <img src={profilePic} alt="Creator" />
        <p>Created by Manon</p>
      </div>

      <h1>🔴 {userInfo.roomID} — Group Call</h1>
      <p>Duration: ⏱️ {getCallDuration()}</p>
      <div>Online: {Object.values(onlineUsers).join(", ")}</div>

      {/* Videos */}
      <div className="video-section">
        <div className="video-box">
          <video ref={userVideo} autoPlay muted playsInline />
          <p>{userInfo.username} (You)</p>
        </div>
        {peers.map(({ peer, username }, i) => (
          <Video key={i} peer={peer} username={username} />
        ))}
      </div>

      {/* Controls */}
      <div className="controls">
        <button onClick={toggleMic} className="btn">🎤 {isMicOn ? "Mic On" : "Mic Off"}</button>
        <button onClick={toggleCam} className="btn">🎥 {isCamOn ? "Cam On" : "Cam Off"}</button>
        <button onClick={startRecording} className="btn record">🔴 Record</button>
      </div>

      {/* Chat Box */}
      <div className="chatbox">
        <div ref={chatBoxRef} className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`msg ${msg.username === userInfo.username ? "me" : "other"}`}>
              <p className="meta">{msg.username} • {msg.timestamp}</p>
              <p>{msg.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="chat-form">
          <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type..." required />
          <button type="submit" className="btn send">Send</button>
        </form>
        <div className="file-share">
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={sendFile} className="btn file">📤 Send File</button>
        </div>
        <div id="file-area"></div>
      </div>
    </div>
  );
};

// Video component
const Video = ({ peer, username }) => {
  const ref = useRef();
  useEffect(() => {
    peer.on("stream", (stream) => {
      ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <div className="video-box">
      <video playsInline autoPlay ref={ref} />
      <p>{username}</p>
    </div>
  );
};

<img src={profilePic} alt="Creator" className="creator-avatar" />


export default App;
