// 관리자 PC Flask 서버 주소 (같은 PC에서 실행 시 localhost)
// 실제 배포 시 관리자 PC의 사설 IP로 변경 (예: 'http://192.168.0.10:5000')
export const SERVER_URL = 'http://localhost:5000';

// 장비 목록 (5대의 가상 비전검사 장비)
export const DEVICES = [
  { device_id: 'RASP_PI_01', name: '비전검사 장비 #1', model_name: 'SMT_CHIP_A20' },
  { device_id: 'RASP_PI_02', name: '비전검사 장비 #2', model_name: 'SMT_CHIP_A20' },
  { device_id: 'RASP_PI_03', name: '비전검사 장비 #3', model_name: 'SMT_CHIP_B15' },
  { device_id: 'RASP_PI_04', name: '비전검사 장비 #4', model_name: 'SMT_CHIP_B15' },
  { device_id: 'RASP_PI_05', name: '비전검사 장비 #5', model_name: 'SMT_CHIP_C10' },
];
