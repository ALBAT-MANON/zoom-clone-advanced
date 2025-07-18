// client/src/Join.jsx
import React, { useState } from "react";

const Join = ({ onJoin }) => {
  const [username, setUsername] = useState("");
  const [roomID, setRoomID] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && roomID.trim()) {
      onJoin({ username, roomID });
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-lg shadow-lg w-96 space-y-4"
      >
        <h1 className="text-2xl font-semibold text-center">🎥 Join a Room</h1>
        <input
          type="text"
          placeholder="Your name"
          className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Room ID"
          className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
          value={roomID}
          onChange={(e) => setRoomID(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
        >
          Join Now
        </button>
      </form>
    </div>
  );
};

export default Join;
