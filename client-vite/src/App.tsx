import './App.css'
import "./Tailwind.css";
import { useState } from 'react';

function App() {
  const [messages, setMessages] = useState([
    {
      sender: 'AI',
      message: 'hi, what can I help you with your calendar today?'
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Update UI with user message
    const userMessage = input.trim();
    setMessages(messages => [...messages, { sender: 'customer', message: userMessage }]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Send the message to the server
      const response = await fetch('http://localhost:3000/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: userMessage,
          calendarId: "primary"
        })
      });
      
      const data = await response.json();
      
      // Check if the response has the expected format
      if (response.ok && data.response) {
        setMessages(messages => [...messages, { sender: 'AI', message: data.response }]);
      } else if (data.error) {
        setMessages(messages => [...messages, { 
          sender: 'AI', 
          message: `Error: ${data.error}${data.details ? ' - ' + data.details : ''}` 
        }]);
      } else {
        setMessages(messages => [...messages, { 
          sender: 'AI', 
          message: 'Sorry, I received an unexpected response from the server.' 
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(messages => [...messages, { 
        sender: 'AI', 
        message: 'Sorry, there was an error connecting to the server. Please try again later.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="App">
      <div className='chatbox'>
        <div className="chatheader text-black">Calendar Assistant</div>
        <div className="chatmessages">
          {messages.map((msg, index) => (
            <div key={index} className={`${msg.sender}_message`}>{msg.message}</div>
          ))}
          {isLoading && <div className="AI_message">Loading...</div>}
        </div>
        <div className="inputbox">
          <input 
            className="input" 
            type="text" 
            placeholder="例如：添加明天10:00的会议..." 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <button onClick={sendMessage} disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
