import './DeviceCard.css';

export default function ContinuousDeviceCard({ device, state, onStart, onStop, onUnlock, onPowerOn, onPowerOff, delay }) {
  const isRunning = state.status === 'RUN';
  const isError = state.status === 'ERROR';
  const isStopped = state.status === 'STOP'; // 전원 OFF 상태
  const isLocked = state.status === 'LOCKED';
  const isStopping = state.status === 'STOPPING';
  const isIdle = state.status === 'IDLE';

  // 상태별 배지 텍스트 & 클래스
  const statusConfig = {
    IDLE: { text: '대기 중 (유휴)', className: 'idle' },
    STANDBY: { text: '가동 준비 중...', className: 'idle' },
    RUN: { text: '가동 중', className: 'run' },
    ERROR: { text: '오류 발생', className: 'error' },
    STOP: { text: '전원 OFF', className: 'stop' },
    STOPPING: { text: '중지 중...', className: 'stop' },
    LOCKED: { text: '🔒 장비 잠금', className: 'locked' },
    UNKNOWN: { text: '알 수 없음', className: 'idle' },
  };

  const { text: statusText, className: statusClass } = statusConfig[state.status] || statusConfig.UNKNOWN;

  return (
    <div
      className={`device-card ${statusClass}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="device-info">
        {/* 장비 이름 & ID */}
        <div className="device-header">
          <h3 className="device-name">{device.name}</h3>
          <span className={`status-badge ${statusClass}`}>
            {(isRunning || isError || isLocked || isStopping || state.status === 'STANDBY') && <span className="status-pulse"></span>}
            {statusText}
          </span>
        </div>

        <div className="device-meta">
          <span className="meta-item">
            <span className="meta-label">ID</span>
            <span className="meta-value">{device.device_id}</span>
          </span>
          <span className="meta-item">
            <span className="meta-label">모델</span>
            <span className="meta-value">{device.model_name}</span>
          </span>
        </div>

        {/* 검사 카운트 (가동 중일 때만) */}
        {(isRunning || isError || isStopped || isLocked || isStopping) && (
          <div className="progress-stats">
            <span className="progress-count">총 검사: {state.sequence || 0}건</span>
            <span className="progress-results">
              <span className="result-ok">OK {state.okCount}</span>
              <span className="result-ng">NG {state.ngCount}</span>
            </span>
          </div>
        )}
      </div>

      {/* 시작/종료/전원 버튼 */}
      {isStopped ? (
        <button className="inspect-btn" onClick={onPowerOn} style={{ background: '#10b981' }}>
          💡 전원 ON
        </button>
      ) : isLocked ? (
        <button className="inspect-btn locked" onClick={onUnlock} style={{ cursor: 'pointer' }}>
          🔓 잠금 해제
        </button>
      ) : (isRunning || isError) ? (
        <button className="inspect-btn" onClick={onStop} disabled={isStopping} style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
          {isStopping ? '중지 중...' : '⏹ 가동 중지'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button className="inspect-btn" onClick={onPowerOff} style={{ background: '#6b7280', fontSize: '13px', padding: '12px 16px' }}>
            🔌 전원 OFF
          </button>
          <button className="inspect-btn" onClick={onStart} disabled={isStopping}>
            ▶ 가동 시작
          </button>
        </div>
      )}
    </div>
  );
}
