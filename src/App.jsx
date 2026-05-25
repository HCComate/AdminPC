import { useState } from "react";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import UserManagement from "./components/UserManagement";
import ScheduleManagement from "./components/ScheduleManagement";
import NoticeManagement from "./components/NoticeManagement";
import DeviceManagement from "./components/DeviceManagement";

export default function App() {
  // 새로고침 시 localStorage에서 로그인 상태 복원 (지연 초기화 함수로 동기적 처리)
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        // 백엔드 필드 키 구조(role, user_role, Role) 및 대소문자 변동에 무관하도록 안전하게 대문자 처리
        const resolvedRole = (
          parsed.role ||
          parsed.user_role ||
          parsed.Role ||
          "OPERATOR"
        ).toUpperCase();

        return {
          username: parsed.username || parsed.id || "admin",
          role: resolvedRole,
        };
      } catch {
        localStorage.clear();
        return null;
      }
    }
    return null;
  });

  const [page, setPage] = useState("dashboard"); // 'dashboard' | 'users'

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
      username: userInfo.username || userInfo.id || "admin",
      role: resolvedRole,
    };

    localStorage.setItem("user", JSON.stringify(userObj));
    setUser(userObj);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setPage("dashboard");
  };

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
