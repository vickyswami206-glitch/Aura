import { useState } from "react";

export default function App() {
  const [name, setName] = useState<string>("");
  const [date, setDate] = useState<string>("");

  const handleSubmit = () => {
    alert(`Appointment booked for ${name} on ${date}`);
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Book Appointment</h1>

      <input
        className="border p-2 w-full mb-3"
        placeholder="Your Name"
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setName(e.target.value)
        }
      />

      <input
        type="date"
        className="border p-2 w-full mb-3"
        value={date}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setDate(e.target.value)
        }
      />

      <button
        className="bg-blue-500 text-white p-2 w-full"
        onClick={handleSubmit}
      >
        Book
      </button>
    </div>
  );
}
