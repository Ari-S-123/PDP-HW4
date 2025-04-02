import { FormEvent } from "react";

/**
 * Props for the MessageInput component.
 */
type MessageInputProps = {
  /** The current value of the message input field. */
  input: string;
  /** Function to update the message input state. */
  setInput: (value: string) => void;
  /** Function to handle form submission (sending the message). */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Flag indicating if the input/button should be disabled (e.g., when disconnected). */
  disabled: boolean;
};

/**
 * Renders the message input field and send button.
 */
export const MessageInput = ({ input, setInput, onSubmit, disabled }: MessageInputProps) => {
  return (
    <form id="form" onSubmit={onSubmit}>
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
        <button type="submit" disabled={disabled || input.trim() === ""}>
          Send
        </button>
      </div>
    </form>
  );
};
