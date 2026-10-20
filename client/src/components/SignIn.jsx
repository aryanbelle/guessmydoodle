import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../ThemeContext";
import { useAuth } from "../lib/AuthProvider";

function SignIn() {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { signIn } = useAuth();
  const handleSignIn = async (event) => {
    event.preventDefault();
    const cleanNickname = Array.from(nickname).filter((character) => character !== "<" && character !== ">").join("").trim().slice(0, 24);
    if (!cleanNickname) return;
    setError("");
    setIsSubmitting(true);
    try {
      await signIn(cleanNickname);
      navigate(location.state?.from?.pathname || "/main", { replace: true });
    } catch (signInError) {
      setError(signInError.message || "Could not join the party. Check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className={`signin-page ${theme === "light" ? "" : "lobby-dark"}`}>
      <a className="brand-mark signin-brand" href="/signin"><span className="brand-icon">✎</span><span>guess<span className="brand-color">my</span>doodle</span></a>
      <div className="signin-content">
        <section className="signin-welcome"><div className="eyebrow"><span>✦</span> GRAB A PENCIL, ANY PENCIL</div><h1>Your friends<br/>are about to see<br/><span>your art.</span></h1><p>Well, your interpretation of a banana. Come play a round.</p><div className="signin-doodle">🍌<span>is this a banana?</span></div></section>
        <form onSubmit={handleSignIn} className="signin-card"><div className="signin-card-icon">👋</div><span className="eyebrow">YOUR SEAT IS WAITING</span><h2>First, what do<br/>we call you?</h2><label htmlFor="nickname">Pick a nickname</label><input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} autoComplete="nickname" placeholder="e.g. DoodleFan" required autoFocus/>{error && <div className="signin-error" role="alert">{error}</div>}<button type="submit" className="primary-action" disabled={isSubmitting}>{isSubmitting ? "Joining..." : "Let’s play"} <span>→</span></button><p>Just here for fun. Your nickname stays in this browser.</p></form>
      </div>
      <footer className="lobby-footer signin-footer"><span>GOOD ART IS OPTIONAL. GOOD TIMES AREN'T.</span><span>✦ PLAY NICE, DRAW SILLY</span></footer>
    </main>
  );
}

export default SignIn;
