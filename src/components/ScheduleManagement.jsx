import { useState, useEffect } from 'react';
import { SERVER_URL } from '../config';
import './ScheduleManagement.css';

export default function ScheduleManagement({ user, onBack }) {
  // YYYY-MM-DD 형식으로 오늘 날짜 초기화
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  
  const [allUsers, setAllUsers] = useState([]);
  const [scheduledUsers, setScheduledUsers] = useState(new Set());
  
  // 주요 일정 상태
  const [events, setEvents] = useState([]);
  const [newEventContent, setNewEventContent] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const token = localStorage.getItem('token');

  // 전체 사용자 불러오기 (사번, 이름 등을 표시하기 위함)
  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      } else {
        setError('사용자 목록을 불러올 수 없습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  // 특정 날짜의 확정된 스케줄 불러오기
  const fetchScheduleForDate = async (dateStr) => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/schedules?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // 해당 날짜에 할당된 유저의 ID들을 Set으로 저장
        const ids = new Set(data.map(u => u.id));
        setScheduledUsers(ids);
      } else {
        setError('스케줄 정보를 불러올 수 없습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 특정 날짜의 주요 일정 불러오기
  const fetchEventsForDate = async (dateStr) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/events?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 마운트 시 전체 유저 로드
  useEffect(() => {
    fetchAllUsers();
  }, []);

  // 날짜 변경 시 해당 날짜의 스케줄 및 일정 로드
  useEffect(() => {
    if (selectedDate) {
      fetchScheduleForDate(selectedDate);
      fetchEventsForDate(selectedDate);
    }
  }, [selectedDate]);

  // 알림 메시지 자동 제거
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // 체크박스 토글 핸들러
  const handleToggleUser = (userId) => {
    setScheduledUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // 저장 (현재 체크된 사람들을 해당 날짜의 스케줄로 덮어쓰기)
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${SERVER_URL}/api/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          user_ids: Array.from(scheduledUsers),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`${selectedDate} 근무 일정이 저장되었습니다.`);
      } else {
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 주요 일정 등록 핸들러
  const handleAddEvent = async () => {
    if (!newEventContent.trim()) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          content: newEventContent,
        }),
      });
      if (res.ok) {
        setNewEventContent('');
        fetchEventsForDate(selectedDate);
      } else {
        const data = await res.json();
        setError(data.error || '일정 등록에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  // 주요 일정 삭제 핸들러
  const handleDeleteEvent = async (id) => {
    if (!window.confirm('해당 일정을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/events/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        fetchEventsForDate(selectedDate);
      } else {
        setError('일정 삭제에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  return (
    <div className="schedule-mgmt">
      {/* 헤더 */}
      <header className="schedule-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>← 대시보드</button>
          <h1 className="header-title">📅 근무 일정 관리</h1>
        </div>
        <div className="header-right">
          <span className="user-info">
            <span className="user-role">{user.role}</span>
            {user.nickname || user.username}
          </span>
        </div>
      </header>

      <div className="schedule-body container">
        {/* 알림 메시지 */}
        {successMsg && <div className="msg-success">✅ {successMsg}</div>}
        {error && <div className="msg-error">⚠️ {error}</div>}

        <div className="schedule-control-card">
          <div className="date-picker-wrap">
            <label>근무 일자 선택</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
          </div>
          
          <button 
            className="save-btn" 
            onClick={handleSave} 
            disabled={loading || saving}
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>

        {/* 주요 일정 섹션 */}
        <div className="events-card">
          <h3 className="card-title">주요 일정 (Event)</h3>
          <div className="event-input-group">
            <input 
              type="text" 
              value={newEventContent}
              onChange={(e) => setNewEventContent(e.target.value)}
              placeholder="일정 내용 입력 (예: 프로젝트 마감 D-3)"
              className="event-input"
              onKeyPress={(e) => e.key === 'Enter' && handleAddEvent()}
            />
            <button className="add-event-btn" onClick={handleAddEvent}>추가</button>
          </div>
          <ul className="events-list">
            {events.length === 0 ? (
              <li className="no-events">해당 날짜에 등록된 주요 일정이 없습니다.</li>
            ) : (
              events.map(ev => (
                <li key={ev.id} className="event-item">
                  <span className="event-content">{ev.content}</span>
                  <button 
                    className="delete-event-btn" 
                    onClick={() => handleDeleteEvent(ev.id)}
                    title="일정 삭제"
                  >
                    🗑️
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="users-list-card">
          <h3 className="card-title">
            해당 날짜 근무자 선택 ({scheduledUsers.size}명 선택됨)
          </h3>
          
          {loading ? (
            <p className="loading-text">데이터를 불러오는 중입니다...</p>
          ) : (
            <div className="users-grid">
              {allUsers.map(u => {
                const isSelected = scheduledUsers.has(u.id);
                return (
                  <div 
                    key={u.id} 
                    className={`user-check-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleUser(u.id)}
                  >
                    <div className="check-indicator">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        readOnly
                      />
                    </div>
                    <div className="user-info-text">
                      <div className="user-name-role">
                        <strong>{u.nickname || u.username}</strong>
                        <span className="role-text">{u.role}</span>
                      </div>
                      <div className="user-emp-id">
                        사번: {u.emp_id || '없음'} | ID: {u.username}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {allUsers.length === 0 && (
                <p className="no-data">등록된 사용자가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
