import { useState } from "react";
import { SERVER_URL } from "../config";
import "./LoginPage.css";
import logoImg from "../assets/logo.png";

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // 토큰과 사용자 정보를 localStorage에 저장
        const userInfo = data.user || data;
        localStorage.setItem("token", data.token);
        localStorage.setItem(
          "user",
          JSON.stringify({
            username: userInfo.username,
            role: userInfo.role,
          }),
        );
        onLoginSuccess(userInfo);
      } else {
        setError(data.error || "로그인에 실패했습니다.");
      }
    } catch (err) {
      setError("서버에 연결할 수 없습니다. 서버 상태를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* 로고 영역 */}
        <div className="login-header">
          <div className="login-logo">
            <img src={logoImg} alt="VisionMate Logo" className="logo-icon" />
          </div>
          <h1 className="login-title">Vision Mate</h1>
          <p className="login-subtitle">관리자 PC 모니터링 시스템</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label htmlFor="username">아이디</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {error && (
            <div className="login-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="login-hint">기본 계정: admin / admin1234</p>
      </div>
    </div>
  );
}
