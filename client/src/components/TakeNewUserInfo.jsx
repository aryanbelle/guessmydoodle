import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function TakeNewUserInfo() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nickname || !age || !gender) {
      alert('Fill all the fields');
      return;
    }
    if (age < 8 || age > 100) {
      alert('Invalid age');
      return;
    }

    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem('authToken');

      // Send the request with the token
      const storeData = await axios.post('http://localhost:5000/account/newuser', {
        nickname, age, gender
      }, {
        headers: {
          Authorization: `Bearer ${token}` // Include the token here
        }
      });

      navigate('/main');
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="bg-[#0a0a0a] w-screen h-screen text-white flex justify-center items-center p-4" style={{ fontFamily: 'Orbitron' }}>

      <div className="w-[60vw] h-[80vh] flex flex-col justify-center items-center gap-6 border border-gray-700 rounded-lg bg-[#1a1a1a]" style={{
        background: 'linear-gradient(145deg, #1b1b1b, #0e0e0e)',
        boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.3)'
      }}>

        <h2 className="text-3xl font-extrabold mb-4">WELCOME</h2>

        <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-6">

          <div className="flex flex-col">

            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="p-3 bg-[#2b2b2b] border border-gray-600 rounded- text-white focus:outline-none focus:border-[#3a3a3a] transition duration-300"
              placeholder="Give a nickname"
            />
          </div>


          <div className="flex flex-col">

            <input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="p-3 bg-[#2b2b2b] border border-gray-600 rounded- text-white focus:outline-none focus:border-[#3a3a3a] transition duration-300"
              placeholder="Enter your age"
            />
          </div>


          <div className="flex flex-col">

            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="p-3 bg-[#2b2b2b] border border-gray-600 rounded- text-white focus:outline-none focus:border-[#3a3a3a] transition duration-300"

            >
              <option value="" disabled>Select your gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>


          <button type="submit" className="w-full p-3 mt-8 mb-6 bg-indigo-600 rounded-md hover:bg-indigo-800 transition duration-300">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

export default TakeNewUserInfo;
