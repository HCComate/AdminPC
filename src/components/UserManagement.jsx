import { useState, useEffect } from 'react';
import { SERVER_URL } from '../config';
import './UserManagement.css';

const ROLES = ['OPERATOR', 'TECHNICIAN', 'MASTER'];

const ROLE_LABELS = {
  OPERATOR: '작업자',
  TECHNICIAN: '엔지니어',
  MASTER: '관리자',
};

const ROLE_COLORS = {
  OPERATOR: 'role-operator',
  TECHNICIAN: 'role-technician',
  MASTER: 'role-master',
};

export default function UserManagement({ user, onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 새 사용자 등록 폼
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('OPERATOR');
  const [newNickname, setNewNickname] = useState('');
  const [newEmpId, setNewEmpId] = useState('');

  // 닉네임 수정 상태
  const [editingUserId, setEditingUserId] = useState(null);
  const [tempNickname, setTempNickname] = useState('');

  // 삭제 확인 모달 상태
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, username }

  const token = localStorage.getItem('token');

  // 사용자 목록 로드
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        setError('사용자 목록을 불러올 수 없습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 알림 메시지 자동 제거
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // 권한 변경
  const handleRoleChange = async (userId, username, newRole) => {
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`${username}의 권한이 ${ROLE_LABELS[newRole]}(으)로 변경되었습니다.`);
        fetchUsers();
      } else {
        setError(data.error || '권한 변경에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  // 닉네임 수정 모드 진입
  const handleEditNickname = (userObj) => {
    setEditingUserId(userObj.id);
    setTempNickname(userObj.nickname);
  };

  // 닉네임 저장
  const handleSaveNickname = async (userId, username) => {
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname: tempNickname }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`${username}의 이름(닉네임)이 변경되었습니다.`);
        setEditingUserId(null);
        fetchUsers();
      } else {
        setError(data.error || '이름 변경에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  // 삭제 버튼 클릭 → 확인 모달 열기
  const handleDeleteClick = (userId, username) => {
    setDeleteTarget({ id: userId, username });
  };

  // 삭제 확인 → 실제 삭제 수행
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id: userId, username } = deleteTarget;
    setDeleteTarget(null);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`${username} 계정이 삭제되었습니다.`);
        fetchUsers();
      } else {
        setError(data.error || '삭제에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  // 사용자 등록
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
          nickname: newNickname,
          emp_id: newEmpId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`${newUsername} 계정이 등록되었습니다.`);
        setNewUsername('');
        setNewPassword('');
        setNewRole('OPERATOR');
        setNewNickname('');
        setNewEmpId('');
        setShowForm(false);
        fetchUsers();
      } else {
        setError(data.error || '등록에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  return (
    <div className="user-mgmt">
      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="delete-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon">⚠️</div>
            <h3 className="delete-modal-title">사용자 삭제</h3>
            <p className="delete-modal-text">
              정말로 <strong>'{deleteTarget.username}'</strong> 계정을 삭제하시겠습니까?
            </p>
            <p className="delete-modal-sub">이 작업은 되돌릴 수 없습니다.</p>
            <div className="delete-modal-actions">
              <button className="modal-cancel-btn" onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="modal-confirm-btn" onClick={handleDeleteConfirm}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="user-mgmt-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>← 대시보드</button>
          <h1 className="header-title">👥 사용자 관리</h1>
        </div>
        <div className="header-right">
          <span className="user-info">
            <span className="user-role">{user.role}</span>
            {user.username}
          </span>
        </div>
      </header>

      <div className="user-mgmt-body container">
        {/* 알림 메시지 */}
        {successMsg && <div className="msg-success">✅ {successMsg}</div>}
        {error && <div className="msg-error">⚠️ {error}</div>}

        {/* 액션 바 */}
        <div className="action-bar">
          <h2 className="section-title">등록된 사용자 ({users.length}명)</h2>
          <button
            className="add-user-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '✕ 취소' : '+ 새 사용자 등록'}
          </button>
        </div>

        {/* 새 사용자 등록 폼 */}
        {showForm && (
          <form className="create-form" onSubmit={handleCreateUser}>
            <div className="form-row">
              <div className="form-field">
                <label>사번</label>
                <input
                  type="text"
                  value={newEmpId}
                  onChange={(e) => setNewEmpId(e.target.value)}
                  placeholder="예: 2111111"
                  required
                />
              </div>
              <div className="form-field">
                <label>이름 (닉네임)</label>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="예: 홍길동"
                  required
                />
              </div>
              <div className="form-field">
                <label>아이디</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="로그인 아이디"
                  required
                />
              </div>
              <div className="form-field">
                <label>비밀번호</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="비밀번호"
                  required
                />
              </div>
              <div className="form-field">
                <label>직급</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="form-submit-btn">등록</button>
            </div>
          </form>
        )}

        {/* 사용자 테이블 */}
        {loading ? (
          <p className="loading-text">불러오는 중...</p>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>사번</th>
                  <th>아이디</th>
                  <th>이름 (닉네임)</th>
                  <th>직급</th>
                  <th>상태</th>
                  <th>권한 변경</th>
                  <th>생성일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => (
                  <tr key={u.id}>
                    <td className="td-id">{index + 1}</td>
                    <td className="td-empid">{u.emp_id}</td>
                    <td className="td-username">
                      {u.username}
                      {u.username === user.username && (
                        <span className="me-badge">나</span>
                      )}
                    </td>
                    <td className="td-nickname">
                      {editingUserId === u.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={tempNickname}
                            onChange={(e) => setTempNickname(e.target.value)}
                            style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <button onClick={() => handleSaveNickname(u.id, u.username)} style={{ padding: '4px 8px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>저장</button>
                          <button onClick={() => setEditingUserId(null)} style={{ padding: '4px 8px', background: '#999', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>취소</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <strong>{u.nickname}</strong>
                          <button onClick={() => handleEditNickname(u)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#666', padding: '2px' }} title="이름(닉네임) 수정">
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`role-badge ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${u.is_online ? 'online' : 'offline'}`}>
                        {u.is_online ? '🟢 근무 중' : '⚪ 퇴근'}
                      </span>
                    </td>
                    <td>
                      <select
                        className="role-select"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, u.username, e.target.value)}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="td-date">{u.created_at}</td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteClick(u.id, u.username)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
