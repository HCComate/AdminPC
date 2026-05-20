import { useState, useEffect, useRef } from 'react';
import { DEVICES, SERVER_URL } from '../config';
import socket from '../socket';
import DeviceCard from './DeviceCard';
import './Dashboard.css';

export default function Dashboard({ user, onLogout, onNavigate }) {
  // 각 장비의 실시간 상태
  const [deviceStates, setDeviceStates] = useState(() => {
    const initial = {};
    DEVICES.forEach(d => {
      initial[d.device_id] = {
        status: 'IDLE',       // IDLE, RUN, ERROR, STOP
        sequence: 0,
        lastResult: null,     // OK, NG
        ngCount: 0,
        okCount: 0,
      };
    });
    return initial;
  });

  // 실시간 로그 (최근 100개 — 장비별 필터링을 위해 넉넉히 보관)
  const [logs, setLogs] = useState([]);

  // 로그 탭 필터 ('ALL' 또는 장비 device_id)
  const [logTab, setLogTab] = useState('ALL');

  // 서버 연결 상태
  const [connected, setConnected] = useState(false);

  // 초기 데이터 로딩 상태
  const [loading, setLoading] = useState(true);

  // DB 누적 통계 (페이지 로드 시 서버에서 가져옴)
  const [dbStats, setDbStats] = useState({ ok: 0, ng: 0, total: 0 });

  // 실시간 세션 카운터 (Socket.IO로 받은 건수)
  const sessionOk = useRef(0);
  const sessionNg = useRef(0);

  // 페이지 로드 시: API 데이터 로딩과 소켓 연결을 동시에 진행
  useEffect(() => {
    const token = localStorage.getItem('token');

    // 1) 소켓 연결 즉시 시작 (지연 방지)
    socket.connect();

    // 2) 대시보드 통계 + 장비 상태를 가져오기
    const fetchSummary = fetch(`${SERVER_URL}/api/dashboard/summary`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(res => res.ok ? res.json() : null).catch(() => null);

    const fetchDevices = fetch(`${SERVER_URL}/api/devices`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(res => res.ok ? res.json() : null).catch(() => null);

    Promise.all([fetchSummary, fetchDevices]).then(([summaryData, devicesData]) => {
      // 통계 반영
      if (summaryData) {
        setDbStats({
          ok: summaryData.ok_count || 0,
          ng: summaryData.ng_count || 0,
          total: summaryData.total_inspections || 0,
        });
      }

      // 장비 상태 반영
      if (devicesData && Array.isArray(devicesData)) {
        setDeviceStates(prev => {
          const updated = { ...prev };
          devicesData.forEach(d => {
            if (updated[d.device_id]) {
              const currentStatus = updated[d.device_id].status;
              // 소켓이 먼저 연결되어 이미 RUN, ERROR, LOCKED 상태를 받았다면 API 과거 데이터로 덮어쓰지 않음
              if (currentStatus === 'RUN' || currentStatus === 'ERROR' || currentStatus === 'LOCKED') {
                return;
              }

              let status = d.status;
              if (status === 'STOP') status = 'IDLE';
              // 서버에서는 돌고 있더라도 프론트엔드 새로고침 시 초기화 (소켓 데이터가 오면 다시 RUN됨)
              if (status === 'RUN' || status === 'ERROR') status = 'IDLE';

              updated[d.device_id] = {
                ...updated[d.device_id],
                status: status,
              };
            }
          });
          return updated;
        });
      }

      // 로딩 화면 종료
      setLoading(false);
    });

    // 소켓 이벤트 리스너 등록 (connect 이전에 등록해도 문제없음)
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // 모바일 앱에 포워딩되는 것과 동일한 데이터를 웹 UI에서도 수신
    socket.on('mobile_data_feed', (data) => {
      const header = data.header || {};
      const body = data.body || {};
      const deviceId = header.device_id;
      const visionResult = body.vision_result || {};

      // 실시간 세션 카운터 업데이트
      if (visionResult.result === 'OK') sessionOk.current += 1;
      if (visionResult.result === 'NG') sessionNg.current += 1;

      // 장비 상태 업데이트 (LOCKED 상태는 보호: 데이터가 와도 LOCKED를 유지)
      setDeviceStates(prev => {
        const current = prev[deviceId] || {};

        // LOCKED 상태인 장비는 status를 덮어쓰지 않음
        const newStatus = current.status === 'LOCKED'
          ? 'LOCKED'
          : (body.machine_status || 'UNKNOWN');

        return {
          ...prev,
          [deviceId]: {
            status: newStatus,
            sequence: body.sequence || 0,
            lastResult: visionResult.result || null,
            okCount: visionResult.result === 'OK'
              ? (current.okCount || 0) + 1
              : (current.okCount || 0),
            ngCount: visionResult.result === 'NG'
              ? (current.ngCount || 0) + 1
              : (current.ngCount || 0),
          }
        };
      });

      // 실시간 로그에 추가 (최근 100건 유지)
      const logEntry = {
        id: `${deviceId}-${body.sequence}-${Date.now()}`,
        device_id: deviceId,
        sequence: body.sequence,
        result: visionResult.result,
        defect_type: visionResult.defect_type,
        status_codes: (body.status_info || []).map(s => s.code).join(', '),
        timestamp: body.timestamp,
      };

      setLogs(prev => [logEntry, ...prev].slice(0, 100));
    });

    // 배치 완료 이벤트 수신 (장비 상태를 STOP으로 변경 → 3초 후 IDLE로 자동 복귀)
    socket.on('batch_complete_notify', (data) => {
      const deviceId = data.device_id;
      setDeviceStates(prev => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          status: 'STOP',
        }
      }));

      // 3초 후 IDLE 상태로 자동 복귀 (검사 버튼 재활성화)
      setTimeout(() => {
        setDeviceStates(prev => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            status: 'IDLE',
          }
        }));
      }, 3000);
    });

    // CRITICAL 오류 → 장비 LOCKED 상태로 변경
    socket.on('critical_alert', (data) => {
      const deviceId = data.device_id;
      setDeviceStates(prev => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          status: 'LOCKED',
        }
      }));
      alert(`🚨 [${deviceId}] 치명적(CRITICAL) 오류 발생!\n에러 코드: ${(data.error_codes || []).join(', ')}\n장비가 잠금되었습니다. 모바일 앱에서 해제해 주세요.`);
    });



    // 장비 잠금 해제 → IDLE로 복구
    socket.on('error_resolved', (data) => {
      const deviceId = data.device_id;
      setDeviceStates(prev => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          status: 'IDLE',
        }
      }));
    });

    // 잠긴 장비 시작 시도 차단 알림
    socket.on('start_blocked', (data) => {
      alert(`⛔ [${data.device_id}] ${data.reason}`);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('mobile_data_feed');
      socket.off('batch_complete_notify');
      socket.off('critical_alert');

      socket.off('error_resolved');
      socket.off('start_blocked');
      socket.disconnect();
    };
  }, []);

  // 검사 시작 버튼 핸들러
  const handleStartInspection = (device) => {
    const batchId = `BATCH_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;

    // 서버에 검사 시작 이벤트 전송
    socket.emit('ui_start_btn', {
      device_id: device.device_id,
      batch_id: batchId,
      model_name: device.model_name,
    });

    // 즉시 UI 상태를 IDLE로 전환 (서버 응답 대기 중 표시)
    setDeviceStates(prev => ({
      ...prev,
      [device.device_id]: {
        ...prev[device.device_id],
        status: 'IDLE',
        sequence: 0,
        ngCount: 0,
        okCount: 0,
        lastResult: null,
      }
    }));
  };

  // 전체 장비 동시 시작
  const handleStartAll = () => {
    DEVICES.forEach(device => {
      const state = deviceStates[device.device_id];
      if (state.status !== 'RUN' && state.status !== 'LOCKED') {
        handleStartInspection(device);
      }
    });
  };

  // 통계 계산 (DB 누적 + 실시간 세션)
  const totalOk = dbStats.ok + sessionOk.current;
  const totalNg = dbStats.ng + sessionNg.current;
  const totalInspections = totalOk + totalNg;
  const ngRate = totalInspections > 0 ? ((totalNg / totalInspections) * 100).toFixed(1) : '0.0';
  const runningCount = Object.values(deviceStates).filter(d => d.status === 'RUN').length;
  const isAnyRunning = runningCount > 0;

  // ── 장비 가동 중 새로고침/창 닫기 방지 ──
  useEffect(() => {
    // 1. 브라우저 새로고침/닫기 팝업 띄우기
    const handleBeforeUnload = (e) => {
      if (isAnyRunning) {
        e.preventDefault();
        e.returnValue = ''; // 모던 브라우저에서는 빈 문자열로 두어야 기본 경고창이 뜸
        return '';
      }
    };

    // 2. 키보드 단축키 방지 (F5, Ctrl+R, Ctrl+F5 등)
    const handleKeyDown = (e) => {
      if (isAnyRunning) {
        // F5 누름 또는 Ctrl+R (Cmd+R) 누름
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
          e.preventDefault();
          alert('⚠️ 현재 장비 검사가 진행 중입니다. 단축키를 통한 새로고침이 차단되었습니다.');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAnyRunning]);

  // 페이지 이동 / 로그아웃 클릭 시 방어 로직
  const handleNavigateUser = () => {
    if (isAnyRunning) {
      alert('⚠️ 현재 장비 검사가 진행 중입니다.\n데이터 유실을 막기 위해 검사가 모두 완료된 후 이동해주세요.');
      return;
    }
    onNavigate('users');
  };

  const handleNavigateSchedule = () => {
    if (isAnyRunning) {
      alert('⚠️ 장비가 가동 중일 때는 이동할 수 없습니다.');
      return;
    }
    onNavigate('schedules');
  };

  const handleNavigateNotice = () => {
    if (isAnyRunning) {
      alert('⚠️ 장비가 가동 중일 때는 이동할 수 없습니다.');
      return;
    }
    onNavigate('notices');
  };

  const handleLogout = () => {
    if (isAnyRunning) {
      alert('⚠️ 현재 장비 검사가 진행 중입니다.\n장비가 모두 정지된 후 로그아웃 해주세요.');
      return;
    }
    onLogout();
  };

  // 로그 탭 필터링
  const filteredLogs = logTab === 'ALL'
    ? logs.slice(0, 30)
    : logs.filter(log => log.device_id === logTab).slice(0, 20);

  // 로딩 중이면 로딩 화면 표시
  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p className="loading-text">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* 헤더 */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="header-title">🔬 Vision Mate</h1>
          <div className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
            <span className="badge-dot"></span>
            {connected ? '서버 연결됨' : '연결 끊김'}
          </div>
        </div>
        <div className="header-right">
          <span className="user-info">
            <span className="user-role">{user.role}</span>
            {user.username}
          </span>
          {(user.role === 'Master' || user.role === 'Technician') && (
            <button className={`manage-users-btn schedule-btn ${isAnyRunning ? 'disabled' : ''}`} onClick={handleNavigateSchedule}>
              📅 근무 일정 관리
            </button>
          )}
          {(user.role === 'Master' || user.role === 'Technician') && (
            <button className={`manage-users-btn notice-btn ${isAnyRunning ? 'disabled' : ''}`} onClick={handleNavigateNotice}>
              📢 공지사항 관리
            </button>
          )}
          {user.role === 'Master' && (
            <button className={`manage-users-btn ${isAnyRunning ? 'disabled' : ''}`} onClick={handleNavigateUser}>
              👥 사용자 관리
            </button>
          )}
          <button className={`logout-btn ${isAnyRunning ? 'disabled' : ''}`} onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      <div className="dashboard-body container">
        {/* 요약 카드 */}
        <section className="summary-row">
          <div className="summary-card">
            <span className="summary-label">가동 장비</span>
            <span className="summary-value blue">{runningCount} <small>/ {DEVICES.length}</small></span>
          </div>
          <div className="summary-card">
            <span className="summary-label">총 검사</span>
            <span className="summary-value">{totalInspections}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">OK</span>
            <span className="summary-value green">{totalOk}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">NG</span>
            <span className="summary-value red">{totalNg}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">불량률</span>
            <span className="summary-value yellow">{ngRate}%</span>
          </div>
        </section>

        {/* 전체 시작 버튼 */}
        <div className="action-bar">
          <button className="start-all-btn" onClick={handleStartAll}>
            ▶ 전체 장비 검사 시작
          </button>
        </div>

        {/* 장비 리스트 + 실시간 로그 */}
        <div className="main-grid">
          {/* 왼쪽: 장비 5개 세로 정렬 */}
          <section className="device-list">
            <h2 className="section-title">장비 목록</h2>
            {DEVICES.map((device, idx) => (
              <DeviceCard
                key={device.device_id}
                device={device}
                state={deviceStates[device.device_id]}
                onStart={() => handleStartInspection(device)}
                delay={idx * 80}
              />
            ))}
          </section>

          {/* 오른쪽: 실시간 로그 (탭 필터) */}
          <section className="log-panel">
            <h2 className="section-title">실시간 검사 로그</h2>
            <div className="log-tabs">
              <button
                className={`log-tab ${logTab === 'ALL' ? 'active' : ''}`}
                onClick={() => setLogTab('ALL')}
              >
                전체
              </button>
              {DEVICES.map(d => (
                <button
                  key={d.device_id}
                  className={`log-tab ${logTab === d.device_id ? 'active' : ''}`}
                  onClick={() => setLogTab(d.device_id)}
                >
                  #{d.device_id.replace('RASP_PI_0', '')}
                </button>
              ))}
            </div>
            <div className="log-list">
              {filteredLogs.length === 0 ? (
                <p className="log-empty">
                  {logs.length === 0
                    ? '검사를 시작하면 로그가 여기에 표시됩니다.'
                    : '이 장비의 로그가 아직 없습니다.'}
                </p>
              ) : (
                filteredLogs.map(log => (
                  <div
                    key={log.id}
                    className={`log-item ${log.result === 'NG' ? 'log-ng' : 'log-ok'}`}
                  >
                    <span className="log-device">{log.device_id}</span>
                    <span className="log-seq">#{log.sequence}</span>
                    <span className={`log-result ${log.result === 'NG' ? 'ng' : 'ok'}`}>
                      {log.result}
                    </span>
                    {log.result === 'NG' && (
                      <span className="log-defect">{log.defect_type}</span>
                    )}
                    {log.status_codes && log.result === 'NG' && (
                      <span className="log-code">{log.status_codes}</span>
                    )}
                    <span className="log-time">{log.timestamp?.split(' ')[1]}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
