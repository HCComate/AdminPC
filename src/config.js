// 관리자 PC Flask 서버 주소 (같은 PC에서 실행 시 localhost)
// 실제 배포 시 관리자 PC의 사설 IP로 변경 (예: 'http://192.168.0.10:5000')
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';


