

import { useEffect, useState } from "react";

export default function MailVerify() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div className="container">
        <div className={`card ${visible ? "show" : ""}`}>
          <div className="checkmark">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="25" fill="none" />
              <path d="M14 27l7 7 16-16" fill="none" />
            </svg>
          </div>
          <h1>Email Verified</h1>
          <p>Your email has been successfully verified.</p>
        </div>
      </div>

      <style jsx>{`
                .container {
                    min-height: 100vh;
                    width: 100vw;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #0f0f11;
                    color: white;
                    font-family: system-ui, -apple-system, sans-serif;
                    padding: 24px;
                    box-sizing: border-box;
                }

                .card {
                    text-align: center;
                    opacity: 0;
                    transform: translateY(10px) scale(0.96);
                    transition: all 0.6s ease;
                }

                .card.show {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }

                .checkmark {
                    display: flex;
                    justify-content: center;
                }

                .checkmark svg {
                    width: 80px;
                    height: 80px;
                    stroke: #22c55e;
                    stroke-width: 3;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }

                .checkmark circle {
                    stroke-dasharray: 160;
                    stroke-dashoffset: 160;
                    animation: circle 0.8s ease forwards;
                }

                .checkmark path {
                    stroke-dasharray: 48;
                    stroke-dashoffset: 48;
                    animation: tick 0.5s 0.6s ease forwards;
                }

                h1 {
                    margin: 18px 0 0;
                    font-size: 26px;
                    font-weight: 600;
                }

                p {
                    margin: 8px 0 0;
                    color: #9ca3af;
                    font-size: 14px;
                }

                @keyframes circle {
                    to {
                        stroke-dashoffset: 0;
                    }
                }

                @keyframes tick {
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `}</style>

      <style jsx global>{`
                html,
                body,
                #__next {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    min-height: 100%;
                    background: #0f0f11;
                }
            `}</style>
    </>
  );
}