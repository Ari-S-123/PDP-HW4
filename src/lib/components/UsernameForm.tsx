import { FormEvent } from "react";

/**
 * Props for the UsernameForm component.
 */
type UsernameFormProps = {
  /** The current value of the username input field. */
  username: string;
  /** Function to update the username state. */
  setUsername: (value: string) => void;
  /** Function to handle form submission. */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Flag indicating if the form is for changing the username vs initial join. */
  isChanging: boolean;
};

/**
 * A form component for users to enter or change their username.
 * Handles both the initial username entry and subsequent changes.
 */
export const UsernameForm = ({ username, setUsername, onSubmit, isChanging }: UsernameFormProps) => {
  const title = isChanging ? "Change Username" : "Join the Chat";
  const buttonText = isChanging ? "Update" : "Join";

  return (
    <div className="username-container">
      <h1>{title}</h1>
      <form onSubmit={onSubmit}>
        <input
          value={username} // Controlled input
          onChange={(e) => setUsername(e.target.value)} // Update state on change
          placeholder="Enter your username"
          aria-label="Username"
          autoFocus // Focus input on load
        />
        {/* Disable button if username is empty or only whitespace */}
        <button type="submit" disabled={username.trim() === ""}>
          {buttonText}
        </button>
      </form>
    </div>
  );
};
