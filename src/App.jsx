import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import UserManagement from './components/UserManagement';
import ScheduleManagement from './components/ScheduleManagement';
import NoticeManagement from './components/NoticeManagement';
import DeviceManagement from './components/DeviceManagement';

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard'); // 'dashboard' | 'users'

  // 새로고침 시 localStorage에서 로그인 상태 복원
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLoginSuccess = (data) => {
    setUser({ username: data.username, role: data.role });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPage('dashboard');
  };

  // 로그인 안 됐으면 로그인 화면
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (page === 'users' && user.role === 'MASTER') {
    return (
      <UserManagement
        user={user}
        onBack={() => setPage('dashboard')}
      />
    );
  }

  // 근무 일정 관리 페이지 (MASTER, TECHNICIAN 접근 가능)
  if (page === 'schedules' && (user.role === 'MASTER' || user.role === 'TECHNICIAN')) {
    return (
      <ScheduleManagement
        user={user}
        onBack={() => setPage('dashboard')}
      />
    );
  }

  // 공지사항 관리 페이지 (MASTER, TECHNICIAN 접근 가능)
  if (page === 'notices' && (user.role === 'MASTER' || user.role === 'TECHNICIAN')) {
    return (
      <NoticeManagement
        user={user}
        onBack={() => setPage('dashboard')}
      />
    );
  }

  // 장비 관리 페이지 (MASTER 전용)
  if (page === 'devices' && user.role === 'MASTER') {
    return (
      <DeviceManagement
        user={user}
        onBack={() => setPage('dashboard')}
      />
    );
  }

  // 메인 대시보드
  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onNavigate={setPage}
    />
  );
}
