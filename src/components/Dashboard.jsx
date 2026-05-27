import { useState, useEffect, useRef } from "react";
import { SERVER_URL } from "../config";
import socket from "../socket";
import ContinuousDeviceCard from "./ContinuousDeviceCard";
import "./Dashboard.css";
import logoImg from "../assets/logo.png";

export default function Dashboard({ user, onLogout, onNavigate }) {
  // DB에서 불러온 장비 목록 마스터 데이터
  const [devices, setDevices] = useState([]);

  // 각 장비의 실시간 상태
  const [deviceStates, setDeviceStates] = useState({});

  // 실시간 로그 (최근 100개 — 장비별 필터링을 위해 넉넉히 보관)
  const [logs, setLogs] = useState([]);

  // 로그 탭 필터 ('ALL' 또는 장비 device_id)
  const [logTab, setLogTab] = useState("ALL");

  // 서버 연결 상태
  const [connected, setConnected] = useState(false);

  // 초기 데이터 로딩 상태
  const [loading, setLoading] = useState(true);

  // DB 누적 통계 (페이지 로드 시 서버에서 가져옴)
  const [dbStats, setDbStats] = useState({ ok: 0, ng: 0, total: 0 });

  // 실시간 세션 카운터 (Socket.IO로 받은 건수)
  const sessionOk = useRef(0);
  const sessionNg = useRef(0);

  // 🚀 성능 최적화: 실시간 데이터 버퍼 (즉시 렌더링 대신 300ms 간격으로 일괄 반영)
  const dataBuffer = useRef([]); // 소켓 수신 데이터를 임시로 쌓는 버퍼
  const flushTimerRef = useRef(null); // flush interval ID

  // 페이지 로드 시: API 데이터 로딩과 소켓 연결을 동시에 진행
  useEffect(() => {
    const token = localStorage.getItem("token");

    // 1) 소켓 연결 즉시 시작 (지연 방지)
    socket.connect();

    const fetchSummary = fetch(`${SERVER_URL}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    const fetchDevices = fetch(`${SERVER_URL}/api/devices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    const fetchRegisteredDevices = fetch(
      `${SERVER_URL}/api/devices/registered`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    Promise.all([fetchSummary, fetchDevices, fetchRegisteredDevices]).then(
      ([summaryData, devicesData, registeredData]) => {
        // 통계 반영
        if (summaryData) {
          setDbStats({
            ok: summaryData.ok_count || 0,
            ng: summaryData.ng_count || 0,
            total: summaryData.total_inspections || 0,
          });
        }

        // 등록된 장비 목록 반영
        if (registeredData && Array.isArray(registeredData)) {
          setDevices(registeredData);
          // deviceStates 기본 구조 초기화 (새로운 장비 추가 방어)
          setDeviceStates((prev) => {
            const initial = { ...prev };
            registeredData.forEach((d) => {
              if (!initial[d.device_id]) {
                initial[d.device_id] = {
                  status: "IDLE",
                  sequence: 0,
                  lastResult: null,
                  ngCount: 0,
                  okCount: 0,
                };
              }
            });
            return initial;
          });
        }

        // 장비 런타임 상태 반영 (RUN, STOP 등)
        if (devicesData && Array.isArray(devicesData)) {
          setDeviceStates((prev) => {
            const updated = { ...prev };
            devicesData.forEach((d) => {
              if (updated[d.device_id]) {
                const currentStatus = updated[d.device_id].status;
                // 소켓이 먼저 연결되어 이미 RUN, ERROR, LOCKED 상태를 받았다면 API 과거 데이터로 덮어쓰지 않음
                if (
                  currentStatus === "RUN" ||
                  currentStatus === "ERROR" ||
                  currentStatus === "LOCKED"
                ) {
                  return;
                }

                let status = d.status;
                // 서버에서는 돌고 있더라도 프론트엔드 새로고침 시 초기화 (소켓 데이터가 오면 다시 RUN됨)
                if (status === "RUN" || status === "ERROR") status = "IDLE";

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
      },
    );

    // 소켓 이벤트 리스너 등록 (connect 이전에 등록해도 문제없음)
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // 🚀 성능 최적화: 데이터를 즉시 렌더링하지 않고 버퍼에 쌓기만 함
    socket.on("mobile_data_feed", (data) => {
      dataBuffer.current.push(data);
    });

    // 🚀 성능 최적화: 150ms 간격으로 버퍼에 쌓인 데이터를 한 번에 State에 반영
    flushTimerRef.current = setInterval(() => {
      const buffered = dataBuffer.current;
      if (buffered.length === 0) return;

      // 버퍼를 즉시 비우고 복사본으로 작업 (다음 데이터가 밀려도 안전)
      dataBuffer.current = [];

      // 세션 카운터 일괄 업데이트 (ref이므로 렌더링 유발 없음)
      let okInc = 0;
      let ngInc = 0;

      // 로그 엔트리를 최신순(역순)으로 구성 — 가장 최근 데이터가 배열 앞에 위치
      const newLogEntries = [];
      for (let i = buffered.length - 1; i >= 0; i--) {
        const data = buffered[i];
        const header = data.header || {};
        const body = data.body || {};
        const visionResult = body.vision_result || {};

        if (visionResult.result === "OK") okInc += 1;
        if (visionResult.result === "NG") ngInc += 1;

        newLogEntries.push({
          id: `${header.device_id}-${body.sequence}-${Date.now()}-${Math.random()}`,
          device_id: header.device_id,
          sequence: body.sequence,
          result: visionResult.result,
          defect_type: visionResult.defect_type,
          status_codes: (body.status_info || []).map((s) => s.code).join(", "),
          timestamp: body.timestamp,
        });
      }

      sessionOk.current += okInc;
      sessionNg.current += ngInc;

      // 장비 상태 일괄 업데이트 (setState 1회만 호출)
      setDeviceStates((prev) => {
        const updated = { ...prev };
        for (const data of buffered) {
          const deviceId = (data.header || {}).device_id;
          const body = data.body || {};
          const visionResult = body.vision_result || {};
          const current = updated[deviceId] || {};

          const newStatus =
            current.status === "LOCKED"
              ? "LOCKED"
              : body.machine_status || "UNKNOWN";

          updated[deviceId] = {
            status: newStatus,
            sequence: body.sequence || 0,
            lastResult: visionResult.result || null,
            okCount:
              (current.okCount || 0) + (visionResult.result === "OK" ? 1 : 0),
            ngCount:
              (current.ngCount || 0) + (visionResult.result === "NG" ? 1 : 0),
          };
        }
        return updated;
      });

      // 로그 일괄 업데이트 (setState 1회만 호출, 이미 최신순으로 정렬됨)
      setLogs((prev) => [...newLogEntries, ...prev].slice(0, 100));
    }, 150);

    // (배치 완료 이벤트 제거됨 - 연속 가동만 사용)

    // 🔄 연속 가동 장비 종료 완료 이벤트
    socket.on("continuous_stopped_notify", (data) => {
      const deviceId = data.device_id;
      setDeviceStates((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          status: "IDLE", // 가동이 멈추면 전원이 켜진 대기 상태(IDLE)로 돌아감
        },
      }));
    });

    // CRITICAL 오류 → 장비 LOCKED 상태로 변경
    socket.on("critical_alert", (data) => {
      const deviceId = data.device_id;
      setDeviceStates((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          status: "LOCKED",
        },
      }));
      alert(
        `🚨 [${deviceId}] 치명적(CRITICAL) 오류 발생!\n에러 코드: ${(data.error_codes || []).join(", ")}\n장비가 잠금되었습니다. 모바일 앱에서 해제해 주세요.`,
      );
    });

    // 장비 잠금 해제 → IDLE로 복구
    socket.on("error_resolved", (data) => {
      const deviceId = data.device_id;
      setDeviceStates((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          status: "IDLE",
        },
      }));
    });

    // 잠긴 장비 시작 시도 차단 알림
    socket.on("start_blocked", (data) => {
      alert(`⛔ [${data.device_id}] ${data.reason}`);
    });

    return () => {
      // 🚀 flush 타이머 정리
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);

      socket.off("connect");
      socket.off("disconnect");
      socket.off("mobile_data_feed");
      socket.off("critical_alert");

      socket.off("error_resolved");
      socket.off("start_blocked");
      socket.off("continuous_stopped_notify");
      socket.disconnect();
    };
  }, []);

  // 전체 장비 동시 시작 (연속 가동)
  const handleStartAll = () => {
    devices.forEach((device) => {
      const state = deviceStates[device.device_id] || {};
      if (state.status !== "RUN" && state.status !== "LOCKED") {
        handleStartContinuous(device);
      }
    });
  };

  // 🔄 연속 가동 장비 시작 핸들러
  const handleStartContinuous = (device) => {
    const batchId = `CONT_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;

    socket.emit("ui_start_continuous", {
      device_id: device.device_id,
      batch_id: batchId,
      model_name: device.model_name,
    });

    setDeviceStates((prev) => ({
      ...prev,
      [device.device_id]: {
        ...prev[device.device_id],
        status: "IDLE",
        sequence: 0,
        ngCount: 0,
        okCount: 0,
        lastResult: null,
      },
    }));
  };

  // 🔄 연속 가동 장비 종료 핸들러
  const handleStopContinuous = (device) => {
    socket.emit("ui_stop_continuous", {
      device_id: device.device_id,
    });

    setDeviceStates((prev) => ({
      ...prev,
      [device.device_id]: {
        ...prev[device.device_id],
        status: "STOPPING",
      },
    }));
  };

  // 🔌 전원 ON 핸들러 (STOP -> IDLE)
  const handlePowerOn = (device) => {
    socket.emit("ui_power_on", { device_id: device.device_id });
    setDeviceStates((prev) => ({
      ...prev,
      [device.device_id]: { ...prev[device.device_id], status: "IDLE" },
    }));
  };

  // 🔌 전원 OFF 핸들러 (IDLE -> STOP)
  const handlePowerOff = (device) => {
    socket.emit("ui_power_off", { device_id: device.device_id });
    setDeviceStates((prev) => ({
      ...prev,
      [device.device_id]: { ...prev[device.device_id], status: "STOP", okCount: 0, ngCount: 0, sequence: 0 },
    }));
  };

  // 🔓 전체 장비 잠금 해제 (테스트용)
  const handleUnlockAll = () => {
    socket.emit("unlock_all_devices");
  };

  // 🔓 개별 장비 잠금 해제
  const handleUnlockContinuous = (device) => {
    socket.emit("unlock_device", { device_id: device.device_id });
  };

  // 💾 로그 내보내기 + 비우기 핸들러
  const handleExportAndClear = async () => {
    if (isAnyRunning) {
      alert(
        "\u26a0\ufe0f \uc7a5\ube44\uac00 \uac00\ub3d9 \uc911\uc77c \ub54c\ub294 \ub85c\uadf8\ub97c \ub0b4\ubcf4\ub0bc \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.",
      );
      return;
    }
    if (
      !confirm(
        "\ud604\uc7ac\uae4c\uc9c0\uc758 \ubaa8\ub4e0 \ub370\uc774\ud130 \ub85c\uadf8\ub97c CSV \ud30c\uc77c\ub85c \uc800\uc7a5\ud558\uace0,\nDB\ub97c \ube44\uc6b8\uae4c\uc694?",
      )
    )
      return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${SERVER_URL}/api/logs/export-and-clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert(
          `\u2705 ${data.message}\n\uc800\uc7a5 \ud30c\uc77c: ${data.file}`,
        );
        // \ud1b5\uacc4 \ucd08\uae30\ud654
        setDbStats({ ok: 0, ng: 0, total: 0 });
        sessionOk.current = 0;
        sessionNg.current = 0;
        setLogs([]);
      } else {
        alert(`\u274c ${data.error}`);
      }
    } catch (err) {
      alert("\u274c \uc11c\ubc84 \uc5f0\uacb0 \uc2e4\ud328");
    }
  };

  // \uc7a0\uae34 \uc7a5\ube44\uac00 \uc788\ub294\uc9c0 \ud655\uc778
  const lockedCount = Object.values(deviceStates).filter(
    (d) => d.status === "LOCKED",
  ).length;

  // 통계 계산 (DB 누적 + 실시간 세션)
  const totalOk = dbStats.ok + sessionOk.current;
  const totalNg = dbStats.ng + sessionNg.current;
  const totalInspections = totalOk + totalNg;
  const ngRate =
    totalInspections > 0
      ? ((totalNg / totalInspections) * 100).toFixed(1)
      : "0.0";
  const runningCount = Object.values(deviceStates).filter(
    (d) => d.status === "RUN" || d.status === "ERROR",
  ).length;
  const isAnyRunning = runningCount > 0;

  // ── 장비 가동 중 새로고침/창 닫기 방지 ──
  useEffect(() => {
    // 1. 브라우저 새로고침/닫기 팝업 띄우기
    const handleBeforeUnload = (e) => {
      if (isAnyRunning) {
        e.preventDefault();
        e.returnValue = ""; // 모던 브라우저에서는 빈 문자열로 두어야 기본 경고창이 뜸
        return "";
      }
    };

    // 2. 키보드 단축키 방지 (F5, Ctrl+R, Ctrl+F5 등)
    const handleKeyDown = (e) => {
      if (isAnyRunning) {
        // F5 누름 또는 Ctrl+R (Cmd+R) 누름
        if (
          e.key === "F5" ||
          ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"))
        ) {
          e.preventDefault();
          alert(
            "⚠️ 현재 장비 검사가 진행 중입니다. 단축키를 통한 새로고침이 차단되었습니다.",
          );
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAnyRunning]);

  // 페이지 이동 / 로그아웃 클릭 시 방어 로직
  const handleNavigateUser = () => {
    if (isAnyRunning) {
      alert(
        "⚠️ 현재 장비 검사가 진행 중입니다.\n데이터 유실을 막기 위해 검사가 모두 완료된 후 이동해주세요.",
      );
      return;
    }
    onNavigate("users");
  };

  const handleNavigateDevice = () => {
    if (isAnyRunning) {
      alert(
        "⚠️ 현재 장비 검사가 진행 중입니다.\n데이터 유실을 막기 위해 검사가 모두 완료된 후 이동해주세요.",
      );
      return;
    }
    onNavigate("devices");
  };

  const handleNavigateSchedule = () => {
    if (isAnyRunning) {
      alert("⚠️ 장비가 가동 중일 때는 이동할 수 없습니다.");
      return;
    }
    onNavigate("schedules");
  };

  const handleNavigateNotice = () => {
    if (isAnyRunning) {
      alert("⚠️ 장비가 가동 중일 때는 이동할 수 없습니다.");
      return;
    }
    onNavigate("notices");
  };

  const handleLogout = () => {
    if (isAnyRunning) {
      alert(
        "⚠️ 현재 장비 검사가 진행 중입니다.\n장비가 모두 정지된 후 로그아웃 해주세요.",
      );
      return;
    }
    onLogout();
  };

  // 로그 탭 필터링
  const filteredLogs =
    logTab === "ALL"
      ? logs.slice(0, 30)
      : logs.filter((log) => log.device_id === logTab).slice(0, 20);

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
          <div className="logo-container">
            <div className="logo-wrapper">
              <img src={logoImg} alt="VisionMate Logo" className="logo-image" />
            </div>
            <h1 className="header-title">Vision Mate</h1>
          </div>

          <div
            className={`connection-badge ${connected ? "connected" : "disconnected"}`}
          >
            <span className="badge-dot"></span>
            {connected ? "서버 연결됨" : "연결 끊김"}
          </div>
        </div>
        <div className="header-right">
          <span className="user-info">
            <span className="user-role">{user.role}</span>
            {user.username}
          </span>
          {(user.role === "MASTER" || user.role === "TECHNICIAN") && (
            <button
              className={`manage-users-btn schedule-btn ${isAnyRunning ? "disabled" : ""}`}
              onClick={handleNavigateSchedule}
            >
              📅 근무 일정 관리
            </button>
          )}
          {(user.role === "MASTER" || user.role === "TECHNICIAN") && (
            <button
              className={`manage-users-btn schedule-btn ${isAnyRunning ? "disabled" : ""}`}
              onClick={handleNavigateNotice}
            >
              📢 공지사항 관리
            </button>
          )}
          {user.role === "MASTER" && (
            <button
              className={`manage-users-btn schedule-btn ${isAnyRunning ? "disabled" : ""}`}
              onClick={handleNavigateDevice}
            >
              🔧 장비 관리
            </button>
          )}
          {user.role === "MASTER" && (
            <button
              className={`manage-users-btn schedule-btn ${isAnyRunning ? "disabled" : ""}`}
              onClick={handleNavigateUser}
            >
              👥 사용자 관리
            </button>
          )}
          <button
            className={`logout-btn ${isAnyRunning ? "disabled" : ""}`}
            onClick={handleLogout}
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="dashboard-body container">
        {/* 요약 카드 */}
        <section className="summary-row">
          <div className="summary-card">
            <span className="summary-label">가동 장비</span>
            <span className="summary-value blue">
              {runningCount} <small>/ {devices.length}</small>
            </span>
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

        {/* 전체 시작 버튼 + 잠금 해제 버튼 */}
        <div className="action-bar">
          <button className="start-all-btn" onClick={handleStartAll}>
            ▶ 전체 장비 검사 시작
          </button>
          {lockedCount > 0 && (
            <button
              className="start-all-btn"
              onClick={handleUnlockAll}
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                marginLeft: "12px",
              }}
            >
              🔓 전체 잠금 해제 ({lockedCount}대)
            </button>
          )}
          {(user.role === "MASTER" || user.role === "TECHNICIAN") && (
            <button
              className="start-all-btn"
              onClick={handleExportAndClear}
              disabled={isAnyRunning}
              style={{
                background: isAnyRunning
                  ? "#ccc"
                  : "linear-gradient(135deg, #6366f1, #4f46e5)",
                marginLeft: "12px",
                cursor: isAnyRunning ? "not-allowed" : "pointer",
              }}
            >
              💾 로그 내보내기 & 비우기
            </button>
          )}
        </div>

        {/* 장비 리스트 + 실시간 로그 */}
        <div className="main-grid">
          {/* 왼쪽: 장비 5개 세로 정렬 */}
          <section className="device-list">
            <h2 className="section-title">연속 검사 장비 목록</h2>
            {devices.map((device, idx) => (
              <ContinuousDeviceCard
                key={device.device_id}
                device={device}
                state={
                  deviceStates[device.device_id] || {
                    status: "IDLE",
                    okCount: 0,
                    ngCount: 0,
                    sequence: 0,
                  }
                }
                onStart={() => handleStartContinuous(device)}
                onStop={() => handleStopContinuous(device)}
                onUnlock={() => handleUnlockContinuous(device)}
                onPowerOn={() => handlePowerOn(device)}
                onPowerOff={() => handlePowerOff(device)}
                delay={idx * 80}
              />
            ))}
          </section>

          {/* 오른쪽: 실시간 로그 (탭 필터) */}
          <section className="log-panel">
            <h2 className="section-title">실시간 검사 로그</h2>
            <div className="log-tabs">
              <button
                className={`log-tab ${logTab === "ALL" ? "active" : ""}`}
                onClick={() => setLogTab("ALL")}
              >
                전체
              </button>
              {devices.map((d) => (
                <button
                  key={d.device_id}
                  className={`log-tab ${logTab === d.device_id ? "active" : ""}`}
                  onClick={() => setLogTab(d.device_id)}
                >
                  #{d.device_id.replace("RASP_PI_0", "")}
                </button>
              ))}
            </div>
            <div className="log-list">
              {filteredLogs.length === 0 ? (
                <p className="log-empty">
                  {logs.length === 0
                    ? "검사를 시작하면 로그가 여기에 표시됩니다."
                    : "이 장비의 로그가 아직 없습니다."}
                </p>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`log-item ${log.result === "NG" ? "log-ng" : "log-ok"}`}
                  >
                    <span className="log-device">{log.device_id}</span>
                    <span className="log-seq">#{log.sequence}</span>
                    <span
                      className={`log-result ${log.result === "NG" ? "ng" : "ok"}`}
                    >
                      {log.result}
                    </span>
                    {log.result === "NG" && (
                      <span className="log-defect">{log.defect_type}</span>
                    )}
                    {log.status_codes && log.result === "NG" && (
                      <span className="log-code">{log.status_codes}</span>
                    )}
                    <span className="log-time">
                      {log.timestamp?.split(" ")[1]}
                    </span>
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
