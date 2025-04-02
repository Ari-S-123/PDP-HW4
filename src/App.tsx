import { useState, FormEvent, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";
import { Message } from "./lib/types/Message";
// import { ReadReceipt } from "./lib/types/ReadReceipt"; // Removed unused import

/**
 * The main application component for the chat client.
 * Handles user authentication, message display, sending messages,
 * displaying online users, managing socket connections, and read receipts.
 */
const App = () => {
  /** State for storing the list of messages displayed in the chat. */
  const [messages, setMessages] = useState<Message[]>([]);
  /** State for the current value of the message input field. */
  const [input, setInput] = useState("");
  /** State for the current user's username. */
  const [username, setUsername] = useState("");
  /** State flag indicating if the user has successfully entered a username and joined the chat. */
  const [hasUsername, setHasUsername] = useState(false);
  /** State for storing the list of currently online users. */
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  /** State for storing any connection error message from Socket.IO. Null if connected. */
  const [connectionError, setConnectionError] = useState<string | null>(null);
  /** Ref to the Socket.IO client instance. */
  const socketRef = useRef<Socket | null>(null);
  /** Ref to an empty div at the end of the messages list, used for auto-scrolling. */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Ref to the container div holding the message bubbles. Used for IntersectionObserver. */
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  /** State flag indicating if the user is currently in the process of changing their username. */
  const [changingUsername, setChangingUsername] = useState(false);
  /** State to temporarily store the old username when initiating a username change. */
  const [oldUsername, setOldUsername] = useState("");

  /**
   * Effect hook to establish and manage the Socket.IO connection.
   * Sets up listeners for incoming messages, user list updates, and connection events.
   * Cleans up the connection on component unmount.
   * Dependency: `username` - Re-runs if username changes to potentially re-emit read receipts.
   */
  useEffect(() => {
    // Connect to the Socket.IO server
    socketRef.current = io("http://localhost:3000");

    /** Handler for incoming 'chat message' events. */
    const handleChatMessage = (msg: Message) => {
      setMessages((prevMessages) => {
        // Prevent duplicates if the same message ID is received again
        const messageExists = prevMessages.some((m) => m.id === msg.id);
        if (messageExists) {
          return prevMessages;
        }
        return [...prevMessages, msg];
      });

      // Automatically send a read receipt if the message is not from the current user
      if (username && msg.sender !== username && socketRef.current) {
        socketRef.current.emit("read receipt", {
          messageId: msg.id,
          reader: username
        });
      }
    };

    /** Handler for 'message updated' events (typically for read receipts). */
    const handleMessageUpdated = (updatedMsg: Message) => {
      setMessages((prevMessages) => prevMessages.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg)));
    };

    /** Handler for 'online users' events. */
    const handleOnlineUsers = (users: string[]) => {
      setOnlineUsers(users);
    };

    /** Handler for successful connection events. */
    const handleConnect = () => {
      console.log("Connected to server");
      setConnectionError(null); // Clear any previous error
    };

    /** Handler for connection error events. */
    const handleConnectError = (error: Error) => {
      console.error("Connection error:", error);
      setConnectionError(
        `Failed to connect to the chat server. Please check your connection or try again later. Error: ${error.message}`
      );
    };

    // Register event listeners
    socketRef.current.on("chat message", handleChatMessage);
    socketRef.current.on("message updated", handleMessageUpdated);
    socketRef.current.on("online users", handleOnlineUsers);
    socketRef.current.on("connect", handleConnect);
    socketRef.current.on("connect_error", handleConnectError);

    // Cleanup function: remove listeners and disconnect socket
    return () => {
      if (socketRef.current) {
        socketRef.current.off("chat message", handleChatMessage);
        socketRef.current.off("message updated", handleMessageUpdated);
        socketRef.current.off("online users", handleOnlineUsers);
        socketRef.current.off("connect", handleConnect);
        socketRef.current.off("connect_error", handleConnectError);
        socketRef.current.disconnect();
        console.log("Socket disconnected on cleanup");
      }
    };
    // Re-run this effect if the username changes, which might be relevant for read receipts
    // or potential future logic tied to the specific user.
  }, [username]);

  /**
   * Effect hook to emit "user joined" or "change username" events when the username state changes
   * after the user has initially joined (hasUsername is true).
   * Dependencies: `username`, `hasUsername`, `changingUsername`, `oldUsername`
   */
  useEffect(() => {
    // Only proceed if we have a valid socket connection, a username, and the user has passed the initial join screen
    if (username && hasUsername && socketRef.current) {
      const trimmedUsername = username.trim();

      // If currently in the username change flow AND the name is different from the old one
      if (changingUsername && trimmedUsername !== oldUsername) {
        console.log(`Emitting 'change username' from ${oldUsername} to ${trimmedUsername}`);
        // Emit the specific event for username change
        socketRef.current.emit("change username", {
          oldUsername,
          newUsername: trimmedUsername
        });
        // Reset the changing username flag after emitting
        setChangingUsername(false);
      } else if (!changingUsername) {
        // If not changing username, emit the standard "user joined" event
        // This handles the initial join after setting the username.
        console.log(`Emitting 'user joined' for ${trimmedUsername}`);
        socketRef.current.emit("user joined", trimmedUsername);
      }
    }
  }, [username, hasUsername, changingUsername, oldUsername]);

  /**
   * Effect hook to handle marking messages as read when the browser tab becomes visible.
   * Adds and removes a visibilitychange event listener.
   * Dependencies: `messages`, `username`
   */
  useEffect(() => {
    /**
     * Event handler for the 'visibilitychange' event.
     * Sends read receipts for unread messages when the tab becomes visible.
     */
    const handleVisibilityChange = () => {
      // Check if the tab is now visible and the user is logged in
      if (document.visibilityState === "visible" && username && socketRef.current) {
        console.log("Tab became visible, checking for unread messages.");
        messages.forEach((msg) => {
          // Send read receipt for messages not sent by the current user and not already marked as read by them
          if (msg.sender !== username && !msg.readBy.includes(username)) {
            console.log(`Sending read receipt for message ${msg.id} on visibility change.`);
            socketRef.current?.emit("read receipt", {
              messageId: msg.id,
              reader: username
            });
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Cleanup: remove the event listener
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [messages, username]);

  /**
   * Effect hook to set up an IntersectionObserver for marking messages as read when they scroll into view.
   * Observes message bubbles within the messages container.
   * Dependencies: `messages.length`, `username`, `messages` (array reference itself)
   */
  useEffect(() => {
    // Ensure the container ref is set, user is logged in, and there are messages to observe
    if (!messagesContainerRef.current || !username || messages.length === 0) {
      return;
    }

    // Capture the current ref value for stable use in callbacks and cleanup
    const container = messagesContainerRef.current;

    /**
     * Callback function for the IntersectionObserver.
     * Sends a read receipt when a message bubble enters the viewport.
     * @param {IntersectionObserverEntry[]} entries - Array of observer entries.
     */
    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        // Check if the element is intersecting (visible)
        if (entry.isIntersecting) {
          const targetElement = entry.target as HTMLElement;
          const messageId = targetElement.getAttribute("data-message-id");
          if (!messageId) return; // Skip if the element doesn't have the message ID

          // Find the corresponding message in the *current* state
          // Use a function call to get the latest messages state if necessary, although
          // having messages in the dependency array should keep it up-to-date.
          const message = messages.find((m) => m.id === messageId);

          // Send read receipt if the message exists, wasn't sent by the current user,
          // and hasn't already been marked as read by the current user.
          if (message && message.sender !== username && !message.readBy.includes(username) && socketRef.current) {
            // Double-check the latest state in case it was updated between finding and emitting
            const currentMessageState = messages.find((m) => m.id === messageId);
            if (currentMessageState && !currentMessageState.readBy.includes(username)) {
              console.log(`IntersectionObserver: Marking message ${messageId} as read by ${username}`);
              socketRef.current.emit("read receipt", {
                messageId,
                reader: username
              });
            }
          }
        }
      });
    };

    // Create the observer instance
    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.1, // Trigger when 10% of the element is visible
      root: container // Observe intersections within the messages container
    });

    // Find all message bubble elements with the data attribute and observe them
    const messageElements = container.querySelectorAll(".message-bubble[data-message-id]");
    messageElements.forEach((el) => observer.observe(el));
    console.log(`IntersectionObserver observing ${messageElements.length} messages.`);

    // Cleanup function: unobserve all elements and disconnect the observer
    return () => {
      console.log("IntersectionObserver cleanup: Disconnecting observer.");
      // Use the captured container variable safely
      const currentElements = container?.querySelectorAll(".message-bubble[data-message-id]");
      if (currentElements) {
        currentElements.forEach((el) => observer.unobserve(el));
      }
      observer.disconnect();
    };
    // Dependencies ensure the effect re-runs if the number of messages changes,
    // the username changes, or the message array reference itself changes.
  }, [messages.length, username, messages]);

  /**
   * Effect hook to automatically scroll to the bottom of the messages container
   * whenever the `messages` array changes.
   * Dependency: `messages`
   */
  useEffect(() => {
    // Use optional chaining in case the ref is not yet attached
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Handles the submission of the message input form.
   * Prevents default form submission, trims the input, and emits a "chat message" event if valid.
   * Clears the input field after sending.
   * @param {FormEvent<HTMLFormElement>} e - The form submission event.
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent page reload
    const trimmedInput = input.trim();
    // Check if input is not empty and the user is logged in
    if (trimmedInput && hasUsername && socketRef.current) {
      console.log(`Sending message: "${trimmedInput}" from ${username}`);
      // Emit the message content and sender username
      socketRef.current.emit("chat message", {
        text: trimmedInput,
        sender: username
      });
      // Clear the input field
      setInput("");
    }
  };

  /**
   * Handles the submission of the username form (initial join or update).
   * Prevents default form submission.
   * If joining for the first time, sets `hasUsername` to true (triggering the join effect).
   * If changing username, calls `handleUsernameUpdate`.
   * @param {FormEvent<HTMLFormElement>} e - The form submission event.
   */
  const handleUsernameSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent page reload
    const trimmedUsername = username.trim();

    // Proceed only if a non-empty username is entered
    if (trimmedUsername) {
      if (changingUsername) {
        // If we are in the 'change username' flow, call the specific update handler
        console.log(`Username form submitted in 'change' mode for: ${trimmedUsername}`);
        handleUsernameUpdate(trimmedUsername);
      } else {
        // If it's the initial join, just set the flag
        console.log(`Username form submitted in 'join' mode for: ${trimmedUsername}`);
        // Setting hasUsername to true triggers the useEffect hook
        // which then emits the appropriate "user joined" event.
        setHasUsername(true);
      }
    }
  };

  /**
   * Handles the logic for updating the username after the user confirms the change.
   * Called by `handleUsernameSubmit` when `changingUsername` is true.
   * If the name is unchanged, returns to chat view.
   * If the name is changed, updates the `username` state (triggering the change effect).
   * @param {string} newUsername - The new username entered by the user.
   */
  const handleUsernameUpdate = (newUsername: string) => {
    if (newUsername === oldUsername) {
      // If the user entered the same name, no need to emit events
      console.log("Username unchanged, returning to chat view.");
      setChangingUsername(false); // Exit the changing username mode
      setHasUsername(true); // Show the chat interface again
    } else {
      // If the username is different, proceed with the update
      console.log(`Attempting to update username state from ${oldUsername} to ${newUsername}`);
      // Update the username state. This will trigger the useEffect hook
      // which handles emitting the "change username" event because changingUsername is true.
      setUsername(newUsername);
      // Set hasUsername back to true to show the chat view after the state update triggers the effect.
      setHasUsername(true);
      // Note: setChangingUsername(false) is handled within the useEffect hook after the event is emitted.
    }
  };

  /**
   * Initiates the username change process.
   * Stores the current username, sets the `changingUsername` flag,
   * hides the chat view, and clears the messages.
   */
  const handleChangeUsername = () => {
    if (socketRef.current) {
      console.log(`Initiating username change for ${username}`);
      // Store the current username to compare against the new one later
      setOldUsername(username);
      // Set the flag to indicate we are in the change flow
      setChangingUsername(true);
      // Hide the main chat interface and show the username input form
      setHasUsername(false);
      // Clear existing messages from the display
      setMessages([]);
    }
  };

  /**
   * Handles a complete logout.
   * Disconnects the socket, resets all relevant state variables,
   * and re-initializes the socket connection for a potential future login.
   */
  const handleTrueLogout = () => {
    if (socketRef.current) {
      console.log(`Logging out user ${username}`);
      // Disconnect the current socket connection
      socketRef.current.disconnect();

      // Reset all application state to initial values
      setHasUsername(false);
      setMessages([]);
      setUsername("");
      setOnlineUsers([]);
      setChangingUsername(false);
      setOldUsername("");
      setConnectionError(null); // Also clear connection errors on logout

      // Re-establish a clean socket instance for the next connection attempt
      // Listeners will be added by the main useEffect hook when the component re-renders.
      socketRef.current = io("http://localhost:3000");
      console.log("State reset and new socket instance created after logout.");
    }
  };

  /**
   * Formats a Date object into a locale-specific time string (HH:MM AM/PM).
   * @param {Date} date - The Date object to format.
   * @returns {string} The formatted time string.
   */
  const formatTime = (date: Date): string => {
    // Ensure input is a valid Date object before formatting
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      console.warn("Invalid date provided to formatTime:", date);
      return "Invalid Time";
    }
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  /**
   * Renders the read receipt status for a given message.
   * Shows "Not read yet" or "Read by X people" with a tooltip listing readers.
   * Returns null for system messages.
   * @param {Message} message - The message object to render receipts for.
   */
  const renderReadReceipts = (message: Message) => {
    // Don't show read receipts for system messages
    if (message.sender === "System") return null;

    // Filter out the sender themselves from the readBy list for the display
    const otherReaders = message.readBy.filter((reader) => reader !== message.sender);

    // If no one else has read it yet
    if (otherReaders.length === 0) {
      return <div className="read-receipt">Not read yet</div>;
    }

    // Display count and list readers in a tooltip
    return (
      <div className="read-receipt">
        Read by {otherReaders.length} {otherReaders.length === 1 ? "person" : "people"}
        {/* Tooltip shown on hover */}
        <div className="read-tooltip">
          {otherReaders.map((reader) => (
            <div key={reader} className="reader">
              {reader}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Conditional Rendering Logic:

  // 1. Render connection error view if connection failed
  if (connectionError) {
    return (
      <div className="error-container">
        <h1>Connection Error</h1>
        <p>{connectionError}</p>
        {/* Consider adding a button here to manually trigger a reconnect attempt */}
      </div>
    );
  }

  // 2. Render username input view if user hasn't joined yet
  if (!hasUsername) {
    // Determine title and button text based on whether it's initial join or changing username
    const isChangingUsername = changingUsername;

    return (
      <div className="username-container">
        <h1>{isChangingUsername ? "Change Username" : "Join the Chat"}</h1>
        <form onSubmit={handleUsernameSubmit}>
          <input
            value={username} // Controlled input
            onChange={(e) => setUsername(e.target.value)} // Update state on change
            placeholder="Enter your username"
            aria-label="Username"
            autoFocus // Focus input on load
          />
          {/* Disable button if username is empty or only whitespace */}
          <button type="submit" disabled={username.trim() === ""}>
            {isChangingUsername ? "Update" : "Join"}
          </button>
        </form>
      </div>
    );
  }

  // 3. Render the main chat view if connected and username is set
  return (
    <div className="chat-container">
      {/* Header Section */}
      <header>
        <h2>Chat Room</h2>
        <div className="header-controls">
          {/* Display current username */}
          <div className="user-badge">
            Logged in as <span>{username}</span>
          </div>
          {/* Button to initiate username change */}
          <button className="change-username-button" onClick={handleChangeUsername}>
            Change Username
          </button>
          {/* Button for complete logout */}
          <button className="true-logout-button" onClick={handleTrueLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Online Users Bar */}
      <div className="online-users">
        <div className="online-label">Online:</div>
        <div className="user-list">
          {onlineUsers.map((user) => (
            <div key={user} className="online-user">
              <span className="online-dot"></span> {user}
            </div>
          ))}
        </div>
      </div>

      {/* Messages Display Area */}
      <div className="messages-container" ref={messagesContainerRef}>
        {/* Sort messages chronologically before mapping */}
        {[...messages]
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map((message) => (
            <div
              key={message.id} // Unique key for React rendering
              // Apply CSS classes based on sender for styling
              className={`message-bubble ${
                message.sender === username ? "own-message" : ""
              } ${message.sender === "System" ? "system-message" : ""}`}
              data-message-id={message.id} // Store message ID for IntersectionObserver
            >
              {/* Message Header (Sender & Time) */}
              <div className="message-header">
                <span className="message-sender">{message.sender}</span>
                <span className="message-time">{formatTime(message.timestamp)}</span>
              </div>
              {/* Message Content */}
              <div className="message-content">{message.text}</div>
              {/* Render Read Receipts */}
              {renderReadReceipts(message)}
            </div>
          ))}
        {/* Empty div target for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Form */}
      <form id="form" onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            id="input"
            value={input} // Controlled input
            onChange={(e) => setInput(e.target.value)} // Update state on change
            autoComplete="off" // Disable browser autocomplete
            aria-label="Message input"
            placeholder="Type a message..."
          />
          {/* Disable button if input is empty or only whitespace */}
          <button type="submit" disabled={input.trim() === ""}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default App;
