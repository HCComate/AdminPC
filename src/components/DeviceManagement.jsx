import { useState, useEffect } from 'react';
import { SERVER_URL } from '../config';
import './DeviceManagement.css';

export default function DeviceManagement({ user, onBack }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 새 장비 등록 폼
  const [showForm, setShowForm] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newName, setNewName] = useState('');
  const [newModelName, setNewModelName] = useState('');

  // 삭제 확인 모달 상태
  const [deleteTarget, setDeleteTarget] = useState(null); // { device_id, name }

  const token = localStorage.getItem('token');

  // 장비 목록 로드
  const fetchDevices = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/devices/registered`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      } else {
        setError('장비 목록을 불러올 수 없습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // 알림 메시지 자동 제거
  useEffect(() => {
    let timer;
    if (successMsg || error) {
      timer = setTimeout(() => {
        setSuccessMsg('');
        setError('');
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [successMsg, error]);

  // 삭제 버튼 클릭 → 확인 모달 열기
  const handleDeleteClick = (deviceId, name) => {
    setDeleteTarget({ device_id: deviceId, name });
  };

  // 삭제 확인 → 실제 삭제 수행
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { device_id: deviceId, name } = deleteTarget;
    setDeleteTarget(null);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/devices/registered/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`${name} 장비가 삭제되었습니다.`);
        fetchDevices();
      } else {
        setError(data.error || '삭제에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  // 장비 등록
  const handleCreateDevice = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/devices/registered`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          device_id: newDeviceId,
          name: newName,
          model_name: newModelName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`${newName} 장비가 등록되었습니다.`);
        setNewDeviceId('');
        setNewName('');
        setNewModelName('');
        setShowForm(false);
        fetchDevices();
      } else {
        setError(data.error || '등록에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  return (
    <div className="device-mgmt">
      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="delete-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon">⚠️</div>
            <h3 className="delete-modal-title">장비 삭제</h3>
            <p className="delete-modal-text">
              정말로 <strong>'{deleteTarget.name}' ({deleteTarget.device_id})</strong> 장비를 삭제하시겠습니까?
            </p>
            <p className="delete-modal-sub">이 작업은 되돌릴 수 없습니다. 가동 중이거나 오류 상태인 장비는 삭제할 수 없습니다.</p>
            <div className="delete-modal-actions">
              <button className="modal-cancel-btn" onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="modal-confirm-btn" onClick={handleDeleteConfirm}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="device-mgmt-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>← 대시보드</button>
          <h1 className="header-title">🔧 장비 관리</h1>
        </div>
        <div className="header-right">
          <span className="user-info">
            <span className="user-role">{user.role}</span>
            {user.username}
          </span>
        </div>
      </header>

      <div className="device-mgmt-body container">
        {/* 알림 메시지 */}
        {successMsg && <div className="msg-success">✅ {successMsg}</div>}
        {error && <div className="msg-error">⚠️ {error}</div>}

        {/* 액션 바 */}
        <div className="action-bar">
          <h2 className="section-title">등록된 장비 ({devices.length}대)</h2>
          <button
            className="add-device-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '✕ 취소' : '+ 새 장비 등록'}
          </button>
        </div>

        {/* 새 장비 등록 폼 */}
        {showForm && (
          <form className="create-form" onSubmit={handleCreateDevice}>
            <div className="form-row">
              <div className="form-field">
                <label>장비 ID</label>
                <input
                  type="text"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value.toUpperCase())}
                  placeholder="예: RASP_PI_06"
                  required
                />
              </div>
              <div className="form-field">
                <label>장비명</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 비전검사 장비 #6"
                  required
                />
              </div>
              <div className="form-field">
                <label>모델명</label>
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="예: SMT_CHIP_D50"
                  required
                />
              </div>
              <button type="submit" className="form-submit-btn">등록</button>
            </div>
          </form>
        )}

        {/* 장비 테이블 */}
        {loading ? (
          <p className="loading-text">불러오는 중...</p>
        ) : (
          <div className="device-table-wrap">
            <table className="device-table">
              <thead>
                <tr>
                  <th>순번</th>
                  <th>장비 ID</th>
                  <th>장비명</th>
                  <th>검사 모델명</th>
                  <th>등록일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d, index) => (
                  <tr key={d.device_id}>
                    <td className="td-id">{index + 1}</td>
                    <td className="td-deviceid">
                      <strong>{d.device_id}</strong>
                    </td>
                    <td className="td-name">{d.name}</td>
                    <td className="td-model">{d.model_name}</td>
                    <td className="td-date">{d.created_at}</td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteClick(d.device_id, d.name)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {devices.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-row">등록된 장비가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
