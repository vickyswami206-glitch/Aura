import { useState } from "react";
import VoiceAssistant from "./VoiceAssistant";
import { aatEngine } from "./aatEngine";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

export default function App() {
  const [responses, setResponses] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<string[]>([]);

  const speak = async (text: string) => {
    // remove [emotion] tags before speaking
    const clean = text.replace(/\[.*?\]/g, "");

    await TextToSpeech.speak({
      text: clean,
      lang: "en-US",
      rate: 1.0,
      pitch: 1.0,
    });
  };

  import { extractDateTime } from "./utils";

const processCommand = async (text: string) => {
  const lower = text.toLowerCase();

  // 🔥 SMART BOOKING
  if (lower.includes("appointment") || lower.includes("meeting")) {
    const date = extractDateTime(text);

    const appointment = `📅 Appointment on ${date.toLocaleString()}`;

    setAppointments((prev) => [...prev, appointment]);

    const reply = `[happy] Your appointment is booked for ${date.toLocaleString()}`;

    setResponses((prev) => [...prev, reply]);

    await speak(reply);
    return;
  }

  // 🧠 AI fallback
  const result = await aatEngine.process(text);

  setResponses((prev) => [...prev, result]);

  await speak(result);
};

    // 🧠 AI RESPONSE
    const result = await aatEngine.process(text);

    setResponses((prev) => [...prev, result]);

    // 🔊 SPEAK RESPONSE
    await speak(result);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Aura AI Assistant</h1>

      <VoiceAssistant onCommand={processCommand} />

      <h2>AI Responses</h2>
      <ul>
        {responses.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      <h2>Appointments</h2>
      <ul>
        {appointments.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
