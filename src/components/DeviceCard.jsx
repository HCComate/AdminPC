import './DeviceCard.css';

export default function DeviceCard({ device, state, onStart, delay }) {
  const isRunning = state.status === 'RUN';
  const isError = state.status === 'ERROR';
  const isStopped = state.status === 'STOP';
  const isLocked = state.status === 'LOCKED';
  const progress = state.sequence;

  // 상태별 배지 텍스트 & 클래스
  const statusConfig = {
    IDLE: { text: '대기 중', className: 'idle' },
    RUN: { text: '가동 중', className: 'run' },
    ERROR: { text: '오류 발생', className: 'error' },
    STOP: { text: '검사 완료', className: 'stop' },
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
            {(isRunning || isError || isLocked) && <span className="status-pulse"></span>}
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

        {/* 프로그레스 바 (가동 중일 때만) */}
        {(isRunning || isError || isStopped || isLocked) && (
          <div className="progress-section">
            <div className="progress-bar-bg">
              <div
                className={`progress-bar-fill ${isError ? 'error' : ''}`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-stats">
              <span className="progress-count">{progress} / 100</span>
              <span className="progress-results">
                <span className="result-ok">OK {state.okCount}</span>
                <span className="result-ng">NG {state.ngCount}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 검사 시작 버튼 */}
      <button
        className={`inspect-btn ${isLocked ? 'locked' : ''}`}
        onClick={onStart}
        disabled={isRunning || isError || isStopped || isLocked}
      >
        {isLocked ? '🔒 장비 잠금' : (isRunning || isError) ? '검사 중...' : isStopped ? '검사 완료' : '검사 시작'}
      </button>
    </div>
  );
}
