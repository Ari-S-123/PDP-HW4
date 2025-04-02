/**
 * Props for the ChatHeader component.
 */
type ChatHeaderProps = {
  /** The currently logged-in user's username. */
  username: string;
  /** Function to initiate the username change process. */
  onChangeUsername: () => void;
  /** Function to handle user logout. */
  onLogout: () => void;
};

/**
 * Displays the header of the chat application.
 * Shows the chat room title, the current user's name,
 * and buttons for changing username and logging out.
 */
export const ChatHeader = ({ username, onChangeUsername, onLogout }: ChatHeaderProps) => {
  return (
    <header>
      <h2>Chat Room</h2>
      <div className="header-controls">
        {/* Display current username */}
        <div className="user-badge">
          Logged in as <span>{username}</span>
        </div>
        {/* Button to initiate username change */}
        <button className="change-username-button" onClick={onChangeUsername}>
          Change Username
        </button>
        {/* Button for complete logout */}
        <button className="true-logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};
