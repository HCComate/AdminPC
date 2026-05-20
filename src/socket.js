import { io } from 'socket.io-client';
import { SERVER_URL } from './config';

// Socket.IO 클라이언트 (싱글톤)
const socket = io(SERVER_URL, {
  autoConnect: false,   // 수동 연결 (로그인 후 연결)
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
});

export default socket;
