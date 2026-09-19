"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "opnemen" | "uploaden";

function formatDuur(seconden: number): string {
  const min = Math.floor(seconden / 60);
  const sec = seconden % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export default function OpnemenPage() {
  const router = useRouter();
  const [apparaten, setApparaten] = useState<MediaDeviceInfo[]>([]);
  const [geselecteerdApparaat, setGeselecteerdApparaat] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [foutmelding, setFoutmelding] = useState<string | null>(null);
  const [verstrekenSeconden, setVerstrekenSeconden] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const gestartOpRef = useRef<Date | null>(null);
  const beeindigdOpRef = useRef<Date | null>(null);

  useEffect(() => {
    async function laadApparaten() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setApparaten(devices.filter((device) => device.kind === "audioinput"));
    }

    async function vraagToestemmingEnLaad() {
      try {
        // Browsers geven pas namen/volledige lijst van invoerapparaten (bv. een externe
        // USB-ontvanger) via enumerateDevices() zodra deze pagina al eens microfoontoegang
        // heeft gekregen. Vraag die daarom hier alvast aan, sluit de stream meteen weer.
        const tijdelijkeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tijdelijkeStream.getTracks().forEach((track) => track.stop());
      } catch {
        // Toestemming geweigerd of geen microfoon aangesloten — laad hieronder alsnog
        // wat enumerateDevices() teruggeeft (mogelijk onvolledig/naamloos).
      }
      await laadApparaten();
    }

    void vraagToestemmingEnLaad();

    // Ververs de lijst als er tijdens het gebruik een apparaat wordt aan-/losgekoppeld
    // (bv. de Rode Wireless ME-ontvanger die pas na het openen van de pagina wordt aangesloten).
    navigator.mediaDevices.addEventListener("devicechange", laadApparaten);
    return () => navigator.mediaDevices.removeEventListener("devicechange", laadApparaten);
  }, []);

  useEffect(() => {
    if (status !== "opnemen") return;
    const interval = setInterval(() => setVerstrekenSeconden((seconden) => seconden + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  async function uploadOpname(audioBlob: Blob) {
    setStatus("uploaden");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "opname.webm");
      formData.append("gestartOp", (gestartOpRef.current ?? new Date()).toISOString());
      formData.append("beeindigdOp", (beeindigdOpRef.current ?? new Date()).toISOString());

      const response = await fetch("/api/gesprekken", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload mislukt");

      const gesprek = (await response.json()) as { id: string };
      router.push(`/gesprekken/${gesprek.id}`);
      router.refresh();
    } catch {
      setFoutmelding("Uploaden of verwerken van de opname is mislukt. Probeer het opnieuw.");
      setStatus("idle");
    }
  }

  async function startOpname() {
    setFoutmelding(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: geselecteerdApparaat ? { deviceId: { exact: geselecteerdApparaat } } : true,
      });

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
        void uploadOpname(audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      gestartOpRef.current = new Date();
      setVerstrekenSeconden(0);
      setStatus("opnemen");
    } catch {
      setFoutmelding("Kon microfoon niet starten. Controleer de permissies.");
    }
  }

  function stopOpname() {
    beeindigdOpRef.current = new Date();
    mediaRecorderRef.current?.stop();
  }

  return (
    <main className="opname-scherm">
      <h1>Nieuw gesprek</h1>

      <div className="opname-kaart">
        <label className="microfoon-veld">
          <span>Microfoon</span>
          <select
            value={geselecteerdApparaat}
            onChange={(event) => setGeselecteerdApparaat(event.target.value)}
            disabled={status !== "idle"}
          >
            <option value="">Standaard microfoon</option>
            {apparaten.map((apparaat) => (
              <option key={apparaat.deviceId} value={apparaat.deviceId}>
                {apparaat.label || "Onbekende microfoon"}
              </option>
            ))}
          </select>
        </label>

        <div className="opname-controls">
          <button
            type="button"
            className={`opname-knop ${status === "opnemen" ? "opname-knop--actief" : ""}`}
            onClick={status === "opnemen" ? stopOpname : startOpname}
            disabled={status === "uploaden"}
            aria-label={status === "opnemen" ? "Stop opname" : "Start opname"}
          >
            <span className="opname-knop-icoon" aria-hidden="true" />
          </button>

          <div className="opname-status">
            {status === "idle" && <span>Klik om te starten</span>}
            {status === "opnemen" && <span className="opname-timer">{formatDuur(verstrekenSeconden)}</span>}
            {status === "uploaden" && <span>Bezig met verwerken…</span>}
          </div>
        </div>
      </div>

      {foutmelding && (
        <p className="status-mislukt" role="alert">
          {foutmelding}
        </p>
      )}
    </main>
  );
}
