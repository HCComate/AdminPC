import './DeviceCard.css';

// 연속 가동 장비 정의 (DB 장비 관리와 독립, 고정)
const CONTINUOUS_DEVICES = [
  { device_id: 'CONT_PI_01', name: '연속 검사 장비 #1', model_name: 'SMT_CONT_A10' },
  { device_id: 'CONT_PI_02', name: '연속 검사 장비 #2', model_name: 'SMT_CONT_B10' },
];

export { CONTINUOUS_DEVICES };

export default function ContinuousDeviceCard({ device, state, onStart, onStop, delay }) {
  const isRunning = state.status === 'RUN';
  const isError = state.status === 'ERROR';
  const isStopped = state.status === 'STOP';
  const isLocked = state.status === 'LOCKED';
  const isStopping = state.status === 'STOPPING';

  // 상태별 배지 텍스트 & 클래스
  const statusConfig = {
    IDLE: { text: '대기 중', className: 'idle' },
    RUN: { text: '연속 가동 중', className: 'run' },
    ERROR: { text: '오류 발생', className: 'error' },
    STOP: { text: '가동 종료', className: 'stop' },
    STOPPING: { text: '종료 중...', className: 'stop' },
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
          <h3 className="device-name">🔄 {device.name}</h3>
          <span className={`status-badge ${statusClass}`}>
            {(isRunning || isError || isLocked || isStopping) && <span className="status-pulse"></span>}
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

      {/* 시작/종료 버튼 */}
      {(isRunning || isError) ? (
        <button
          className="inspect-btn"
          onClick={onStop}
          disabled={isStopping}
          style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
        >
          {isStopping ? '종료 중...' : '⏹ 가동 종료'}
        </button>
      ) : (
        <button
          className={`inspect-btn ${isLocked ? 'locked' : ''}`}
          onClick={onStart}
          disabled={isLocked || isStopping}
        >
          {isLocked ? '🔒 장비 잠금' : isStopped ? '▶ 재가동' : '▶ 연속 가동'}
        </button>
      )}
    </div>
  );
}
