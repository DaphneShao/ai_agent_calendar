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

  const sendMessage = async () =>{
    console.log("old messages",messages);
    if (input.trim()) {
      // update and update the page
      setMessages(messages => [...messages, { sender: 'customer', message: input }]);
      setInput('');
    }
    console.log("added message",messages);
    // send the message to the server http://localhost:3000/api/query
    const response = await fetch('http://localhost:3000/api/query',{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({message: input})
    })
    const data = await response.json();
    setMessages( messages => [...messages,{ sender:'AI', message: data.message }]);
    console.log("new messages",messages);
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
