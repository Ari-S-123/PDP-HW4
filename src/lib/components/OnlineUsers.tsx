/**
 * Props for the OnlineUsers component.
 */
type OnlineUsersProps = {
  /** An array of usernames currently online. */
  users: string[];
};

/**
 * Displays the list of users currently online in the chat.
 */
export const OnlineUsers = ({ users }: OnlineUsersProps) => {
  return (
    <div className="online-users">
      <div className="online-label">Online:</div>
      <div className="user-list">
        {users.map((user) => (
          <div key={user} className="online-user">
            <span className="online-dot"></span> {user}
          </div>
        ))}
      </div>
    </div>
  );
};
