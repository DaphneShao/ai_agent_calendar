import './App.css'
import "./Tailwind.css";
import { useState } from 'react';

function App() {
  const [messages, setMessages] = useState([
    {
      sender: 'AI',
      message: 'hi, what can I help you today?'
    },
    {
      sender: 'customer',
      message: 'change my address into 223 Main St'
    }
  ]);

  const [input, setInput] = useState('');

  const sendMessage = () =>{
    if (input.trim()) {
      setMessages([...messages, { sender: 'customer', message: input }]);
      setInput('');
    }
  }

  return (
    <div className="App">
    <div className='chatbox'>
      <div className="chatheader text-black">Customer Service Robot</div>
      <div className="chatmessages">
        {/* <div className="AI_message">hi, what can I help you today?</div>
        <div className="customer_message">change my address</div> */}
        {messages.map((msg, index)=>(
          <div key={index} className={`${msg.sender}_message`}>{msg.message}</div>
        ))}
      </div>
      <div className="inputbox">
        <input className="input" type="text" placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)}/>
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  </div>
  )
}

export default App
