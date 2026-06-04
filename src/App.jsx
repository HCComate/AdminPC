import { useState, useEffect } from "react";
import socket from "./socket";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import UserManagement from "./components/UserManagement";
import ScheduleManagement from "./components/ScheduleManagement";
import NoticeManagement from "./components/NoticeManagement";
import DeviceManagement from "./components/DeviceManagement";

export default function App() {
  // JWT 토큰의 payload를 디코딩하는 헬퍼 (Base64URL → JSON)
  const decodeJwtPayload = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  };

  // 새로고침 시 localStorage에서 로그인 상태 복원 (JWT 만료 검증 포함)
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");
    if (savedUser && savedToken) {
      try {
        // JWT 토큰 만료 여부 검증
        const payload = decodeJwtPayload(savedToken);
        if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
          // 토큰이 만료되었거나 유효하지 않음 → 세션 클리어
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          return null;
        }

        const parsed = JSON.parse(savedUser);
        const resolvedRole = (
          parsed.role ||
          parsed.user_role ||
          parsed.Role ||
          "OPERATOR"
        ).toUpperCase();

        // username이 없으면 유효하지 않은 세션으로 판단
        if (!parsed.username) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          return null;
        }

        return {
          username: parsed.username,
          role: resolvedRole,
        };
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return null;
      }
    }
    return null;
  });

  const [page, setPageState] = useState(() => {
    return localStorage.getItem("page") || "dashboard";
  });

  // 페이지 변경 시 localStorage에도 저장 (새로고침 시 복원용)
  const setPage = (newPage) => {
    localStorage.setItem("page", newPage);
    setPageState(newPage);
  };

  const handleLoginSuccess = (data) => {
    // 백엔드 응답이 중첩 객체(data.user) 형태이거나 direct 프로퍼티인 경우 모두 대응
    const userInfo = data.user || data;
    const resolvedRole = (
      userInfo.role ||
      userInfo.user_role ||
      userInfo.Role ||
      "OPERATOR"
    ).toUpperCase();

    const userObj = {
      username: userInfo.username || userInfo.id,
      role: resolvedRole,
    };

    localStorage.setItem("user", JSON.stringify(userObj));
    setUser(userObj);

    // 로그인 성공 시 소켓 연결 시작
    if (!socket.connected) {
      socket.connect();
    }
    const token = localStorage.getItem("token");
    if (token) {
      socket.emit("worker_auth", { token });
    }
  };

  const handleLogout = () => {
    // 로그아웃 시에만 소켓 연결 해제 (페이지 이동 시에는 유지)
    socket.disconnect();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("page");
    setUser(null);
    setPageState("dashboard");
  };

  // 앱 레벨 소켓 연결 관리: 로그인 상태가 복원된 경우 소켓 자동 재연결
  useEffect(() => {
    if (user && !socket.connected) {
      socket.connect();
      const token = localStorage.getItem("token");
      // connect 이벤트에서 worker_auth를 보내도록 리스너 등록
      const handleConnect = () => {
        if (token) socket.emit("worker_auth", { token });
      };
      socket.on("connect", handleConnect);
      return () => {
        socket.off("connect", handleConnect);
      };
    }
  }, [user]);

  // 로그인 안 됐으면 로그인 화면
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 데이터 안정성을 위해 렌더링 분기 시 대문자로 통일하여 비교 진행
  const currentUserRole = user.role?.toUpperCase();

  if (page === "users" && currentUserRole === "MASTER") {
    return <UserManagement user={user} onBack={() => setPage("dashboard")} />;
  }

  // 근무 일정 관리 페이지 (MASTER, TECHNICIAN 접근 가능)
  if (
    page === "schedules" &&
    (currentUserRole === "MASTER" || currentUserRole === "TECHNICIAN")
  ) {
    return (
      <ScheduleManagement user={user} onBack={() => setPage("dashboard")} />
    );
  }

  // 공지사항 관리 페이지 (MASTER, TECHNICIAN 접근 가능)
  if (
    page === "notices" &&
    (currentUserRole === "MASTER" || currentUserRole === "TECHNICIAN")
  ) {
    return <NoticeManagement user={user} onBack={() => setPage("dashboard")} />;
  }

  // 장비 관리 페이지 (MASTER 접근 가능)
  if (page === "devices" && currentUserRole === "MASTER") {
    return <DeviceManagement user={user} onBack={() => setPage("dashboard")} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} onNavigate={setPage} />;
}
