import { useState, useEffect } from 'react';
import { SERVER_URL } from '../config';
import './NoticeManagement.css';

export default function NoticeManagement({ user, onBack }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 새 공지 작성 폼
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newIsImportant, setNewIsImportant] = useState(false);

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 펼쳐볼 공지 ID
  const [expandedId, setExpandedId] = useState(null);

  const token = localStorage.getItem('token');

  // 공지사항 목록 로드
  const fetchNotices = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/notices`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotices(data);
      } else {
        setError('공지사항을 불러올 수 없습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  // 알림 메시지 자동 제거
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // 공지 등록
  const handleCreateNotice = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/notices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          is_important: newIsImportant,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('공지사항이 등록되었습니다.');
        setNewTitle('');
        setNewContent('');
        setNewIsImportant(false);
        setShowForm(false);
        fetchNotices();
      } else {
        setError(data.error || '등록에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  // 삭제 확인
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/notices/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`공지 "${deleteTarget.title}" 이(가) 삭제되었습니다.`);
        setDeleteTarget(null);
        fetchNotices();
      } else {
        setError(data.error || '삭제에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
  };

  // 날짜 포맷 함수 (2026-05-19 21:04:13 → 2026.05.19 오후 9:04)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? '오후' : '오전';
      hours = hours % 12 || 12;
      return `${yyyy}.${mm}.${dd} ${ampm} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="notice-mgmt">
      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="notice-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="notice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notice-modal-icon">⚠️</div>
            <h3 className="notice-modal-title">공지사항 삭제</h3>
            <p className="notice-modal-text">
              정말로 <strong>"{deleteTarget.title}"</strong> 공지를 삭제하시겠습니까?
            </p>
            <p className="notice-modal-sub">이 작업은 되돌릴 수 없습니다.</p>
            <div className="notice-modal-actions">
              <button className="modal-cancel-btn" onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="modal-confirm-btn" onClick={handleDeleteConfirm}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="notice-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>← 대시보드</button>
          <h1 className="header-title">📢 공지사항 관리</h1>
        </div>
        <div className="header-right">
          <span className="user-info">
            <span className="user-role">{user.role}</span>
            {user.nickname || user.username}
          </span>
        </div>
      </header>

      <div className="notice-body container">
        {/* 알림 메시지 */}
        {successMsg && <div className="msg-success">✅ {successMsg}</div>}
        {error && <div className="msg-error">⚠️ {error}</div>}

        {/* 액션 바 */}
        <div className="notice-action-bar">
          <h2 className="section-title">전체 공지 ({notices.length}건)</h2>
          <button
            className="add-notice-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '✕ 취소' : '+ 새 공지 작성'}
          </button>
        </div>

        {/* 새 공지 작성 폼 */}
        {showForm && (
          <form className="notice-create-form" onSubmit={handleCreateNotice}>
            <div className="form-group">
              <label>제목</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="공지 제목을 입력하세요"
                required
              />
            </div>
            <div className="form-group">
              <label>내용</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="공지 내용을 입력하세요"
                rows={5}
                required
              />
            </div>
            <div className="form-footer">
              <label className="important-toggle">
                <input
                  type="checkbox"
                  checked={newIsImportant}
                  onChange={(e) => setNewIsImportant(e.target.checked)}
                />
                <span className="important-label">🔴 [중요] 표시</span>
              </label>
              <button type="submit" className="form-submit-btn">공지 등록</button>
            </div>
          </form>
        )}

        {/* 공지 목록 */}
        {loading ? (
          <p className="loading-text">불러오는 중...</p>
        ) : notices.length === 0 ? (
          <div className="notice-empty">
            <span className="empty-icon">📭</span>
            <p>등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="notice-list">
            {notices.map(n => (
              <div
                key={n.id}
                className={`notice-card ${n.is_important ? 'important' : ''} ${expandedId === n.id ? 'expanded' : ''}`}
              >
                <div
                  className="notice-card-header"
                  onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                >
                  <div className="notice-meta">
                    {n.is_important === 1 && <span className="important-badge">중요</span>}
                    <span className="notice-date">{formatDate(n.created_at)}</span>
                  </div>
                  <h3 className="notice-title">{n.title}</h3>
                  <p className="notice-preview">
                    {n.content.length > 80 ? n.content.slice(0, 80) + '...' : n.content}
                  </p>
                </div>

                {expandedId === n.id && (
                  <div className="notice-card-body">
                    <div className="notice-full-content">{n.content}</div>
                    <div className="notice-card-actions">
                      <button
                        className="notice-delete-btn"
                        onClick={() => setDeleteTarget({ id: n.id, title: n.title })}
                      >
                        🗑️ 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
