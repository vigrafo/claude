"use client";
import { useState } from "react";

/** Empfangene Bilder sind standardmäßig verborgen und werden erst nach ausdrücklichem Klick geladen. */
export function HiddenImage({ mediaId, from }: { mediaId: string; from: string }) {
  const [show, setShow] = useState(false);
  if (!show) {
    return (
      <button type="button" className="btn secondary small" onClick={() => setShow(true)} style={{ marginBottom: 6 }}>
        🖼 Bild von {from} anzeigen
      </button>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="chat-img" src={`/app/medien/${mediaId}`} alt={`Bild von ${from}`} />
      <button type="button" className="btn ghost small" onClick={() => setShow(false)}>Wieder verbergen</button>
    </>
  );
}
