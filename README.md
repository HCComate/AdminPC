# HCComate - AdminPC UI (Web Dashboard)

HCComate의 데스크톱 환경 관리자 전용 프론트엔드 모듈입니다. 다수의 장비 동작 상태를 한눈에 파악할 수 있는 관제(Monitoring) 대시보드를 제공합니다.

## 🛠 기술 스택

- **Core**: React 18, Vite
- **Networking**: Socket.IO Client (실시간 웹소켓 통신), Fetch API
- **Charts/UI**: Recharts (검사 통계 차트), 순수 CSS(Vanilla CSS)를 활용한 커스텀 UI

## ✨ 핵심 컴포넌트 및 기능

- **`Dashboard.jsx`**: 전체 시스템의 모니터링 상황판입니다. Socket.io를 통해 실시간으로 장비 상태(`IDLE`, `STANDBY`, `RUN`, `LOCKED`, `STOP`)를 업데이트하고, 상태별로 색상과 애니메이션(Pulse)을 부여하여 시각적 인지력을 극대화했습니다. 낙관적 UI 업데이트(Optimistic UI)가 적용되어 조작 시 즉각적인 반응성을 제공합니다.
- **`ContinuousDeviceCard.jsx`**: 개별 장비의 가동률, 양품/불량 카운트를 표시하고, 전원 조작 및 가동/중지 버튼을 제공하는 컴포넌트입니다.
- **`DeviceManagement.jsx`**: 장비를 서버에 등록/삭제하고, 전담 담당자를 배정하며, 장비별 `STANDBY -> IDLE` 전환 타임아웃(초)을 설정하는 CRUD 인터페이스입니다.
- **공지사항 / 스케줄 관리**: 사내 작업 스케줄 및 공지를 공유할 수 있는 커뮤니케이션 도구가 탑재되어 있습니다.

## 🚀 실행 방법

```bash
# 패키지 설치
npm install

# 개발 서버 구동 (기본 포트: 5173)
npm run dev
```

> **Note**: 환경 변수 또는 `src/config.js`를 통해 백엔드 소켓 주소(`http://localhost:5000`)와의 연결을 확인하세요.
